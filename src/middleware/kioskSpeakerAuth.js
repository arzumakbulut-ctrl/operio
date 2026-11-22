const { MockSpeakerVerifier } = require('../drivers/MockSpeakerVerifier');
const registry = require('../services/_registry');

const getKioskService = () => registry.get('kiosk', () => require('../services/kiosk.service'));

/**
 * getSpeakerVerifier — şu an için tek seçenek Mock'tur (gerçek konuşmacı-tanıma
 * entegrasyonu henüz yok). Bu KASITLI olarak cihaz sürücülerindeki driver_key
 * tabanlı registry'den (src/drivers/registry.js, Plan 1) ayrı, küçük bir
 * seçimdir — ileride gerçek bir sürücü eklendiğinde burası genişletilir.
 */
function getSpeakerVerifier() {
  return new MockSpeakerVerifier();
}

/**
 * kioskSpeakerAuth — kioskRoomAuth'tan SONRA zincirlenir; req.kiosk ve
 * req.activeSurgery'nin zaten dolu olduğunu varsayar. Ses örneğinden
 * konuşmacıyı tanımlar ve bu ameliyatın ekibinde olup olmadığını doğrular:
 *
 *   1. req.activeSurgery.surgeryTeams'ten candidateUserIds çıkarılır.
 *   2. kiosk.service.getMockConfig() ile kurumun mock konfigürasyonu okunur
 *      ve MockSpeakerVerifier.identify()'a geçirilir.
 *   3. mode === 'cycle' ise, bir sonraki çağrının index'i ilerlemesi için
 *      incrementMockCycleIndex() çağrılır (hata bu isteğin yanıtını
 *      engellemez — sadece loglanır).
 *   4. identify() null dönerse              → 403 { code: 'unrecognized' }
 *      (konuşmacının kimliği belirsiz — mesaj kasıtlı olarak İSİM İÇERMEZ).
 *   5. identify() dolu ama userId ekipte     → 403 { code: 'not_in_team' }
 *      değilse                                 (kimliği "tanınan" ama bu
 *                                                ameliyatta yetkisiz biri —
 *                                                (4)'teki mesajla KARIŞMAZ).
 *   6. ekipteyse                              → eşleşen candidate'in
 *                                                surgeryTeams'teki tam
 *                                                kaydından req.speaker
 *                                                doldurulur, next() çağrılır
 *                                                (ek DB sorgusu YOK).
 *
 * Review Focus #3: (4) ve (5)'teki mesajlar iki ayrı, birbirine asla
 * karışmayan anlam taşır: "seni tanıyamadım" (kimliği bilinmiyor) vs.
 * "seni tanıdım ama yetkin yok" (kimliği bilinen yetkisiz kişi).
 */
async function kioskSpeakerAuth(req, res, next) {
  try {
    const { institutionId } = req.kiosk;
    const surgeryTeams = req.activeSurgery.surgeryTeams;
    const candidateUserIds = surgeryTeams.map(member => member.userId);

    const kioskService = getKioskService();
    const config = await kioskService.getMockConfig(institutionId);

    // audio null/eksik olabilir (kiosk henüz bir ses parçası kaydetmemişken ya da mikrofon
    // izni yokken — bkz. kioskVoiceCommandSchema). Verifier'a her durumda null olarak geçer;
    // sözleşme (SpeakerVerifier.identify JSDoc): null ses örneği "eşleşme yok" demektir ve
    // ASLA fırlatmamalıdır. MockSpeakerVerifier audioBuffer'ı zaten hiç kullanmaz.
    const audioBuffer = (req.body && req.body.audio) ?? null;
    const verifier = getSpeakerVerifier();
    const result = await verifier.identify(audioBuffer, candidateUserIds, config);

    if (config.mode === 'cycle') {
      // Fire-and-forget'e yakın: bir sonraki çağrının index'i ilerlemesi
      // içindir, ancak bu isteğin yanıtını bloklamaz/başarısızlığından
      // etkilenmez.
      try {
        await kioskService.incrementMockCycleIndex(institutionId);
      } catch (err) {
        console.error('[kioskSpeakerAuth] incrementMockCycleIndex hatası:', err.message);
      }
    }

    if (!result) {
      return res.status(403).json({
        success: false,
        error: { code: 'unrecognized', message: 'Sizi tanıyamadım, lütfen tekrar deneyin.' },
      });
    }

    const member = surgeryTeams.find(m => m.userId === result.userId);
    if (!member) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'not_in_team',
          message: 'Sizi tanıdım, ancak bu ameliyatta görevli değilsiniz, komut veremezsiniz.',
        },
      });
    }

    req.speaker = {
      userId: member.userId,
      fullName: member.fullName,
      roleId: member.roleId,
      teamRole: member.teamRole,
    };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { kioskSpeakerAuth, getSpeakerVerifier };
