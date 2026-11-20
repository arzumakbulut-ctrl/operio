import { useState, useRef, useEffect } from 'react';
import { useAuthStore, useUIStore, useDataStore } from '../store';

const BASE = 'http://localhost:4000/api';
function tok() { return localStorage.getItem('operio_access'); }
const PROS_COLORS = ['#14B8A6','#DC2626','#7C3AED','#0284C7','#EA580C','#059669'];

function dbToPros(r, i) {
  return {
    id: r.id,
    name: r.baslik,
    branch: r.kategori || 'Genel Cerrahi',
    dur: 90,
    diff: 'Orta',
    ane: 'Genel Anestezi',
    color: PROS_COLORS[i % PROS_COLORS.length],
    desc: r.icerik || r.baslik,
    steps: [],
    materials: [],
    risks: [],
    docContent: r.icerik || '',
    logo: null,
    meta: { dokNo:'—', yayinTar:'', revNo:r.versiyon||'1.0', revTar:'', sayfaNo:'1/1', brans:r.kategori||'' },
    footer: { title:'ONAY BÖLÜMLERİ', lbl1:'HAZIRLAYAN', name1:r.olusturan||'', date1:'', lbl2:'SİSTEM ONAYI', name2:r.onaylayan||'', date2:'', lbl3:'YÜRÜRLÜLÜK ONAYI', name3:'', date3:'' },
  };
}

