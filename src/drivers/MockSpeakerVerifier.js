const { SpeakerVerifier } = require('./SpeakerVerifier');

/**
 * always_reject_team modunda kasıtlı olarak döndürülen, hiçbir gerçek
 * kullanıcıya karşılık gelmeyen sabit bir UUID. Amaç sadece "ekip dışı"
 * reddini (kioskSpeakerAuth'taki not_in_team dalını) deterministik olarak
 * tetiklemektir — gerçek bir "başka kullanıcı" için users tablosuna
 * sorgu atmaya gerek yoktur (bu demo/mock akışta kasıtlı bir tasarım kararı).
 */
const NOT_IN_TEAM_USER_ID = '00000000-0000-4000-8000-000000000000';

/**
 * MockSpeakerVerifier — gerçek ses-tanıma donanımı/servisi olmadan
 * kioskSpeakerAuth akışını test etmeye yarayan deterministik simülatör.
 *
 * identify() kasıtlı olarak SAF (pure) bir fonksiyondur: yan etkisi yoktur,
 * DB'ye dokunmaz, iç durum tutmaz. 'cycle' modunun index'i ilerletmesi
 * (kiosk_mock_config'e yazma) tamamen çağıranın (kioskSpeakerAuth +
 * kiosk.service.js'in incrementMockCycleIndex'i) sorumluluğundadır — bu da
 * identify()'ı DB mock'u olmadan birim testi kolay tutar.
 *
 * mode:
 *   'always_match'         → candidateUserIds[0] ile eşleşir (confidence 1)
 *   'always_reject_team'   → ekipte OLMAYAN sabit bir userId döner (NOT_IN_TEAM_USER_ID)
 *   'always_unrecognized'  → null (konuşmacı tanınamadı)
 *   'cycle'                → candidateUserIds[config.cycleIndex % length] döner;
 *                            bilinmeyen/eksik mode için 'always_match' davranışına düşer.
 */
class MockSpeakerVerifier extends SpeakerVerifier {
  async identify(audioBuffer, candidateUserIds, config) {
    const mode = config && config.mode;

    if (mode === 'always_unrecognized') {
      return null;
    }

    if (mode === 'always_reject_team') {
      return { userId: NOT_IN_TEAM_USER_ID, confidence: 1 };
    }

    if (!candidateUserIds || candidateUserIds.length === 0) {
      return null;
    }

    if (mode === 'cycle') {
      const cycleIndex = (config && typeof config.cycleIndex === 'number') ? config.cycleIndex : 0;
      const userId = candidateUserIds[cycleIndex % candidateUserIds.length];
      return { userId, confidence: 1 };
    }

    // 'always_match' ve varsayılan/bilinmeyen mode
    return { userId: candidateUserIds[0], confidence: 1 };
  }
}

module.exports = { MockSpeakerVerifier, NOT_IN_TEAM_USER_ID };
