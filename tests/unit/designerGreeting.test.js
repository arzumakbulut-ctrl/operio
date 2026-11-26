import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import registry from '../../src/services/_registry.js';

const require = createRequire(import.meta.url);
const { RealSpeakerVerifier } = require('../../src/drivers/RealSpeakerVerifier.js');
const { GREETING_POOL, pickDesignerGreeting, isDesignerSpeaking } =
  require('../../src/utils/designerGreeting.js');

const mockKioskService = { getMockConfig: vi.fn() };

function makeReq(overrides = {}) {
  return {
    kiosk: { institutionId: 'inst-1' },
    body: { audio: Buffer.from('mock-audio') },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  registry.register('kiosk', mockKioskService);
  delete process.env.DESIGNER_USER_ID;
});

afterEach(() => {
  delete process.env.DESIGNER_USER_ID;
});

describe('pickDesignerGreeting', () => {
  it('Math.random 0 ise GREETING_POOL[0] döner', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(pickDesignerGreeting()).toBe(GREETING_POOL[0]);
    spy.mockRestore();
  });

  it('Math.random 0.999 ise GREETING_POOL son elemanını döner', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.999);
    expect(pickDesignerGreeting()).toBe(GREETING_POOL[GREETING_POOL.length - 1]);
    spy.mockRestore();
  });

  it('GREETING_POOL en az 4 farklı cümle içerir (Anti-goal: "hep aynı" hissi)', () => {
    expect(new Set(GREETING_POOL).size).toBeGreaterThanOrEqual(4);
  });
});

describe('isDesignerSpeaking', () => {
  it('DESIGNER_USER_ID ayarlanmamışsa false döner, getMockConfig hiç çağrılmaz', async () => {
    const result = await isDesignerSpeaking(makeReq());
    expect(result).toBe(false);
    expect(mockKioskService.getMockConfig).not.toHaveBeenCalled();
  });

  it('audio yoksa false döner', async () => {
    process.env.DESIGNER_USER_ID = 'designer-1';
    const result = await isDesignerSpeaking(makeReq({ body: {} }));
    expect(result).toBe(false);
  });

  it('config.mode "real" DEĞİLSE (always_match dahil) false döner — identify() HİÇ çağrılmaz', async () => {
    process.env.DESIGNER_USER_ID = 'designer-1';
    mockKioskService.getMockConfig.mockResolvedValueOnce({ mode: 'always_match', cycleIndex: 0 });
    const spy = vi.spyOn(RealSpeakerVerifier.prototype, 'identify');

    const result = await isDesignerSpeaking(makeReq());

    expect(result).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('config.mode "real" ve identify() designer id ile eşleşirse true döner, identify tek adayla çağrılır', async () => {
    process.env.DESIGNER_USER_ID = 'designer-1';
    mockKioskService.getMockConfig.mockResolvedValueOnce({ mode: 'real' });
    const spy = vi
      .spyOn(RealSpeakerVerifier.prototype, 'identify')
      .mockResolvedValueOnce({ userId: 'designer-1', confidence: 0.9 });

    const result = await isDesignerSpeaking(makeReq());

    expect(result).toBe(true);
    expect(spy).toHaveBeenCalledWith(expect.anything(), ['designer-1'], { mode: 'real' });
    spy.mockRestore();
  });

  it('config.mode "real" ama identify() null dönerse (tanınamadı) false döner', async () => {
    process.env.DESIGNER_USER_ID = 'designer-1';
    mockKioskService.getMockConfig.mockResolvedValueOnce({ mode: 'real' });
    const spy = vi.spyOn(RealSpeakerVerifier.prototype, 'identify').mockResolvedValueOnce(null);

    const result = await isDesignerSpeaking(makeReq());

    expect(result).toBe(false);
    spy.mockRestore();
  });

  it('getMockConfig fırlatırsa false döner, hata yutulur (FIRLATMAZ)', async () => {
    process.env.DESIGNER_USER_ID = 'designer-1';
    mockKioskService.getMockConfig.mockRejectedValueOnce(new Error('DB down'));

    const result = await isDesignerSpeaking(makeReq());

    expect(result).toBe(false);
  });
});
