const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { RATE_LIMIT } = require('../config/security');
const { verifyKioskToken } = require('../utils/kioskJwt');
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
const { addressSpeaker, describeDeviceAction } = require('../utils/kioskAddressing');
const { isDesignerSpeaking, pickDesignerGreeting } = require('../utils/designerGreeting');

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
 *   - masa (table) → transcript "kapat"/"durdur" içeriyorsa 'turn_off' (hareket İÇERMEYEN,
 *     device.service.decideCommand'ın requires_physical_confirm cihazlar için zaten izin
 *     verdiği güvenli disarm/durdurma eylemi). Aksi HER durumda 'arm_move' (masalar sesli
 *     komutla hareketi sadece kurabilir/arm — asıl hareket fiziksel konsoldan onaylanır;
 *     turn_on/set_power asla; bkz. Plan 1 tasarımı). value verilmemişse null.
 *   - diğer gruplar → params.value bir SAYIYSA 'set_power'; değilse transcript "aç"
 *     içeriyorsa 'turn_on'; "kapat" içeriyorsa 'turn_off'; hiçbiri eşleşmezse null döner
 *     (çağıran taraf bunu "anlayamadım" fallback'i olarak ele alır — UNKNOWN'la aynı ruhta,
 *     ama bir hata değil).
 */
function deriveAction(deviceGroup, transcript, value) {
  if (deviceGroup === 'table') {
    if (/kapat|durdur/i.test(transcript)) {
      return { action: 'turn_off' };
    }
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
const UNKNOWN_ESCALATED_RESPONSE = {
  type: 'UNKNOWN',
  say: 'Ne demek istediğinizi anlamadım, herhangi bir işlem yapmıyorum.',
};

// roomId → ardışık UNKNOWN sayısı. kioskConfirmation.service.js'teki bellek-içi
// Map deseniyle tutarlı (DB YOK, registry YOK, saf JS) — sadece kademeli mesaj
// seçimi için tutulur, TTL'si yok: herhangi bir BAŞKA intent tipi (onay dalı
// dahil) sayacı sıfırlar, bu yüzden sonsuza kadar büyümez.
const UNKNOWN_STREAK = new Map();

/**
 * kioskRateLimitKey — kiosk limitinin anahtarı. app.js'teki genel IP-bazlı limit
 * /api/kiosk/*'u muaf tutar (aynı NAT arkasındaki kiosk'lar + klinisyenler birbirinin
 * kotasını tüketmesin); burada bunun yerine kiosk token'ının jti'si (kioskRoomAuth'un
 * kullandığı aynı verifyKioskToken ile, İMZASI DOĞRULANARAK çıkarılır — doğrulanmamış
 * bir jti'yle anahtarlamak, istemcinin her istekte jti uydurup limiti atlatmasına izin
 * verirdi) kullanılır. Token yok/geçersizse IP'ye düşülür (bu istekler zaten
 * kioskRoomAuth'ta 401 alacak; yine de sınırsız kalmamaları için).
 */
function kioskRateLimitKey(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const { jti } = verifyKioskToken(header.slice(7));
      if (jti) return `kiosk-jti:${jti}`;
    } catch {
      // geçersiz token — IP'ye düş
    }
  }
  return `kiosk-ip:${req.ip}`;
}

router.use(rateLimit({
  windowMs: RATE_LIMIT.KIOSK_WINDOW_MS,
  max:      RATE_LIMIT.KIOSK_MAX,
  keyGenerator: kioskRateLimitKey,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Çok fazla istek gönderildi, lütfen bekleyin' },
  },
}));

/**
 * Onaylanmış bir DEVICE_COMMAND'ın başarı mesajı. arm_move hareketi GERÇEKLEŞTİRMEZ —
 * sadece kurar (ARMED); asıl hareket fiziksel konsoldan onaylanır (physicalConfirm).
 * Bu yüzden arm_move için "uygulandı" demek yanıltıcı olur. Diğer tüm eylemler
 * (turn_on/turn_off/set_power, masa için turn_off dahil) jenerik mesajı kullanır.
 */
function deviceCommandSuccessSay(action) {
  if (action === 'arm_move') {
    return 'Masa hazırlandı, konsoldan fiziksel onay bekleniyor.';
  }
  return 'Komut uygulandı.';
}

