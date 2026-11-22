import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { signAccessToken } from '../../src/utils/jwt.js';
import registry from '../../src/services/_registry.js';
import app from '../../src/app.js';
import { EMBEDDING_FAILED_MESSAGE } from '../../src/services/voiceProfile.service.js';

const request = supertest(app);
const mockVoiceProfileService = {
  enrollVoiceProfile: vi.fn(),
  getVoiceProfile: vi.fn(),
};
const tok = (sub = 'user-1') => signAccessToken({ sub, email: 'e@t.com', roleId: 6, institutionId: 'inst-1' });

beforeEach(() => {
  vi.clearAllMocks();
  registry.register('voiceProfile', mockVoiceProfileService);
});

describe('POST /api/profile/voice-enrollment', () => {
  it('token yok → 401, servis çağrılmaz', async () => {
    const res = await request
      .post('/api/profile/voice-enrollment')
      .send({ audio: Buffer.from('audio').toString('base64') });
    expect(res.status).toBe(401);
    expect(mockVoiceProfileService.enrollVoiceProfile).not.toHaveBeenCalled();
  });

  it('kendi (personel) JWT\'siyle enroll edebilir → 200 + modelVersion/enrolledAt', async () => {
    const enrolledAt = new Date().toISOString();
    mockVoiceProfileService.enrollVoiceProfile.mockResolvedValueOnce({
      modelVersion: 'mock-v1',
      enrolledAt,
    });
    const samples = ['c2FtcGxlLTE=', 'c2FtcGxlLTI=', 'c2FtcGxlLTM='];

    const res = await request
      .post('/api/profile/voice-enrollment')
      .set('Authorization', `Bearer ${tok('user-1')}`)
      .send({ audioSamples: samples });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ modelVersion: 'mock-v1', enrolledAt });
    // route, kiosk token değil kişisel JWT'den gelen req.user.sub'ı userId
    // olarak servise geçirmeli (bkz. task context: authenticate req.user.sub).
    expect(mockVoiceProfileService.enrollVoiceProfile).toHaveBeenCalledWith('user-1', samples);
  });

  it('audioSamples 3 eleman değilse 400 döner, servis çağrılmaz', async () => {
    const res = await request
      .post('/api/profile/voice-enrollment')
      .set('Authorization', `Bearer ${tok('user-1')}`)
      .send({ audioSamples: ['a', 'b'] });

    expect(res.status).toBe(400);
    expect(mockVoiceProfileService.enrollVoiceProfile).not.toHaveBeenCalled();
  });

  it('audioSamples hiç gönderilmezse (eski tekil audio alanı dahil) 400 döner', async () => {
    const res = await request
      .post('/api/profile/voice-enrollment')
      .set('Authorization', `Bearer ${tok('user-1')}`)
      .send({ audio: 'c2FtcGxlLTE=' });

    expect(res.status).toBe(400);
    expect(mockVoiceProfileService.enrollVoiceProfile).not.toHaveBeenCalled();
  });

  it('audioSamples dizi değilse 400 döner', async () => {
    const res = await request
      .post('/api/profile/voice-enrollment')
      .set('Authorization', `Bearer ${tok('user-1')}`)
      .send({ audioSamples: 'c2FtcGxlLTE=' });

    expect(res.status).toBe(400);
    expect(mockVoiceProfileService.enrollVoiceProfile).not.toHaveBeenCalled();
  });

  it('servis bir örnek için embedding çıkarılamadığını bildirirse → 400 (500 değil)', async () => {
    mockVoiceProfileService.enrollVoiceProfile.mockRejectedValueOnce(
      new Error(EMBEDDING_FAILED_MESSAGE)
    );

    const res = await request
      .post('/api/profile/voice-enrollment')
      .set('Authorization', `Bearer ${tok('user-1')}`)
      .send({ audioSamples: ['c2FtcGxlLTE=', 'c2FtcGxlLTI=', 'c2FtcGxlLTM='] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('beklenmeyen servis hatası → 500 olarak kalır', async () => {
    mockVoiceProfileService.enrollVoiceProfile.mockRejectedValueOnce(new Error('db down'));

    const res = await request
      .post('/api/profile/voice-enrollment')
      .set('Authorization', `Bearer ${tok('user-1')}`)
      .send({ audioSamples: ['c2FtcGxlLTE=', 'c2FtcGxlLTI=', 'c2FtcGxlLTM='] });

    expect(res.status).toBe(500);
  });
});

describe('GET /api/profile/voice-enrollment', () => {
  it('token yok → 401, servis çağrılmaz', async () => {
    const res = await request.get('/api/profile/voice-enrollment');
    expect(res.status).toBe(401);
    expect(mockVoiceProfileService.getVoiceProfile).not.toHaveBeenCalled();
  });

  it('önceden enroll edilmemiş kullanıcı için → 404', async () => {
    mockVoiceProfileService.getVoiceProfile.mockResolvedValueOnce(null);

    const res = await request
      .get('/api/profile/voice-enrollment')
      .set('Authorization', `Bearer ${tok('user-2')}`);

    expect(res.status).toBe(404);
    expect(mockVoiceProfileService.getVoiceProfile).toHaveBeenCalledWith('user-2');
  });

  it('enroll edilmiş kullanıcı için → 200 + enrolledAt/modelVersion', async () => {
    const enrolledAt = new Date().toISOString();
    mockVoiceProfileService.getVoiceProfile.mockResolvedValueOnce({
      enrolledAt,
      modelVersion: 'mock-v1',
    });

    const res = await request
      .get('/api/profile/voice-enrollment')
      .set('Authorization', `Bearer ${tok('user-1')}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ enrolledAt, modelVersion: 'mock-v1' });
  });
});
