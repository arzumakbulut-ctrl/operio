const router = require('express').Router();
const { kioskRoomAuth } = require('../middleware/kioskRoomAuth');
const { kioskSpeakerAuth } = require('../middleware/kioskSpeakerAuth');
const { validate } = require('../middleware/validate');
const { kioskVoiceCommandSchema } = require('../validators/schemas');
const { parseIntent } = require('../utils/kioskIntent');
const { ok, serverError } = require('../utils/response');
const { handleCommandError } = require('../utils/deviceCommandErrors');
const { createPendingConfirmation, resolvePendingConfirmation } = require('../services/kioskConfirmation.service');
const { MockSpotifyPlaybackDriver } = require('../drivers/MockSpotifyPlaybackDriver');
const { isClinicalQuestion } = require('../utils/clinicalQuestionClassifier');

// Servis varsayılan olarak gerçek implementasyonu kullanır
// Test ortamında mock inject edilebilir (device.routes.js'teki desenle aynı)
const registry = require('../services/_registry');
const getKioskService   = () => registry.get('kiosk', () => require('../services/kiosk.service'));
const getDeviceService  = () => registry.get('device', () => require('../services/device.service'));
const getSpotifyService = () => registry.get('spotify', () => require('../services/spotify.service'));
const getAiService      = () => registry.get('ai', () => require('../services/ai.service'));
// Spotify çalma sürücüsü de (device.service ile aynı sebeple) registry üzerinden alınır —
// kioskSpeakerAuth'un getSpeakerVerifier()'ı (registry'siz, sabit factory) buna UYGUN
// DEĞİLDİR, çünkü MockSpeakerVerifier.identify() yan etkisizdir ama MockSpotifyPlaybackDriver.
// play() KENDİ İÇİNDE audit() çağırır (gerçek DB'ye yazar) — entegrasyon testlerinin bunu
// enjekte edebilmesi gerekir (bkz. kioskVoiceCommand.spotify.test.js).
const getSpotifyPlaybackDriver = () => registry.get('spotifyPlaybackDriver', () => new MockSpotifyPlaybackDriver());

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

/**
 * extractSpotifyQuery — SPOTIFY_PLAY transcript'inden arama sorgusunu çıkarır.
 * parseIntent SPOTIFY_PLAY için params.query DÖNDÜRMEZ (sadece "spotify" geçtiğini
 * tespit eder, bkz. kioskIntent.js) — bu basit ikinci-aşama ayrıştırma, "spotify"
 * kelimesinden SONRA kalan her şeyi sorgu olarak alır.
 *
 * "spotify" kelimesinin hemen ardına kesme işaretiyle bitişik gelen bir Türkçe hal
 * eki varsa (örn. "spotify'da", "spotify'dan") bu ek atılır; ardından baştaki/
 * sondaki noktalama ve boşluklar kırpılır. Kasıtlı olarak basit tutulmuştur — tam
 * dil bilgisi ayrıştırması bu task'ın kapsamı dışındadır (bkz. task brief).
 */
