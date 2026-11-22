import { describe, it, expect, vi, afterEach } from 'vitest';

const { createPendingConfirmation, resolvePendingConfirmation } = await import('../../src/services/kioskConfirmation.service.js');

const TTL_MS = 20000;

afterEach(() => {
  vi.useRealTimers();
});

describe('kioskConfirmation.service — evet/hayır', () => {
  it('createPendingConfirmation artık phrase döndürmez', () => {
    expect(createPendingConfirmation('room-no-phrase', { deviceId: 'd0' })).toEqual({});
  });

  it('"evet" diyen başlatan kişiye confirmed+payload döner, entry silinir', () => {
    const payload = { deviceId: 'd1', action: 'set_power', value: 20, initiatingUserId: 'u1' };
    createPendingConfirmation('room-yes', payload);

    expect(resolvePendingConfirmation('room-yes', 'evet', 'u1')).toEqual({ status: 'confirmed', payload });
    // tek kullanımlık
    expect(resolvePendingConfirmation('room-yes', 'evet', 'u1')).toBeNull();
  });

  it('"hayır" diyen başlatan kişiye cancelled döner, entry silinir', () => {
    createPendingConfirmation('room-no', { deviceId: 'd2', action: 'turn_off', initiatingUserId: 'u1' });

    expect(resolvePendingConfirmation('room-no', 'hayır', 'u1')).toEqual({ status: 'cancelled' });
    expect(resolvePendingConfirmation('room-no', 'evet', 'u1')).toBeNull();
  });

  it('ASCII "hayir" ve büyük harf "EVET" da tanınır (trim+lowercase)', () => {
    createPendingConfirmation('room-ascii-no', { initiatingUserId: 'u1' });
    expect(resolvePendingConfirmation('room-ascii-no', '  Hayir  ', 'u1')).toEqual({ status: 'cancelled' });

    const payload = { deviceId: 'd3', initiatingUserId: 'u1' };
    createPendingConfirmation('room-upper-yes', payload);
    expect(resolvePendingConfirmation('room-upper-yes', 'EVET', 'u1')).toEqual({ status: 'confirmed', payload });
  });

  it('anlaşılmaz bir metin (ör. "ne dedin") unresolved döner, entry SİLİNMEZ', () => {
    const payload = { deviceId: 'd4', action: 'set_power', initiatingUserId: 'u1' };
    createPendingConfirmation('room-unclear', payload);

    expect(resolvePendingConfirmation('room-unclear', 'ne dedin', 'u1')).toEqual({ status: 'unresolved' });
    expect(resolvePendingConfirmation('room-unclear', 'evet', 'u1')).toEqual({ status: 'confirmed', payload });
  });

  it('"evet" ile başlayan ama olumsuzlanan ifade ("evet değil") confirmed DEĞİL unresolved döner, entry SİLİNMEZ', () => {
    const payload = { deviceId: 'd10', action: 'set_power', initiatingUserId: 'u1' };
    createPendingConfirmation('room-yes-negated', payload);

    expect(resolvePendingConfirmation('room-yes-negated', 'evet değil', 'u1')).toEqual({ status: 'unresolved' });
    expect(resolvePendingConfirmation('room-yes-negated', 'evet', 'u1')).toEqual({ status: 'confirmed', payload });
  });

  it('"hayır" ile başlayan çok kelimeli ifade unresolved döner, entry SİLİNMEZ', () => {
    const payload = { deviceId: 'd11', action: 'turn_off', initiatingUserId: 'u1' };
    createPendingConfirmation('room-no-multi', payload);

    expect(resolvePendingConfirmation('room-no-multi', 'hayır, yapma', 'u1')).toEqual({ status: 'unresolved' });
    expect(resolvePendingConfirmation('room-no-multi', 'hayır', 'u1')).toEqual({ status: 'cancelled' });
  });

  it('TRADE-OFF: çok kelimeli onay ("evet lütfen") bilinçli olarak unresolved döner, entry SİLİNMEZ (güvenli taraf: kullanıcı tekrar söyler)', () => {
    const payload = { deviceId: 'd12', action: 'set_power', initiatingUserId: 'u1' };
    createPendingConfirmation('room-yes-polite', payload);

    expect(resolvePendingConfirmation('room-yes-polite', 'evet lütfen', 'u1')).toEqual({ status: 'unresolved' });
    expect(resolvePendingConfirmation('room-yes-polite', 'evet', 'u1')).toEqual({ status: 'confirmed', payload });
  });

  it('boş veya metin olmayan cevap unresolved döner, entry SİLİNMEZ', () => {
    const payload = { deviceId: 'd5', initiatingUserId: 'u1' };
    createPendingConfirmation('room-empty', payload);

    expect(resolvePendingConfirmation('room-empty', '', 'u1')).toEqual({ status: 'unresolved' });
    expect(resolvePendingConfirmation('room-empty', undefined, 'u1')).toEqual({ status: 'unresolved' });
    expect(resolvePendingConfirmation('room-empty', 'evet', 'u1')).toEqual({ status: 'confirmed', payload });
  });

  it('başlatan kişi dışında biri "evet" derse unresolved döner, entry SİLİNMEZ', () => {
    const payload = { deviceId: 'd6', action: 'set_power', initiatingUserId: 'u1' };
    createPendingConfirmation('room-wrong-speaker', payload);

    expect(resolvePendingConfirmation('room-wrong-speaker', 'evet', 'u2')).toEqual({ status: 'unresolved' });
    expect(resolvePendingConfirmation('room-wrong-speaker', 'hayır', 'u2')).toEqual({ status: 'unresolved' });
    expect(resolvePendingConfirmation('room-wrong-speaker', 'evet', 'u1')).toEqual({ status: 'confirmed', payload });
  });

  it('initiatingUserId yoksa konuşmacı kontrolü yapılmaz', () => {
    const payload = { deviceId: 'd7', action: 'turn_on' };
    createPendingConfirmation('room-no-initiator', payload);

    expect(resolvePendingConfirmation('room-no-initiator', 'tamam', undefined)).toEqual({ status: 'confirmed', payload });
  });

  it('süre dolmadan hemen önce "evet" hâlâ confirmed döner (TTL 20sn)', () => {
    vi.useFakeTimers();
    const start = Date.parse('2026-01-01T00:00:00Z');
    vi.setSystemTime(new Date(start));

    const payload = { deviceId: 'd8', initiatingUserId: 'u1' };
    createPendingConfirmation('room-ttl-edge', payload);

    vi.setSystemTime(new Date(start + TTL_MS - 1));
    expect(resolvePendingConfirmation('room-ttl-edge', 'evet', 'u1')).toEqual({ status: 'confirmed', payload });
  });

  it('süre dolduktan sonra "evet" gelirse null döner, entry silinir', () => {
    vi.useFakeTimers();
    const start = Date.parse('2026-01-01T00:00:00Z');
    vi.setSystemTime(new Date(start));

    createPendingConfirmation('room-expired', { deviceId: 'd9', initiatingUserId: 'u1' });

    vi.setSystemTime(new Date(start + TTL_MS + 1));
    expect(resolvePendingConfirmation('room-expired', 'evet', 'u1')).toBeNull();
    expect(resolvePendingConfirmation('room-expired', 'evet', 'u1')).toBeNull();
  });

  it('hiç bekleyen onay yoksa null döner', () => {
    expect(resolvePendingConfirmation('oda-yok', 'evet', 'u1')).toBeNull();
  });
});
