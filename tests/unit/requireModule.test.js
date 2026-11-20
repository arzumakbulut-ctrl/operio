import { describe, it, expect, vi, beforeEach } from 'vitest';
import registry from '../../src/services/_registry.js';
const { requireModule } = await import('../../src/middleware/requireModule.js');

const mockModuleService = { hasActiveModule: vi.fn() };
beforeEach(() => { vi.clearAllMocks(); registry.register('module', mockModuleService); });

describe('requireModule', () => {
  it('kurum modülü almışsa next() çağırmalı', async () => {
    mockModuleService.hasActiveModule.mockResolvedValueOnce(true);
    const req = { user: { institutionId: 'inst-1' } };
    const next = vi.fn();
    await requireModule('voice_control')(req, {}, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('kurum modülü almamışsa 403 dönmeli', async () => {
    mockModuleService.hasActiveModule.mockResolvedValueOnce(false);
    const req = { user: { institutionId: 'inst-1' } };
    const json = vi.fn();
    const res = { status: vi.fn(() => ({ json })) };
    const next = vi.fn();
    await requireModule('voice_control')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
