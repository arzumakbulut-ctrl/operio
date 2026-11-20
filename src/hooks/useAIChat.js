import { useState, useCallback } from 'react';
import { useDataStore } from '../store';

/**
 * useAIChat — Operia "AI" asistanı, yerel veri üzerinde çalışır.
 *
 * Gerçek bir LLM çağrısı yapmaz — bunun yerine niyet tanıma (intent matching)
 * ile kullanıcının sorusunu sınıflandırıp, mevcut store verisinden (ameliyatlar,
 * salonlar, steril setler, personel, hastalar) anlamlı bir yanıt üretir.
 * Maliyetsizdir, internet/backend gerektirmez.
 *
 * API yüzeyi (messages, streaming, pendingAction, error, sendMessage, ...)
 * önceki backend-tabanlı sürümle aynı tutuldu, AIPanel.jsx değişmeden çalışır.
 */

function simulateTyping(fullText, onToken, onDone, action) {
  // Karakter karakter "yazıyor" hissi vermek için kısa aralıklarla token akıt.
  let i = 0;
  const chunkSize = 3; // birkaç karakterlik parçalar halinde
  const interval = setInterval(() => {
    if (i >= fullText.length) {
      clearInterval(interval);
      onDone(fullText, action);
      return;
    }
    const chunk = fullText.slice(i, i + chunkSize);
    onToken(chunk);
    i += chunkSize;
  }, 12);
  return () => clearInterval(interval);
}

function normalize(s) {
  return (s || '').toLocaleLowerCase('tr-TR').trim();
}

