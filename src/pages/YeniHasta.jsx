import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore, useDataStore } from '../store';
import { createPatient } from '../services/patientsAdapter.js';

const INIT_FORM = {
  ad:'', soyad:'', tc:'', dogum:'', cinsiyet:'', kan:'', medeni:'',
  tel:'', tel2:'', email:'', adres:'', sehir:'', ilce:'',
  sigortaTip:'SGK', sigortaNo:'', sigortaSirket:'', policeNo:'',
  acilAd:'', acilTel:'', acilYakinlik:'',
  boy:'', kilo:'', alerjiler:'', kronik:'', ilaclar:'', gecmisop:'',
  notlar:'', belgeler:[],
};

const SEHIRLER = ['İstanbul','Ankara','İzmir','Bursa','Antalya','Adana','Konya','Gaziantep','Mersin','Kayseri','Eskişehir','Trabzon','Samsun','Denizli','Diyarbakır','Erzurum','Malatya','Diğer'];
const KAN_GRUPLARI = ['A Rh+','A Rh-','B Rh+','B Rh-','AB Rh+','AB Rh-','0 Rh+','0 Rh-'];

function calcYas(dogum) {
  if (!dogum) return '';
  const d = new Date(dogum), now = new Date();
  const y = now.getFullYear() - d.getFullYear() - (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
  return isNaN(y) ? '' : `${y} yaş`;
}

const DOLULUK_ALANLARI = [
  { lbl:'Ad & Soyad',      ok: f => !!(f.ad && f.soyad) },
  { lbl:'TC Kimlik',       ok: f => f.tc?.length === 11 },
  { lbl:'Doğum Tarihi',    ok: f => !!f.dogum },
  { lbl:'Cinsiyet',        ok: f => !!f.cinsiyet },
  { lbl:'Kan Grubu',       ok: f => !!f.kan },
  { lbl:'Telefon',         ok: f => !!f.tel },
  { lbl:'Adres / Şehir',   ok: f => !!(f.adres || f.sehir) },
  { lbl:'Sigorta Bilgisi', ok: f => !!f.sigortaTip },
  { lbl:'Acil İletişim',   ok: f => !!(f.acilAd && f.acilTel) },
  { lbl:'Alerji / Sağlık', ok: f => !!(f.alerjiler || f.kronik) },
];

export default function YeniHasta() {
  const navigate = useNavigate();
  const { showToast } = useUIStore();
  const { addHasta } = useDataStore();
  const [form, setForm] = useState({...INIT_FORM});
  const [tcMsg, setTcMsg] = useState({ txt:'', ok:false });
  const fileInputRef = useRef(null);

  const f = (k, v) => setForm(p => ({...p, [k]:v}));

  const fullAd = `${form.ad} ${form.soyad}`.trim();
  const initials = fullAd ? fullAd.split(' ').filter(Boolean).map(w=>w[0]).join('').substring(0,2).toUpperCase() : '?';
  const yas = form.dogum ? calcYas(form.dogum) : '';
  const cinsTxt = form.cinsiyet==='E'?'Erkek':form.cinsiyet==='K'?'Kadın':'';

  const tamamlanan = DOLULUK_ALANLARI.filter(a => a.ok(form)).length;
  const pct = Math.round(tamamlanan / DOLULUK_ALANLARI.length * 100);
  const barRenk = pct === 100 ? 'var(--success)' : pct >= 70 ? 'var(--teal)' : 'var(--warning)';

  function tcCheck(tc) {
    if (!tc || tc.length < 11) { setTcMsg({ txt:'', ok:false }); return; }
    const valid = tc.length === 11 && /^\d{11}$/.test(tc) && tc[0] !== '0';
    setTcMsg({ txt: valid ? '✓ Geçerli TC kimlik numarası' : '⚠ Geçersiz TC kimlik numarası', ok: valid });
  }

  function addFiles(files) {
    const names = [...files].map(f => f.name);
    setForm(p => ({...p, belgeler:[...p.belgeler, ...names]}));
  }
  function removeFile(i) {
    setForm(p => ({...p, belgeler: p.belgeler.filter((_,j)=>j!==i)}));
  }

  async function kaydet(taslak=false) {
    if (!form.ad || !form.soyad) { showToast('Ad ve soyad zorunludur'); return; }
    if (!form.tc || form.tc.length !== 11) { showToast('Geçerli TC kimlik numarası girin'); return; }
    try {
      const yeniHasta = await createPatient({
        firstName: form.ad, lastName: form.soyad, tcNo: form.tc,
        dateOfBirth: form.dogum ? new Date(form.dogum).toISOString() : null,
        gender: form.cinsiyet || null,
        phone: form.tel || null, bloodType: form.kan ? form.kan.replace(' Rh', '') : null,
      });
      if (!yeniHasta) throw new Error('Hasta kaydedilemedi');
      addHasta({ id: yeniHasta.id, ad: form.ad, soyad: form.soyad, tc: form.tc, tel: form.tel, kan: form.kan, cinsiyet: form.cinsiyet === 'E' ? 'Erkek' : 'Kadın', alerjiler: form.alerjiler, notlar: form.notlar });
      showToast(taslak ? 'Taslak kaydedildi ✓' : 'Hasta başarıyla kaydedildi ✓');
      if (!taslak) navigate('/hastalar');
    } catch(e) {
      showToast('Kayıt hatası: ' + e.message);
    }
  }

  function reset() {
    setForm({...INIT_FORM});
    setTcMsg({ txt:'', ok:false });
  }

  return (
    <div>
      {/* Başlık */}
      <div className="page-hd" style={{ marginBottom:16 }}>
        <div>
          <div className="page-hd-title">Yeni Hasta Kaydı</div>
          <div className="page-hd-sub">Sisteme yeni hasta ekleyin — tüm alanları doldurun</div>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/hastalar')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:12,height:12}}><polyline points="15 18 9 12 15 6"/></svg>
          Hasta Listesine Dön
        </button>
      </div>

      <div className="nh-layout">
        {/* Sol: Form */}
        <div className="nh-form">

          {/* KİŞİSEL BİLGİLER */}
          <div className="nh-form-section">
            <div className="nh-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Kişisel Bilgiler
            </div>
            <div className="nh-row">
              <div className="fg"><label className="fl">Ad</label><input className="fi" placeholder="Ad" value={form.ad} onChange={e=>f('ad',e.target.value)}/></div>
              <div className="fg"><label className="fl">Soyad</label><input className="fi" placeholder="Soyad" value={form.soyad} onChange={e=>f('soyad',e.target.value)}/></div>
            </div>
            <div className="nh-row">
              <div className="fg">
                <label className="fl">TC Kimlik No</label>
                <input className="fi" placeholder="12345678901" maxLength={11} value={form.tc} onChange={e=>{f('tc',e.target.value);tcCheck(e.target.value);}}/>
                {tcMsg.txt && <div style={{ fontSize:10, marginTop:3, color:tcMsg.ok?'var(--success)':'var(--warning)' }}>{tcMsg.txt}</div>}
              </div>
              <div className="fg"><label className="fl">Doğum Tarihi</label><input className="fi" type="date" value={form.dogum} onChange={e=>f('dogum',e.target.value)}/></div>
            </div>
            <div className="nh-row-3">
              <div className="fg"><label className="fl">Cinsiyet</label>
                <select className="fi" value={form.cinsiyet} onChange={e=>f('cinsiyet',e.target.value)}>
                  <option value="">Seçin</option><option value="E">Erkek</option><option value="K">Kadın</option>
                </select>
              </div>
              <div className="fg"><label className="fl">Kan Grubu</label>
                <select className="fi" value={form.kan} onChange={e=>f('kan',e.target.value)}>
                  <option value="">Seçin</option>
                  {KAN_GRUPLARI.map(k=><option key={k}>{k}</option>)}
                </select>
              </div>
              <div className="fg"><label className="fl">Medeni Durum</label>
                <select className="fi" value={form.medeni} onChange={e=>f('medeni',e.target.value)}>
                  <option value="">Seçin</option>
                  <option>Evli</option><option>Bekâr</option><option>Boşanmış</option><option>Dul</option>
                </select>
              </div>
            </div>
          </div>

          {/* İLETİŞİM */}
          <div className="nh-form-section">
            <div className="nh-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>
              İletişim Bilgileri
            </div>
            <div className="nh-row">
              <div className="fg"><label className="fl">Telefon</label><input className="fi" placeholder="0532 000 0000" value={form.tel} onChange={e=>f('tel',e.target.value)}/></div>
              <div className="fg"><label className="fl">İkinci Telefon (opsiyonel)</label><input className="fi" placeholder="0533 000 0000" value={form.tel2} onChange={e=>f('tel2',e.target.value)}/></div>
            </div>
            <div className="nh-row-full">
              <div className="fg"><label className="fl">E-posta (opsiyonel)</label><input className="fi" type="email" placeholder="ornek@eposta.com" value={form.email} onChange={e=>f('email',e.target.value)}/></div>
            </div>
            <div className="nh-row-full">
              <div className="fg"><label className="fl">Adres</label><textarea className="fi" rows={2} placeholder="Mahalle, Sokak, Kapı No…" value={form.adres} onChange={e=>f('adres',e.target.value)}/></div>
            </div>
            <div className="nh-row">
              <div className="fg"><label className="fl">Şehir</label>
                <select className="fi" value={form.sehir} onChange={e=>f('sehir',e.target.value)}>
                  <option value="">Şehir seçin</option>
                  {SEHIRLER.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="fg"><label className="fl">İlçe</label><input className="fi" placeholder="İlçe" value={form.ilce} onChange={e=>f('ilce',e.target.value)}/></div>
            </div>
          </div>

          {/* SİGORTA */}
          <div className="nh-form-section">
            <div className="nh-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Sigorta Bilgileri
            </div>
            <div className="nh-row">
              <div className="fg"><label className="fl">Sigorta Tipi</label>
                <select className="fi" value={form.sigortaTip} onChange={e=>f('sigortaTip',e.target.value)}>
                  <option>SGK</option><option>Özel Sigorta</option><option>Emekli Sandığı</option>
                  <option>Bağ-Kur</option><option>Yeşil Kart</option><option>Ücretli / Sigortasız</option>
                </select>
              </div>
              <div className="fg"><label className="fl">Sigorta / Provizyon No</label><input className="fi" placeholder="000000000" value={form.sigortaNo} onChange={e=>f('sigortaNo',e.target.value)}/></div>
            </div>
            <div className="nh-row">
              <div className="fg"><label className="fl">Sigorta Şirketi (Özel ise)</label><input className="fi" placeholder="Axa, Allianz, Mapfre…" value={form.sigortaSirket} onChange={e=>f('sigortaSirket',e.target.value)}/></div>
              <div className="fg"><label className="fl">Poliçe No</label><input className="fi" placeholder="Opsiyonel" value={form.policeNo} onChange={e=>f('policeNo',e.target.value)}/></div>
            </div>
          </div>

          {/* ACİL İLETİŞİM */}
          <div className="nh-form-section">
            <div className="nh-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Acil İletişim
            </div>
            <div className="nh-row-3">
              <div className="fg"><label className="fl">Yakınının Adı</label><input className="fi" placeholder="Ad Soyad" value={form.acilAd} onChange={e=>f('acilAd',e.target.value)}/></div>
              <div className="fg"><label className="fl">Telefon</label><input className="fi" placeholder="0532 000 0000" value={form.acilTel} onChange={e=>f('acilTel',e.target.value)}/></div>
              <div className="fg"><label className="fl">Yakınlık</label>
                <select className="fi" value={form.acilYakinlik} onChange={e=>f('acilYakinlik',e.target.value)}>
                  <option value="">Seçin</option>
                  <option>Eş</option><option>Anne</option><option>Baba</option><option>Kardeş</option><option>Çocuk</option><option>Diğer</option>
                </select>
              </div>
            </div>
          </div>

          {/* SAĞLIK GEÇMİŞİ */}
          <div className="nh-form-section">
            <div className="nh-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              Sağlık Geçmişi
            </div>
            <div className="nh-row">
              <div className="fg"><label className="fl">Boy (cm)</label><input className="fi" type="number" placeholder="170" min="50" max="250" value={form.boy} onChange={e=>f('boy',e.target.value)}/></div>
              <div className="fg"><label className="fl">Kilo (kg)</label><input className="fi" type="number" placeholder="70" min="1" max="300" value={form.kilo} onChange={e=>f('kilo',e.target.value)}/></div>
            </div>
            <div className="nh-row-full">
              <div className="fg"><label className="fl">Bilinen Alerjiler</label><textarea className="fi" rows={2} placeholder="Penisilin, NSAID, kontrast madde, lateks…" value={form.alerjiler} onChange={e=>f('alerjiler',e.target.value)}/></div>
            </div>
            <div className="nh-row-full">
              <div className="fg"><label className="fl">Kronik Hastalıklar</label><textarea className="fi" rows={2} placeholder="Hipertansiyon, Tip 2 DM, Koroner Arter Hastalığı…" value={form.kronik} onChange={e=>f('kronik',e.target.value)}/></div>
            </div>
            <div className="nh-row-full">
              <div className="fg"><label className="fl">Sürekli Kullandığı İlaçlar</label><textarea className="fi" rows={2} placeholder="Metformin 1000mg 2×1, Metoprolol 50mg 1×1…" value={form.ilaclar} onChange={e=>f('ilaclar',e.target.value)}/></div>
            </div>
            <div className="nh-row-full">
              <div className="fg"><label className="fl">Geçirilmiş Ameliyatlar (opsiyonel)</label><input className="fi" placeholder="Apendektomi (2018), Kolesistektomi (2021)…" value={form.gecmisop} onChange={e=>f('gecmisop',e.target.value)}/></div>
            </div>
          </div>

          {/* BELGELER */}
          <div className="nh-form-section">
            <div className="nh-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Belgeler & Dosyalar
            </div>
            <div className="nh-file-zone" onClick={() => fileInputRef.current?.click()}>
              <div className="nh-file-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--slate)' }}>Dosya Yükle</div>
                <div style={{ fontSize:'10.5px', color:'var(--slate-light)', marginTop:2 }}>Kimlik fotokopisi, sigorta kartı, tetkik sonuçları — PDF, JPG, PNG</div>
              </div>
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" style={{display:'none'}} onChange={e=>addFiles(e.target.files)}/>
            </div>
            {form.belgeler.length > 0 && (
              <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:5 }}>
                {form.belgeler.map((name, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:9, padding:'7px 10px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:7 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span style={{ fontSize:'11.5px', color:'var(--slate)', flex:1 }}>{name}</span>
                    <button onClick={() => removeFile(i)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--slate-light)', fontSize:14 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* NOTLAR */}
          <div className="nh-form-section">
            <div className="nh-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/></svg>
              Ek Notlar
            </div>
            <div className="fg">
              <textarea className="fi" rows={3} placeholder="Sekreter notu, özel talepler, dikkat edilmesi gerekenler…" value={form.notlar} onChange={e=>f('notlar',e.target.value)}/>
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding:'16px 22px', background:'var(--surface)', borderTop:'1px solid var(--border)', display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button className="btn btn-secondary" onClick={reset}>Formu Temizle</button>
            <button className="btn btn-secondary" onClick={() => kaydet(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:13,height:13}}><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v14a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Taslak Kaydet
            </button>
            <button className="btn btn-primary" onClick={() => kaydet(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:13,height:13}}><polyline points="20 6 9 17 4 12"/></svg>
              Hastayı Kaydet
            </button>
          </div>
        </div>

        {/* Sağ: Önizleme + Doluluk */}
        <div className="nh-sidebar">
          <div className="nh-preview-card">
            <div className="nh-preview-hd">
              <div className="nh-preview-av">{initials}</div>
              <div className="nh-preview-name">{fullAd || 'Ad Soyad'}</div>
              <div className="nh-preview-sub">{[yas,cinsTxt].filter(Boolean).join(' · ') || 'Kişisel bilgileri girin'}</div>
            </div>
            <div className="nh-preview-body">
              {[
                ['TC No',       form.tc||'—'],
                ['Kan Grubu',   form.kan||'—'],
                ['Telefon',     form.tel||'—'],
                ['Sigorta',     form.sigortaTip||'SGK'],
                ['Alerji',      form.alerjiler||'—'],
                ['Kronik',      form.kronik||'—'],
              ].map(([l,v]) => (
                <div className="nh-preview-row" key={l}>
                  <span className="nh-preview-lbl">{l}</span>
                  <span className="nh-preview-val" style={l==='Alerji'&&v!=='—'?{color:'var(--warning)'}:{}}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Doluluk göstergesi */}
          <div className="panel" style={{ padding:'14px 16px' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--slate-mid)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:10 }}>Form Durumu</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {DOLULUK_ALANLARI.map(a => {
                const ok = a.ok(form);
                return (
                  <div key={a.lbl} style={{ display:'flex', alignItems:'center', gap:7, fontSize:11 }}>
                    <div style={{ width:14, height:14, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:ok?'var(--success)':'var(--surface)', border:`1.5px solid ${ok?'var(--success)':'var(--border)'}` }}>
                      {ok && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <span style={{ color:ok?'var(--slate)':'var(--slate-light)' }}>{a.lbl}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop:12, background:'var(--surface)', borderRadius:6, overflow:'hidden', height:6 }}>
              <div style={{ height:'100%', width:`${pct}%`, background:barRenk, borderRadius:6, transition:'width 0.3s' }}/>
            </div>
            <div style={{ fontSize:11, fontWeight:600, color:barRenk, marginTop:6, textAlign:'right' }}>{pct}% Tamamlandı</div>
          </div>
        </div>
      </div>
    </div>
  );
}
