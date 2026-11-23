import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('kioskAPI', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { ok: true } }),
    });
  });

  it('voiceCommand() doğru endpoint, body ve kiosk token Authorization header ile POST atmalı', async () => {
    const { kioskAPI } = await import('../../src/services/api.js');
    await kioskAPI.voiceCommand('room1', 'kiosk-tok-abc', {
      transcript: 'ışıkları aç',
      audio: null,
      confirmationAnswer: null,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/kiosk/rooms/room1/voice-command'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer kiosk-tok-abc' }),
        body: JSON.stringify({ transcript: 'ışıkları aç', audio: null, confirmationAnswer: null }),
      })
    );
  });

  it('status() doğru endpoint ve kiosk token Authorization header ile GET atmalı', async () => {
    const { kioskAPI } = await import('../../src/services/api.js');
    await kioskAPI.status('room1', 'kiosk-tok-xyz');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/kiosk/rooms/room1/status'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer kiosk-tok-xyz' }),
      })
    );
  });

  it('kişisel JWT yerine SADECE parametre olarak verilen kiosk token kullanılmalı — kişisel oturum olmadan da çalışmalı', async () => {
    const { kioskAPI, saveTokens, clearTokens } = await import('../../src/services/api.js');

    // Kişisel oturumdan kalan sahte bir access token olduğunu simüle et.
    saveTokens('FAKE-PERSONAL-ACCESS-TOKEN', 'FAKE-PERSONAL-REFRESH-TOKEN');

    await kioskAPI.voiceCommand('room1', 'REAL-KIOSK-TOKEN', {
      transcript: 'merhaba',
      audio: null,
      confirmationAnswer: null,
    });

    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers.Authorization).toBe('Bearer REAL-KIOSK-TOKEN');
    expect(opts.headers.Authorization).not.toContain('FAKE-PERSONAL-ACCESS-TOKEN');

    clearTokens();
  });

  it('401 aldığında retry/refresh denemez (kiosk token kişisel JWT refresh akışından ayrı)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'INVALID_KIOSK_TOKEN', message: 'Geçersiz kiosk token' } }),
    });

    const { kioskAPI } = await import('../../src/services/api.js');

    await expect(kioskAPI.status('room1', 'expired-kiosk-tok')).rejects.toMatchObject({
      code: 'INVALID_KIOSK_TOKEN',
      status: 401,
    });

    // Sadece 1 çağrı yapılmış olmalı — /auth/refresh'e gidip tekrar denemek YOK.
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('voiceProfileAPI', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { enrolled: true } }),
    });
  });

  it('enroll() bir diziyi audioSamples alanında POST atmalı (kişisel JWT)', async () => {
    const { voiceProfileAPI } = await import('../../src/services/api.js');
    await voiceProfileAPI.enroll(['sample1', 'sample2', 'sample3']);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/profile/voice-enrollment'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ audioSamples: ['sample1', 'sample2', 'sample3'] }),
      })
    );
  });

  it('get() doğru endpoint ile GET atmalı (kişisel JWT)', async () => {
    const { voiceProfileAPI } = await import('../../src/services/api.js');
    await voiceProfileAPI.get();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/profile/voice-enrollment'),
      expect.objectContaining({ method: 'GET' })
    );
  });
});

describe('spotifyAPI', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { url: 'https://accounts.spotify.com/authorize?...' } }),
    });
  });

  it('connect() doğru endpoint ile GET atmalı', async () => {
    const { spotifyAPI } = await import('../../src/services/api.js');
    await spotifyAPI.connect();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/spotify/connect'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('disconnect() doğru endpoint ile POST atmalı', async () => {
    const { spotifyAPI } = await import('../../src/services/api.js');
    await spotifyAPI.disconnect();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/spotify/disconnect'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('kioskAdminAPI', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { ok: true } }),
    });
  });

  it('createToken() doğru endpoint ile POST atmalı', async () => {
    const { kioskAdminAPI } = await import('../../src/services/api.js');
    await kioskAdminAPI.createToken('room1');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/kiosk-admin/rooms/room1/token'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('revokeToken() doğru endpoint ile POST atmalı', async () => {
    const { kioskAdminAPI } = await import('../../src/services/api.js');
    await kioskAdminAPI.revokeToken('room1');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/kiosk-admin/rooms/room1/token/revoke'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('getMockConfig() doğru endpoint ile GET atmalı', async () => {
    const { kioskAdminAPI } = await import('../../src/services/api.js');
    await kioskAdminAPI.getMockConfig();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/kiosk-admin/mock-config'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('setMockConfig() doğru endpoint ve body ile PUT atmalı (backend route PUT kullanıyor, POST DEĞİL)', async () => {
    const { kioskAdminAPI } = await import('../../src/services/api.js');
    await kioskAdminAPI.setMockConfig('always_match');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/kiosk-admin/mock-config'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ mode: 'always_match' }),
      })
    );
  });
});
