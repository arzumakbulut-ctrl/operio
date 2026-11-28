import { useState, useEffect } from 'react';
import { useAuthStore, useUIStore, useDataStore } from '../store';

export default function Raporlar() {
  const { curRole } = useAuthStore();
  const { showToast } = useUIStore();
  const { surgeries, hastalar, personel } = useDataStore();

  function exportAmeliyatCSV() {
    const headers = ['Ameliyat Tipi','Hasta','Doktor','Salon','Saat','Bitis','Durum'];
    const rows = surgeries.map(s => [
      s.op||'', s.hasta||'', s.dr||'', s.salon||'', s.saat||'', s.bitis||'', s.durum||''
    ]);
    const csv = [headers, ...rows].map(r => r.map(x => '"'+String(x||'').replace(/"/g,'""')+'"').join(',')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM+csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='ameliyatlar_'+new Date().toISOString().split('T')[0]+'.csv'; a.click();
    URL.revokeObjectURL(url);
    showToast('Ameliyat listesi indirildi');
  }

  function exportPersonelCSV() {
    const headers = ['Ad Soyad','Gorev','Telefon','Email','Durum'];
    const rows = personel.map(p => [p.ad||p.name||'', p.rol||p.specialty||'', p.tel||p.phone||'', p.email||'', p.durum||p.status||'']);
    const csv = [headers, ...rows].map(r => r.map(x => '"'+String(x||'').replace(/"/g,'""')+'"').join(',')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM+csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='personel_'+new Date().toISOString().split('T')[0]+'.csv'; a.click();
    URL.revokeObjectURL(url);
    showToast('Personel listesi indirildi');
  }

  function exportHastalarCSV() {
    const headers = ['Ad','Soyad','TC','Telefon','Kan Grubu','Cinsiyet','Alerjiler'];
    const rows = hastalar.map(h => [h.ad||'', h.soyad||'', h.tc||'', h.tel||h.phone||'', h.kan||h.bloodType||'', h.cinsiyet||h.gender||'', h.alerjiler||h.allergies||'']);
    const csv = [headers, ...rows].map(r => r.map(x => '"'+String(x||'').replace(/"/g,'""')+'"').join(',')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM+csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='hastalar_'+new Date().toISOString().split('T')[0]+'.csv'; a.click();
    URL.revokeObjectURL(url);
    showToast('Hasta listesi indirildi');
  }

  const [loglar, setLoglar] = useState([]);
  useEffect(() => {
    const tok = () => localStorage.getItem('operio_access');
    // Gerçek backend #1 uç noktası: GET /api/audit — {success,data:[],meta} zarfı,
    // satırlar düz (nested .user yok) snake_case DB kolonları: action, resource,
    // resource_id, created_at, full_name (LEFT JOIN users).
    fetch('http://localhost:4000/api/audit?limit=5', { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.json().catch(() => null).then(json => ({ status: r.status, json })))
      .then(({ status, json }) => {
        if (!json?.success) {
          // Final review Finding 5: GET /api/audit sadece Üst Yönetici'ye
          // açık — diğer roller için backend 403/FORBIDDEN döner. Bu gerçek
          // bir hata değil, rol bazlı görünürlük kısıtı; sessizce boş liste
          // göster, toast GÖSTERME (diğer tüm hata türlerinde toast
          // göstermeye devam et).
          if (status === 403 || json?.error?.code === 'FORBIDDEN') { setLoglar([]); return; }
          showToast(json?.error?.message || 'Aktivite günlüğü yüklenemedi');
          return;
        }
        setLoglar(Array.isArray(json.data) ? json.data : []);
      })
      .catch(() => showToast('Aktivite günlüğü yüklenemedi'));
  }, []);

  const now = new Date();
  const oncekiAy = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const fmtTarih = d => d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  const ayBas = fmtTarih(oncekiAy);
  const ayBit = fmtTarih(new Date(now.getFullYear(), now.getMonth(), 0));

  const [ozet, setOzet] = useState({ toplamAmeliyat:0, toplamHasta:0, toplamPersonel:0, aktifSalon:0 });

  useEffect(() => {
    setOzet({
      toplamAmeliyat: surgeries.length,
      toplamHasta: hastalar.length,
      toplamPersonel: personel.length,
      aktifSalon: surgeries.filter(s=>s.st==='dot-active').length,
    });
  }, [surgeries.length, hastalar.length, personel.length]);
  const isAne = curRole === 2;
  const [otomasyonlar, setOtomasyonlar] = useState([true,true,true,false,false]);

  const raporlar = [
    { bg:'si-teal',   rc:'rc-teal',   icon:'ane',   name:'Aylık Ameliyat Özeti', onExport: exportAmeliyatCSV,          desc:isAne?'Anestezi vakaları, tipler ve süreler':'Ameliyat listesi, personel ve salon bazında aylık özet', tarih:ayBas, fmt:'PDF', size:'—' },
    { bg:'si-blue',   rc:'rc-blue',   icon:'users',  name:isAne?'Teknisyen Performans Raporu':'Personel Mesai Raporu', onExport: exportPersonelCSV, desc:isAne?'Teknisyen başına vaka sayısı, ortalama süre':'Hemşire ve yardımcı personel mesai ve nöbet özeti', tarih:ayBit, fmt:'XLSX', size:'—' },
    { bg:'si-purple', rc:'rc-purple', icon:'chart',  name:'Branş & Vaka İstatistikleri',   desc:'Ameliyat türlerine göre sıklık, süre ortalaması ve dağılım analizi', tarih:ayBit, fmt:'PDF', size:'—' },
    { bg:'si-orange', rc:'rc-orange', icon:'dev',    name:isAne?'Anestezi İlaç Tüketimi':'Cihaz Kullanım Raporu', desc:isAne?'Ajan kullanımı ve ilaç tüketimi':'Cihaz kullanım süreleri ve bakım geçmişi', tarih:ayBit, fmt:'PDF', size:'—' },
    { bg:'si-teal',   rc:'rc-green',  icon:'cal',    name:'Nöbet & Çalışma Listesi',       desc:'Aylık nöbet dağılımı, vardiya dengeleri ve tatil hesaplamaları', tarih:ayBas, fmt:'PDF', size:'—' },
    { bg:'si-blue',   rc:'rc-blue',   icon:'doc',    name:'Olay & Komplikasyon Raporu',    desc:'Ameliyathane olay bildirimleri, komplikasyon analizi ve kalite metrikleri', tarih:ayBit, fmt:'PDF', size:'—' },
  ];

  const otomasyonAdi = ['Haftalık Ameliyat Özeti','Aylık Personel Mesaisi','Cihaz Bakım Hatırlatıcı','Branş Performans Raporu','Komplikasyon Özeti'];
  const otomasyonFreq = ["Her Pazartesi 08:00","Ayın 1'i 07:00","Bakım tarihinden 3 gün önce","Her Cuma 17:00","Aylık, ayın 28'i"];

  const RaporIkon = ({ icon }) => {
    const paths = {
      ane:   <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>,
      users: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></>,
      chart: <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
      dev:   <><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>,
      cal:   <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
      doc:   <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
    };
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{paths[icon]||paths.doc}</svg>;
  };

  return (
    <div>
      <div className="stat-row" style={{marginBottom:16}}>
        <div className="stat-card stat-card-1">
          <div className="stat-card-glow"/><div className="stat-card-glow2"/>
          <div className="stat-icon si-teal"><svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>
          <div className="stat-val">{ozet.toplamAmeliyat}</div>
          <div className="stat-lbl">Toplam Ameliyat</div>
          <div className="stat-trend">DB kayitli</div>
        </div>
        <div className="stat-card stat-card-2">
          <div className="stat-card-glow"/><div className="stat-card-glow2"/>
          <div className="stat-icon si-blue"><svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
          <div className="stat-val">{ozet.toplamHasta}</div>
          <div className="stat-lbl">Kayitli Hasta</div>
          <div className="stat-trend">DB kayitli</div>
        </div>
        <div className="stat-card stat-card-3">
          <div className="stat-card-glow"/><div className="stat-card-glow2"/>
          <div className="stat-icon si-purple"><svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
          <div className="stat-val">{ozet.toplamPersonel}</div>
          <div className="stat-lbl">Personel</div>
          <div className="stat-trend">DB kayitli</div>
        </div>
        <div className="stat-card stat-card-4">
          <div className="stat-card-glow"/><div className="stat-card-glow2"/>
          <div className="stat-icon si-orange"><svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/></svg></div>
          <div className="stat-val">{ozet.aktifSalon}</div>
          <div className="stat-lbl">Aktif Ameliyat</div>
          <div className="stat-trend">Su an devam eden</div>
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
        <div>
          <div className="page-hd-title">Raporlar</div>
          <div className="page-hd-sub">{isAne?'Anestezi operasyon raporları':'Ameliyathane operasyon raporları'} — indirme ve önizleme</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <div className="period-sel">
            {['Haftalık','Aylık','Yıllık'].map(p => (
              <div key={p} className={`period-opt${p==='Aylık'?' active':''}`} onClick={() => showToast(`${p} filtre uygulandı`)}>{p}</div>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => showToast('Özel rapor oluşturma açılıyor…')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width:13, height:13 }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Özel Rapor Oluştur
          </button>
        </div>
      </div>

      {/* Rapor Kartları */}
      <div className="rapor-grid">
        {raporlar.map((r,i) => (
          <div key={i} className={`rapor-card ${r.rc}`}>
            <div className={`rapor-icon ${r.bg}`}><RaporIkon icon={r.icon}/></div>
            <div className="rapor-name">{r.name}</div>
            <div className="rapor-desc">{r.desc}</div>
            <div className="rapor-meta">
              <div className="rapor-date">{r.tarih} · {r.fmt} · {r.size}</div>
              <div style={{ display:'flex', gap:8 }}>
                <div className="rapor-dl" onClick={() => showToast(`${r.name} önizleniyor…`)} title="Önizle">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </div>
                <div className="rapor-dl" onClick={() => showToast(`${r.name} indiriliyor…`)} title="İndir">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  İndir
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Alt grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:16, marginTop:16 }}>
        <div className="istat-block">
          <div className="istat-block-title">Son Rapor Aktiviteleri</div>
          {loglar.length === 0 && <div style={{ fontSize:12, color:'var(--slate-light)', padding:'8px 0' }}>Henüz aktivite kaydı yok.</div>}
          {loglar.map((l,i) => {
            const ad = l.full_name || 'Sistem';
            const av = ad.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
            const BGLIST = ['#14B8A6','#0284C7','#7C3AED','#EA580C','#059669','#DC2626'];
            const bg = BGLIST[ad.charCodeAt(0) % BGLIST.length];
            const t = new Date(l.created_at).toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
            return (
              <div key={l.id || i} className="nitem" style={{ padding:'9px 8px' }}>
                <div className="avatar" style={{ background:bg, color:'white', width:30, height:30, fontSize:10, flexShrink:0 }}>{av}</div>
                <div className="nc">
                  <div className="nt"><strong>{ad}</strong> — {l.action}</div>
                  <div className="ntm">{t}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="istat-block">
          <div className="istat-block-title">Otomatik Raporlar</div>
          {otomasyonAdi.map((ad,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid var(--border)' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'11.5px', fontWeight:600, color:'var(--slate)' }}>{ad}</div>
                <div style={{ fontSize:10, color:'var(--slate-light)', marginTop:1 }}>{otomasyonFreq[i]}</div>
              </div>
              <button
                className={`tog${otomasyonlar[i]?' on':''}`}
                onClick={() => { setOtomasyonlar(prev => prev.map((v,j) => j===i?!v:v)); showToast(otomasyonlar[i]?'Otomatik rapor devre dışı':'Otomatik rapor aktif'); }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
