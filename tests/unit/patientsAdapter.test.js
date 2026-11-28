import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listPatients, getPatient, createPatient } from '../../src/services/patientsAdapter.js';

const BASE = 'http://localhost:4000/api';

beforeEach(() => { localStorage.setItem('operio_access','test-token'); global.fetch = vi.fn(); });
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('listPatients', () => {
  it('backend zarfını açar, first_name/last_name/tc_no/blood_type/date_of_birth alanlarını çevirir', async () => {
    global.fetch.mockResolvedValueOnce({ ok:true, json: async () => ({ success:true, data:[{
      id:'p1', tc_no:'12345678901', first_name:'Ayşe', last_name:'Demir',
      date_of_birth:'1990-05-10', gender:'K', blood_type:'A+', phone:'5551234567',
    }], meta:{} }) });

    const result = await listPatients();

    // Finding 3: query param yoksa backend limit'i varsayılan 20'ye düşürüyor
    // — ?limit=100 şemanın izin verdiği maksimum gönderilmeli.
    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/patients?limit=100`, expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }));
    expect(result[0]).toMatchObject({ id:'p1', ad:'Ayşe', soyad:'Demir', tc:'12345678901', kan:'A+', cinsiyet:'K', tel:'5551234567' });
    expect(result[0].yas).toBeGreaterThan(0);
  });

  it('backend hata dönerse boş dizi döner, FIRLATMAZ', async () => {
    global.fetch.mockResolvedValueOnce({ ok:false, status:401, json: async () => ({ success:false }) });
    expect(await listPatients()).toEqual([]);
  });
});

describe('createPatient', () => {
  it('camelCase body ile POST atar', async () => {
    global.fetch.mockResolvedValueOnce({ ok:true, json: async () => ({ success:true, data:{ id:'p2', first_name:'Ali', last_name:'Veli' } }) });
    const result = await createPatient({ firstName:'Ali', lastName:'Veli', gender:'E' });
    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/patients`, expect.objectContaining({
      method:'POST', body: JSON.stringify({ firstName:'Ali', lastName:'Veli', gender:'E' }),
    }));
    expect(result.ad).toBe('Ali');
  });
});
