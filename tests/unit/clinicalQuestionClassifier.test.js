import { describe, it, expect } from 'vitest';
import { isClinicalQuestion } from '../../src/utils/clinicalQuestionClassifier.js';

/**
 * isClinicalQuestion — saf (pure) fonksiyon, WEB_SEARCH yanıtına "doğrulanmış klinik
 * kaynak değildir" uyarısının eklenip eklenmeyeceğine karar vermek için kullanılır
 * (bkz. kiosk.routes.js WEB_SEARCH dalı). DB/servis çağrısı yapmaz — sadece
 * anahtar kelime eşleşmesi: ilaç, doz, mg, protokol, kontrendikasyon, alerji,
 * komplikasyon, ameliyat sonrası.
 */
describe('isClinicalQuestion', () => {
  it('"parasetamol dozu nedir" → true ("doz" anahtar kelimesi)', () => {
    expect(isClinicalQuestion('parasetamol dozu nedir')).toBe(true);
  });

  it('"fenerbahçe kaç kaç bitti" → false (hiçbir klinik anahtar kelime yok)', () => {
    expect(isClinicalQuestion('fenerbahçe kaç kaç bitti')).toBe(false);
  });

  it('"bugün hava nasıl" → false', () => {
    expect(isClinicalQuestion('bugün hava nasıl')).toBe(false);
  });

  it('"bu ilacın kontrendikasyonu var mı" → true ("kontrendikasyon" anahtar kelimesi)', () => {
    expect(isClinicalQuestion('bu ilacın kontrendikasyonu var mı')).toBe(true);
  });

  it('büyük/küçük harf duyarsız eşleşir ("İLAÇ alerjisi var mı?")', () => {
    expect(isClinicalQuestion('İLAÇ alerjisi var mı?')).toBe(true);
  });

  it('"ameliyat sonrası bakım nasıl olmalı" → true (çok kelimeli anahtar kelime)', () => {
    expect(isClinicalQuestion('ameliyat sonrası bakım nasıl olmalı')).toBe(true);
  });

  it('boş/undefined metin → false (fırlatmaz)', () => {
    expect(isClinicalQuestion('')).toBe(false);
    expect(isClinicalQuestion(undefined)).toBe(false);
  });

  it('"protokol" ve "komplikasyon" anahtar kelimeleri de eşleşir', () => {
    expect(isClinicalQuestion('ameliyat protokolü ne diyor')).toBe(true);
    expect(isClinicalQuestion('bu ameliyatın komplikasyon riski nedir')).toBe(true);
  });
});