// ── VERİ ─────────────────────────────────────────────────────
const INIT_PROSEDURLER = [
  {id:1,name:'Laparoskopik Kolesistektomi',branch:'Genel Cerrahi',dur:90,diff:'Orta',ane:'Genel Anestezi',color:'#14B8A6',
   desc:'Safra kesesinin laparoskopik yöntemle çıkarılması. Minimal invazif yaklaşım, hızlı iyileşme.',
   steps:[{t:'Hasta Hazırlığı',n:'Supine pozisyon, genel anestezi indüksiyonu, karın temizliği.',dur:'15 dk'},{t:'Port Yerleşimi',n:'Göbek altı 10mm kamera portu, epigastrik ve sağ üst kadran portları.',dur:'10 dk'},{t:'Pnömoperitonyum',n:'CO₂ ile karın şişirilmesi, 12-15 mmHg basınç.',dur:'5 dk',warn:'Kardiyak hastada dikkat'},{t:'Diseksiyon',n:'Calot üçgeni diseksiyonu, kistik duktus ve arter tanımlanması.',dur:'30 dk'},{t:'Klip & Kesim',n:'Metal klip ile bağlama ve kesme işlemi.',dur:'10 dk'},{t:'Çıkarma & Kapatma',n:'Safra kesesi endobag ile çıkarılması, port yerleri kapatılması.',dur:'15 dk'}],
   materials:[{cat:'Set',name:'Laparoskopi Seti A',qty:'1 adet',color:'#14B8A6'},{cat:'Alet',name:'Elektrokoter',qty:'1 adet',color:'#0284C7'},{cat:'Sarf',name:'Metal Klip (10lu)',qty:'2 kutu',color:'#7C3AED'},{cat:'Sarf',name:'Endobag',qty:'1 adet',color:'#EA580C'},{cat:'Sarf',name:'Trokar (5mm)',qty:'2 adet',color:'#059669'},{cat:'Sarf',name:'Trokar (10mm)',qty:'1 adet',color:'#DC2626'}],
   risks:[{sev:'high',lbl:'Yüksek Risk',txt:'Safra kesesi perforasyonu — dikkatli diseksiyon, irrigasyon hazır bulundurulmalı'},{sev:'med',lbl:'Orta Risk',txt:'Safra yolu yaralanması — Calot üçgeni anatomisi net görülmeden klip uygulanmamalı'},{sev:'low',lbl:'Düşük Risk',txt:'Port yeri kanaması — hemostaz kontrolü zorunlu'}],
   meta:{dokNo:'SOP-2025-001',yayinTar:'2025-01-15',revNo:'02',revTar:'2025-04-01',sayfaNo:'1/1',brans:'Genel Cerrahi'},
   footer:{title:'ONAY BÖLÜMLERİ',lbl1:'HAZIRLAYAN',name1:'Dr. Ahmet Yılmaz',date1:'2025-04-01',lbl2:'SİSTEM ONAYI',name2:'Başhekim',date2:'2025-04-05',lbl3:'YÜRÜRLÜLÜK ONAYI',name3:'Kalite Müdürü',date3:'2025-04-10'},
  },
  {id:2,name:'Apendektomi',branch:'Genel Cerrahi',dur:60,diff:'Basit',ane:'Genel Anestezi',color:'#DC2626',
   desc:'Akut apandisitte apendiksin laparoskopik veya açık cerrahi ile çıkarılması.',
   steps:[{t:'Pozisyonlama',n:'Supine / hafif Trendelenburg, genel anestezi.',dur:'10 dk'},{t:'Abdominal Giriş',n:'Laparoskopik; 3 port veya açık McBurney insizyonu.',dur:'10 dk'},{t:'Appendiks Tespiti',n:'Çekum bulunarak appendiks serbestleştirilir.',dur:'15 dk'},{t:'Mezoapendiks',n:'Elektrokoter ile damar kontrolü yapılarak kesilir.',dur:'10 dk'},{t:'Güdük Bağlama',n:'Endoloop × 2, güdük kesilir. Appendiks çıkarılır.',dur:'10 dk',warn:'Perforasyon varsa periton yıkama'},{t:'Kapatma',n:'Portlar kapatılır, dren konulabilir.',dur:'5 dk'}],
   materials:[{cat:'Set',name:'Laparoskopi Seti',qty:'1 adet',color:'#14B8A6'},{cat:'Sarf',name:'Endoloop',qty:'2 adet',color:'#7C3AED'},{cat:'Alet',name:'Elektrokoter',qty:'1 adet',color:'#0284C7'},{cat:'Sarf',name:'Endobag',qty:'1 adet',color:'#EA580C'}],
   risks:[{sev:'high',lbl:'Yüksek Risk',txt:'Perforasyon — peritonit riski, irrigasyon ve dren şart'},{sev:'med',lbl:'Orta Risk',txt:'Güdük kaçağı — endoloop güvenliği kontrol edilmeli'}],
   meta:{dokNo:'SOP-2025-002',yayinTar:'2025-01-15',revNo:'01',revTar:'2025-03-10',sayfaNo:'1/1',brans:'Genel Cerrahi'},
   footer:{title:'ONAY BÖLÜMLERİ',lbl1:'HAZIRLAYAN',name1:'Dr. Ahmet Yılmaz',date1:'2025-03-10',lbl2:'SİSTEM ONAYI',name2:'Başhekim',date2:'',lbl3:'YÜRÜRLÜLÜK ONAYI',name3:'Kalite Müdürü',date3:''},
  },
  {id:3,name:'Total Diz Artroplastisi',branch:'Ortopedi',dur:120,diff:'Karmaşık',ane:'Spinal',color:'#7C3AED',
   desc:'Diz ekleminin protez ile değiştirilmesi. Primer ve revizyon uygulamaları mevcuttur.',
   steps:[{t:'Pozisyon & Turnike',n:'Supin, turnike 300 mmHg, diz fleksiyonda.',dur:'10 dk'},{t:'Eklem Açma',n:'Paramedian insizyon, kapsül açılması.',dur:'15 dk'},{t:'Femur Kesisi',n:'İntramedüller kılavuz, 5-7° valgus, distal femur kesisi.',dur:'25 dk'},{t:'Tibia Kesisi',n:'Ekstramedüller kılavuz, tibial platö perpendikül kesisi.',dur:'20 dk'},{t:'Denge & Trial',n:'Ligament balansı, trial komponent deneme.',dur:'20 dk',warn:'Fleksiyon-ekstansiyon boşluğu eşit olmalı'},{t:'Sementasyon',n:'Çimento hazırlama, implant yerleştirme, sıkıştırma.',dur:'15 dk'},{t:'Kapatma',n:'Kapsül sütürü, dren, cilt kapatma.',dur:'15 dk'}],
   materials:[{cat:'İmplant',name:'TDA Protez Sistemi',qty:'1 set',color:'#7C3AED'},{cat:'Sarf',name:'Kemik Çimentosu',qty:'2 paket',color:'#0284C7'},{cat:'Alet',name:'Pnömatik Turnike',qty:'1 adet',color:'#EA580C'},{cat:'Sarf',name:'Hemovak Dren',qty:'1 adet',color:'#059669'},{cat:'Sarf',name:'Elektrokoter',qty:'1 adet',color:'#DC2626'}],
   risks:[{sev:'high',lbl:'Yüksek Risk',txt:'Derin ven trombozu — antikoagülan profilaksi zorunlu'},{sev:'high',lbl:'Yüksek Risk',txt:'Peroneal sinir yaralanması — valgus düzeltme miktarı izlenmeli'},{sev:'med',lbl:'Orta Risk',txt:'Yara enfeksiyonu — perioperatif antibiyotik protokolü uygulanmalı'},{sev:'low',lbl:'Düşük Risk',txt:'Çimento reaksiyonu — kan basıncı izlemi'}],
   meta:{dokNo:'SOP-2025-003',yayinTar:'2025-02-01',revNo:'00',revTar:'',sayfaNo:'1/1',brans:'Ortopedi'},
   footer:{title:'ONAY BÖLÜMLERİ',lbl1:'HAZIRLAYAN',name1:'Dr. Ortopedi',date1:'2025-02-01',lbl2:'SİSTEM ONAYI',name2:'',date2:'',lbl3:'YÜRÜRLÜLÜK ONAYI',name3:'',date3:''},
  },
  {id:4,name:'Tiroidektomi',branch:'Endokrin Cerrahisi',dur:100,diff:'Karmaşık',ane:'Genel Anestezi',color:'#0284C7',
   desc:'Tiroid bezinin total veya subtotal olarak çıkarılması. Malignite ve multinodüler guatr endikasyonları.',
   steps:[{t:'Pozisyon',n:'Supin, boyun hiperekstansiyonu, omuz altına yastık.',dur:'5 dk'},{t:'İnsizyon',n:'Boyun orta hatta Kocher insizyonu (4-6 cm).',dur:'10 dk'},{t:'Diseksiyon',n:'Derin servikal fasya açılması, kas ayrılması.',dur:'20 dk'},{t:'Sinir Koruması',n:'N. laryngeus recurrens tanımlanması ve korunması.',dur:'20 dk',warn:'Sinir monitorizasyonu kullanılmalı'},{t:'Paratiroid',n:'Paratiroid bezlerin tanımlanması, kanlanmanın korunması.',dur:'15 dk'},{t:'Bez Çıkarma',n:'Tiroid lobunun serbest bırakılması ve çıkarılması.',dur:'20 dk'},{t:'Dren & Kapatma',n:'Hemovak dren, kas ve cilt kapatma.',dur:'10 dk'}],
   materials:[{cat:'Alet',name:'Nöromonitor Set',qty:'1 set',color:'#DC2626'},{cat:'Alet',name:'Elektrokoter',qty:'1 adet',color:'#0284C7'},{cat:'Sarf',name:'Hemovak Dren',qty:'1 adet',color:'#059669'},{cat:'Sarf',name:'Absorbable Sütür',qty:'2 paket',color:'#7C3AED'}],
   risks:[{sev:'high',lbl:'Yüksek Risk',txt:'N. recurrens yaralanması — intraoperatif sinir monitorizasyonu şart'},{sev:'high',lbl:'Yüksek Risk',txt:'Hipoparatiroidizm — kalsiyum ve PTH takibi yapılmalı'},{sev:'med',lbl:'Orta Risk',txt:'Postoperatif kanama — hematom boyun kompresyonuna yol açabilir'}],
   meta:{dokNo:'SOP-2025-004',yayinTar:'2025-02-15',revNo:'01',revTar:'2025-03-20',sayfaNo:'1/1',brans:'Endokrin Cerrahisi'},
   footer:{title:'ONAY BÖLÜMLERİ',lbl1:'HAZIRLAYAN',name1:'Dr. Cerrah',date1:'2025-03-20',lbl2:'SİSTEM ONAYI',name2:'Başhekim',date2:'2025-03-25',lbl3:'YÜRÜRLÜLÜK ONAYI',name3:'Kalite Müdürü',date3:'2025-03-30'},
  },
];

