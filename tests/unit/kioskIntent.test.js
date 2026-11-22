import { describe, it, expect } from 'vitest';

const { parseIntent } = await import('../../src/utils/kioskIntent.js');

describe('parseIntent', () => {
  describe('TIMEOUT', () => {
    it.each([
      ['Operio time-out'],
      ['operio zaman aşımı'],
    ])('"%s" → TIMEOUT', (transcript) => {
      expect(parseIntent(transcript).type).toBe('TIMEOUT');
    });
  });

  describe('DEVICE_COMMAND', () => {
    it('"koteri yirmi yap" → DEVICE_COMMAND, params.deviceGroup = koter', () => {
      const result = parseIntent('koteri yirmi yap');
      expect(result.type).toBe('DEVICE_COMMAND');
      expect(result.params.deviceGroup).toBe('koter');
    });

    it('"ışığı aç" → DEVICE_COMMAND, params.deviceGroup = ışık (Türkçe ünsüz yumuşaması: ışık→ışığı)', () => {
      const result = parseIntent('ışığı aç');
      expect(result.type).toBe('DEVICE_COMMAND');
      expect(result.params.deviceGroup).toBe('ışık');
    });

    it('metindeki rakamı (\\d+) params.value olarak yakalar', () => {
      const result = parseIntent('koteri 20 yap');
      expect(result.type).toBe('DEVICE_COMMAND');
      expect(result.params.value).toBe(20);
    });

    it('rakam yoksa params.value tanımsız kalır', () => {
      const result = parseIntent('ışığı aç');
      expect(result.params.value).toBeUndefined();
    });
  });

  describe('SPOTIFY_PLAY', () => {
    it.each([
      ["spotify'da seksenler çalsın"],
      ['spotify aç müzik çal'],
    ])('"%s" → SPOTIFY_PLAY', (transcript) => {
      expect(parseIntent(transcript).type).toBe('SPOTIFY_PLAY');
    });
  });

  describe('WEB_SEARCH', () => {
    it.each([
      ['ara: parasetamol dozu'],
      ['bul fenerbahçe kaç kaç bitti'],
    ])('"%s" → WEB_SEARCH', (transcript) => {
      expect(parseIntent(transcript).type).toBe('WEB_SEARCH');
    });
  });

  describe('UNKNOWN', () => {
    it.each([
      [''],
      ['asdasd'],
    ])('"%s" → UNKNOWN', (transcript) => {
      expect(parseIntent(transcript).type).toBe('UNKNOWN');
    });

    it('3 karakterden kısa transcript → UNKNOWN (Review Focus #5)', () => {
      expect(parseIntent('ha').type).toBe('UNKNOWN');
    });

    it('hiçbir anahtar kelimeyle eşleşmeyen uzun transcript → UNKNOWN', () => {
      expect(parseIntent('asdasd zzz qqq').type).toBe('UNKNOWN');
    });
  });

  it('her zaman bir params nesnesi döner (en azından boş obje)', () => {
    expect(parseIntent('asdasd').params).toEqual({});
  });
});
