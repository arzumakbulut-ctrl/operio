import { describe, it, expect, vi } from 'vitest';

vi.unmock('../../src/utils/sanitize');
vi.unmock('../../src/utils/response');

const { sanitizeString, sanitizeObject, escapeLike, isValidUUID, encodeHTML, checkInstitutionAccess } =
  await import('../../src/utils/sanitize');

describe('Sanitize Utility', () => {

  describe('sanitizeString', () => {
    it('null byte temizlemeli', () => {
      expect(sanitizeString('hello\x00world')).toBe('helloworld');
    });

    it('kontrol karakterlerini temizlemeli', () => {
      expect(sanitizeString('hello\x01\x08world')).toBe('helloworld');
    });

    it('tab ve newline korumalı (yasal whitespace)', () => {
      const result = sanitizeString('hello\tworld\nnewline');
      expect(result).toContain('hello');
      expect(result).toContain('world');
    });

    it('normal string değiştirmemeli', () => {
      expect(sanitizeString('Ameliyat Notu')).toBe('Ameliyat Notu');
    });

    it('string olmayan değerleri olduğu gibi döndürmeli', () => {
      expect(sanitizeString(42)).toBe(42);
      expect(sanitizeString(null)).toBe(null);
    });

    it('trim yapmalı', () => {
      expect(sanitizeString('  test  ')).toBe('test');
    });
  });

  describe('sanitizeObject', () => {
    it('iç içe nesneleri temizlemeli', () => {
      const dirty = {
        name:    'Dr. Ahmet\x00',
        address: { city: 'İstanbul\x01' },
        tags:    ['surgery\x00', 'ortho'],
      };
      const clean = sanitizeObject(dirty);
      expect(clean.name).toBe('Dr. Ahmet');
      expect(clean.address.city).toBe('İstanbul');
      expect(clean.tags[0]).toBe('surgery');
    });

    it('null değerleri korumalı', () => {
      expect(sanitizeObject(null)).toBe(null);
    });

    it('sayıları değiştirmemeli', () => {
      const obj = { count: 42, rate: 3.14 };
      expect(sanitizeObject(obj)).toEqual({ count: 42, rate: 3.14 });
    });
  });

  describe('escapeLike', () => {
    it('wildcard karakterleri escape etmeli', () => {
      expect(escapeLike('50%')).toBe('50\\%');
      expect(escapeLike('name_')).toBe('name\\_');
      expect(escapeLike('back\\slash')).toBe('back\\\\slash');
    });

    it('normal string değiştirmemeli', () => {
      expect(escapeLike('Ahmet Yılmaz')).toBe('Ahmet Yılmaz');
    });
  });

  describe('isValidUUID', () => {
    it('geçerli UUID kabul etmeli', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('6ba7b810-9dad-41d1-80b4-00c04fd430c8')).toBe(true);
    });

    it('geçersiz formatı reddetmeli', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('12345')).toBe(false);
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID('injection\'; DROP TABLE users; --')).toBe(false);
    });
  });

  describe('encodeHTML', () => {
    it('XSS payload encode etmeli', () => {
      expect(encodeHTML('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;&#x2F;script&gt;');
    });

    it('& karakterini encode etmeli', () => {
      expect(encodeHTML('AT&T')).toBe('AT&amp;T');
    });

    it('tırnak işaretlerini encode etmeli', () => {
      expect(encodeHTML('"quoted"')).toBe('&quot;quoted&quot;');
      expect(encodeHTML("'single'")).toBe('&#x27;single&#x27;');
    });
  });

  describe('checkInstitutionAccess', () => {
    it('Üst Yönetici (role=0) her kuruma erişebilmeli', () => {
      expect(checkInstitutionAccess({
        resourceInstitutionId: 'inst-A',
        userInstitutionId:     'inst-B',
        userRoleId:            0,
      })).toBe(true);
    });

    it('aynı kurum erişim izni vermeli', () => {
      expect(checkInstitutionAccess({
        resourceInstitutionId: 'inst-A',
        userInstitutionId:     'inst-A',
        userRoleId:            1,
      })).toBe(true);
    });

    it('farklı kurum erişim reddetmeli (IDOR koruması)', () => {
      expect(checkInstitutionAccess({
        resourceInstitutionId: 'inst-A',
        userInstitutionId:     'inst-B',
        userRoleId:            6,
      })).toBe(false);
    });
  });

});

// ── RESPONSE YARDIMCILARı ─────────────────────────────────────

const response = await import('../../src/utils/response');

describe('Response Utility', () => {
  function mockRes() {
    const res = {
      _status: 200,
      _body:   null,
      status(code) { this._status = code; return this; },
      json(body)   { this._body = body; return this; },
      send()       { return this; },
    };
    return res;
  }

  it('ok — 200 ve success:true döndürmeli', () => {
    const res = mockRes();
    response.ok(res, { id: 1 });
    expect(res._status).toBe(200);
    expect(res._body.success).toBe(true);
    expect(res._body.data).toEqual({ id: 1 });
  });

  it('created — 201 döndürmeli', () => {
    const res = mockRes();
    response.created(res, { id: 'new' });
    expect(res._status).toBe(201);
    expect(res._body.success).toBe(true);
  });

  it('notFound — 404 ve hata kodu döndürmeli', () => {
    const res = mockRes();
    response.notFound(res, 'Ameliyat');
    expect(res._status).toBe(404);
    expect(res._body.success).toBe(false);
    expect(res._body.error.code).toBe('NOT_FOUND');
    expect(res._body.error.message).toContain('Ameliyat');
  });

  it('unauthorized — 401 döndürmeli', () => {
    const res = mockRes();
    response.unauthorized(res);
    expect(res._status).toBe(401);
    expect(res._body.error.code).toBe('UNAUTHORIZED');
  });

  it('forbidden — 403 döndürmeli', () => {
    const res = mockRes();
    response.forbidden(res);
    expect(res._status).toBe(403);
    expect(res._body.error.code).toBe('FORBIDDEN');
  });

  it('badRequest — detay içermeli', () => {
    const res = mockRes();
    response.badRequest(res, 'Hata', [{ field: 'email', message: 'Geçersiz' }]);
    expect(res._status).toBe(400);
    expect(res._body.error.details).toBeDefined();
  });

  it('ok — meta bilgisi eklenmeli', () => {
    const res  = mockRes();
    const meta = { total: 100, page: 1 };
    response.ok(res, [], meta);
    expect(res._body.meta).toEqual(meta);
  });
});