function fmtDate(d){if(!d)return'—';try{return new Date(d).toLocaleDateString('tr-TR');}catch{return d;}}

function getDefaultDocContent(p){
  if(!p)return`<h2>1. AMAÇ</h2><p>Bu prosedürün amacı...</p><h2>2. KAPSAM</h2><p>Bu prosedür ...</p><h2>3. TANIMLAR</h2><p></p><h2>4. SORUMLULUKLAR</h2><p></p><h2>5. UYGULAMA ADIMLARI</h2><ol><li>...</li></ol><h2>6. REFERANSLAR</h2><p></p>`;
  const steps=(p.steps||[]).map(s=>`<li><strong>${s.t}</strong> — ${s.n}</li>`).join('');
  const mats=(p.materials||[]).map(m=>`<li>${m.name} (${m.qty})</li>`).join('');
  const risks=(p.risks||[]).map(r=>`<li><strong>${r.lbl}:</strong> ${r.txt}</li>`).join('');
  return`<h2>1. AMAÇ</h2><p>${p.desc}</p><h2>2. KAPSAM</h2><p>Bu prosedür ${p.branch} dalında uygulanacak ${p.name} işlemine ait standart operasyon protokolünü kapsar.</p><h2>3. ANESTEZİ</h2><p>${p.ane} uygulanır. Tahmini süre: ${p.dur} dakika.</p><h2>4. UYGULAMA ADIMLARI</h2><ol>${steps}</ol><h2>5. GEREKLİ MALZEME VE EKİPMAN</h2><ul>${mats}</ul><h2>6. RİSKLER VE UYARILAR</h2><ul>${risks}</ul>`;
}

