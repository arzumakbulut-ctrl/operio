import { useCallback, useEffect, useRef, useState } from 'react';
import { kioskAPI } from '../services/api.js';

// ──────────────────────────────────────────────────────────────
// Kiosk sesli cihaz kontrolü — uyandırma kelimesi ("operio") +
// SpeechRecognition + MediaRecorder + speechSynthesis boru hattı.
//
// Bu kod tabanında bu üç tarayıcı API'si birlikte kullanılan ilk
// özellik; MediaRecorder kullanımı Profil.jsx'teki (Task 12) sabit
// süreli ses kaydı deseninden esinlendi (blobToBase64 tekniği aynı),
// ama buradaki kullanım SÜREKLİ/DÖNEN bir tampon — tek seferlik değil.
//
// Durum makinesi dönüş tipi `'idle' | 'listening' | 'awaiting_confirmation'
// | 'executing' | 'no_surgery' | 'setup_error'` olarak tanımlı ('setup_error':
// status() 409 DIŞI bir hatayla — geçersiz token, modül yok, ağ — reddetti;
// terminal durum, polling yok), ancak aşağıdaki kontrolör
// mantığında 'listening' hiçbir yere ATANMIYOR: plan bu durum için bir
// geçiş kuralı tanımlamıyor — sürekli dinleme zaten 'idle' iken pasif
// olarak çalışıyor. 'listening' tip imzasında bilinçli olarak tutuldu
// (arayüz sözleşmesi plan metniyle aynı), ileride ayrıştırılabilir.
// ──────────────────────────────────────────────────────────────