function extractSpotifyQuery(transcript) {
  const text = transcript ?? '';
  const idx = text.toLowerCase().indexOf('spotify');
  if (idx === -1) return '';

  let rest = text.slice(idx + 'spotify'.length);
  rest = rest.replace(/^'\p{L}*/u, ''); // "'da"/"'de"/"'dan"/"'den" vb. bitişik ek
  rest = rest.trim().replace(/^[-:,.'"]+\s*/, '').replace(/\s*[-:,.'"]+$/, '');
  return rest.trim();
}

/**
 * extractWebSearchQuery — WEB_SEARCH transcript'inden arama sorgusunu çıkarır.
 * parseIntent WEB_SEARCH için params.query DÖNDÜRMEZ (sadece transcript'in
 * kioskIntent.js'teki WEB_SEARCH_RE = /^(ara|bul)[:\s]/i ile eşleştiğini tespit
 * eder) — bu basit ikinci-aşama ayrıştırma, eşleşen öneki (tam olarak "ara:"/
 * "ara "/"bul:"/"bul " — regex'in kendisi tek bir ':' ya da boşluk karakteri
 * tüketir) transcript'ten kırpıp kalanı trim'ler. extractSpotifyQuery'nin
 * aksine ek noktalama temizliği YAPMAZ (kasıtlı olarak basit tutulmuştur —
 * bkz. task brief); kalan boşsa (sadece boşluklardan ibaretse) çağıran taraf
 * bunu "anlayamadım" fallback'i olarak ele alır.
 */
function extractWebSearchQuery(transcript) {
  const text = transcript ?? '';
  const match = text.match(/^(ara|bul)[:\s]/i);
  if (!match) return '';
  return text.slice(match[0].length).trim();
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
 * - SPOTIFY_PLAY (Task 9): DEVICE_COMMAND gibi kioskSpeakerAuth'tan manuel geçer, AMA
 *   DEVICE_COMMAND'ın aksine TEK adımda sonuçlanır — sesli onay döngüsüne (confirmationPhrase/
 *   createPendingConfirmation) HİÇ girmez. Sırasıyla: transcript'ten sorgu çıkarılır
 *   (extractSpotifyQuery) → spotify.service.refreshAccessTokenIfNeeded ile access token
 *   alınır (bağlantı yoksa 404 fırlatır — bu durumda kullanıcıya özel bir "bağlı değil"
 *   mesajı dönülür, jenerik bir hata DEĞİL) → spotify.service.searchTrackOrPlaylist ile
 *   GERÇEK bir Spotify arama çağrısı yapılır (sadece arama/resolve — plandaki tasarım
 *   kararı: gerçek play/transfer-playback endpoint'i bu fazda hiç çağrılmaz) → bulunan
 *   track/playlist MockSpotifyPlaybackDriver'a (ağ çağrısı yapmaz, audit() yazar) geçirilir.
 * - WEB_SEARCH (Task 10): SPOTIFY_PLAY gibi kioskSpeakerAuth'tan manuel geçer ve TEK
 *   adımda sonuçlanır (sesli onay döngüsüne hiç girmez). Sırasıyla: transcript'ten
 *   sorgu çıkarılır (extractWebSearchQuery — "ara:"/"ara "/"bul:"/"bul " önekini
 *   kırpar) → boşsa "anlayamadım" fallback'i → ai.service.webSearch(query) ile
 *   GERÇEK bir Claude web_search çağrısı yapılır → isClinicalQuestion(query) true
 *   ise yanıtın önüne doğrulanmamış-kaynak uyarısı eklenir → kiosk.service.
 *   recordWebSearch() ile audit'e SADECE soru+özet yazılır (audit() burada DOĞRUDAN
 *   çağrılmaz — bu projenin konvansiyonu, bkz. recordTimeoutRead).
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
        // Aynı manuel kioskSpeakerAuth çağırma deseni (DEVICE_COMMAND dalındaki yorum, Task 7,
        // bkz. yukarı) — ama bu dal TEK adımda sonuçlanır, sesli onay döngüsüne hiç girmez.
        let speakerAuthErr = null;
        await kioskSpeakerAuth(req, res, (err) => { speakerAuthErr = err; });
        if (speakerAuthErr) throw speakerAuthErr;
        if (res.headersSent) return;

        const query = extractSpotifyQuery(req.body.transcript);
        if (!query) {
          return ok(res, { type: 'SPOTIFY_PLAY', say: 'Ne çalmamı istediğinizi anlayamadım.' });
        }

        let accessToken;
        try {
          accessToken = await getSpotifyService().refreshAccessTokenIfNeeded(req.speaker.userId);
        } catch (err) {
          if (err.statusCode === 404) {
            // Beklenen, kullanıcıya özel bir durum (hesap bağlı değil) — sunucu hatası DEĞİL,
            // bu yüzden normal bir 200 yanıtı (bkz. Review Focus #4).
            return ok(res, {
              type: 'SPOTIFY_PLAY',
              say: 'Spotify hesabınız bağlı değil, Profil sayfasından bağlayabilirsiniz.',
            });
          }
          throw err;
        }

        const result = await getSpotifyService().searchTrackOrPlaylist(accessToken, query);
        if (!result) {
          return ok(res, { type: 'SPOTIFY_PLAY', say: 'Bu isimde bir şarkı veya liste bulamadım.' });
        }

        const driverResult = await getSpotifyPlaybackDriver().play({
          userName:  req.speaker.fullName,
          trackName: result.name,
          roomId:    req.kiosk.roomId,
          req,
        });
        return ok(res, { type: 'SPOTIFY_PLAY', say: driverResult.message });
      }

      if (intent.type === 'WEB_SEARCH') {
        // Aynı manuel kioskSpeakerAuth çağırma deseni (DEVICE_COMMAND/SPOTIFY_PLAY
        // dallarındaki yorum, Task 7/9, bkz. yukarı) — bu dal da TEK adımda
        // sonuçlanır, sesli onay döngüsüne hiç girmez (SPOTIFY_PLAY ile aynı ruh).
        let speakerAuthErr = null;
        await kioskSpeakerAuth(req, res, (err) => { speakerAuthErr = err; });
        if (speakerAuthErr) throw speakerAuthErr;
        if (res.headersSent) return;

        const query = extractWebSearchQuery(req.body.transcript);
        if (!query) {
          return ok(res, { type: 'WEB_SEARCH', say: 'Ne aramamı istediğinizi anlayamadım.' });
        }

        const rawAnswer = await getAiService().webSearch(query);
        // Gizlilik/güvenlik kararı (bkz. tasarım dokümanı): web arama klinik bir
        // soruya cevap veriyorsa, Operia bir tıbbi danışman OLMADIĞI için yanıtın
        // önüne doğrulanmamış-kaynak uyarısı eklenir. audit() SADECE bu nihai
        // (uyarılı ya da uyarısız) cevabı, soruyla birlikte loglar — ham arama
        // sonuçları/kaynaklar hiç persist edilmez (zaten webSearch() bunları ayıklar).
        const finalAnswer = isClinicalQuestion(query)
          ? `Bu doğrulanmış bir klinik kaynak değildir. ${rawAnswer}`
          : rawAnswer;

        // audit() DOĞRUDAN burada DEĞİL, kiosk.service.recordWebSearch() üzerinden
        // yazılır — bu projede audit() her zaman servis katmanından yazılır
        // (recordTimeoutRead ile aynı konvansiyon, bkz. dosya başı yorumu).
        await getKioskService().recordWebSearch({
          userId:    req.speaker.userId,
          surgeryId: req.activeSurgery.id,
          query,
          answer:    finalAnswer,
          req,
        });

        return ok(res, { type: 'WEB_SEARCH', say: finalAnswer });
      }

      // UNKNOWN ve henüz implemente edilmemiş diğer tipler için ortak fallback.
      return ok(res, UNKNOWN_RESPONSE);
    } catch (err) {
      return serverError(res, err);
    }
  }
);

module.exports = router;
