/**
 * isClinicalQuestion — WEB_SEARCH sorgusunun klinik (tıbbi) bir soru olup
 * olmadığını saf (pure) bir anahtar-kelime eşleşmesiyle belirler. DB/servis
 * çağrısı yapmaz. kiosk.routes.js'in WEB_SEARCH dalı, bu true dönerse Claude'un
 * web_search aracıyla ürettiği yanıtın önüne "Bu doğrulanmış bir klinik kaynak
 * değildir." uyarısını ekler — Operia bir tıbbi danışman DEĞİLDİR, web arama
 * sonucu tıbbi içerik barındırıyorsa kullanıcı bunun doğrulanmamış bir kaynak
 * olduğunu bilmelidir (bkz. tasarım dokümanının gizlilik/güvenlik kararı).
 *
 * Eşleşme büyük/küçük harf duyarsızdır (Türkçe harfler için `toLocaleLowerCase('tr')`
 * kullanılır — örn. "İLAÇ" → "ilaç"). Basit bir alt-dize (substring) kontrolüdür;
 * tam dil bilgisi/kök analizi yapılmaz (bu basit sınıflandırmanın kapsamı dışında).
 */

const CLINICAL_KEYWORDS = [
  'ilaç',
  'doz',
  'mg',
  'protokol',
  'kontrendikasyon',
  'alerji',
  'komplikasyon',
  'ameliyat sonrası',
];

function isClinicalQuestion(text) {
  const normalized = (text ?? '').toLocaleLowerCase('tr');
  return CLINICAL_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

module.exports = { isClinicalQuestion };
