/**
 * Tek seferlik provisioning: "designer" (patron) hesabını oluşturur.
 *
 * Kullanım (operatör, bir kez, manuel):
 *   DESIGNER_EMAIL=... DESIGNER_PASSWORD=... DESIGNER_FULL_NAME=... \
 *     node scripts/provision-designer-account.js
 *
 * Çıktıdaki id'yi .env dosyasına DESIGNER_USER_ID olarak ekleyin.
 * Bu script uygulama tarafından çağrılmaz.
 */
async function provisionDesignerAccount({ email, password, fullName }) {
  // Dinamik import: vi.mock() yalnızca import() yoluyla yüklenen modülü yakalar.
  const authService = await import('../src/services/auth.service.js');
  const user = await authService.register({
    email,
    password,
    fullName,
    roleId: 0,
    institutionId: null,
  });
  return user.id;
}

async function main() {
  const email    = process.env.DESIGNER_EMAIL;
  const password = process.env.DESIGNER_PASSWORD;
  const fullName = process.env.DESIGNER_FULL_NAME;

  const missing = [
    ['DESIGNER_EMAIL', email],
    ['DESIGNER_PASSWORD', password],
    ['DESIGNER_FULL_NAME', fullName],
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missing.length) {
    console.error('Eksik ortam değişkenleri: ' + missing.join(', '));
    process.exit(1);
  }

  try {
    const id = await provisionDesignerAccount({ email, password, fullName });
    console.log('Designer hesabı oluşturuldu. .env dosyana şunu ekle: DESIGNER_USER_ID=' + id);
    process.exit(0);
  } catch (err) {
    console.error('Hesap oluşturulamadı:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { provisionDesignerAccount };
