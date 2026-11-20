import { useState, useEffect } from 'react';
import {useUIStore, useDataStore } from '../store';
import Modal from '../components/ui/Modal';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

const BASE = 'http://localhost:4000/api';
const tok = () => localStorage.getItem('operio_access');

function mapKart(p) {
  const extra = (() => { try { return JSON.parse(p.icerik || '{}'); } catch { return {}; } })();
  return {
    id: p.id,
    name: p.baslik,
    branch: extra.branch || '—',
    dur: extra.dur || 0,
    color: extra.color || '#14B8A6',
    desc: extra.desc || '',
    setler: extra.setler || [],
    malzeme: extra.malzeme || [],
    cihaz: extra.cihaz || [],
    ilac: extra.ilac || [],
    durum: p.durum || 'Taslak',
    kullanim: extra.kullanim || 0,
  };
}

const INIT_KARTLAR = [
  { id:1, name:'Laparoskopik Kolesistektomi', branch:'Genel Cerrahi', dur:90, color:'#14B8A6',
    desc:'Safra kesesinin laparoskopik yöntemle çıkarılması.',
    setler:['Laparoskopi Seti A','Kamera Sistemi','Trokar Seti'],
    malzeme:['Metal Klip (10lu)','Endobag','İrrigasyon Seti','Absorbabl Sütür'],
    cihaz:['Elektrokoter','CO₂ İnsuflator','Monitor Stantı'],
    ilac:['Propofol 200mg','Fentanil 100mcg','Sevofluran','Roküronyum 50mg'],
    durum:'Onaylı', kullanim:12 },
  { id:2, name:'İnguinal Herni Onarımı', branch:'Genel Cerrahi', dur:60, color:'#0284C7',
    desc:'Kasık fıtığının mesh ile onarımı, açık veya laparoskopik.',
    setler:['Laparoskopi Seti B','Mesh Aplikatör'],
    malzeme:['Polipropilen Mesh','Tacker','Non-absorbabl Sütür'],
    cihaz:['Elektrokoter','Laparoskopik Kamera'],
    ilac:['Propofol 150mg','Fentanil 75mcg','Spinal Bupivakain'],
    durum:'Onaylı', kullanim:8 },
  { id:3, name:'Tiroidektomi (Total)', branch:'Endokrin Cerrahisi', dur:110, color:'#7C3AED',
    desc:'Tiroid bezinin total olarak çıkarılması, sinir monitorizasyonu ile.',
    setler:['Boyun Cerrahi Seti','Nöromonitor Set'],
    malzeme:['Hemovak Dren','Absorbabl Sütür 2-0','Cilt Ağrafı'],
    cihaz:['Nöromonitor Cihazı','Elektrokoter','Harmonik Skalpel'],
    ilac:['Propofol 200mg','Fentanil 100mcg','Neostigmin','Atropin'],
    durum:'Beklemede', kullanim:5 },
];

const DUR_COLOR = { 'Onaylı':'#059669', 'Beklemede':'#D97706', 'Taslak':'#94A3B8' };
const DUR_TAG   = { 'Onaylı':'t-green',  'Beklemede':'t-orange',  'Taslak':'t-gray'  };

const CHIP_COLORS = {
  setler:'rgba(20,184,166,0.12)',
  malzeme:'rgba(2,132,199,0.12)',
  cihaz:'rgba(217,119,6,0.12)',
  ilac:'rgba(190,24,93,0.12)',
};
const CHIP_TEXT = {
  setler:'#0f766e', malzeme:'#0369a1', cihaz:'#b45309', ilac:'#9d174d',
};

function Chip({ text, type }) {
  return (
    <span style={{ padding:'3px 9px', borderRadius:20, fontSize:10.5, fontWeight:600,
      background: CHIP_COLORS[type]||'var(--surface)', color: CHIP_TEXT[type]||'var(--slate-mid)',
      whiteSpace:'nowrap' }}>
      {text}
    </span>
  );
}

