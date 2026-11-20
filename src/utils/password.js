const bcrypt = require('bcryptjs');
const db     = require('./db');
const { PASSWORD } = require('../config/security');

/**
 * Şifre gücünü doğrula — politikayı karşılamıyorsa hata mesajları döndür.
 * @param {string} password
 * @returns {string[]} hata mesajları — boş dizi = geçerli
 */
function validatePasswordStrength(password) {
  const errors = [];

  if (!password || password.length < PASSWORD.MIN_LENGTH) {
    errors.push(`Şifre en az ${PASSWORD.MIN_LENGTH} karakter olmalı`);
  }
  if (password.length > PASSWORD.MAX_LENGTH) {
    errors.push(`Şifre en fazla ${PASSWORD.MAX_LENGTH} karakter olabilir`);
  }
  if (PASSWORD.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('En az bir büyük harf (A-Z) içermeli');
  }
  if (PASSWORD.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('En az bir küçük harf (a-z) içermeli');
  }
  if (PASSWORD.REQUIRE_NUMBER && !/[0-9]/.test(password)) {
    errors.push('En az bir rakam (0-9) içermeli');
  }
  if (PASSWORD.REQUIRE_SPECIAL && !/[^A-Za-z0-9]/.test(password)) {
    errors.push('En az bir özel karakter (!@#$%^&* vb.) içermeli');
  }

  // Yaygın zayıf şifreler
  const COMMON = ['password', '12345678', 'qwerty123', 'operio123', 'hastane123'];
  if (COMMON.includes(password.toLowerCase())) {
    errors.push('Bu şifre çok yaygın — daha özgün bir şifre seçin');
  }

  return errors;
}

/**
 * Şifreyi güvenli hashle (bcrypt, cost=12)
 */
async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

/**
 * Şifre doğrula
 */
async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/**
 * Şifrenin son N geçmişte kullanılıp kullanılmadığını kontrol et.
 * @returns {boolean} true = daha önce kullanılmış (reddedilmeli)
 */
async function isPasswordReused(userId, newPassword) {
  const { rows } = await db.query(
    `SELECT password_hash FROM password_history
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, PASSWORD.HISTORY_COUNT]
  );

  for (const row of rows) {
    const match = await bcrypt.compare(newPassword, row.password_hash);
    if (match) return true;
  }
  return false;
}

/**
 * Şifre geçmişine ekle (eski şifre kaydedilir, yeni şifre uygulanır)
 */
async function savePasswordHistory(userId, passwordHash) {
  await db.query(
    `INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)`,
    [userId, passwordHash]
  );

  // Sadece son N kaydı tut
  await db.query(
    `DELETE FROM password_history
     WHERE user_id = $1
       AND id NOT IN (
         SELECT id FROM password_history
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2
       )`,
    [userId, PASSWORD.HISTORY_COUNT]
  );
}

/**
 * Şifre değiştir — politika + geçmiş kontrolü yapar.
 * @throws {Error} Politika ihlali durumunda
 */
async function changePassword({ userId, currentPassword, newPassword }) {
  // Mevcut şifreyi doğrula
  const { rows } = await db.query(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId]
  );
  if (!rows[0]) throw new Error('Kullanıcı bulunamadı');

  const valid = await verifyPassword(currentPassword, rows[0].password_hash);
  if (!valid) throw Object.assign(new Error('Mevcut şifre hatalı'), { statusCode: 400 });

  // Yeni şifre politikası
  const strengthErrors = validatePasswordStrength(newPassword);
  if (strengthErrors.length) {
    throw Object.assign(new Error(strengthErrors.join('; ')), { statusCode: 400 });
  }

  // Geçmiş kontrolü
  const reused = await isPasswordReused(userId, newPassword);
  if (reused) {
    throw Object.assign(
      new Error(`Son ${PASSWORD.HISTORY_COUNT} şifrenizden birini kullanamazsınız`),
      { statusCode: 400 }
    );
  }

  const newHash = await hashPassword(newPassword);

  // Eski şifreyi geçmişe ekle, yeni şifreyi uygula
  await db.transaction(async (client) => {
    await savePasswordHistory(userId, rows[0].password_hash);
    await client.query(
      `UPDATE users SET password_hash=$1, password_changed_at=NOW(), updated_at=NOW() WHERE id=$2`,
      [newHash, userId]
    );
  });

  return true;
}

module.exports = {
  validatePasswordStrength,
  hashPassword,
  verifyPassword,
  isPasswordReused,
  savePasswordHistory,
  changePassword,
};
