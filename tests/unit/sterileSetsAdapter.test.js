import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listSterileSets, createSterileSet, updateSterileSet, getLastError } from '../../src/services/sterileSetsAdapter.js';

const BASE = 'http://localhost:4000/api';
beforeEach(() => { localStorage.setItem('operio_access','test-token'); global.fetch = vi.fn(); });
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('listSterileSets', () => {
  it('backend zarfını açar, shelf_location/status alanlarını Türkçe UI değerlerine çevirir', async () => {
    global.fetch.mockResolvedValueOnce({ ok:true, json: async () => ({ success:true, data:[{
      id:'ss1', code:'SET-001', name:'Laparoskopi Seti', total_count:5, sterile_count:5, in_use_count:0,
      shelf_location:'Raf A-3', status:'STERILE', instruments:[],
    }], meta:{} }) });

    const result = await listSterileSets();

    // Finding 3: query param yoksa backend limit'i varsayılan 20'ye düşürüyor
    // — ?limit=100 şemanın izin verdiği maksimum gönderilmeli.
    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/sterile-sets?limit=100`, expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }));
    expect(result[0]).toMatchObject({ id:'ss1', name:'Laparoskopi Seti', raf:'Raf A-3', durum:'Steril — Hazır' });
  });

  it('IN_USE -> Kullanımda, STERILIZING -> Sterilizasyonda, FAULTY/RETIRED -> Arızalı çevrilir', async () => {
    global.fetch.mockResolvedValueOnce({ ok:true, json: async () => ({ success:true, data:[
      { id:'a', code:'A', name:'A', status:'IN_USE' },
      { id:'b', code:'B', name:'B', status:'STERILIZING' },
      { id:'c', code:'C', name:'C', status:'FAULTY' },
      { id:'d', code:'D', name:'D', status:'RETIRED' },
    ], meta:{} }) });
    const result = await listSterileSets();
    expect(result.map(r=>r.durum)).toEqual(['Kullanımda','Sterilizasyonda','Arızalı','Arızalı']);
  });
});

describe('createSterileSet / updateSterileSet', () => {
  it('createSterileSet POST /sterile-sets camelCase body atar', async () => {
    global.fetch.mockResolvedValueOnce({ ok:true, json: async () => ({ success:true, data:{ id:'ss2', code:'SET-002', name:'Yeni Set', status:'STERILE' } }) });
    await createSterileSet({ code:'SET-002', name:'Yeni Set' });
    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/sterile-sets`, expect.objectContaining({
      method:'POST', body: JSON.stringify({ code:'SET-002', name:'Yeni Set' }),
    }));
  });

  it('updateSterileSet PATCH /sterile-sets/:id atar (PUT DEĞİL)', async () => {
    global.fetch.mockResolvedValueOnce({ ok:true, json: async () => ({ success:true, data:{ id:'ss1', status:'IN_USE' } }) });
    await updateSterileSet('ss1', { status: 'IN_USE' });
    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/sterile-sets/ss1`, expect.objectContaining({ method:'PATCH' }));
  });
});

// Final review Finding 4: apiCall "asla fırlatmaz" sözleşmesini korur (null
// döner) ama artık son başarısız çağrının gerçek {code,message} nesnesini
// getLastError() üzerinden açığa çıkarıyor — SterilSetler.jsx'in saveSet()'i
// bunu hardcoded 'Hata' yerine toast'ta göstermek için kullanıyor.
describe('getLastError (Finding 4)', () => {
  it('backend {success:false,error:{message}} dönerse getLastError() bu mesajı verir', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false, status: 500,
      json: async () => ({ success:false, error:{ code:'INTERNAL_SERVER_ERROR', message:'duplicate key value violates unique constraint' } }),
    });
    const result = await createSterileSet({ code:'SET-003', name:'Çakışan Set' });
    expect(result).toBeNull();
    expect(getLastError()).toEqual({ code:'INTERNAL_SERVER_ERROR', message:'duplicate key value violates unique constraint' });
  });

  it('başarılı bir çağrı sonrası getLastError() null döner', async () => {
    global.fetch.mockResolvedValueOnce({ ok:true, json: async () => ({ success:true, data:{ id:'ss9', code:'SET-009', name:'X', status:'STERILE' } }) });
    await createSterileSet({ code:'SET-009', name:'X' });
    expect(getLastError()).toBeNull();
  });
});