export function useAIChat() {
  const [messages, setMessages]           = useState([]);
  const [streaming, setStreaming]         = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [error, setError]                 = useState(null);

  const { surgeries, rooms, sterilSetler, personel, hastalar, addSurgery } = useDataStore();

  const buildAnswer = useCallback((rawText) => {
    const q = normalize(rawText);

    // ── Bugünkü ameliyat programı ─────────────────────────────
    if (q.includes('ameliyat program') || q.includes('bugünkü ameliyat') || (q.includes('ameliyat') && q.includes('özetle'))) {
      if (surgeries.length === 0) return 'Bugün için kayıtlı ameliyat bulunmuyor.';
      const satirlar = surgeries.slice(0, 8).map(s =>
        `- **${s.saat || '—'}** ${s.op || s.hasta || 'Ameliyat'} — ${s.salon || 'Salon belirtilmemiş'} (${s.durum || s.st || 'durum bilinmiyor'})`
      );
      return `Bugün **${surgeries.length} ameliyat** kayıtlı:\n\n${satirlar.join('\n')}${surgeries.length > 8 ? `\n\n...ve ${surgeries.length - 8} ameliyat daha.` : ''}`;
    }

    // ── Boş / aktif salonlar ───────────────────────────────────
    if (q.includes('boş salon') || (q.includes('salon') && (q.includes('boş') || q.includes('müsait')))) {
      const bosSalonlar = rooms.filter(r => {
        const d = normalize(r.durum || r.status);
        return d.includes('boş') || d.includes('müsait') || d === 'idle';
      });
      if (bosSalonlar.length === 0) return 'Şu anda boş/müsait salon görünmüyor — tüm salonlar dolu veya bakımda olabilir.';
      return `Şu an **${bosSalonlar.length} salon** boş: ${bosSalonlar.map(r => r.ad || r.name).join(', ')}.`;
    }

    if (q.includes('aktif salon') || (q.includes('salon') && q.includes('durum'))) {
      if (rooms.length === 0) return 'Salon verisi bulunamadı.';
      const satirlar = rooms.slice(0, 10).map(r => `- **${r.ad || r.name}**: ${r.durum || r.status || 'bilinmiyor'}`);
      return `Salon durumları:\n\n${satirlar.join('\n')}`;
    }

    // ── Steril set durumu ────────────────────────────────────
    if (q.includes('steril set') || (q.includes('set') && q.includes('durum'))) {
      if (sterilSetler.length === 0) return 'Steril set verisi bulunamadı.';
      const ozet = {};
      sterilSetler.forEach(s => { const d = s.durum || 'Bilinmiyor'; ozet[d] = (ozet[d]||0)+1; });
      const satirlar = Object.entries(ozet).map(([d,sayi]) => `- **${d}**: ${sayi} set`);
      return `Steril set durumu (${sterilSetler.length} set):\n\n${satirlar.join('\n')}`;
    }

    // ── Nöbetteki / aktif personel ─────────────────────────────
    if (q.includes('nöbet') || (q.includes('personel') && (q.includes('listele') || q.includes('kim')))) {
      const aktifler = personel.filter(p => (p.durum || p.s) === 'Aktif');
      if (aktifler.length === 0) return 'Aktif/nöbetteki personel bulunamadı.';
      const satirlar = aktifler.slice(0, 12).map(p => `- ${p.ad || p.n} (${p.rol || p.r || 'Rol belirtilmemiş'})`);
      return `Aktif personel (${aktifler.length} kişi):\n\n${satirlar.join('\n')}${aktifler.length > 12 ? `\n\n...ve ${aktifler.length - 12} kişi daha.` : ''}`;
    }

    // ── Tamamlanan ameliyatlar ───────────────────────────────
    if (q.includes('tamamlanan ameliyat') || (q.includes('ameliyat') && q.includes('tamamlan'))) {
      const tamam = surgeries.filter(s => normalize(s.durum || s.st).includes('tamam'));
      if (tamam.length === 0) return 'Bugün henüz tamamlanan ameliyat bulunmuyor.';
      const satirlar = tamam.map(s => `- ${s.op || s.hasta} — ${s.salon || ''}`);
      return `Tamamlanan ameliyatlar (${tamam.length}):\n\n${satirlar.join('\n')}`;
    }

    // ── Hasta arama (isimle) ───────────────────────────────────
    const hastaEslesme = hastalar.find(h => q.includes(normalize(h.ad)) || (h.ad && normalize(h.ad).includes(q) && q.length > 2));
    if (hastaEslesme) {
      return `**${hastaEslesme.ad}** hasta kaydı bulundu. Detaylar için Hasta Kayıtları sayfasından arayabilirsiniz.`;
    }

    // ── Personel arama (isimle) ─────────────────────────────────
    const personelEslesme = personel.find(p => {
      const ad = normalize(p.ad || p.n);
      return ad && (q.includes(ad) || (ad.includes(q) && q.length > 2));
    });
    if (personelEslesme) {
      const ad = personelEslesme.ad || personelEslesme.n;
      const rol = personelEslesme.rol || personelEslesme.r || 'Rol belirtilmemiş';
      const durum = personelEslesme.durum || personelEslesme.s || 'Bilinmiyor';
      return `**${ad}** — ${rol}, durum: ${durum}.`;
    }

    // ── Yeni ameliyat oluşturma (basit niyet) ───────────────────
    if (q.includes('ameliyat ekle') || q.includes('ameliyat oluştur') || q.includes('yeni ameliyat')) {
      return {
        text: 'Yeni ameliyat oluşturmak için lütfen **Ameliyat Talebi** sayfasını kullanın — orada hasta, tarih, salon ve ekip bilgilerini eksiksiz girebilirsiniz. Buradan doğal dille ameliyat oluşturma şu an desteklenmiyor.',
      };
    }

    // ── Selamlama ─────────────────────────────────────────────
    if (['merhaba','selam','iyi günler','naber','nasılsın'].some(k => q.includes(k))) {
      return 'Merhaba! Bugünkü ameliyat programı, salon durumları, steril setler veya personel hakkında soru sorabilirsiniz.';
    }

    // ── Eşleşme yok ───────────────────────────────────────────
    return 'Bu konuda elimde net bir bilgi yok. Şunları sorabilirsiniz: bugünkü ameliyat programı, boş salonlar, steril set durumları, nöbetteki personel, ya da bir hasta/personel adı yazabilirsiniz.';
  }, [surgeries, rooms, sterilSetler, personel, hastalar]);

  const sendMessage = useCallback(async (userText) => {
    if (!userText.trim() || streaming) return;

    setError(null);
    const userMsg = { role: 'user', content: userText.trim() };
    setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '', streaming: true }]);
    setStreaming(true);

    const result = buildAnswer(userText);
    const fullText = typeof result === 'string' ? result : result.text;
    const action = typeof result === 'object' ? result.action : null;

    // Yazıyor efekti — gerçek bir gecikme/API çağrısı yok, tamamen yerel.
    simulateTyping(
      fullText,
      (chunk) => {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = { ...last, content: (last.content || '') + chunk, streaming: true };
          return updated;
        });
      },
      (text, act) => {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: text, streaming: false };
          return updated;
        });
        setStreaming(false);
        if (act) setPendingAction(act);
      },
      action
    );
  }, [streaming, buildAnswer]);

  // Eylemi uygula — yerel store action'larına bağlanır (gerçek backend çağrısı yok).
  const executeAction = useCallback(async (action) => {
    try {
      if (action?.type === 'CREATE_SURGERY' && action.payload) {
        addSurgery(action.payload);
      }
      setPendingAction(null);
      return { ok: true, data: { type: action?.type } };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, [addSurgery]);

  const cancelAction = useCallback(() => setPendingAction(null), []);

  const stop = useCallback(() => {
    setStreaming(false);
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
    setPendingAction(null);
    setError(null);
  }, []);

  return {
    messages, streaming, pendingAction, error,
    sendMessage, executeAction, cancelAction, stop, clear,
  };
}
