const { forbidden, conflict, serverError } = require('./response');

// executeCommand/physicalConfirm'in attığı BİLİNEN reddetme nedenleri (device.service.js'teki
// checkDeviceAuthorization/decideCommand/executeCommand/physicalConfirm'den gelir). Bunlar
// yetkilendirme/iş-kuralı reddini temsil eder → 403 (not_armed hariç, bkz. aşağı — o bir
// durum çatışmasıdır, 409 döner). Bu listede olmayan, beklenmeyen bir hata (DB hatası,
// sürücü çökmesi vb.) sessizce 403'e gizlenmez — 500 olarak kalır.
const COMMAND_REJECTION_REASONS = new Set([
  'device_not_found',
  'role_not_allowed',
  'room_mismatch',
  'team_role_required',
  'physical_confirm_required',
  'not_armed',
  'unknown_action',
  'surgery_ended',
]);

// Ham İngilizce/teknik reddetme nedenleri doğrudan son kullanıcıya gösterilmiyor — frontend
// bu mesajı bir toast'ta olduğu gibi gösteriyor. Bilinen her neden için kullanıcıya dönük,
// Türkçe bir mesaja çevriliyor; allowlist'te olmayan (beklenmedik) bir neden için ham mesaja
// düşülüyor (kapalı liste sayesinde pratikte hiç gerçekleşmemeli).
const REJECTION_MESSAGES_TR = {
  device_not_found:          'Cihaz bulunamadı.',
  role_not_allowed:          'Bu işlem için rolünüz yetkili değil.',
  room_mismatch:             'Bu komutu verebilmek için cihazın bulunduğu odadaki aktif bir ameliyat ekibinde olmanız gerekir.',
  team_role_required:        'Bu cihazı sadece ameliyattaki cerrah kontrol edebilir.',
  physical_confirm_required: 'Bu cihazda hareket, önce "hazırla" komutuyla başlatılıp fiziksel konsoldan onaylanmalı.',
  not_armed:                 'Cihaz şu anda fiziksel onay bekleyen bir hareket durumunda değil.',
  unknown_action:            'Bu komut bu cihaz için geçerli değil.',
  surgery_ended:             'Bu komutu onaylayan ameliyat sona erdiği için işlem tamamlanamadı.',
};

function handleCommandError(res, err) {
  const trMessage = REJECTION_MESSAGES_TR[err.message] ?? err.message;

  // not_armed bir yetkilendirme reddi değil, bir durum çatışması — 409.
  if (err.message === 'not_armed') {
    return conflict(res, trMessage);
  }
  if (COMMAND_REJECTION_REASONS.has(err.message)) {
    return forbidden(res, trMessage);
  }
  return serverError(res, err);
}

module.exports = { COMMAND_REJECTION_REASONS, REJECTION_MESSAGES_TR, handleCommandError };
