import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { signAccessToken } from '../../src/utils/jwt.js';
import registry from '../../src/services/_registry.js';
import app from '../../src/app.js';

const request = supertest(app);
const mockModuleService = { hasActiveModule: vi.fn().mockResolvedValue(true) };
const mockSterileSetService = {
  getSet: vi.fn(), recordVisionSuggestion: vi.fn(), addTrackingLog: vi.fn(),
  listSets: vi.fn(), createSet: vi.fn(), updateSet: vi.fn(),
};
const mockAiService = { countInstruments: vi.fn() };
const tok = (roleId) => signAccessToken({ sub:'u1', email:'e@t.com', roleId, institutionId:'inst-1' });

beforeEach(() => {
  vi.clearAllMocks();
  registry.register('module', mockModuleService);
  registry.register('sterileSet', mockSterileSetService);
  registry.register('ai', mockAiService);
});

describe('POST /api/sterile-sets/:id/vision-count', () => {
  it('modül satın alınmamışsa 403', async () => {
    mockModuleService.hasActiveModule.mockResolvedValueOnce(false);
    const res = await request.post('/api/sterile-sets/s1/vision-count')
      .set('Authorization', `Bearer ${tok(8)}`).send({ imageBase64:'x', mediaType:'image/jpeg' });
    expect(res.status).toBe(403);
  });

  it('yetkisiz rol (Doktor=6) 403 — requireModule hiç çağrılmaz', async () => {
    const res = await request.post('/api/sterile-sets/s1/vision-count')
      .set('Authorization', `Bearer ${tok(6)}`).send({ imageBase64:'x', mediaType:'image/jpeg' });
    expect(res.status).toBe(403);
    expect(mockModuleService.hasActiveModule).not.toHaveBeenCalled();
  });

  it('geçersiz mediaType 400 döner', async () => {
    const res = await request.post('/api/sterile-sets/s1/vision-count')
      .set('Authorization', `Bearer ${tok(8)}`).send({ imageBase64:'x', mediaType:'image/gif' });
    expect(res.status).toBe(400);
  });

  it('set bulunamazsa 404', async () => {
    mockSterileSetService.getSet.mockResolvedValueOnce(null);
    const res = await request.post('/api/sterile-sets/s1/vision-count')
      .set('Authorization', `Bearer ${tok(8)}`).send({ imageBase64:'x', mediaType:'image/jpeg' });
    expect(res.status).toBe(404);
  });

  it('başarılı: getSet → countInstruments → recordVisionSuggestion sırayla çağrılır, sonuç 200 döner', async () => {
    mockSterileSetService.getSet.mockResolvedValueOnce({ id:'s1', instruments:[{ id:'i1', name:'Trokar 10mm', expected_count:1 }] });
    mockAiService.countInstruments.mockResolvedValueOnce({ suggestions:[{ instrumentId:'i1', name:'Trokar 10mm', expectedCount:1, detectedCount:1 }], parsed:true });
    const res = await request.post('/api/sterile-sets/s1/vision-count')
      .set('Authorization', `Bearer ${tok(8)}`).send({ imageBase64:'x', mediaType:'image/jpeg' });
    expect(res.status).toBe(200);
    expect(mockAiService.countInstruments).toHaveBeenCalledWith('x', 'image/jpeg', [{ instrumentId:'i1', name:'Trokar 10mm', expectedCount:1 }]);
    expect(mockSterileSetService.recordVisionSuggestion).toHaveBeenCalledWith(expect.objectContaining({ setId:'s1' }));
  });

  it('4mb altı ama 512kb üstü bir body bu route için kabul edilir, başka bir route için REDDEDİLİR (413)', async () => {
    const bigPayload = { imageBase64: 'a'.repeat(700 * 1024), mediaType: 'image/jpeg' }; // ~700KB > 512kb küresel limit
    mockSterileSetService.getSet.mockResolvedValueOnce({ id:'s1', instruments:[] });
    mockAiService.countInstruments.mockResolvedValueOnce({ suggestions:[], parsed:true });
    const okRes = await request.post('/api/sterile-sets/s1/vision-count')
      .set('Authorization', `Bearer ${tok(8)}`).send(bigPayload);
    expect(okRes.status).toBe(200);

    const rejectedRes = await request.patch('/api/sterile-sets/s1')
      .set('Authorization', `Bearer ${tok(0)}`).send({ name: 'a'.repeat(700 * 1024) });
    expect(rejectedRes.status).toBe(413);
  });
});

describe('POST /api/sterile-sets/:id/tracking (genişletilmiş)', () => {
  it('counts gönderildiğinde addTrackingLog bunu geçirir', async () => {
    mockSterileSetService.addTrackingLog.mockResolvedValueOnce({ id:'log1' });
    const res = await request.post('/api/sterile-sets/s1/tracking')
      .set('Authorization', `Bearer ${tok(9)}`)
      .send({ stage:'teslim_alindi', counts:[{ instrumentId:'11111111-1111-1111-1111-111111111111', count:1 }] });
    expect(res.status).toBe(201);
    expect(mockSterileSetService.addTrackingLog).toHaveBeenCalledWith(expect.objectContaining({
      setId:'s1', stage:'teslim_alindi', counts:[{ instrumentId:'11111111-1111-1111-1111-111111111111', count:1 }],
    }));
  });
});
