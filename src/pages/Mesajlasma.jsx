import { useState, useRef, useEffect } from 'react';
import { useAuthStore, useUIStore } from '../store';
import { ROLES } from '../data/roles';

function chNow(){ const n=new Date(); return String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0'); }
function avHarf(name){ return (name||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase(); }

export default function Mesajlasma(){
  const { showToast } = useUIStore();
  const { curRole, user } = useAuthStore();
  const rol = ROLES[curRole] || ROLES[0];
  const [convs, setConvs] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [search, setSearch] = useState('');
  const [msgInput, setMsgInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [grupModal, setGrupModal] = useState(false);
  const [grupAd, setGrupAd] = useState('');
  const [personeller, setPersoneller] = useState([]);
  const [grupSecili, setGrupSecili] = useState([]);
  const msgsRef = useRef(null);
  const inputRef = useRef(null);
  const socketRef = useRef(null);
  const token = localStorage.getItem('operio_access');
  const BASE = 'http://localhost:4000/api';
  const h = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };

  // Socket.io baglan
  useEffect(() => {
    const script = document.querySelector('script[src*="socket.io"]');
    if (!script) {
      const s = document.createElement('script');
      s.src = 'http://localhost:4000/socket.io/socket.io.js';
      s.onload = () => initSocket();
      document.head.appendChild(s);
    } else {
      initSocket();
    }
    return () => { if(socketRef.current) socketRef.current.disconnect(); };
  }, []);

  function initSocket() {
    if (!window.io) return;
    const socket = window.io('http://localhost:4000');
    socketRef.current = socket;
    socket.on('message:new', (msg) => {
      setMsgs(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setTimeout(() => { if(msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight; }, 50);
    });
  }

  // Konusmalari yukle
  useEffect(() => {
    fetch(BASE + '/messages/conversations', { headers: h })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setConvs(data); setLoading(false); })
      .catch(() => setLoading(false));

    fetch(BASE + '/personel', { headers: h })
      .then(r => r.ok ? r.json() : [])
      .then(setPersoneller)
      .catch(() => {});
  }, []);

  // Mesajlari yukle
  useEffect(() => {
    if (!activeId) return;
    fetch(BASE + '/messages/conversations/' + activeId + '/messages', { headers: h })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setMsgs(data);
        setTimeout(() => { if(msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight; }, 50);
      });
    if (socketRef.current) {
      socketRef.current.emit('join:conversation', activeId);
    }
  }, [activeId]);

  async function send() {
    if (!msgInput.trim() || !activeId || sending) return;
    setSending(true);
    try {
      const res = await fetch(BASE + '/messages/send', {
        method: 'POST', headers: h,
        body: JSON.stringify({ conversationId: activeId, content: msgInput.trim() }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMsgs(prev => [...prev, msg]);
        setMsgInput('');
        setTimeout(() => { if(msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight; }, 50);
      }
    } catch(e) { showToast('Mesaj gonderilemedi'); }
    setSending(false);
    inputRef.current?.focus();
  }

  async function grupOlustur() {
    if (!grupAd.trim() || grupSecili.length === 0) { showToast('Grup adi ve uye gerekli'); return; }
    try {
      const res = await fetch(BASE + '/messages/conversations', {
        method: 'POST', headers: h,
        body: JSON.stringify({ name: grupAd, isGroup: true, memberIds: grupSecili }),
      });
      if (res.ok) {
        const conv = await res.json();
        setConvs(prev => [conv, ...prev]);
        setGrupModal(false); setGrupAd(''); setGrupSecili([]);
        showToast('Grup olusturuldu');
      }
    } catch(e) { showToast('Hata'); }
  }

  const conv = convs.find(c => c.id === activeId);
  const filteredConvs = convs.filter(c => (c.name||'').toLowerCase().includes(search.toLowerCase()));

  function convName(c) {
    if (c.name) return c.name;
    const other = (c.members||[]).find(m => m.userId !== user?.id);
    return other?.user?.name || 'Sohbet';
  }

  function convAv(c) { return avHarf(convName(c)); }

  function lastMsg(c) {
    const m = c.messages?.[0];
    if (!m) return 'Henuz mesaj yok';
    return m.content?.slice(0, 40) || '';
  }

  const BG_COLORS = ['#0891b2','#059669','#7C3AED','#DC2626','#D97706','#EA580C'];
  function colorFor(str) { let h=0; for(let i=0;i<(str||'').length;i++) h=str.charCodeAt(i)+((h<<5)-h); return BG_COLORS[Math.abs(h)%BG_COLORS.length]; }

  return (
    <div style={{ display:'flex', height:'calc(100vh - 120px)', background:'var(--card-bg)', borderRadius:14, border:'1px solid var(--border)', overflow:'hidden' }}>

      {/* Sol panel - Konusmalar */}
      <div style={{ width:300, borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0 }}>
        <div style={{ padding:'16px 14px 10px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontSize:15, fontWeight:800, color:'var(--slate)' }}>Mesajlar</div>
            <button onClick={() => setGrupModal(true)} style={{ background:'var(--teal)', color:'white', border:'none', borderRadius:8, padding:'5px 10px', fontSize:11, fontWeight:700, cursor:'pointer' }}>+ Grup</button>
          </div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ara..." className="fi" style={{ fontSize:12, padding:'7px 10px' }} />
        </div>

        <div style={{ flex:1, overflowY:'auto' }}>
          {loading && <div style={{ padding:24, textAlign:'center', color:'var(--slate-light)', fontSize:12 }}>Yukleniyor...</div>}
          {!loading && filteredConvs.length === 0 && (
            <div style={{ padding:24, textAlign:'center', color:'var(--slate-light)', fontSize:12 }}>
              <div style={{ fontSize:32, marginBottom:8 }}>💬</div>
              Henuz konusma yok
            </div>
          )}
          {filteredConvs.map(c => (
            <div key={c.id} onClick={() => setActiveId(c.id)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', cursor:'pointer', background: activeId===c.id ? 'var(--surface)' : '', borderBottom:'1px solid var(--border)', transition:'background 0.1s' }}
              onMouseOver={e => { if(activeId!==c.id) e.currentTarget.style.background='var(--surface)'; }}
              onMouseOut={e => { if(activeId!==c.id) e.currentTarget.style.background=''; }}>
              <div style={{ width:40, height:40, borderRadius:'50%', background:colorFor(convName(c)), color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0 }}>
                {c.isGroup ? '👥' : convAv(c)}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--slate)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{convName(c)}</div>
                <div style={{ fontSize:11, color:'var(--slate-light)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:2 }}>{lastMsg(c)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sag panel - Mesajlar */}
      {!activeId ? (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, color:'var(--slate-light)' }}>
          <div style={{ fontSize:48 }}>💬</div>
          <div style={{ fontSize:14, fontWeight:600 }}>Bir konusma secin</div>
        </div>
      ) : (
        <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
          {/* Header */}
          <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:'50%', background:colorFor(convName(conv||{})), color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>
              {conv?.isGroup ? '👥' : convAv(conv||{})}
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--slate)' }}>{convName(conv||{})}</div>
              <div style={{ fontSize:11, color:'var(--slate-light)' }}>{conv?.isGroup ? (conv.members?.length||0) + ' uye' : 'Direkt mesaj'}</div>
            </div>
          </div>

          {/* Mesajlar */}
          <div ref={msgsRef} style={{ flex:1, overflowY:'auto', padding:'16px 18px', display:'flex', flexDirection:'column', gap:10 }}>
            {msgs.map((m, i) => {
              const isOut = m.senderId === user?.id;
              return (
                <div key={m.id||i} style={{ display:'flex', justifyContent: isOut ? 'flex-end' : 'flex-start', gap:8, alignItems:'flex-end' }}>
                  {!isOut && (
                    <div style={{ width:28, height:28, borderRadius:'50%', background:colorFor(m.sender?.name||''), color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 }}>
                      {avHarf(m.sender?.name||'')}
                    </div>
                  )}
                  <div style={{ maxWidth:'65%' }}>
                    {!isOut && <div style={{ fontSize:10, color:'var(--slate-light)', marginBottom:3 }}>{m.sender?.name||''}</div>}
                    <div style={{ padding:'9px 13px', borderRadius: isOut ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: isOut ? 'var(--teal)' : 'var(--surface)', color: isOut ? 'white' : 'var(--slate)', fontSize:13, lineHeight:1.5, border: isOut ? 'none' : '1px solid var(--border)' }}>
                      {m.content}
                    </div>
                    <div style={{ fontSize:10, color:'var(--slate-light)', marginTop:3, textAlign: isOut ? 'right' : 'left' }}>
                      {m.createdAt ? new Date(m.createdAt).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}) : chNow()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <div style={{ padding:'12px 16px', borderTop:'1px solid var(--border)', display:'flex', gap:10, alignItems:'center' }}>
            <input ref={inputRef} value={msgInput} onChange={e=>setMsgInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();} }}
              placeholder="Mesaj yaz..." className="fi"
              style={{ flex:1, fontSize:13, padding:'10px 14px' }} />
            <button onClick={send} disabled={sending||!msgInput.trim()}
              style={{ background:'var(--teal)', color:'white', border:'none', borderRadius:10, padding:'10px 18px', fontWeight:700, cursor:'pointer', fontSize:13, opacity: sending||!msgInput.trim()?0.6:1 }}>
              {sending ? '...' : 'Gonder'}
            </button>
          </div>
        </div>
      )}

      {/* Grup Modal */}
      {grupModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}>
          <div style={{ background:'var(--card-bg)', borderRadius:16, padding:24, width:400, maxHeight:'80vh', overflowY:'auto' }}>
            <div style={{ fontSize:16, fontWeight:800, color:'var(--slate)', marginBottom:16, background:'linear-gradient(135deg,#7C3AED,#6366F1,#0891b2)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Yeni Grup Olustur</div>
            <div className="fg" style={{ marginBottom:12 }}>
              <label className="fl">GRUP ADI</label>
              <input className="fi" value={grupAd} onChange={e=>setGrupAd(e.target.value)} placeholder="Grup adi..." />
            </div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--slate-light)', marginBottom:8 }}>UYELER</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:200, overflowY:'auto', marginBottom:16 }}>
              {personeller.map(p => (
                <div key={p.id} onClick={() => setGrupSecili(prev => prev.includes(p.id) ? prev.filter(x=>x!==p.id) : [...prev,p.id])}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, cursor:'pointer', background: grupSecili.includes(p.id) ? 'rgba(20,184,166,0.1)' : 'var(--surface)', border: grupSecili.includes(p.id) ? '1px solid var(--teal)' : '1px solid var(--border)' }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:colorFor(p.ad||p.name||''), color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700 }}>
                    {avHarf(p.ad||p.name||'')}
                  </div>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--slate)' }}>{p.ad||p.name||''}</div>
                  {grupSecili.includes(p.id) && <div style={{ marginLeft:'auto', color:'var(--teal)', fontSize:14 }}>✓</div>}
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setGrupModal(false)} style={{ flex:1, padding:'10px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:9, cursor:'pointer', fontSize:13, fontWeight:600 }}>Iptal</button>
              <button onClick={grupOlustur} style={{ flex:2, padding:'10px', background:'var(--teal)', color:'white', border:'none', borderRadius:9, cursor:'pointer', fontSize:13, fontWeight:700 }}>Olustur</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