// ── Yazdır fonksiyonu (orijinal printBelge'ye denk) ──────────
function printDoc(html, title){
  const w = window.open('','_blank','width=900,height=750');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}body{background:white;font-family:'Inter',system-ui,sans-serif;padding:24px;color:#1a1a1a}
    h2{font-size:14px;font-weight:700;color:#1e3a5f;margin:14px 0 5px}p,li{font-size:12.5px;line-height:1.7;color:#334155}
    ol,ul{padding-left:20px;margin:4px 0}table{width:100%;border-collapse:collapse;margin:8px 0}
    td,th{border:1px solid #cbd5e1;padding:6px 10px;font-size:12px}th{background:#f1f5f9;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.3px;color:#475569}
    .doc-header{border:2px solid #1e3a5f;display:grid;grid-template-columns:76px 1fr;overflow:hidden;margin-bottom:16px}
    .doc-header-logo{background:#1e3a5f;display:flex;align-items:center;justify-content:center;padding:10px}
    .doc-header-title-row{background:#1e3a5f;padding:8px 14px}
    .doc-title{font-size:14px;font-weight:800;color:white;letter-spacing:-0.2px}
    .doc-header-meta{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid rgba(30,58,95,0.3)}
    .doc-meta-cell{padding:5px 10px;border-right:1px solid rgba(30,58,95,0.2)}
    .doc-meta-cell:last-child{border-right:none}
    .doc-meta-lbl{font-size:8.5px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px}
    .doc-meta-val{font-size:11.5px;font-weight:600;color:#1a1a1a}
    .doc-content{padding:12px 0;min-height:120px}
    .doc-footer{border:2px solid #1e3a5f;margin-top:16px}
    .doc-footer-title-bar{background:#1e3a5f;padding:6px 14px;font-size:10.5px;font-weight:700;color:white;letter-spacing:0.3px}
    .doc-footer-grid{display:grid;grid-template-columns:1fr 1fr 1fr}
    .doc-footer-cell{padding:10px 14px;border-right:1px solid rgba(30,58,95,0.25)}
    .doc-footer-cell:last-child{border-right:none}
    .sign-area{height:36px;border-top:1px dashed #cbd5e1;margin-top:8px;display:flex;align-items:flex-end;padding-bottom:2px}
    .sign-txt{font-size:9px;color:#94a3b8;font-style:italic}
    .footer-name{font-size:12px;font-weight:600;color:#1a1a1a;margin-top:4px}
    .footer-date{font-size:10px;color:#64748b;margin-top:3px}
    @media print{body{padding:0}@page{size:A4;margin:10mm}}
  </style></head><body>${html}<script>window.onload=function(){window.print();}<\/script></body></html>`);
  w.document.close();
}

// ── Döküman HTML üretici ─────────────────────────────────────
function buildDocHTML(p, docContent, logoSrc){
  const meta=p.meta||{};const footer=p.footer||{};
  const logoHtml=logoSrc
    ?`<img src="${logoSrc}" style="max-width:52px;max-height:44px;object-fit:contain">`
    :`<svg viewBox="0 0 24 24" fill="white" width="36" height="36"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/></svg>`;
  return`<div class="doc-header">
    <div class="doc-header-logo">${logoHtml}</div>
    <div>
      <div class="doc-header-title-row"><div class="doc-title">${p.name}</div></div>
      <div class="doc-header-meta">
        ${[['Doküman No',meta.dokNo||'—'],['Yayın Tarihi',fmtDate(meta.yayinTar)],['Rev. No',meta.revNo||'00'],['Revizyon Tarihi',fmtDate(meta.revTar)],['Sayfa No',meta.sayfaNo||'1/1'],['Branş',meta.brans||p.branch]].map(([l,v])=>`<div class="doc-meta-cell"><div class="doc-meta-lbl">${l}</div><div class="doc-meta-val">${v}</div></div>`).join('')}
      </div>
    </div>
  </div>
  <div class="doc-content">${docContent}</div>
  <div class="doc-footer">
    <div class="doc-footer-title-bar">${footer.title||'ONAY BÖLÜMLERİ'}</div>
    <div class="doc-footer-grid">
      ${[[footer.lbl1||'HAZIRLAYAN',footer.name1||'—',footer.date1],[footer.lbl2||'SİSTEM ONAYI',footer.name2||'—',footer.date2],[footer.lbl3||'YÜRÜRLÜLÜK ONAYI',footer.name3||'—',footer.date3]].map(([lbl,name,date])=>`
      <div class="doc-footer-cell">
        <div class="doc-meta-lbl">${lbl}</div>
        <div class="footer-name">${name}</div>
        <div class="sign-area"><span class="sign-txt">İmza alanı</span></div>
        ${date?`<div class="footer-date">${fmtDate(date)}</div>`:''}
      </div>`).join('')}
    </div>
  </div>`;
}

// ── Prosedür Oluştur / Düzenle MODAL ─────────────────────────
function ProsModal({ editing, onSave, onClose }){
  const p = editing;
  const today = new Date().toISOString().split('T')[0];
  const editorRef = useRef(null);
  const logoUploadRef = useRef(null);
  const [logo, setLogo] = useState(p?.logo||null);
  const [form, setForm] = useState({
    name:p?.name||'', branch:p?.branch||'Genel Cerrahi',
    diff:p?.diff||'Orta', ane:p?.ane||'Genel Anestezi', dur:p?.dur||90,
    dokNo:p?.meta?.dokNo||'SOP-2025-001', yayinTar:p?.meta?.yayinTar||today,
    revNo:p?.meta?.revNo||'00', revTar:p?.meta?.revTar||'',
    sayfaNo:p?.meta?.sayfaNo||'1/1', brans:p?.meta?.brans||p?.branch||'',
    footerTitle:p?.footer?.title||'ONAY BÖLÜMLERİ',
    lbl1:p?.footer?.lbl1||'HAZIRLAYAN', name1:p?.footer?.name1||'', date1:p?.footer?.date1||today,
    lbl2:p?.footer?.lbl2||'SİSTEM ONAYI', name2:p?.footer?.name2||'', date2:p?.footer?.date2||'',
    lbl3:p?.footer?.lbl3||'YÜRÜRLÜLÜK ONAYI', name3:p?.footer?.name3||'', date3:p?.footer?.date3||'',
  });
  const f=(k,v)=>setForm(prev=>({...prev,[k]:v}));

  useEffect(()=>{
    if(editorRef.current) editorRef.current.innerHTML = p?.docContent||getDefaultDocContent(p);
  },[]);

  function execFmt(cmd,val){
    document.execCommand(cmd,false,val||null);
    editorRef.current?.focus();
  }
  function insertTable(){
    document.execCommand('insertHTML',false,`<table><tr><th>Başlık 1</th><th>Başlık 2</th><th>Başlık 3</th></tr><tr><td>Veri</td><td>Veri</td><td>Veri</td></tr></table><p></p>`);
    editorRef.current?.focus();
  }
  function loadLogo(e){
    const file=e.target.files[0]; if(!file) return;
    const r=new FileReader();
    r.onload=ev=>setLogo(ev.target.result);
    r.readAsDataURL(file);
  }
  function save(){
    if(!form.name.trim()) return;
    const colors=['#14B8A6','#DC2626','#7C3AED','#0284C7','#EA580C','#059669'];
    const newId=p?.id||Date.now();
    onSave({
      id:newId, name:form.name, branch:form.branch, dur:Number(form.dur),
      diff:form.diff, ane:form.ane, color:p?.color||colors[newId%6],
      desc:p?.desc||form.name, steps:p?.steps||[], materials:p?.materials||[], risks:p?.risks||[],
      logo, docContent:editorRef.current?.innerHTML||'',
      meta:{dokNo:form.dokNo,yayinTar:form.yayinTar,revNo:form.revNo,revTar:form.revTar,sayfaNo:form.sayfaNo,brans:form.brans},
      footer:{title:form.footerTitle,lbl1:form.lbl1,name1:form.name1,date1:form.date1,lbl2:form.lbl2,name2:form.name2,date2:form.date2,lbl3:form.lbl3,name3:form.name3,date3:form.date3},
    });
  }

  return(
    <div className="modal-bg open" onClick={onClose}>
      <div className="modal pros-modal-wide" onClick={e=>e.stopPropagation()}>

        {/* Modal Başlık */}
        <div className="modal-title" style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:34,height:34,borderRadius:8,background:'rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
            </div>
            <div>
              <div style={{fontSize:14,fontWeight:700}}>{p?'Prosedür Düzenle':'Yeni Prosedür Dökümanı'}</div>
              <div style={{fontSize:10,opacity:0.55,marginTop:1}}>Aşağıdaki alanlara tıklayarak düzenleyebilirsiniz</div>
            </div>
          </div>
          <div style={{display:'flex',gap:7,alignItems:'center'}}>
            <button className="btn btn-secondary btn-sm" onClick={insertTable} style={{fontSize:11}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:11,height:11}}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
              Tablo Ekle
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onClose} style={{fontSize:11}}>İptal</button>
            <button className="btn btn-primary btn-sm" onClick={save} style={{fontSize:11}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:11,height:11}}><polyline points="20 6 9 17 4 12"/></svg>
              Kaydet
            </button>
          </div>
        </div>

        {/* Scroll içerik */}
        <div style={{overflowY:'auto',flex:1,padding:'18px 20px',background:'var(--surface)'}}>

          {/* Logo bar */}
          <div style={{background:'var(--card-bg)',border:'1px solid var(--border)',borderRadius:10,padding:'10px 14px',marginBottom:14,display:'flex',alignItems:'center',gap:12}}>
            <div
              style={{width:40,height:40,border:'1.5px dashed var(--border)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',overflow:'hidden',flexShrink:0,transition:'all 0.15s'}}
              onClick={()=>logoUploadRef.current?.click()}
              onMouseOver={e=>e.currentTarget.style.borderColor='var(--teal-mid)'}
              onMouseOut={e=>e.currentTarget.style.borderColor='var(--border)'}>
              {logo
                ?<img src={logo} style={{width:'100%',height:'100%',objectFit:'contain'}}/>
                :<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--slate-light)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>}
            </div>
            <input ref={logoUploadRef} type="file" accept="image/*" style={{display:'none'}} onChange={loadLogo}/>
            <div style={{flex:1}}>
              <div style={{fontSize:'11.5px',fontWeight:600,color:'var(--slate)'}}>Kurum Logosu</div>
              <div style={{fontSize:10,color:'var(--slate-light)',marginTop:1}}>Döküman başlığında görünür · Değiştirmek için tıklayın</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={()=>logoUploadRef.current?.click()} style={{fontSize:'10.5px',flexShrink:0}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:11,height:11}}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Logo Yükle
            </button>
          </div>

          {/* A4 Döküman önizlemesi */}
          <div className="pros-doc" style={{boxShadow:'0 6px 28px rgba(0,0,0,0.2)',borderRadius:6,overflow:'hidden'}}>
            <div style={{padding:20}}>

              {/* SAYFA BAŞI */}
              <div className="doc-header" style={{marginBottom:16}}>
                <div className="doc-header-logo" id="docLogoCell">
                  {logo
                    ?<img src={logo} style={{maxWidth:52,maxHeight:44,objectFit:'contain'}}/>
                    :<svg viewBox="0 0 24 24" fill="white" width="36" height="36"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/></svg>}
                </div>
                <div className="doc-header-right">
                  <div className="doc-header-title-row">
                    <input type="text" value={form.name} onChange={e=>f('name',e.target.value)} placeholder="Prosedür Adını Girin…" style={{fontSize:15,fontWeight:800,letterSpacing:'-0.3px'}}/>
                  </div>
                  <div className="doc-header-meta">
                    <div className="doc-meta-cell"><div className="doc-meta-lbl">Doküman No</div><input className="doc-meta-input" value={form.dokNo} onChange={e=>f('dokNo',e.target.value)} placeholder="SOP-2025-001"/></div>
                    <div className="doc-meta-cell"><div className="doc-meta-lbl">Yayın Tarihi</div><input className="doc-meta-input" type="date" value={form.yayinTar} onChange={e=>f('yayinTar',e.target.value)}/></div>
                    <div className="doc-meta-cell"><div className="doc-meta-lbl">Rev. No</div><input className="doc-meta-input" value={form.revNo} onChange={e=>f('revNo',e.target.value)} placeholder="00"/></div>
                    <div className="doc-meta-cell"><div className="doc-meta-lbl">Revizyon Tarihi</div><input className="doc-meta-input" type="date" value={form.revTar} onChange={e=>f('revTar',e.target.value)}/></div>
                    <div className="doc-meta-cell"><div className="doc-meta-lbl">Sayfa No</div><input className="doc-meta-input" value={form.sayfaNo} onChange={e=>f('sayfaNo',e.target.value)} placeholder="1/1"/></div>
                    <div className="doc-meta-cell"><div className="doc-meta-lbl">Branş</div><input className="doc-meta-input" value={form.brans} onChange={e=>f('brans',e.target.value)} placeholder="Genel Cerrahi"/></div>
                  </div>
                </div>
              </div>

              {/* FORMAT BAR + EDİTÖR */}
              <div style={{border:'1px solid #cbd5e1',borderRadius:6,overflow:'hidden',marginBottom:16}}>
                <div className="fmt-bar">
                  <select className="fmt-select" onChange={e=>{execFmt('formatBlock',e.target.value);e.target.value='';}} title="Başlık">
                    <option value="">Paragraf</option>
                    <option value="h1">Başlık 1</option><option value="h2">Başlık 2</option><option value="h3">Başlık 3</option>
                  </select>
                  <select className="fmt-select" onChange={e=>{execFmt('fontSize',e.target.value);e.target.value='';}} title="Boyut">
                    <option value="">Boyut</option>
                    <option value="1">8pt</option><option value="2">10pt</option><option value="3">12pt</option>
                    <option value="4">14pt</option><option value="5">18pt</option><option value="6">24pt</option>
                  </select>
                  <div className="fmt-sep"/>
                  <button className="fmt-btn" onClick={()=>execFmt('bold')} title="Kalın"><b>B</b></button>
                  <button className="fmt-btn" onClick={()=>execFmt('italic')} title="İtalik" style={{fontStyle:'italic'}}><i>I</i></button>
                  <button className="fmt-btn" onClick={()=>execFmt('underline')} title="Altı Çizili" style={{textDecoration:'underline'}}>U</button>
                  <button className="fmt-btn" onClick={()=>execFmt('strikeThrough')} title="Üstü Çizili" style={{textDecoration:'line-through'}}>S</button>
                  <div className="fmt-sep"/>
                  <button className="fmt-btn" onClick={()=>execFmt('justifyLeft')} title="Sola">&#8676;</button>
                  <button className="fmt-btn" onClick={()=>execFmt('justifyCenter')} title="Ortala">&#8652;</button>
                  <button className="fmt-btn" onClick={()=>execFmt('justifyRight')} title="Sağa">&#8677;</button>
                  <div className="fmt-sep"/>
                  <button className="fmt-btn" onClick={()=>execFmt('insertUnorderedList')} title="Madde">•</button>
                  <button className="fmt-btn" onClick={()=>execFmt('insertOrderedList')} title="Numaralı">1.</button>
                  <button className="fmt-btn" onClick={()=>execFmt('indent')} title="Girinti +">→</button>
                  <button className="fmt-btn" onClick={()=>execFmt('outdent')} title="Girinti -">←</button>
                  <div className="fmt-sep"/>
                  <button className="fmt-btn" onClick={()=>execFmt('removeFormat')} title="Biçimi Temizle" style={{fontSize:10,fontFamily:'sans-serif'}}>Tx</button>
                  <div className="fmt-sep"/>
                  <div style={{display:'flex',alignItems:'center',gap:4}}>
                    <span style={{fontSize:10,color:'var(--slate-light)'}}>Renk:</span>
                    <input type="color" defaultValue="#1e3a5f" style={{width:22,height:22,border:'none',padding:0,cursor:'pointer',borderRadius:4}} onChange={e=>execFmt('foreColor',e.target.value)} title="Yazı Rengi"/>
                    <input type="color" defaultValue="#CCFBF1" style={{width:22,height:22,border:'none',padding:0,cursor:'pointer',borderRadius:4}} onChange={e=>execFmt('hiliteColor',e.target.value)} title="Arka Plan Rengi"/>
                  </div>
                </div>
                <div
                  ref={editorRef}
                  className="doc-content-editor"
                  contentEditable
                  suppressContentEditableWarning
                  style={{minHeight:280}}
                />
              </div>

              {/* SAYFA SONU */}
              <div className="doc-footer">
                <div className="doc-footer-title">
                  <input type="text" value={form.footerTitle} onChange={e=>f('footerTitle',e.target.value)} style={{background:'transparent',border:'none',outline:'none',color:'white',fontSize:11,fontWeight:700,fontFamily:'var(--font)',width:'100%',letterSpacing:'0.3px'}}/>
                </div>
                <div className="doc-footer-grid">
                  {[1,2,3].map(i=>(
                    <div className="doc-footer-cell" key={i}>
                      <input type="text" className="doc-footer-lbl-input" value={form[`lbl${i}`]} onChange={e=>f(`lbl${i}`,e.target.value)}/>
                      <input type="text" className="doc-footer-name-input" value={form[`name${i}`]} onChange={e=>f(`name${i}`,e.target.value)} placeholder="Ad Soyad / Ünvan"/>
                      <div className="doc-sign-area"><span className="doc-sign-txt">İmza alanı</span></div>
                      <div className="doc-footer-date">
                        <input type="date" value={form[`date${i}`]} onChange={e=>f(`date${i}`,e.target.value)} style={{border:'none',outline:'none',fontSize:10,color:'#64748b',background:'transparent',fontFamily:'var(--font)'}}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ANA COMPONENT ─────────────────────────────────────────────
export default function Prosedurler(){
  const { curRole } = useAuthStore();
  const { showToast } = useUIStore();
  const isAdmin = curRole===0;

  const [prosedurler, setProsedurler] = useState(INIT_PROSEDURLER);
  const [selId,  setSelId]  = useState(INIT_PROSEDURLER[0]?.id || null);
  const [aramaQ, setAramaQ] = useState('');
  const [modal,  setModal]  = useState(null);

  useEffect(() => {
    fetch(`${BASE}/prosedurler`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (data.length > 0) {
          const mapped = data.map(dbToPros);
          setProsedurler(mapped);
          setSelId(mapped[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const filtered = prosedurler.filter(p=>
    p.name.toLowerCase().includes(aramaQ.toLowerCase())||
    p.branch.toLowerCase().includes(aramaQ.toLowerCase())
  );
  const p = prosedurler.find(x=>x.id===selId)||prosedurler[0];
  const meta=p?.meta||{};const footer=p?.footer||{};

  async function savePros(data){
    const body = { baslik: data.name, kategori: data.branch, icerik: data.docContent, versiyon: data.meta?.revNo||'1.0' };
    const isEdit = prosedurler.find(x=>x.id===data.id);
    try {
      if (isEdit) {
        await fetch(`${BASE}/prosedurler/${data.id}`, { method:'PUT', headers:{'Content-Type':'application/json',Authorization:`Bearer ${tok()}`}, body: JSON.stringify(body) });
        setProsedurler(prev=>prev.map(x=>x.id===data.id?{...x,...data}:x));
        showToast('Prosedür güncellendi ✓');
      } else {
        const res = await fetch(`${BASE}/prosedurler`, { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${tok()}`}, body: JSON.stringify(body) });
        const saved = await res.json();
        const newP = { ...data, id: saved.id || data.id };
        setProsedurler(prev=>[...prev,newP]);
        setSelId(newP.id);
        showToast('Prosedür oluşturuldu ✓');
      }
    } catch(e) {
      showToast('Kayıt hatası: ' + e.message);
    }
    setModal(null);
  }
  async function deletePros(id){
    if(prosedurler.length<=1){showToast('En az 1 prosedür olmalı');return;}
    if(!window.confirm('Bu prosedürü silmek istiyor musunuz?')) return;
    try {
      await fetch(`${BASE}/prosedurler/${id}`, { method:'DELETE', headers:{Authorization:`Bearer ${tok()}`} });
    } catch(e) { /* fail silently */ }
    setProsedurler(prev=>prev.filter(x=>x.id!==id));
    setSelId(prosedurler.find(x=>x.id!==id)?.id);
    showToast('Prosedür silindi');
  }
  function handlePrint(){
    if(!p) return;
    const content=p.docContent||getDefaultDocContent(p);
    printDoc(buildDocHTML(p,content,p.logo||null), p.name);
  }
  function handleIndir(){
    if(!p) return;
    const content=p.docContent||getDefaultDocContent(p);
    const html=buildDocHTML(p,content,p.logo||null);
    const safeName=p.name.replace(/[^\w\s]/g,'').replace(/\s+/g,'_');
    const blob=new Blob([`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${p.name}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter',system-ui,sans-serif;padding:24px;color:#1a1a1a}
    h2{font-size:14px;font-weight:700;color:#1e3a5f;margin:14px 0 5px}p,li{font-size:12.5px;line-height:1.7;color:#334155}
    ol,ul{padding-left:20px;margin:4px 0}table{width:100%;border-collapse:collapse;margin:8px 0}
    td,th{border:1px solid #cbd5e1;padding:6px 10px;font-size:12px}th{background:#f1f5f9;font-weight:700;font-size:11px;text-transform:uppercase;color:#475569}
    .doc-header{border:2px solid #1e3a5f;display:grid;grid-template-columns:76px 1fr;overflow:hidden;margin-bottom:16px}
    .doc-header-logo{background:#1e3a5f;display:flex;align-items:center;justify-content:center;padding:10px}
    .doc-header-title-row{background:#1e3a5f;padding:8px 14px}
    .doc-title{font-size:14px;font-weight:800;color:white}
    .doc-header-meta{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid rgba(30,58,95,0.3)}
    .doc-meta-cell{padding:5px 10px;border-right:1px solid rgba(30,58,95,0.2)}.doc-meta-cell:last-child{border-right:none}
    .doc-meta-lbl{font-size:8.5px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px}
    .doc-meta-val{font-size:11.5px;font-weight:600;color:#1a1a1a}
    .doc-content{padding:12px 0}
    .doc-footer{border:2px solid #1e3a5f;margin-top:16px}
    .doc-footer-title-bar{background:#1e3a5f;padding:6px 14px;font-size:10.5px;font-weight:700;color:white;letter-spacing:0.3px}
    .doc-footer-grid{display:grid;grid-template-columns:1fr 1fr 1fr}
    .doc-footer-cell{padding:10px 14px;border-right:1px solid rgba(30,58,95,0.25)}.doc-footer-cell:last-child{border-right:none}
    .doc-meta-lbl{font-size:9px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px}
    .footer-name{font-size:12px;font-weight:600;color:#1a1a1a;margin-top:4px}
    .sign-area{height:36px;border-top:1px dashed #cbd5e1;margin-top:8px;display:flex;align-items:flex-end;padding-bottom:2px}
    .sign-txt{font-size:9px;color:#94a3b8;font-style:italic}.footer-date{font-size:10px;color:#64748b;margin-top:3px}
    @media print{body{padding:0}@page{size:A4;margin:10mm}}</style></head><body>${html}</body></html>`],{type:'text/html'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=safeName+'.html';a.click();
    URL.revokeObjectURL(url);
    showToast(`"${p.name}" indirildi — tarayıcıda açıp PDF olarak kaydedebilirsiniz`);
  }

  const diffColor={Basit:'t-green',Orta:'t-blue',Karmaşık:'t-orange','İleri Düzey':'t-red'};

  return(
    <div className="pros-layout">

      {/* ── SOL PANEL ── */}
      <div className="pros-sidebar">
        <div className="pros-sidebar-hd">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <span style={{fontSize:'9.5px',fontWeight:700,color:'var(--slate-light)',textTransform:'uppercase',letterSpacing:'0.6px'}}>Prosedür Kütüphanesi</span>
            <span className="tag t-teal" style={{fontSize:9}}>{prosedurler.length} kayıt</span>
          </div>
          <div className="pros-search">
            <svg viewBox="0 0 24 24" strokeWidth="2" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="text" placeholder="Prosedür ara…" value={aramaQ} onChange={e=>setAramaQ(e.target.value)}/>
          </div>
        </div>
        <div className="pros-list">
          {filtered.map(item=>(
            <div key={item.id} className={`pros-item${item.id===selId?' active':''}`} onClick={()=>setSelId(item.id)}>
              <div className="pros-item-dot" style={{background:item.color}}/>
              <div>
                <div className="pros-item-name">{item.name}</div>
                <div style={{fontSize:'9.5px',color:'var(--slate-light)',marginTop:1}}>{item.branch}</div>
              </div>
              <div className="pros-item-dur">{item.dur}dk</div>
            </div>
          ))}
        </div>
        {isAdmin&&(
          <div className="pros-add-btn" onClick={()=>setModal('yeni')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Yeni Prosedür Ekle
          </div>
        )}
      </div>

      {/* ── SAĞ DETAY ── */}
      {p?(
        <div className="pros-detail">
          <div className="pros-detail-hd">
            <div className="pros-icon" style={{background:`${p.color}1A`}}>
              <svg viewBox="0 0 24 24" fill="none" stroke={p.color} strokeWidth="2">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="1"/>
                <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="12" y2="16"/>
              </svg>
            </div>
            <div className="pros-detail-info">
              <div className="pros-detail-name">{p.name}</div>
              <div className="pros-detail-desc">{meta.dokNo||'—'} · Rev.{meta.revNo||'00'} · {fmtDate(meta.yayinTar)}</div>
              <div className="pros-meta-row">
                <span className="pros-meta">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {p.dur} dk
                </span>
                <span className={`tag ${diffColor[p.diff]||'t-blue'}`} style={{fontSize:9}}>{p.diff}</span>
                <span className="pros-meta">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                  {p.ane}
                </span>
              </div>
            </div>
            <div style={{display:'flex',gap:7,flexShrink:0,flexWrap:'wrap'}}>
              <button className="btn btn-secondary btn-sm" onClick={handlePrint}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:12,height:12}}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Yazdır
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handleIndir}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:12,height:12}}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                İndir
              </button>
              {isAdmin&&<>
                <button className="btn btn-secondary btn-sm" onClick={()=>setModal(p)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:12,height:12}}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Düzenle
                </button>
                <button className="btn btn-sm" style={{background:'#FEF2F2',color:'#DC2626',border:'1px solid #FECACA'}} onClick={()=>deletePros(p.id)}>Sil</button>
              </>}
            </div>
          </div>

          {/* Döküman önizleme */}
          <div className="pros-body">
            <div className="pros-doc" style={{border:'1px solid var(--border)',borderRadius:8,overflow:'hidden',boxShadow:'0 4px 16px var(--shadow-color)'}}>
              <div style={{padding:'16px 18px'}}>

                {/* SAYFA BAŞI */}
                <div className="doc-header" style={{marginBottom:14}}>
                  <div className="doc-header-logo">
                    {p.logo
                      ?<img src={p.logo} style={{maxWidth:52,maxHeight:44,objectFit:'contain'}}/>
                      :<svg viewBox="0 0 24 24" fill="white" width="30" height="30"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/></svg>}
                  </div>
                  <div className="doc-header-right">
                    <div style={{background:'#1e3a5f',padding:'7px 14px'}}>
                      <div style={{fontSize:14,fontWeight:800,color:'white',letterSpacing:'-0.3px'}}>{p.name}</div>
                    </div>
                    <div className="doc-header-meta">
                      {[['Doküman No',meta.dokNo||'—'],['Yayın Tarihi',fmtDate(meta.yayinTar)],['Rev. No',meta.revNo||'00'],['Revizyon Tarihi',fmtDate(meta.revTar)],['Sayfa No',meta.sayfaNo||'1/1'],['Branş',meta.brans||p.branch]].map(([l,v])=>(
                        <div className="doc-meta-cell" key={l}>
                          <div className="doc-meta-lbl">{l}</div>
                          <div style={{fontSize:'11.5px',fontWeight:600,color:'#1a1a1a'}}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* İÇERİK */}
                <div
                  className="doc-content-editor"
                  style={{pointerEvents:'none',minHeight:120,padding:'12px 14px',border:'1px solid #e2e8f0',borderRadius:6,marginBottom:14,fontSize:'12.5px'}}
                  dangerouslySetInnerHTML={{__html: p.docContent||getDefaultDocContent(p)}}
                />

                {/* SAYFA SONU */}
                <div className="doc-footer">
                  <div className="doc-footer-title">
                    <div style={{padding:'5px 14px',fontSize:'10.5px',fontWeight:700,color:'white',letterSpacing:'0.3px'}}>{footer.title||'ONAY BÖLÜMLERİ'}</div>
                  </div>
                  <div className="doc-footer-grid">
                    {[[footer.lbl1||'HAZIRLAYAN',footer.name1||'—',footer.date1],[footer.lbl2||'SİSTEM ONAYI',footer.name2||'—',footer.date2],[footer.lbl3||'YÜRÜRLÜLÜK ONAYI',footer.name3||'—',footer.date3]].map(([lbl,name,date],i)=>(
                      <div className="doc-footer-cell" key={i}>
                        <div className="doc-meta-lbl">{lbl}</div>
                        <div style={{fontSize:12,fontWeight:600,color:'#1a1a1a',marginTop:4}}>{name}</div>
                        <div className="doc-sign-area"><span className="doc-sign-txt">İmza alanı</span></div>
                        {date&&<div style={{fontSize:10,color:'#64748b',marginTop:3}}>{fmtDate(date)}</div>}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      ):(
        <div className="pros-detail">
          <div className="empty"><div className="empty-text">Prosedür seçin</div></div>
        </div>
      )}

      {modal&&(
        <ProsModal
          editing={modal==='yeni'?null:modal}
          onSave={savePros}
          onClose={()=>setModal(null)}
        />
      )}
    </div>
  );
}
