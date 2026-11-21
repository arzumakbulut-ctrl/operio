const router = require('express').Router();
const { kioskRoomAuth } = require('../middleware/kioskRoomAuth');
const { kioskSpeakerAuth } = require('../middleware/kioskSpeakerAuth');
const { validate } = require('../middleware/validate');
const { kioskVoiceCommandSchema } = require('../validators/schemas');
const { parseIntent } = require('../utils/kioskIntent');
const { ok, serverError } = require('../utils/response');
const { handleCommandError } = require('../utils/deviceCommandErrors');
const { createPendingConfirmation, resolvePendingConfirmation } = require('../services/kioskConfirmation.service');

// Servis varsayılan olarak gerçek implementasyonu kullanır
// Test ortamında mock inject edilebilir (device.routes.js'teki desenle aynı)
const registry = require('../services/_registry');
const getKioskService  = () => registry.get('kiosk', () => require('../services/kiosk.service'));
const getDeviceService = () => registry.get('device', () => require('../services/device.service'));

// parseIntent'in DEVICE_COMMAND için döndürdüğü Türkçe anahtar kelime (koter/ligasure/
// ışık/lamba/masa — bkz. kioskIntent.js DEVICE_GROUPS), device.service/DB'nin device_group
// enum'una eşlenir. "endoscopy_imaging" grubuna henüz hiçbir anahtar kelime eşlenmiyor —
// dil bilgisine ileride eklenecek bir genişleme, bu task'ın kapsamı dışında.
const DEVICE_GROUP_MAP = {
  koter: 'electrosurgery',
  ligasure: 'electrosurgery',
  'ışık': 'light',
  lamba: 'light',
  masa: 'table',
};

/**
 * parseIntent DEVICE_COMMAND için eylemi (action) AYRIŞTIRMAZ — sadece deviceGroup
 * (Türkçe anahtar kelime) ve varsa transcript'teki bir sayıyı (params.value) verir.
 * Bu, DEVICE_COMMAND dalına özel ikinci-aşama bir ayrıştırmadır:
 *
 *   - masa (table) → HER ZAMAN 'arm_move' (masalar sesli komutla sadece kol/fiziksel-onay
 *     destekler — turn_on/off/set_power asla; bkz. Plan 1 tasarımı). value verilmemişse null.
 *   - diğer gruplar → params.value bir SAYIYSA 'set_power'; değilse transcript "aç"
 *     içeriyorsa 'turn_on'; "kapat" içeriyorsa 'turn_off'; hiçbiri eşleşmezse null döner
 *     (çağıran taraf bunu "anlayamadım" fallback'i olarak ele alır — UNKNOWN'la aynı ruhta,
 *     ama bir hata değil).
 */