const WAKE_WORD = 'operio';
const NO_SURGERY_POLL_MS = 15000;
const AUDIO_TIMESLICE_MS = 3000;
// Backend'deki pending-confirmation kaydı ~20 saniye sonra kendiliğinden süresi
// doluyor (bkz. spec Karar 12). Hook bunu kendi tarafında da uygulamalı — aksi
// halde kimse "evet"/"hayır" demezse state sonsuza dek awaiting_confirmation'da
// kalır ve bir süre sonra gelen TAMAMEN alakasız bir komut, backend tarafından
// süresi geçmiş/eşleşmeyen bir onay cevabı olarak değerlendirilip reddedilir.
const CONFIRMATION_TIMEOUT_MS = 20000;
// flushCurrentRecording() normalde recorder.stop()'un onstop'u (mock'larda
// senkron, gerçek tarayıcıda bir sonraki tick'te) tetiklemesiyle hemen çözülür.
// Ama bunun GARANTİ olmadığı durumlar var (bkz. Review Focus #1'in "sonsuza dek
// beklemeyelim" uyarısı: ör. nadir bir tarayıcı/cihaz tuhaflığı 'stop' olayını
// hiç fırlatmazsa) — bu kısa güvenlik ağı, handleWakeWordUtterance'ın komut
// gönderimini süresiz olarak engellememesini sağlar.
const FLUSH_SAFETY_TIMEOUT_MS = 500;
const GENERIC_ERROR_MESSAGE = 'Bir hata oluştu, lütfen tekrar deneyin.';
const SURGERY_ENDED_MESSAGE = 'Bu ameliyat sona erdi, sesli kontrol artık kapalı.';

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function speak(text) {
  if (!text) return;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

// Uyandırma kelimesinden sonraki metni çıkarır. "operio" geçmiyorsa veya
// geçtikten sonra komut metni (noktalama/boşluk temizlendikten sonra) boşsa
// null döner — çağıran taraf bu durumda bir sonraki ifadeyi bekler.
function extractCommandAfterWakeWord(transcriptSegment) {
  const lower = transcriptSegment.toLowerCase();
  const idx = lower.indexOf(WAKE_WORD);
  if (idx === -1) return null;
  const after = transcriptSegment.slice(idx + WAKE_WORD.length);
  const trimmed = after.replace(/^[\s,.;:!?-]+/, '').trim();
  return trimmed || null;
}

export function useVoiceDeviceControl(roomId, kioskToken) {
  const [state, setState] = useState('idle');
  const [lastResponse, setLastResponse] = useState(null);

  // phaseRef, `state`'in senkron bir yansısı — SpeechRecognition'ın onresult/
  // onend callback'leri bir kez oluşturulup kalıcı olduğu için (closure), bu
  // callback'lerin her zaman GÜNCEL fazı okuyabilmesi için React state'in
  // (asenkron/batch'lenen) yerine bu ref kullanılıyor.
  const phaseRef = useRef('idle');
  const unmountedRef = useRef(false);

  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  // Dönen (rolling) tek-parça ses tamponu — sadece EN SON chunk tutulur,
  // biriktirilmez. Plan bunun gerçek ifade sınırlarıyla hizalanmadığını
  // (yaklaşık/approximate) açıkça kabul ediyor; bu bilinçli bir basitleştirme.
  const latestAudioChunkRef = useRef(null);
  // handleWakeWordUtterance, bir "operio" ifadesi algılandığında O ANDA kayıtta
  // olan döngüyü flush etmek (stop edip onstop'un blob'u üretmesini beklemek)
  // için bu ref'e kendi resolve fonksiyonunu koyar; recordCycle'ın onstop'u
  // (normal döngü-sonu akışına ek olarak) bunu çağırır. bkz. flushCurrentRecording.
  const pendingFlushResolveRef = useRef(null);
  // awaiting_confirmation'a girildiğinde başlatılan, backend'in ~20s'lik
  // pending-confirmation TTL'ini istemci tarafında yansıtan zamanlayıcı.
  const confirmationTimeoutRef = useRef(null);

  function clearConfirmationTimeout() {
    if (confirmationTimeoutRef.current) {
      clearTimeout(confirmationTimeoutRef.current);
      confirmationTimeoutRef.current = null;
    }
  }

  function startConfirmationTimeout() {
    clearConfirmationTimeout();
    confirmationTimeoutRef.current = setTimeout(() => {
      confirmationTimeoutRef.current = null;
      // Hâlâ awaiting_confirmation'daysak (yani bu süre içinde evet/hayır/mismatch
      // gibi hiçbir şey state'i değiştirmediyse) sessizce idle'a dön — aksi halde
      // kullanıcının bir süre sonra söylediği TAMAMEN alakasız bir komut, backend
      // tarafında süresi geçmiş bir onay cevabı olarak reddedilip kaybolurdu.
      if (phaseRef.current === 'awaiting_confirmation') setPhase('idle');
    }, CONFIRMATION_TIMEOUT_MS);
  }

  function resolvePendingFlush() {
    if (pendingFlushResolveRef.current) {
      const resolve = pendingFlushResolveRef.current;
      pendingFlushResolveRef.current = null;
      resolve();
    }
  }

  // Şu an kayıtta olan döngüyü (varsa) hemen durdurup onstop'un blob'u üretmesini
  // bekler — handleWakeWordUtterance, sendVoiceCommand'ı çağırmadan ÖNCE bunu
  // await eder, böylece gönderilen ses "bir önceki tamamlanmış 3s'lik parça" değil,
  // "wake-word'ün algılandığı ana kadar kaydedilmiş" ses olur (bkz. Review Focus #1).
  // Kayıtta aktif bir döngü yoksa (mikrofon izni yok/MediaRecorder desteklenmiyor)
  // hemen çözülür — sonsuza dek beklemez.
  function flushCurrentRecording() {
    const current = mediaRecorderRef.current;
    if (!current || current.recorder.state !== 'recording') return Promise.resolve();
    return new Promise((resolve) => {
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        pendingFlushResolveRef.current = null;
        resolve();
      };
      pendingFlushResolveRef.current = settle;
      // Güvenlik ağı: onstop çağrılmazsa (ör. .stop() 'stop' olayını hiç
      // tetiklemezse) bu await sonsuza dek asılı kalmasın — kısa bir süre
      // sonra mevcut (muhtemelen bayat) ref değeriyle devam et.
      setTimeout(settle, FLUSH_SAFETY_TIMEOUT_MS);
      try {
        current.recorder.stop();
      } catch {
        // stop() çağrısı başarısız oldu (ör. zaten durdurulmuş) — hemen çöz.
        settle();
      }
    });
  }

  function setPhase(next) {
    phaseRef.current = next;
    // awaiting_confirmation'dan başka HERHANGİ bir faza geçişte TTL zamanlayıcısını
    // iptal et — onay başka bir yoldan (cevap/hata/mismatch) zaten çözüldü, daha
    // sonra geç kalmış bir zamanlayıcı yanlışlıkla state'i tekrar etkilememeli.
    if (next !== 'awaiting_confirmation') clearConfirmationTimeout();
    setState(next);
  }

  function stopPipeline() {
    clearConfirmationTimeout();
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* zaten durmuş olabilir */ }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current) {
      const { recorder, stream } = mediaRecorderRef.current;
      try { recorder.stop(); } catch { /* zaten durmuş olabilir */ }
      try { stream.getTracks().forEach((t) => t.stop()); } catch { /* yoksay */ }
      mediaRecorderRef.current = null;
    }
  }

  function startRecognition() {
    const SpeechRecognitionCtor = (typeof window !== 'undefined')
      && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SpeechRecognitionCtor) return; // Tarayıcı desteklemiyor — sessizce atla.

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.lang = 'tr-TR';
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const results = event.results || [];
      const startIdx = event.resultIndex || 0;
      for (let i = startIdx; i < results.length; i += 1) {
        const result = results[i];
        if (!result || result.isFinal === false) continue;
        const alt = result[0];
        const transcriptSegment = (alt && alt.transcript) || '';
        const commandText = extractCommandAfterWakeWord(transcriptSegment);
        if (commandText) handleWakeWordUtterance(commandText);
      }
    };

    recognition.onend = () => {
      // Sürekli dinleme kendini "iyileştirmeli" (tarayıcılar continuous
      // recognition'ı periyodik olarak durdurur) — ANCAK unmount olduysak
      // veya artık ameliyat yoksa YENİDEN BAŞLATMA.
      if (unmountedRef.current || phaseRef.current === 'no_surgery') return;
      try { recognition.start(); } catch { /* zaten başlamış olabilir */ }
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch { /* yoksay */ }
  }

  // Her döngüde TAZE bir MediaRecorder örneği başlatır. WebM/Opus konteyner
  // başlığı sadece bir recorder'ın İLK chunk'ında bulunur — sürekli/tek bir
  // recorder üzerinde periyodik dataavailable kullanmak, ilk parça dışındaki
  // tüm parçaları başlıksız (bağımsız decode edilemez) bırakır. Bu yüzden
  // recorder, her AUDIO_TIMESLICE_MS'de stop() edilip (tam/kendi içinde
  // tutarlı bir blob üretip) yeniden start() ediliyor — tek seferlik
  // timeslice yerine kendi kendini yeniden başlatan bir döngü.
  function recordCycle(stream) {
    if (unmountedRef.current || phaseRef.current === 'no_surgery') return;
    try {
      const chunks = [];
      const recorder = new window.MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        // Stale-cycle guard: hook'un efekti roomId/kioskToken değişimiyle yeniden
        // çalıştıysa (cleanup -> yeniden kurulum), bu döngünün stream'i artık
        // mediaRecorderRef'te tutulan AKTİF stream olmayabilir — gerçek
        // tarayıcıda stop() olayı asenkron geldiği için yeni efekt zaten
        // unmountedRef'i resetlemiş olabilir. Böyle bir durumda ÖLÜ stream
        // üzerinde döngüyü yeniden başlatma.
        if (mediaRecorderRef.current?.stream !== stream) {
          resolvePendingFlush();
          return;
        }
        if (chunks.length > 0) latestAudioChunkRef.current = new Blob(chunks, { type: 'audio/webm' });
        resolvePendingFlush();
        recordCycle(stream);
      };
      recorder.start();
      mediaRecorderRef.current = { recorder, stream };
      setTimeout(() => {
        try { recorder.stop(); } catch { /* zaten durmuş olabilir */ }
      }, AUDIO_TIMESLICE_MS);
    } catch {
      // MediaRecorder oluşturma veya start() hata verdi (ör. mikrofon track'i
      // bitti/cihaz kaybedildi, ameliyat ortasında olabilir) — döngüyü burada
      // SESSİZCE durdur, tekrar recordCycle çağırıp aynı hatayı sıkı bir
      // döngüde tekrarlama. latestAudioChunkRef'i temizle: bir sonraki komut
      // artık YENİ bir chunk yakalanamadığı için bayat (potansiyel olarak
      // başka birine ait) sesi yeniden göndermek yerine audio:null göndermeli.
      latestAudioChunkRef.current = null;
      resolvePendingFlush();
    }
  }

  async function startAudioCapture() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
    if (typeof window === 'undefined' || !window.MediaRecorder) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { noiseSuppression: true, echoCancellation: true },
      });
      if (unmountedRef.current || phaseRef.current === 'no_surgery') {
        // Bu arada unmount/no_surgery olduysa hemen bırak — mikrofonu açık tutma.
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      recordCycle(stream);
    } catch {
      // Mikrofon izni verilmedi veya hata oluştu — komut hattı sessiz
      // (audio:null) olarak çalışmaya devam eder, bu kritik bir hata değil.
    }
  }

  function startPipeline() {
    startRecognition();
    startAudioCapture();
  }

  async function sendVoiceCommand(payload) {
    setPhase('executing');
    // Tek-seferlik ("consumed-once") okuma: ref'i HEMEN temizle ki bu döngü
    // başarısız olur/hiç yeni chunk yakalanmazsa bir SONRAKİ komut bu (muhtemelen
    // bayat, başka birine ait) sesi sessizce yeniden göndermesin — onun yerine
    // audio:null göndersin (backend bunu zaten güvenli varsayılan "tanınamadı"
    // olarak ele alıyor).
    const chunkToSend = latestAudioChunkRef.current;
    latestAudioChunkRef.current = null;
    let audioBase64 = null;
    if (chunkToSend) {
      try { audioBase64 = await blobToBase64(chunkToSend); } catch { audioBase64 = null; }
    }
    try {
      const response = await kioskAPI.voiceCommand(roomId, kioskToken, { ...payload, audio: audioBase64 });
      handleResponse(response);
    } catch (err) {
      handleError(err, { isConfirmationCall: !!payload.confirmationAnswer });
    }
  }

  function handleResponse(response) {
    // say:null + pending_confirmation → backend hâlâ belirsiz (ambiguous) ASR
    // sonuçları nedeniyle bekliyor; bu durumda lastResponse'u EZME — ekranda
    // halen görünen asıl onay sorusu (say'li önceki pending_confirmation
    // yanıtı) kaybolmasın, kiosk sessizce beklerken kullanıcı soruyu okuyabilsin.
    const isAmbiguousPendingConfirmation = response?.status === 'pending_confirmation' && !response.say;
    if (!isAmbiguousPendingConfirmation) setLastResponse(response);

    if (response?.type === 'TIMEOUT' && Array.isArray(response.say)) {
      // İki cümle sırayla okunur. Tarayıcının speechSynthesis kuyruğu
      // çağrıları zaten sıraya aldığı için art arda iki speak() çağrısı
      // yeterli (ikinciyi onend'e bağlamaya gerek yok) — bilinçli tercih.
      response.say.forEach((sentence) => speak(sentence));
      setPhase('idle');
      return;
    }

    if (response?.status === 'pending_confirmation') {
      // say:null → belirsiz (ambiguous), hiçbir şey okunmadan awaiting_confirmation'da
      // kalınır. speak() zaten falsy metinde no-op olduğu için ek bir dallanma gerekmez.
      setPhase('awaiting_confirmation');
      speak(response.say);
      // İstemci tarafı TTL: backend'in ~20s'lik pending-confirmation penceresini
      // yansıtır (bkz. CONFIRMATION_TIMEOUT_MS tanımı). setPhase('awaiting_confirmation')
      // zaten varsa önceki zamanlayıcıyı silmiyor (next==='awaiting_confirmation' olduğu
      // için) — bu yüzden burada açıkça (yeniden) başlatıyoruz.
      startConfirmationTimeout();
      return;
    }

    // Diğer tüm tek adımlı yanıtlar: DEVICE_COMMAND (status'suz — "Komut iptal
    // edildi." dahil), SPOTIFY_PLAY, WEB_SEARCH, UNKNOWN, ya da onay sonrası
    // final DEVICE_COMMAND.
    speak(response?.say);
    setPhase('idle');
  }

  function handleError(err, { isConfirmationCall } = {}) {
    if (isConfirmationCall && err?.code === 'confirmation_mismatch') {
      speak(err.message);
      setPhase('idle');
      return;
    }

    if (err?.status === 403) {
      // Backend mesajı zaten tam bir Türkçe cümle — direkt okunur.
      speak(err.message);
      setPhase('idle');
      return;
    }

    if (err?.status === 409) {
      speak(SURGERY_ENDED_MESSAGE);
      setPhase('no_surgery');
      // Ameliyat bittiyse dinleme hattının açık kalmasının bir anlamı yok —
      // mikrofonu/recognition'ı burada aktif olarak durduruyoruz (plan sadece
      // "onend'de yeniden başlatma" diyor, ama kaynakları hemen bırakmak daha
      // temiz — onend guard'ı zaten bunu tamamlayıcı olarak koruyor).
      stopPipeline();
      return;
    }

    speak(GENERIC_ERROR_MESSAGE);
    setPhase('idle');
  }

  async function handleWakeWordUtterance(commandText) {
    // 'no_surgery': pipeline durdurulmuş olmalı ama olur da bir onresult
    // sıraya girmiş olursa yoksay. 'executing': aynı anda ikinci bir isteği
    // tetiklememek için (plan bunu tanımlamıyor, ek bir güvenlik önlemi).
    if (phaseRef.current === 'no_surgery' || phaseRef.current === 'executing') return;

    // Review Focus #1: SpeechRecognition'ın final transcript'i, konuşma
    // bittikten ~0.5-1.5s SONRA gelir — bu yüzden wake-word algılandığı anda
    // latestAudioChunkRef'teki değer hâlâ BİR ÖNCEKİ (tamamlanmış) 3s'lik
    // parça olur, asıl konuşma ise o anda hâlâ kayıtta olan döngüde birikiyor
    // olur. Göndermeden ÖNCE o döngüyü flush edip (stop + onstop'un blob'u
    // üretmesini bekleyip) tamamlamak, gönderilen sesi gerçek ifadeye çok
    // daha yakın hale getirir (mükemmel hizalama değil, ama sınırlı/kayda
    // değer bir iyileştirme).
    await flushCurrentRecording();

    // Flush beklenirken (ör. MediaRecorder.stop()'un gerçek tarayıcıdaki
    // asenkron onstop'u) faz değişmiş olabilir — aynı korumaları tekrar kontrol et.
    if (phaseRef.current === 'no_surgery' || phaseRef.current === 'executing') return;

    // Ses tamponu (latestAudioChunkRef) sendVoiceCommand() içinde okunuyor —
    // flush sayesinde bu artık o anki en son (ve wake-word anına kadar
    // kaydedilmiş) parçayı "bu ifadenin sesi" olarak alır.
    if (phaseRef.current === 'awaiting_confirmation') {
      sendVoiceCommand({ transcript: commandText, confirmationAnswer: commandText });
    } else {
      sendVoiceCommand({ transcript: commandText });
    }
  }

  // status() hatası sınıflandırması: SADECE 409 gerçek "aktif ameliyat yok"
  // durumudur (ameliyat sonra başlayabilir → polling anlamlı). 401/403 (geçersiz/
  // iptal edilmiş token, modül satın alınmamış), ağ hatası vb. bir YAPILANDIRMA
  // sorunudur — bir insanın URL/token/modülü düzeltmesi gerekir, polling işe
  // yaramaz. Bu durumlar terminal 'setup_error' durumuna gider (polling YOK).
  function phaseForStatusError(err) {
    return err?.status === 409 ? 'no_surgery' : 'setup_error';
  }

  // Tarayıcılar (Chrome vb.) speechSynthesis.speak() ve mikrofonu bir kullanıcı
  // etkileşimi (tıklama/dokunma) olmadan engelliyor. Bu yüzden boru hattı
  // mount'ta DEĞİL, Kiosk.jsx'teki "Başlat" dokunuşunun çağırdığı start() ile
  // başlar. start() idempotent — ikinci çağrı etkisizdir.
  const [started, setStarted] = useState(false);
  const start = useCallback(() => setStarted(true), []);

  useEffect(() => {
    if (!started) return undefined;
    unmountedRef.current = false;
    let cancelled = false;

    async function init() {
      try {
        await kioskAPI.status(roomId, kioskToken);
        if (cancelled || unmountedRef.current) return;
        setPhase('idle');
        startPipeline();
      } catch (err) {
        if (cancelled || unmountedRef.current) return;
        setPhase(phaseForStatusError(err));
      }
    }
    init();

    return () => {
      cancelled = true;
      unmountedRef.current = true;
      stopPipeline();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, roomId, kioskToken]);

  useEffect(() => {
    if (state !== 'no_surgery') return undefined;

    const id = setInterval(async () => {
      try {
        await kioskAPI.status(roomId, kioskToken);
        if (unmountedRef.current) return;
        setPhase('idle');
        startPipeline();
      } catch (err) {
        if (unmountedRef.current) return;
        // 409: hâlâ aktif ameliyat yok — bir sonraki turda tekrar denenecek.
        // Diğer hatalar (ör. token bu arada iptal edildi): setup_error'a geç,
        // bu da state değiştiği için polling'i durdurur.
        if (err?.status !== 409) setPhase('setup_error');
      }
    }, NO_SURGERY_POLL_MS);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, roomId, kioskToken]);

  return { state, lastResponse, start };
}
