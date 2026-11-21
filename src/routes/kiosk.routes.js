const router = require('express').Router();
const { kioskRoomAuth } = require('../middleware/kioskRoomAuth');
const { validate } = require('../middleware/validate');
const { kioskVoiceCommandSchema } = require('../validators/schemas');
const { parseIntent } = require('../utils/kioskIntent');
const { ok, serverError } = require('../utils/response');

// Servis varsayılan olarak gerçek implementasyonu kullanır
// Test ortamında mock inject edilebilir (device.routes.js'teki desenle aynı)
const registry = require('../services/_registry');
const getKioskService = () => registry.get('kiosk', () => require('../services/kiosk.service'));

// SKS (Sağlıkta Kalite Standartları) Time-Out checklist, madde 16-17 — sabit metin.
const TIMEOUT_SENTENCES = [
  'Ekipteki kişiler kendilerini ad, soyad ve görevleri ile tanıttı mı?',
  'Ekipten bir kişi sesli olarak hastanın kimliğini, yapılan ameliyatı, ameliyat bölgesini teyit etti mi?',
];

const UNKNOWN_RESPONSE = { type: 'UNKNOWN', say: 'Anlayamadım, tekrar söyler misiniz?' };

/**
 * POST /api/kiosk/rooms/:roomId/voice-command
 *
 * Tek giriş noktası: tüm kiosk sesli komutları buradan geçer. kioskRoomAuth
 * (req.kiosk / req.activeSurgery doldurur) → parseIntent(transcript) → tipe göre dallanma.
 *
 * - TIMEOUT: req.speaker HİÇ gerekmez (kioskSpeakerAuth bilerek kullanılmaz) — SKS
 *   checklist'in bu iki maddesi ekipteki herkes tarafından okunabilir/teyit edilebilir,
 *   konuşmacı kimliği doğrulaması istemez. audit() 'voice:timeout_read' ile yazılır
 *   (userId: null — konuşmacı tanımlanmadı).
 * - DEVICE_COMMAND / SPOTIFY_PLAY / WEB_SEARCH: Task 7/9/10'da eklenecek — bu dallar
 *   kasıtlı olarak boş/TODO bırakıldı, şimdilik ortak UNKNOWN fallback'ine düşer.
 * - UNKNOWN (veya transcript < 3 karakter — bkz. parseIntent): sabit "Anlayamadım" yanıtı.
 */
router.post(
  '/rooms/:roomId/voice-command',
  kioskRoomAuth,
  validate(kioskVoiceCommandSchema),
  async (req, res) => {
    try {
      const intent = parseIntent(req.body.transcript);

      if (intent.type === 'TIMEOUT') {
        await getKioskService().recordTimeoutRead({ surgeryId: req.activeSurgery.id, req });
        return ok(res, { type: 'TIMEOUT', say: TIMEOUT_SENTENCES });
      }

      if (intent.type === 'DEVICE_COMMAND') {
        // TODO(Task 7): kioskSpeakerAuth + confirmationPhrase onay akışı + device.service
        // çağrısı buraya eklenecek.
      }

      if (intent.type === 'SPOTIFY_PLAY') {
        // TODO(Task 9): kioskSpeakerAuth + spotify.service çağrısı buraya eklenecek.
      }

      if (intent.type === 'WEB_SEARCH') {
        // TODO(Task 10): kioskSpeakerAuth + web arama servisi çağrısı buraya eklenecek.
      }

      // UNKNOWN ve henüz implemente edilmemiş diğer tipler için ortak fallback.
      return ok(res, UNKNOWN_RESPONSE);
    } catch (err) {
      return serverError(res, err);
    }
  }
);

module.exports = router;