function deriveAction(deviceGroup, transcript, value) {
  if (deviceGroup === 'table') {
    return { action: 'arm_move', value: value ?? null };
  }
  if (typeof value === 'number') {
    return { action: 'set_power', value };
  }
  if (/aç/i.test(transcript)) {
    return { action: 'turn_on' };
  }
  if (/kapat/i.test(transcript)) {
    return { action: 'turn_off' };
  }
  return null;
}

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
 * - DEVICE_COMMAND (Task 7): kioskSpeakerAuth'tan geçer (req.speaker doldurulur), sonra
 *   iki aşamalı sesli onay döngüsü çalışır — confirmationPhrase yoksa kioskConfirmation.
 *   service'te bir bekleyen onay (10sn TTL) oluşturulup phrase döner; confirmationPhrase
 *   varsa çözülür ve device.service.executeCommand() çağrılır (kendi audit()'ini kendi
 *   yazar). Bu ikinci çağrı da kioskRoomAuth'tan GEÇER — ameliyat artık IN_PROGRESS
 *   değilse bekleyen onaya hiç bakılmadan 409 döner (Review Focus #2).
 * - SPOTIFY_PLAY / WEB_SEARCH: Task 9/10'da eklenecek — bu dallar kasıtlı olarak boş/TODO
 *   bırakıldı, şimdilik ortak UNKNOWN fallback'ine düşer.
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
        // kioskRoomAuth zaten çalıştı (req.kiosk/req.activeSurgery dolu). kioskSpeakerAuth'u
        // SADECE bu dal için, tek bir route handler içinden manuel çağırıyoruz — router-level
        // middleware zincirine eklemek TIMEOUT'un kasıtlı olarak speaker-auth'suz kalma
        // gereksinimini bozardı (dosya başı yorumuna bkz). kioskSpeakerAuth kendi içinde ya
        // next()'i (başarı, req.speaker doldurulur) ya da res üzerinden bir 403'ü (başarısızlık)
        // tetikler; next'e bir err geçirilirse yukarıdaki catch'in yakalaması için fırlatılır,
        // aksi halde res.headersSent kioskSpeakerAuth'un zaten yanıt verip vermediğini söyler.
        let speakerAuthErr = null;
        await kioskSpeakerAuth(req, res, (err) => { speakerAuthErr = err; });
        if (speakerAuthErr) throw speakerAuthErr;
        if (res.headersSent) return;

        const { deviceGroup: groupKeyword, value: parsedValue } = intent.params;
        const deviceGroup = DEVICE_GROUP_MAP[groupKeyword];
        const derived = deriveAction(deviceGroup, req.body.transcript, parsedValue);

        if (!derived) {
          return ok(res, {
            type: 'DEVICE_COMMAND',
            say: 'Ne yapmamı istediğinizi anlayamadım, lütfen tekrar söyleyin.',
          });
        }

        const { confirmationPhrase } = req.body;

        if (confirmationPhrase) {
          // İkinci (onay) çağrısı — kioskRoomAuth bu isteği de yeni baştan çalıştırdığı için
          // (Review Focus #2) ameliyatın hâlâ IN_PROGRESS olduğu zaten burada ayrıca
          // kontrol edilmeden garanti; bekleyen onay bulunamazsa/süresi geçmişse/yanlışsa
          // resolvePendingConfirmation null döner.
          const payload = resolvePendingConfirmation(req.kiosk.roomId, confirmationPhrase);
          if (!payload) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'confirmation_mismatch',
                message: 'Onay ifadesi hatalı veya süresi geçmiş, lütfen tekrar deneyin.',
              },
            });
          }

          try {
            const updated = await getDeviceService().executeCommand({
              deviceId: payload.deviceId,
              institutionId: req.kiosk.institutionId,
              userId: req.speaker.userId,
              roleId: req.speaker.roleId,
              action: payload.action,
              value: payload.value,
              req,
            });
            return ok(res, { type: 'DEVICE_COMMAND', say: 'Komut uygulandı.', device: updated });
          } catch (err) {
            return handleCommandError(res, err);
          }
        }

        // confirmationPhrase henüz yok — hedef cihazı bul ve bekleyen onay oluştur.
        // listDevices deviceGroup filtresi ALMAZ (sadece kurum+oda) — dönen listeden
        // device_group'u eşleşen İLK cihaz seçilir (birden fazla eşleşirse ilki kazanır).
        const devices = await getDeviceService().listDevices({
          institutionId: req.kiosk.institutionId,
          roomId: req.kiosk.roomId,
        });
        const device = devices.find(d => d.device_group === deviceGroup);
        if (!device) {
          return handleCommandError(res, new Error('device_not_found'));
        }

        const { phrase } = createPendingConfirmation(req.kiosk.roomId, {
          deviceId: device.id,
          action: derived.action,
          value: derived.value,
        });
        return ok(res, {
          type: 'DEVICE_COMMAND',
          status: 'pending_confirmation',
          phrase,
          say: `Onaylamak için şu rakamları tekrar söyleyin: ${phrase}`,
        });
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
