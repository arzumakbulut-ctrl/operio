/**
 * kioskAddressing — kiosk sesli asistanının konuşmacıya hitap şekli ve cihaz
 * eylemini doğal Türkçe'ye çeviren iki küçük saf (pure) fonksiyon. DB/servis
 * çağrısı yapmaz; kiosk.routes.js'in DEVICE_COMMAND onay sorusunu kurmak için
 * kullanılır (bkz. Plan task 9).
 */

// roleId 6 (cerrah) ve 10 (misafir cerrah) "hocam" ile hitap edilir — kurumun
// rol enum'u (bkz. schemas.js registerSchema roleId aralığı 0-10).
const HOCAM_ROLE_IDS = [6, 10];

// fullName'in başındaki unvan ön-ekini temizler ("Dr.", "Uzm.", "Tek.", "Hem.",
// "Srl.", "Sn." — nokta opsiyonel) — ardından kalan ilk kelime ad olarak alınır.
const TITLE_PREFIXES_RE = /^(dr\.?|uzm\.?|tek\.?|hem\.?|srl\.?|sn\.?)\s+/i;

/**
 * @param {{fullName: string, roleId: number}} speaker — req.speaker'ın bir alt kümesi
 * @returns {string} "{Ad} hocam" (roleId 6/10) ya da yalnız "{Ad}"
 */
function addressSpeaker({ fullName, roleId }) {
  const name = (fullName || '').replace(TITLE_PREFIXES_RE, '').trim().split(/\s+/)[0] || '';
  return HOCAM_ROLE_IDS.includes(roleId) ? `${name} hocam` : name;
}

/**
 * @param {string} groupKeyword — kullanıcının söylediği Türkçe cihaz-grubu kelimesi
 *   (kiosk.routes.js'in DEVICE_GROUP_MAP anahtarı — "koter"/"ligasure"/"ışık"/"lamba"/"masa")
 * @param {string} action — deriveAction'ın döndürdüğü eylem ('set_power'|'turn_on'|'turn_off'|'arm_move')
 * @param {number|null} [value] — set_power için hedef değer
 * @returns {string} onay sorusuna gömülecek doğal dil öbeği
 */
function describeDeviceAction(groupKeyword, action, value) {
  if (action === 'set_power') return `${groupKeyword}i ${value} yapmamı`;
  if (action === 'turn_on') return `${groupKeyword}i açmamı`;
  if (action === 'turn_off') return `${groupKeyword}i kapatmamı`;
  if (action === 'arm_move') return 'masayı hareket için hazırlamamı';
  return `${groupKeyword} için istediğiniz işlemi`;
}

module.exports = { addressSpeaker, describeDeviceAction };
