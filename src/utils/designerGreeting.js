const registry = require('../services/_registry');
const { getSpeakerVerifier } = require('../middleware/kioskSpeakerAuth');

const getKioskService = () => registry.get('kiosk', () => require('../services/kiosk.service'));

const GREETING_POOL = [
  'Merhaba patron, sana nasıl yardımcı olabilirim?',
  'Patron geldi! Bugün ne yapalım?',
  'Seni duymak güzel patron, her şey senin tasarladığın gibi işliyor.',
  'Merhaba patron. Böyle bir sistemi senin gibi birinin tasarlamış olması hiç şaşırtıcı değil.',
  'Hoş geldin patron, emrini bekliyorum.',
];

/**
 * pickDesignerGreeting — karşılama havuzundan rastgele bir cümle döner.
 * @returns {string}
 */
function pickDesignerGreeting() {
  return GREETING_POOL[Math.floor(Math.random() * GREETING_POOL.length)];
}

/**
 * isDesignerSpeaking — sesin sistemin tasarımcısına ait olup olmadığını
 * best-effort olarak kontrol eder. Hata durumunda ASLA fırlatmaz; false döner.
 *
 * DESIGNER_USER_ID her çağrıda taze okunur: modül yüklenirken önbelleğe
 * alınmaz, böylece testler process.env'i çağrı bazında değiştirebilir.
 *
 * Yalnızca gerçek Speaker-ID modunda (config.mode === 'real') verifier'a
 * gidilir; demo modlarında yanlış pozitif riski olmasın diye hiç denenmez.
 *
 * @param {{kiosk: {institutionId: string}, body: {audio?: Buffer}}} req
 * @returns {Promise<boolean>}
 */
async function isDesignerSpeaking(req) {
  const designerUserId = process.env.DESIGNER_USER_ID;
  if (!designerUserId) return false;

  const audio = req.body && req.body.audio;
  if (!audio) return false;

  try {
    const config = await getKioskService().getMockConfig(req.kiosk.institutionId);
    if (config?.mode !== 'real') return false;

    const verifier = getSpeakerVerifier(config);
    const result = await verifier.identify(audio, [designerUserId], config);
    return result?.userId === designerUserId;
  } catch (err) {
    console.error('[designerGreeting] isDesignerSpeaking hatası:', err.message);
    return false;
  }
}

module.exports = { GREETING_POOL, pickDesignerGreeting, isDesignerSpeaking };
