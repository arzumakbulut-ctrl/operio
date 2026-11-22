import { describe, it, expect, vi, afterEach } from 'vitest';

const { createPendingConfirmation, resolvePendingConfirmation } = await import('../../src/services/kioskConfirmation.service.js');

// Yanlış ama phrase ile ÇAKIŞMAYAN bir karşı-phrase üretir (rastgele üretimle çakışma
// riskini sıfırlar — ilk rakamı 1 artırıp mod 10 alır).
function wrongPhraseFor(phrase) {
  const [a, b, c] = phrase.split('-').map(Number);
  return `${(a + 1) % 10}-${b}-${c}`;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('kioskConfirmation.service', () => {
  it('createPendingConfirmation \\d-\\d-\\d formatında bir phrase üretir', () => {
    const { phrase } = createPendingConfirmation('room-format', { foo: 'bar' });
    expect(phrase).toMatch(/^\d-\d-\d$/);
  });

  it('doğru phrase ile resolvePendingConfirmation payload döner VE entry silinir (ikinci çağrıda null)', () => {
    const payload = { deviceId: 'dev-1', action: 'turn_on', value: undefined };
    const { phrase } = createPendingConfirmation('room-ok', payload);

    const result = resolvePendingConfirmation('room-ok', phrase);
    expect(result).toEqual(payload);

    // Entry başarılı eşleşmede silinmiş olmalı — ikinci çağrı null döner.
    expect(resolvePendingConfirmation('room-ok', phrase)).toBeNull();
  });

  it('yanlış phrase ile null döner (entry silinmez — doğru phrase sonradan hâlâ işe yarar)', () => {
    const payload = { deviceId: 'dev-2', action: 'turn_off' };
    const { phrase } = createPendingConfirmation('room-wrong', payload);

    expect(resolvePendingConfirmation('room-wrong', wrongPhraseFor(phrase))).toBeNull();

    // Yanlış denemeden sonra entry hâlâ yerinde olmalı — doğru phrase hâlâ çalışır.
    expect(resolvePendingConfirmation('room-wrong', phrase)).toEqual(payload);
  });

  it('expiresAt geçmişse doğru phrase bile olsa null döner (zaman mocklanır)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const payload = { deviceId: 'dev-3', action: 'set_power', value: 50 };
    const { phrase } = createPendingConfirmation('room-expired', payload);

    // TTL 10sn — 10sn + 1ms ileri sar.
    vi.setSystemTime(new Date('2026-01-01T00:00:10.001Z'));

    expect(resolvePendingConfirmation('room-expired', phrase)).toBeNull();
  });

  it('hiç bekleyen onay olmayan bir roomId için null döner', () => {
    expect(resolvePendingConfirmation('room-never-existed', '1-2-3')).toBeNull();
  });

  describe('rakam-tabanlı karşılaştırma (saklanan "4-7-2" formatı korunur)', () => {
    // Math.random 0.4/0.7/0.2 → floor(x*10) = 4/7/2 → phrase "4-7-2".
    function create472(roomId, payload) {
      const spy = vi.spyOn(Math, 'random').mockReturnValueOnce(0.4).mockReturnValueOnce(0.7).mockReturnValueOnce(0.2);
      const { phrase } = createPendingConfirmation(roomId, payload);
      spy.mockRestore();
      return phrase;
    }

    it('saklanan "4-7-2" ↔ gelen "4 7 2" eşleşir', () => {
      const payload = { deviceId: 'dev-n1', action: 'turn_on' };
      const phrase = create472('room-norm-space', payload);

      expect(phrase).toBe('4-7-2'); // saklanan/okunan format değişmedi
      expect(resolvePendingConfirmation('room-norm-space', '4 7 2')).toEqual(payload);
    });

    it('saklanan "4-7-2" ↔ gelen "472" eşleşir', () => {
      const payload = { deviceId: 'dev-n2', action: 'turn_on' };
      create472('room-norm-compact', payload);

      expect(resolvePendingConfirmation('room-norm-compact', '472')).toEqual(payload);
    });

    it('gerçekten yanlış bir dizi hâlâ reddedilir (ve entry silinmez)', () => {
      const payload = { deviceId: 'dev-n3', action: 'turn_on' };
      create472('room-norm-wrong', payload);

      expect(resolvePendingConfirmation('room-norm-wrong', '4 7 3')).toBeNull();
      expect(resolvePendingConfirmation('room-norm-wrong', '47')).toBeNull();
      expect(resolvePendingConfirmation('room-norm-wrong', '274')).toBeNull();
      expect(resolvePendingConfirmation('room-norm-wrong', '4721')).toBeNull();
      expect(resolvePendingConfirmation('room-norm-wrong', 'dört yedi iki')).toBeNull(); // rakam yok → boş → asla eşleşmez
      expect(resolvePendingConfirmation('room-norm-wrong', '')).toBeNull();
      // Yanlış denemeler entry'yi silmedi — doğru dizi hâlâ çalışır.
      expect(resolvePendingConfirmation('room-norm-wrong', '4-7-2')).toEqual(payload);
    });
  });

  describe('konuşmacı bağlama (initiatingUserId)', () => {
    it('payload.initiatingUserId varsa, FARKLI bir konuşmacı doğru phrase ile bile çözemez (entry silinmez)', () => {
      const payload = { deviceId: 'dev-s1', action: 'turn_on', initiatingUserId: 'nurse-a' };
      const { phrase } = createPendingConfirmation('room-speaker', payload);

      expect(resolvePendingConfirmation('room-speaker', phrase, 'nurse-b')).toBeNull();
      expect(resolvePendingConfirmation('room-speaker', phrase)).toBeNull(); // onaylayan bilinmiyorsa da red
      // Asıl başlatan kişi hâlâ onaylayabilir.
      expect(resolvePendingConfirmation('room-speaker', phrase, 'nurse-a')).toEqual(payload);
    });
  });
});
