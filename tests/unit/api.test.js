import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('deviceAPI', () => {
  beforeEach(() => { global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data: { id: 'd1' } }) }); });

  it('command() doğru endpoint ve body ile POST atmalı', async () => {
    const { deviceAPI } = await import('../../src/services/api.js');
    await deviceAPI.command('d1', { action: 'turn_on' });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/devices/d1/command'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});
