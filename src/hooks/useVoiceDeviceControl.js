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
  const [pendingPhrase, setPendingPhrase] = useState(null);

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

  function setPhase(next) {
    phaseRef.current = next;
    setState(next);
  }

  function stopPipeline() {
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

  async function startAudioCapture() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
    if (typeof window === 'undefined' || !window.MediaRecorder) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (unmountedRef.current || phaseRef.current === 'no_surgery') {
        // Bu arada unmount/no_surgery olduysa hemen bırak — mikrofonu açık tutma.
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const recorder = new window.MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) latestAudioChunkRef.current = e.data;
      };
      recorder.start(AUDIO_TIMESLICE_MS);
      mediaRecorderRef.current = { recorder, stream };
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
    let audioBase64 = null;
    if (latestAudioChunkRef.current) {
      try { audioBase64 = await blobToBase64(latestAudioChunkRef.current); } catch { audioBase64 = null; }
    }
    try {
      const response = await kioskAPI.voiceCommand(roomId, kioskToken, { ...payload, audio: audioBase64 });
      handleResponse(response);
    } catch (err) {
      handleError(err, { isConfirmationCall: !!payload.confirmationPhrase });
    }
  }

  function handleResponse(response) {
    setLastResponse(response);

    if (response?.type === 'TIMEOUT' && Array.isArray(response.say)) {
      // İki cümle sırayla okunur. Tarayıcının speechSynthesis kuyruğu
      // çağrıları zaten sıraya aldığı için art arda iki speak() çağrısı
      // yeterli (ikinciyi onend'e bağlamaya gerek yok) — bilinçli tercih.
      response.say.forEach((sentence) => speak(sentence));
      setPendingPhrase(null);
      setPhase('idle');
      return;
    }

    if (response?.status === 'pending_confirmation') {
      setPendingPhrase(response.phrase);
      setPhase('awaiting_confirmation');
      speak(response.say);
      return;
    }

    // Diğer tüm tek adımlı yanıtlar: DEVICE_COMMAND (status'suz),
    // SPOTIFY_PLAY, WEB_SEARCH, UNKNOWN, ya da onay sonrası final DEVICE_COMMAND.
    setPendingPhrase(null);
    speak(response?.say);
    setPhase('idle');
  }

  function handleError(err, { isConfirmationCall } = {}) {
    if (isConfirmationCall && err?.code === 'confirmation_mismatch') {
      speak(err.message);
      setPendingPhrase(null);
      setPhase('idle');
      return;
    }

    if (err?.status === 403) {
      // Backend mesajı zaten tam bir Türkçe cümle — direkt okunur.
      speak(err.message);
      setPendingPhrase(null);
      setPhase('idle');
      return;
    }

    if (err?.status === 409) {
      speak(SURGERY_ENDED_MESSAGE);
      setPendingPhrase(null);
      setPhase('no_surgery');
      // Ameliyat bittiyse dinleme hattının açık kalmasının bir anlamı yok —
      // mikrofonu/recognition'ı burada aktif olarak durduruyoruz (plan sadece
      // "onend'de yeniden başlatma" diyor, ama kaynakları hemen bırakmak daha
      // temiz — onend guard'ı zaten bunu tamamlayıcı olarak koruyor).
      stopPipeline();
      return;
    }

    speak(GENERIC_ERROR_MESSAGE);
    setPendingPhrase(null);
    setPhase('idle');
  }

  function handleWakeWordUtterance(commandText) {
    // 'no_surgery': pipeline durdurulmuş olmalı ama olur da bir onresult
    // sıraya girmiş olursa yoksay. 'executing': aynı anda ikinci bir isteği
    // tetiklememek için (plan bunu tanımlamıyor, ek bir güvenlik önlemi).
    if (phaseRef.current === 'no_surgery' || phaseRef.current === 'executing') return;

    // Ses tamponu (latestAudioChunkRef) sendVoiceCommand() içinde okunuyor —
    // bu, o anki en son 3 saniyelik parçayı "bu ifadenin sesi" olarak alır.
    if (phaseRef.current === 'awaiting_confirmation') {
      sendVoiceCommand({ transcript: commandText, confirmationPhrase: commandText });
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

  return { state, lastResponse, pendingPhrase, start };
}
