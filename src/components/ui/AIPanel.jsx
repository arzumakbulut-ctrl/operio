import { useState, useEffect, useRef, useCallback } from 'react';
import { useAIChat } from '../../hooks/useAIChat';
import { useDataStore, useUIStore } from '../../store';

// Action tipi → Türkçe açıklama
const ACTION_LABELS = {
  CREATE_SURGERY:    { icon: '🏥', label: 'Ameliyat Oluştur',    color: '#059669' },
  UPDATE_SURGERY:    { icon: '✏️', label: 'Ameliyat Güncelle',   color: '#0284C7' },
  UPDATE_ROOM_STATUS:{ icon: '🚪', label: 'Salon Durumu Değiştir', color: '#D97706' },
};

// Önerilen hızlı sorular
const QUICK_PROMPTS = [
  'Bugünkü ameliyat programını özetle',
  'Hangi salonlar şu an boş?',
  'Steril set durumları nasıl?',
  'Nöbetteki personeli listele',
  'Tamamlanan ameliyatlar hangileri?',
];

function MarkdownText({ text }) {
  // Basit markdown: **bold**, `code`, satır sonu
  const parts = text.split(/(```action[\s\S]*?```|\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('```action')) return null; // action bloğunu gizle
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`'))
          return <code key={i} style={{ background: 'rgba(20,184,166,0.1)', padding: '1px 4px', borderRadius: 3, fontSize: '0.9em', fontFamily: 'monospace' }}>{part.slice(1, -1)}</code>;
        return part;
      })}
    </span>
  );
}

export default function AIPanelOverlay({ onClose }) {
  const { showToast } = useUIStore();
  const { surgeries, rooms } = useDataStore();
  const { messages, streaming, pendingAction, error, sendMessage, executeAction, cancelAction, stop, clear } = useAIChat();

  const [input, setInput]       = useState('');
  const [actionResult, setActionResult] = useState(null);
  const bottomRef               = useRef(null);
  const inputRef                = useRef(null);

  // Otomatik scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Panel açılınca input'a odaklan
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  async function handleSend(e) {
    e?.preventDefault();
    if (!input.trim() || streaming) return;
    const text = input;
    setInput('');
    await sendMessage(text);
  }

  async function handleAction(confirmed) {
    if (!confirmed) { cancelAction(); return; }
    const result = await executeAction(pendingAction);
    if (result.ok) {
      showToast('✅ İşlem uygulandı');
      setActionResult({ ok: true, type: pendingAction.type });
    } else {
      showToast('⚠️ İşlem uygulanamadı');
      setActionResult({ ok: false });
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 4000,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: '6vh',
    }} onClick={e => e.target === e.currentTarget && onClose()}>

      <div style={{
        width: 620, maxWidth: '96vw', height: '80vh', maxHeight: 720,
        background: 'var(--card-bg)',
        borderRadius: 20,
        border: '1px solid var(--border)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.35)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* ── BAŞLIK ─────────────────────────────────────────── */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--surface)',
          flexShrink: 0,
        }}>
          {/* Logo */}
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg,#0F766E,#0891b2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 2a10 10 0 1 0 10 10H12V2z"/><path d="M12 2v10l6 6"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--slate)', fontFamily: "'Outfit',sans-serif" }}>
              Operia
              <span style={{
                marginLeft: 8, fontSize: 9, fontWeight: 700, padding: '2px 7px',
                background: 'rgba(20,184,166,0.12)', color: 'var(--teal)',
                borderRadius: 20, verticalAlign: 'middle',
              }}>BETA</span>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--slate-light)' }}>
              Ameliyathane Akıllı Asistanı · Yerel veri üzerinde çalışır
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {messages.length > 0 && (
              <button onClick={clear}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '5px 10px', fontSize: 11,
                  color: 'var(--slate-light)', cursor: 'pointer',
                }}>
                Temizle
              </button>
            )}
            <button onClick={onClose}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 8, width: 30, height: 30,
                color: 'var(--slate-mid)', cursor: 'pointer', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
          </div>
        </div>

        {/* ── MESAJLAR ───────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

          {/* Boş durum */}
          {messages.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingTop: 24 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>👋</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--slate)', fontFamily: "'Outfit',sans-serif" }}>
                  Merhaba! Ben Operia.
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--slate-light)', marginTop: 6, lineHeight: 1.6, maxWidth: 380 }}>
                  Bugünkü ameliyat programı, salon durumları ve steril setler hakkında soru sorabilir,
                  doğal dilde yeni ameliyat ekleyebilirsiniz.
                </div>
              </div>

              {/* Bağlam özeti */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', maxWidth: 420,
              }}>
                {[
                  { lbl: 'Bugünkü Ameliyat', val: surgeries.length, icon: '🏥' },
                  { lbl: 'Aktif Salon', val: rooms.filter(r=>(r.durum||r.status)==='active'||r.status==='ACTIVE').length, icon: '🚪' },
                ].map(item => (
                  <div key={item.lbl} style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '10px 14px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 22 }}>{item.icon}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--teal)', fontFamily: "'Outfit',sans-serif" }}>{item.val}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--slate-light)' }}>{item.lbl}</div>
                  </div>
                ))}
              </div>

              {/* Hızlı sorular */}
              <div style={{ width: '100%' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--slate-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, textAlign: 'center' }}>
                  Hızlı Sorular
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {QUICK_PROMPTS.map(prompt => (
                    <button key={prompt} onClick={() => sendMessage(prompt)}
                      style={{
                        width: '100%', padding: '9px 14px', textAlign: 'left',
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 9, cursor: 'pointer', fontSize: 12.5,
                        color: 'var(--slate-mid)', fontFamily: 'var(--font)',
                        transition: 'all 0.12s',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--teal-mid)'; e.currentTarget.style.color = 'var(--teal)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--slate-mid)'; }}
                    >
                      <span style={{ color: 'var(--teal)', fontSize: 14 }}>→</span>
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Mesaj listesi */}
          {messages.map((msg, i) => (
            <div key={i} style={{
              display: 'flex',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              gap: 10, marginBottom: 14, alignItems: 'flex-start',
            }}>
              {/* Avatar */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: msg.role === 'user'
                  ? 'var(--teal)'
                  : 'linear-gradient(135deg,#0F766E,#0891b2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: msg.role === 'user' ? 11 : 14,
                color: 'white', fontWeight: 700, marginTop: 2,
              }}>
                {msg.role === 'user' ? 'SİZ' : '✦'}
              </div>

              {/* Balon */}
              <div style={{
                maxWidth: '78%',
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg,var(--teal-dark),#0369A1)'
                  : msg.isError ? '#FEF2F2' : 'var(--surface)',
                color: msg.role === 'user' ? 'white' : msg.isError ? '#DC2626' : 'var(--slate)',
                border: msg.role === 'user' ? 'none' : `1px solid ${msg.isError ? '#FECACA' : 'var(--border)'}`,
                borderRadius: msg.role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                padding: '10px 14px',
                fontSize: 13, lineHeight: 1.65,
              }}>
                <MarkdownText text={msg.content} />
                {msg.streaming && (
                  <span style={{
                    display: 'inline-block', width: 6, height: 14,
                    background: 'var(--teal)', borderRadius: 1,
                    marginLeft: 3, verticalAlign: 'text-bottom',
                    animation: 'blink 0.8s infinite',
                  }}/>
                )}
              </div>
            </div>
          ))}

          {/* Pending action onay kartı */}
          {pendingAction && !actionResult && (
            <div style={{
              margin: '8px 0 14px',
              background: 'var(--surface)', border: '1.5px solid var(--border)',
              borderRadius: 14, overflow: 'hidden',
            }}>
              <div style={{
                padding: '10px 14px',
                background: `${ACTION_LABELS[pendingAction.type]?.color}18`,
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 18 }}>{ACTION_LABELS[pendingAction.type]?.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate)' }}>
                    {ACTION_LABELS[pendingAction.type]?.label}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--slate-light)', marginTop: 1 }}>
                    Bu işlemi onaylıyor musunuz?
                  </div>
                </div>
              </div>
              <div style={{ padding: '10px 14px' }}>
                <pre style={{
                  fontSize: 10.5, color: 'var(--slate-mid)', margin: '0 0 10px',
                  background: 'var(--input-bg)', padding: '8px 10px', borderRadius: 7,
                  overflow: 'auto', maxHeight: 120, fontFamily: 'monospace',
                }}>
                  {JSON.stringify(pendingAction.payload, null, 2)}
                </pre>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleAction(false)}
                    className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                    İptal
                  </button>
                  <button onClick={() => handleAction(true)}
                    className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                    ✓ Onayla ve Uygula
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Eylem sonucu */}
          {actionResult && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, marginBottom: 14,
              background: actionResult.ok ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)',
              border: `1px solid ${actionResult.ok ? 'rgba(5,150,105,0.2)' : 'rgba(220,38,38,0.2)'}`,
              fontSize: 12, color: actionResult.ok ? '#059669' : '#DC2626', fontWeight: 600,
            }}>
              {actionResult.ok ? '✅ İşlem başarıyla uygulandı' : '⚠️ İşlem uygulanamadı'}
            </div>
          )}

          <div ref={bottomRef}/>
        </div>

        {/* ── INPUT ──────────────────────────────────────────── */}
        <div style={{
          padding: '12px 14px',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface)',
          flexShrink: 0,
        }}>
          <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                if (e.key === 'Escape') onClose();
              }}
              placeholder="Soru sor veya talimat ver… (Enter gönderer, Shift+Enter satır ekler)"
              rows={1}
              style={{
                flex: 1, resize: 'none', padding: '9px 12px',
                border: '1.5px solid var(--border)', borderRadius: 10,
                fontSize: 13, fontFamily: 'var(--font)',
                background: 'var(--input-bg)', color: 'var(--slate)',
                outline: 'none', lineHeight: 1.5, maxHeight: 100, overflowY: 'auto',
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--teal-mid)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            />
            {streaming ? (
              <button type="button" onClick={stop}
                style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: '#FEF2F2', border: '1px solid #FECACA',
                  color: '#DC2626', cursor: 'pointer', fontSize: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>■</button>
            ) : (
              <button type="submit" disabled={!input.trim()}
                style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: input.trim() ? 'var(--teal)' : 'var(--border)',
                  border: 'none', color: 'white', cursor: input.trim() ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            )}
          </form>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 8, fontSize: 10, color: 'var(--slate-light)',
          }}>
            <span>⌘K ile aç/kapat · Esc ile kapat</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
              Yerel akıllı arama
            </span>
          </div>
        </div>

        <style>{`
          @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        `}</style>
      </div>
    </div>
  );
}
