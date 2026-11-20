import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { signAccessToken } from '../../src/utils/jwt.js';
import registry from '../../src/services/_registry.js';
import app from '../../src/app.js';

const request = supertest(app);
const mockModuleService = { getModules: vi.fn(), getInstitutionModules: vi.fn(), hasActiveModule: vi.fn().mockResolvedValue(true) };
const mockDeviceService = { listDevices: vi.fn(), getDevice: vi.fn(), createDevice: vi.fn(), updateDeviceConfig: vi.fn(), executeCommand: vi.fn(), physicalConfirm: vi.fn() };
const tok = (roleId) => signAccessToken({ sub: 'u1', email: 'e@t.com', roleId, institutionId: 'inst-1' });

beforeEach(() => {
  vi.clearAllMocks();
  registry.register('module', mockModuleService);
  registry.register('device', mockDeviceService);
});

describe('GET /api/devices', () => {
  it('modül satın alınmamışsa 403', async () => {
    mockModuleService.hasActiveModule.mockResolvedValueOnce(false);
    const res = await request.get('/api/devices').set('Authorization', `Bearer ${tok(6)}`);
    expect(res.status).toBe(403);
  });
  it('modül varsa 200', async () => {
    mockDeviceService.listDevices.mockResolvedValueOnce([]);
    const res = await request.get('/api/devices').set('Authorization', `Bearer ${tok(6)}`);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/devices/:id/command', () => {
  it('yetkilendirme hatasında 403 dönmeli', async () => {
    mockDeviceService.executeCommand.mockRejectedValueOnce(new Error('room_mismatch'));
    const res = await request.post('/api/devices/d1/command')
      .set('Authorization', `Bearer ${tok(6)}`).send({ action: 'turn_on' });
    expect(res.status).toBe(403);
  });
  it('başarılı komut → 200', async () => {
    mockDeviceService.executeCommand.mockResolvedValueOnce({ id: 'd1', power_state: 'ON' });
    const res = await request.post('/api/devices/d1/command')
      .set('Authorization', `Bearer ${tok(6)}`).send({ action: 'turn_on' });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/devices (admin create)', () => {
  it('doktor(6) oluşturamamalı → 403', async () => {
    const res = await request.post('/api/devices').set('Authorization', `Bearer ${tok(6)}`).send({ name: 'X', deviceGroup: 'light', deviceType: 'y' });
    expect(res.status).toBe(403);
  });
  it('Üst Yönetici(0) oluşturabilmeli → 201', async () => {
    mockDeviceService.createDevice.mockResolvedValueOnce({ id: 'd1' });
    const res = await request.post('/api/devices').set('Authorization', `Bearer ${tok(0)}`).send({ name: 'X', deviceGroup: 'light', deviceType: 'y' });
    expect(res.status).toBe(201);
  });
});
