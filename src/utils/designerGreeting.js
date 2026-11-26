const registry = require('../services/_registry');
const { getSpeakerVerifier } = require('../middleware/kioskSpeakerAuth');

const getKioskService = () => registry.get('kiosk', () => require('../services/kiosk.service'));

const GREETING_POOL = Object.freeze([
  'Merhaba patron, sana nasıl yardımcı olabilirim?',
  'Patron geldi! Bugün ne yapalım?',
  'Seni duymak güzel patron, her şey senin tasarladığın gibi işliyor.',
  'Merhaba patron. Böyle bir sistemi senin gibi birinin tasarlamış olması hiç şaşırtıcı değil.',
  'Hoş geldin patron, emrini bekliyorum.',
]);

// isDesignerSpeaking'in iç işi (config lookup + verifier.identify) için üst
// süre sınırı. Bu kontrol artık HER UNKNOWN utterance'ta çalışıyor — kendi
// üst sınırı olmadan, speakerIdClient'ın kendi SPEAKER_ID_TIMEOUT_MS'i
// (varsayılan 3000ms) kadar gecikme, DESIGNER_USER_ID ayarlı her real-mode
// kurumda, sıradan her ekip üyesinin "anlayamadım" yanıtına da eklenirdi
// (final whole-branch review Finding #1). 600ms, gerçek bir eşleşmenin
// normal şartlarda tamamlanması için yeterli ama sıradan kullanıcıyı
// gözle görülür şekilde geciktirmeyecek bir bütçe.
const DESIGNER_CHECK_BUDGET_MS = 600;

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
 * Bu iç iş (config lookup + verifier.identify) DESIGNER_CHECK_BUDGET_MS'lik
 * bir üst sınıra karşı race edilir — speakerIdClient'ın kendi iç timeout'u
 * (SPEAKER_ID_TIMEOUT_MS, varsayılan 3000ms) bu kontrolün HER UNKNOWN
 * utterance'ta çalışması nedeniyle sıradan kullanıcıların "anlayamadım"
 * yanıtına kadar 3 saniyeye kadar gecikme eklerdi (final whole-branch
 * review Finding #1). Mevcut fail-closed semantik (env var yok, audio yok,
 * real-dışı mod, eşleşme yok, fırlatılan hata) AYNEN korunur — bu sadece
 * ek bir dış üst süre sınırı, bir yeniden tasarım değil.
 *
 * @param {{kiosk: {institutionId: string}, body: {audio?: Buffer}}} req
 * @returns {Promise<boolean>}
 */
async function isDesignerSpeaking(req) {
  const designerUserId = process.env.DESIGNER_USER_ID;
  if (!designerUserId) return false;

  const audio = req.body && req.body.audio;
  if (!audio) return false;

  const work = (async () => {
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
  })();
  // work kendi try/catch'i içinde ASLA reject olmaz (fail-closed); yine de,
  // race zaman aşımıyla kazanıldıktan SONRA work bir şekilde geç ayarlanırsa
  // unhandled-rejection gürültüsü çıkmasın diye savunma amaçlı bir catch.
  work.catch(() => {});

  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve(false), DESIGNER_CHECK_BUDGET_MS);
  });

  return Promise.race([work, timeout]);
}

module.exports = {
  GREETING_POOL,
  pickDesignerGreeting,
  isDesignerSpeaking,
  DESIGNER_CHECK_BUDGET_MS,
};