const CONFIRMATION_MISMATCH_BODY = {
  success: false,
  error: {
    code: 'confirmation_mismatch',
    message: 'Onay ifadesi hatalı veya süresi geçmiş, lütfen tekrar deneyin.',
  },
};

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
 * - ONAY ÇAĞRISI (body.confirmationAnswer dolu bir string): parseIntent HİÇ çalışmaz —
 *   transcript (genelde sadece söylenen "evet"/"hayır" cevabı) yönlendirmeyi etkilemez.
 *   kioskSpeakerAuth'tan geçilir, bekleyen onay (doğal dil evet/hayır + başlatan
 *   konuşmacıyla eşleşme, bkz. kioskConfirmation.service.js) resolvePendingConfirmation'ın
 *   4 sonucundan birine (null/unresolved/cancelled/confirmed) bağlanır; sadece 'confirmed'
 *   device.service.executeCommand()'ı tetikler (kendi audit()'ini kendi yazar). Bu ikinci
 *   çağrı da kioskRoomAuth'tan GEÇER — ameliyat artık IN_PROGRESS değilse bekleyen onaya
 *   hiç bakılmadan 409 döner (Review Focus #2).
 * - DEVICE_COMMAND (Task 7, ilk çağrı): kioskSpeakerAuth'tan geçer (req.speaker doldurulur),
 *   eylem türetilir, hedef cihaz bulunur ve kioskConfirmation.service'te konuşmacıya bağlı
 *   bir bekleyen onay (20sn TTL) oluşturulup addressSpeaker+describeDeviceAction'dan kurulu
 *   doğal bir soru ("{Ad} [hocam], {eylem} istiyorsunuz, doğru mu?") döner (Task 9 — artık
 *   rakam YOK; final whole-branch review finding #6 — "istiyorsunuz" yüklemi eklendi).
 * - SPOTIFY_PLAY (Task 9): DEVICE_COMMAND gibi kioskSpeakerAuth'tan manuel geçer, AMA
 *   DEVICE_COMMAND'ın aksine TEK adımda sonuçlanır — sesli onay döngüsüne (confirmationAnswer/
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
 * - UNKNOWN (veya transcript < 3 karakter — bkz. parseIntent): önce isDesignerSpeaking(req)
 *   ile best-effort bir designer kontrolü yapılır — eşleşirse NLU/komut akışına hiç
 *   girilmeden `{type: 'GREETING', ...}` döner, ardışık-anlaşılamama sayacı sıfırlanır;
 *   eşleşmezse (ya da kontrol başarısız olursa) sabit "Anlayamadım" yanıtı değişmeden
 *   devam eder (bkz. designerGreeting.js).
 */
router.post(
  '/rooms/:roomId/voice-command',
  kioskRoomAuth,
  validate(kioskVoiceCommandSchema),
  async (req, res) => {
    try {
      const { confirmationAnswer } = req.body;

      if (typeof confirmationAnswer === 'string' && confirmationAnswer.trim().length > 0) {
        // İkinci (onay) çağrısı — parseIntent'ten ÖNCE ve ONDAN BAĞIMSIZ ele alınır.
        // Gerçek istemci bu çağrıda transcript olarak kullanıcının söylediği serbest
        // metni gönderir; confirmationAnswer ise ayrıştırılmış evet/hayır cevabını taşır
        // ("evet", "hayır", ya da anlaşılmaz bir şey). confirmationAnswer varken
        // transcript'in içeriği yönlendirmeyi HİÇ etkilemez; eylem/cihaz bilgisi zaten
        // bekleyen payload'da saklıdır.
        //
        // kioskRoomAuth bu isteği de yeni baştan çalıştırdığı için (Review Focus #2)
        // ameliyatın hâlâ IN_PROGRESS olduğu burada ayrıca kontrol edilmeden garanti.
        // executeCommand userId/roleId istediğinden konuşmacı yine tanımlanır (aynı manuel
        // kioskSpeakerAuth deseni — bkz. DEVICE_COMMAND dalındaki yorum).
        let speakerAuthErr = null;
        await kioskSpeakerAuth(req, res, (err) => { speakerAuthErr = err; });
        if (speakerAuthErr) throw speakerAuthErr;
        if (res.headersSent) return;

        // Onay dalına girildi — bu bir UNKNOWN deneme değil, sayaç sıfırlanır (bkz.
        // dosya başı UNKNOWN_STREAK yorumu).
        UNKNOWN_STREAK.delete(req.kiosk.roomId);

        // resolvePendingConfirmation 4 sonuçtan birini döner (bkz. kioskConfirmation.
        // service.js dosya başı yorumu):
        //   null                          → bekleyen onay yok/süresi geçti
        //   {status:'unresolved'}         → anlaşılmayan cevap VEYA yanlış konuşmacı;
        //                                   entry silinmez, sessizce yeniden sorulur
        //   {status:'cancelled'}          → açık "hayır"
        //   {status:'confirmed', payload} → açık "evet", doğru konuşmacı
        const result = resolvePendingConfirmation(req.kiosk.roomId, confirmationAnswer, req.speaker.userId);

        if (!result) {
          return res.status(400).json(CONFIRMATION_MISMATCH_BODY);
        }

        if (result.status === 'unresolved') {
          // Kullanıcıya tekrar sormak için yeni bir söz üretmiyoruz (say: null) —
          // kiosk istemcisi bu durumda son soruyu değiştirmeden bekler.
          return ok(res, { type: 'DEVICE_COMMAND', status: 'pending_confirmation', say: null });
        }

        if (result.status === 'cancelled') {
          return ok(res, { type: 'DEVICE_COMMAND', say: 'Komut iptal edildi.' });
        }

        const { payload } = result;
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
          return ok(res, { type: 'DEVICE_COMMAND', say: deviceCommandSuccessSay(payload.action), device: updated });
        } catch (err) {
          return handleCommandError(res, err);
        }
      }

      const intent = parseIntent(req.body.transcript);

      // intent.type UNKNOWN DIŞINDA bir şeye ayrıştı — ardışık "anlayamadım" dizisi
      // bozuldu, sayaç sıfırlanır (bkz. dosya başı UNKNOWN_STREAK yorumu).
      if (intent.type !== 'UNKNOWN') {
        UNKNOWN_STREAK.delete(req.kiosk.roomId);
      }

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

        // (confirmationAnswer'lı onay çağrısı buraya hiç ulaşmaz — handler'ın başında,
        // parseIntent'ten önce ele alınır.) Hedef cihazı bul ve bekleyen onay oluştur.
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

        // initiatingUserId: bekleyen onay, komutu başlatan konuşmacıya bağlanır — onay
        // çağrısında FARKLI bir ekip üyesi tanımlanırsa resolvePendingConfirmation reddeder.
        // createPendingConfirmation artık bir şey DÖNDÜRMEZ (bkz. kioskConfirmation.
        // service.js) — doğal dil sorusu addressSpeaker+describeDeviceAction'dan kurulur.
        createPendingConfirmation(req.kiosk.roomId, {
          deviceId: device.id,
          action: derived.action,
          value: derived.value,
          initiatingUserId: req.speaker.userId,
        });
        // "istiyorsunuz" EKLENDİ (final whole-branch review finding #6) — eski
        // metin dilbilgisel olarak eksikti ("...koteri açmamı, doğru mu?",
        // yüklemsiz); tasarım dokümanının kendi örneği
        // ("...yapmamı istiyorsunuz, doğru mu?") ile hizalandı.
        const say = `${addressSpeaker(req.speaker)}, ${describeDeviceAction(groupKeyword, derived.action, derived.value)} istiyorsunuz, doğru mu?`;
        return ok(res, {
          type: 'DEVICE_COMMAND',
          status: 'pending_confirmation',
          say,
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

      // Designer easter-egg: UNKNOWN'a ayrışan (komut/spotify/arama/time-out
      // olmayan) serbest konuşmada, konuşmacı designer ise (gerçek Speaker-ID
      // ile, sadece config.mode==='real' kurumlarda — bkz. designerGreeting.js)
      // sabit komut akışına hiç girmeden bir karşılama döner. Bu bir
      // "anlayamadım" değildir — streak sıfırlanır.
      if (await isDesignerSpeaking(req)) {
        UNKNOWN_STREAK.delete(req.kiosk.roomId);
        return ok(res, { type: 'GREETING', say: pickDesignerGreeting() });
      }

      // UNKNOWN (parseIntent'in döndürdüğü tek diğer tip) — ardışık deneme sayısına
      // göre kademeli mesaj: ilk başarısızlıkta nazik tekrar isteği, ikinci ve
      // sonraki ardışık başarısızlıklarda "hiçbir işlem yapmıyorum" ile netleştirme
      // (bkz. dosya başı UNKNOWN_STREAK yorumu).
      const streak = (UNKNOWN_STREAK.get(req.kiosk.roomId) || 0) + 1;
      UNKNOWN_STREAK.set(req.kiosk.roomId, streak);
      return ok(res, streak >= 2 ? UNKNOWN_ESCALATED_RESPONSE : UNKNOWN_RESPONSE);
    } catch (err) {
      return serverError(res, err);
    }
  }
);

/**
 * GET /api/kiosk/rooms/:roomId/status
 *
 * Kiosk'un oda durumunu sorgular. Sadece kioskRoomAuth'u kullanır — kioskRoomAuth
 * ameliyat yoksa zaten 409 döner, dolayısıyla buraya gelen her istek aktif bir
 * ameliyatı olan odaya aittir.
 */
router.get('/rooms/:roomId/status', kioskRoomAuth, (req, res) => ok(res, { active: true, surgeryId: req.activeSurgery.id }));

module.exports = router;