export default function AmeliyatKartlari() {
  const navigate = useNavigate();
  const { showToast } = useUIStore();
  const [kartlar, setKartlar] = useState(INIT_KARTLAR);
  useEffect(() => {
    fetch(`${BASE}/ameliyatkart`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (data.length > 0) setKartlar(data.map(mapKart)); })
      .catch(() => {});
  }, []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name:'', branch:'Genel Cerrahi', dur:'90', color:'#14B8A6', desc:'', durum:'Taslak' });
  const [setlerInput, setSetlerInput] = useState('');
  const [malzemeInput, setMalzemeInput] = useState('');
  const [cihazInput, setCihazInput] = useState('');
  const [ilacInput, setIlacInput] = useState('');
  const [detay, setDetay] = useState(null);
  const [excelHata, setExcelHata] = useState('');

  // Excel'den liste içe aktarma — ilk sütundaki her satır bir öğe adı kabul edilir.
  // mevcutInput: o anki virgüllü string, setInput: state setter, basliklar: yoksayılacak başlık satırları
  function handleExcelYukle(e, mevcutInput, setInput, basliklar, etiket) {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelHata('');
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const isimler = rows
          .map(r => String(r[0] || '').trim())
          .filter(v => v && !basliklar.includes(v.toLowerCase()));
        if (isimler.length === 0) {
          setExcelHata('Dosyada okunabilir kayıt bulunamadı.');
          return;
        }
        const mevcut = mevcutInput ? mevcutInput.split(',').map(x => x.trim()).filter(Boolean) : [];
        const birlesik = [...new Set([...mevcut, ...isimler])];
        setInput(birlesik.join(', '));
        showToast(`${isimler.length} ${etiket} Excel'den eklendi ✓`);
      } catch {
        setExcelHata('Dosya okunamadı. Lütfen geçerli bir .xlsx/.xls/.csv dosyası seçin.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  }

  function openModal(id) {
    if (id) {
      const k = kartlar.find(x => x.id === id);
      if (k) {
        setEditId(id);
        setForm({ name:k.name, branch:k.branch, dur:String(k.dur), color:k.color, desc:k.desc||'', durum:k.durum });
        setSetlerInput(k.setler.join(', '));
        setMalzemeInput(k.malzeme.join(', '));
        setCihazInput(k.cihaz.join(', '));
        setIlacInput(k.ilac.join(', '));
      }
    } else {
      setEditId(null);
      setForm({ name:'', branch:'Genel Cerrahi', dur:'90', color:'#14B8A6', desc:'', durum:'Taslak' });
      setSetlerInput(''); setMalzemeInput(''); setCihazInput(''); setIlacInput('');
    }
    setModalOpen(true);
  }

  async function saveKart() {
    if (!form.name.trim()) { showToast('Ameliyat adı zorunludur'); return; }
    const parse = s => s.split(',').map(x => x.trim()).filter(Boolean);
    const setler = parse(setlerInput), malzeme = parse(malzemeInput), cihaz = parse(cihazInput), ilac = parse(ilacInput);
    const extra = { branch:form.branch, dur:Number(form.dur), color:form.color, desc:form.desc, setler, malzeme, cihaz, ilac, kullanim: editId ? (kartlar.find(k=>k.id===editId)?.kullanim||0) : 0 };
    const body = { baslik:form.name, durum:form.durum, icerik:JSON.stringify(extra) };
    try {
      const res = await fetch(editId ? `${BASE}/ameliyatkart/${editId}` : `${BASE}/ameliyatkart`, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${tok()}` },
        body: JSON.stringify(body),
      });
      const saved = await res.json();
      const kart = { id:saved.id||editId, ...form, dur:Number(form.dur), setler, malzeme, cihaz, ilac, kullanim:extra.kullanim };
      if (editId) { setKartlar(prev => prev.map(k => k.id === editId ? kart : k)); showToast('Kart güncellendi ✓'); }
      else { setKartlar(prev => [kart, ...prev]); showToast('Kart oluşturuldu ✓'); }
    } catch {
      const kart = { id:Date.now(), ...form, dur:Number(form.dur), setler, malzeme, cihaz, ilac, kullanim:0 };
      if (editId) { setKartlar(prev => prev.map(k => k.id === editId ? { ...k, ...kart } : k)); }
      else { setKartlar(prev => [kart, ...prev]); }
      showToast('Kart kaydedildi (yerel) ✓');
    }
    setModalOpen(false);
  }

  async function deleteKart(id) {
    setKartlar(prev => prev.filter(k => k.id !== id));
    try { await fetch(`${BASE}/ameliyatkart/${id}`, { method:'DELETE', headers:{Authorization:`Bearer ${tok()}`} }); } catch {}
    showToast('Kart silindi');
  }

  return (
    <div>
      <div className="page-hd">
        <div>
          <div className="page-hd-title">Ameliyat Kartlarım</div>
          <div className="page-hd-sub">{kartlar.length} kart kayıtlı — ameliyat protokolleriniz ve ekipman listeleriniz</div>
        </div>
        <button className="btn btn-primary" onClick={() => openModal(null)}>+ Yeni Kart Oluştur</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
        {kartlar.map(k => (
          <div key={k.id} style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden', position:'relative', transition:'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 12px 32px rgba(0,0,0,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=''; }}>

            {/* Renk çubuğu */}
            <div style={{ height:4, background:k.color }}/>

            {/* Başlık */}
            <div style={{ padding:'16px 18px 12px', display:'flex', alignItems:'flex-start', gap:12 }}>
              <div style={{ width:42, height:42, borderRadius:12, background:`${k.color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={k.color} strokeWidth="2">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                  <rect x="9" y="3" width="6" height="4" rx="1"/>
                  <line x1="9" y1="12" x2="15" y2="12"/>
                  <line x1="9" y1="16" x2="12" y2="16"/>
                </svg>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13.5, fontWeight:700, color:'var(--slate)', lineHeight:1.3 }}>{k.name}</div>
                <div style={{ fontSize:11, color:'var(--slate-light)', marginTop:2 }}>{k.branch}</div>
                <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:4 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--slate-light)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span style={{ fontSize:11, color:'var(--slate-light)' }}>{k.dur} dakika</span>
                  <span style={{ fontSize:10, color:'var(--slate-light)' }}>· {k.kullanim} kullanım</span>
                </div>
              </div>
            </div>

            {/* İçerik */}
            <div style={{ padding:'0 18px 12px', display:'flex', flexDirection:'column', gap:10 }}>
              {k.setler.length > 0 && (
                <div>
                  <div style={{ fontSize:9.5, fontWeight:700, color:'var(--slate-light)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Cerrahi Setler</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {k.setler.slice(0,3).map((s,i) => <Chip key={i} text={s} type="setler"/>)}
                    {k.setler.length > 3 && <Chip text={`+${k.setler.length-3}`} type="setler"/>}
                  </div>
                </div>
              )}
              {k.malzeme.length > 0 && (
                <div>
                  <div style={{ fontSize:9.5, fontWeight:700, color:'var(--slate-light)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Tıbbi Malzemeler</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {k.malzeme.slice(0,3).map((m,i) => <Chip key={i} text={m} type="malzeme"/>)}
                    {k.malzeme.length > 3 && <Chip text={`+${k.malzeme.length-3}`} type="malzeme"/>}
                  </div>
                </div>
              )}
              {k.cihaz.length > 0 && (
                <div>
                  <div style={{ fontSize:9.5, fontWeight:700, color:'var(--slate-light)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>Cihaz & Ekipman</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {k.cihaz.slice(0,2).map((c,i) => <Chip key={i} text={c} type="cihaz"/>)}
                    {k.cihaz.length > 2 && <Chip text={`+${k.cihaz.length-2}`} type="cihaz"/>}
                  </div>
                </div>
              )}
              {k.ilac.length > 0 && (
                <div>
                  <div style={{ fontSize:9.5, fontWeight:700, color:'var(--slate-light)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:5 }}>İlaçlar</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {k.ilac.slice(0,2).map((il,i) => <Chip key={i} text={il} type="ilac"/>)}
                    {k.ilac.length > 2 && <Chip text={`+${k.ilac.length-2}`} type="ilac"/>}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding:'10px 18px 14px', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span className={`tag ${DUR_TAG[k.durum]}`} style={{ fontSize:9.5 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:DUR_COLOR[k.durum], display:'inline-block', marginRight:4 }}/>
                {k.durum}
              </span>
              <div style={{ display:'flex', gap:6 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => openModal(k.id)}>Düzenle</button>
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/randevu-talep')}>Randevu Talebi</button>
                <button onClick={() => deleteKart(k.id)}
                  style={{ padding:'4px 8px', borderRadius:7, border:'1px solid #FECACA', background:'#FEF2F2', color:'#DC2626', cursor:'pointer', fontSize:11 }}>
                  Sil
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Yeni kart ekle kutusu */}
        <div onClick={() => openModal(null)}
          style={{ background:'var(--surface)', border:'2px dashed var(--border)', borderRadius:16, padding:24, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, cursor:'pointer', minHeight:200, transition:'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor='var(--teal)'; e.currentTarget.style.background='rgba(20,184,166,0.03)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--surface)'; }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--slate-light)" strokeWidth="1.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--slate-mid)' }}>Yeni Ameliyat Kartı Oluştur</div>
          <div style={{ fontSize:11, color:'var(--slate-light)' }}>Protokol, ekipman ve ilaç listesi</div>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <Modal title={editId ? 'Kartı Düzenle' : 'Yeni Ameliyat Kartı'} onClose={() => setModalOpen(false)} width={560}>
          <div className="fg" style={{ marginBottom:12 }}>
            <label className="fl">Ameliyat Adı *</label>
            <input className="fi" placeholder="Ör: Laparoskopik Kolesistektomi" value={form.name} onChange={e => setForm({...form, name:e.target.value})}/>
          </div>
          <div className="fr" style={{ marginBottom:12 }}>
            <div className="fg">
              <label className="fl">Branş</label>
              <select className="fi" value={form.branch} onChange={e => setForm({...form, branch:e.target.value})}>
                {['Genel Cerrahi','Ortopedi','Endokrin Cerrahisi','Göz Hastalıkları','KBB','Nöroşirürji','Üroloji','Kardiyoloji'].map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="fl">Süre (dk)</label>
              <input className="fi" type="number" min="15" value={form.dur} onChange={e => setForm({...form, dur:e.target.value})}/>
            </div>
          </div>
          <div className="fr" style={{ marginBottom:12 }}>
            <div className="fg">
              <label className="fl">Renk</label>
              <input className="fi" type="color" value={form.color} onChange={e => setForm({...form, color:e.target.value})} style={{ height:40 }}/>
            </div>
            <div className="fg">
              <label className="fl">Durum</label>
              <select className="fi" value={form.durum} onChange={e => setForm({...form, durum:e.target.value})}>
                {['Taslak','Beklemede','Onaylı'].map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>
          {/* Cerrahi Setler — Excel'den toplu yükleme destekli */}
          <div className="fg" style={{ marginBottom:10 }}>
            <div className="fl" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span>Cerrahi Setler <span style={{ color:'var(--slate-light)', fontWeight:400 }}>(virgülle ayır)</span></span>
              <label htmlFor="cerrahiSetExcel" style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, color:'var(--teal)', cursor:'pointer', padding:'3px 9px', borderRadius:7, border:'1px solid var(--teal)', background:'rgba(20,184,166,0.06)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:11,height:11}}>
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Excel'den Yükle
              </label>
              <input id="cerrahiSetExcel" type="file" accept=".xlsx,.xls,.csv"
                onChange={e => handleExcelYukle(e, setlerInput, setSetlerInput, ['set','set adı','cerrahi set'], 'set')}
                style={{ display:'none' }}/>
            </div>
            <input className="fi" placeholder="Laparoskopi Seti A, Trokar Seti…" value={setlerInput} onChange={e => setSetlerInput(e.target.value)}/>
            {excelHata && <div style={{ fontSize:10.5, color:'var(--danger)', marginTop:4 }}>{excelHata}</div>}
            <div style={{ fontSize:10, color:'var(--slate-light)', marginTop:4 }}>Excel dosyasının ilk sütununda her satırda bir set adı bekleniyor.</div>
          </div>

          {/* Tıbbi Malzemeler — Excel'den toplu yükleme destekli */}
          <div className="fg" style={{ marginBottom:10 }}>
            <div className="fl" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span>Tıbbi Malzemeler <span style={{ color:'var(--slate-light)', fontWeight:400 }}>(virgülle ayır)</span></span>
              <label htmlFor="malzemeExcel" style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, color:'var(--teal)', cursor:'pointer', padding:'3px 9px', borderRadius:7, border:'1px solid var(--teal)', background:'rgba(20,184,166,0.06)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:11,height:11}}>
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Excel'den Yükle
              </label>
              <input id="malzemeExcel" type="file" accept=".xlsx,.xls,.csv"
                onChange={e => handleExcelYukle(e, malzemeInput, setMalzemeInput, ['malzeme','tıbbi malzeme','malzeme adı'], 'malzeme')}
                style={{ display:'none' }}/>
            </div>
            <input className="fi" placeholder="Endobag, Absorbabl Sütür…" value={malzemeInput} onChange={e => setMalzemeInput(e.target.value)}/>
            <div style={{ fontSize:10, color:'var(--slate-light)', marginTop:4 }}>Excel dosyasının ilk sütununda her satırda bir malzeme adı bekleniyor.</div>
          </div>

          {[
            ['Cihaz & Ekipman', cihazInput, setCihazInput, 'Elektrokoter, CO₂ İnsuflator…'],
            ['İlaçlar', ilacInput, setIlacInput, 'Propofol 200mg, Fentanil 100mcg…'],
          ].map(([lbl, val, setter, ph]) => (
            <div className="fg" key={lbl} style={{ marginBottom:10 }}>
              <label className="fl">{lbl} <span style={{ color:'var(--slate-light)', fontWeight:400 }}>(virgülle ayır)</span></label>
              <input className="fi" placeholder={ph} value={val} onChange={e => setter(e.target.value)}/>
            </div>
          ))}
          <div className="mf">
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>İptal</button>
            <button className="btn btn-primary" onClick={saveKart}>{editId ? 'Güncelle' : 'Kart Oluştur'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
