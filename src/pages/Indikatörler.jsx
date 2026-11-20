import { useState, useEffect, useMemo } from 'react';
import { useAuthStore, useUIStore, useDataStore } from '../store';

const AV_RENKLER = ['#14B8A6','#0284C7','#7C3AED','#EA580C','#059669','#DC2626','#D97706'];
function avRenk(ad) { let h=0; for(let c of (ad||'')) h=(h*31+c.charCodeAt(0))&0xffff; return AV_RENKLER[h%AV_RENKLER.length]; }
function sureDk(saat, bitis) {
  if (!saat || !bitis) return 0;
  const [sh,sm]=(saat||'').split(':').map(Number);
  const [bh,bm]=(bitis||'').split(':').map(Number);
  return Math.max(0,(bh*60+bm)-(sh*60+sm));
}

// ── SVG Grafik Bileşenleri ────────────────────────────────────

function BarChart({ data, color = '#14B8A6', height = 100, labels }) {
  const max = Math.max(...data.filter(Boolean), 1);
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:4, height, width:'100%' }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
          <div style={{ width:'100%', background:`${color}20`, borderRadius:'4px 4px 0 0', height:height-18, display:'flex', alignItems:'flex-end' }}>
            <div style={{ width:'100%', background: v ? color : 'transparent', borderRadius:'4px 4px 0 0', height:`${(v/max)*100}%`, transition:'height 0.5s ease', minHeight: v ? 3 : 0 }}/>
          </div>
          {labels && <div style={{ fontSize:9, color:'var(--slate-light)', whiteSpace:'nowrap' }}>{labels[i]}</div>}
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data, size = 100 }) {
  let cum = 0;
  const parts = data.map(d => {
    const deg = d.pct * 3.6;
    const part = `${d.color} ${cum}deg ${cum + deg}deg`;
    cum += deg;
    return part;
  });
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:`conic-gradient(${parts.join(',')})` }}/>
      <div style={{ position:'absolute', inset:'22%', borderRadius:'50%', background:'var(--card-bg)' }}/>
    </div>
  );
}

function SparkLine({ data, color = '#14B8A6', height = 40 }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 120, h = height;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow:'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={pts.split(' ').pop().split(',')[0]} cy={pts.split(' ').pop().split(',')[1]} r="3" fill={color}/>
    </svg>
  );
}

function KpiKart({ icon, val, lbl, trend, trendUp, sub, color = '#14B8A6', spark }) {
  return (
    <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:14, padding:'16px 18px', display:'flex', flexDirection:'column', gap:6 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ width:36, height:36, borderRadius:10, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>{icon}</div>
        {spark && <SparkLine data={spark} color={color}/>}
      </div>
      <div style={{ fontSize:28, fontWeight:900, color:'var(--slate)', fontFamily:"'Outfit',sans-serif", letterSpacing:'-1px', lineHeight:1 }}>{val}</div>
      <div style={{ fontSize:12, fontWeight:600, color:'var(--slate-mid)' }}>{lbl}</div>
      {trend && (
        <div style={{ fontSize:11, fontWeight:600, color: trendUp === true ? '#059669' : trendUp === false ? '#DC2626' : '#D97706', display:'flex', alignItems:'center', gap:4 }}>
          {trendUp === true ? '▲' : trendUp === false ? '▼' : '→'} {trend}
        </div>
      )}
      {sub && <div style={{ fontSize:10, color:'var(--slate-light)' }}>{sub}</div>}
    </div>
  );
}

function Bolum({ title, children }) {
  return (
    <div style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', marginBottom:14 }}>
      <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--border)', fontSize:'10.5px', fontWeight:700, color:'var(--slate-light)', textTransform:'uppercase', letterSpacing:'0.5px' }}>{title}</div>
      <div style={{ padding:'16px 18px' }}>{children}</div>
    </div>
  );
}

const AYLAR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

// ── ÜST YÖNETİCİ (0) ─────────────────────────────────────────
function IndUstYonetici({ period, stats, rooms, surgeries }) {
  const ameliyatAy  = [92,108,124,119,148,161,0,0,0,0,0,0];
  const gelirAy     = [1820,2140,2480,2310,2960,3210,0,0,0,0,0,0];
  const personelPct = [91,88,93,90,95,97,0,0,0,0,0,0];

  const bransDist = [
    { lbl:'Genel Cerrahi', pct:34, color:'#14B8A6' },
    { lbl:'Ortopedi',      pct:22, color:'#0284C7' },
    { lbl:'Göz / KBB',    pct:14, color:'#7C3AED' },
    { lbl:'Endokrin',      pct:12, color:'#EA580C' },
    { lbl:'Nöro',          pct:9,  color:'#DC2626' },
    { lbl:'Diğer',         pct:9,  color:'#94A3B8' },
  ];

  const performans = [
    { lbl:'Ameliyathane Kullanım Oranı', val:'%73',  hedef:'%80', pct:73, color:'#14B8A6' },
    { lbl:'Ortalama Ameliyat Süresi',    val:'3.4s', hedef:'3.0s',pct:72, color:'#0284C7' },
    { lbl:'İptal / Erteleme Oranı',      val:'%4.2', hedef:'<%3', pct:42, color:'#DC2626' },
    { lbl:'Hasta Memnuniyeti',           val:'4.6/5',hedef:'4.5/5',pct:92,color:'#059669' },
    { lbl:'Ekip Doluluk Oranı',          val:'%95',  hedef:'%90', pct:95, color:'#7C3AED' },
    { lbl:'Sterilizasyon Başarısı',      val:'%99.2',hedef:'%99', pct:99, color:'#D97706' },
  ];

  const salonlar = useMemo(() => {
    const liste = (rooms || []);
    const maxAmel = Math.max(1, ...liste.map(r => (surgeries || []).filter(s => s.salon === r.ad).length));
    return liste.map(r => {
      const rSurg = (surgeries || []).filter(s => s.salon === r.ad);
      const amel = rSurg.length;
      const kullanum = Math.round((amel / maxAmel) * 100);
      const bransSay = {};
      rSurg.forEach(s => { const k = s.brans || s.op; if (k) bransSay[k] = (bransSay[k] || 0) + 1; });
      const brans = Object.keys(bransSay).sort((a, b) => bransSay[b] - bransSay[a])[0] || r.alan || '—';
      return { ad: r.ad, kullanum, amel, brans, trend: '—', up: null };
    });
  }, [rooms, surgeries]);

  return (
    <div>
      {/* KPI Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:14 }}>
        <KpiKart icon="🏥" val={stats?.buAyAmeliyat ?? 161}   lbl="Bu Ay Ameliyat"       trend={stats ? `%${stats.ameliyatArtis >= 0 ? '+' : ''}${stats.ameliyatArtis} geçen aya göre` : '%9 geçen aya göre'}     trendUp={true}  color="#14B8A6" spark={ameliyatAy.filter(Boolean)}/>
        <KpiKart icon="💰" val="3.2M₺" lbl="Aylık Gelir"          trend="%8 artış"              trendUp={true}  color="#0284C7" spark={gelirAy.filter(Boolean).map(v=>v/1000)}/>
        <KpiKart icon="👥" val={stats?.aktifPersonel ?? 97}    lbl="Aktif Personel"        trend="%95 doluluk oranı"     trendUp={true}  color="#7C3AED" spark={personelPct.filter(Boolean)}/>
        <KpiKart icon="⭐" val="4.6"   lbl="Hasta Memnuniyeti"    trend="5 üzerinden"           trendUp={true}  color="#D97706"/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:14 }}>
        <KpiKart icon="⚠" val={stats ? `%${stats.iptalOrani}` : '4.2%'} lbl="İptal / Erteleme Oranı" trend="Hedef: <%3 — iyileştirme gerekli" trendUp={false} color="#DC2626"/>
        <KpiKart icon="🏛" val="%73" lbl="Salon Kullanım Oranı"    trend="Hedef %80 — 7 puan açık"         trendUp={null}  color="#EA580C"/>
        <KpiKart icon="🛡" val="%99.2" lbl="Sterilizasyon Başarı" trend="Hedef karşılandı ✓"               trendUp={true}  color="#059669"/>
      </div>

      <div className="cg">
        <div>
          {/* Aylık Ameliyat Trendi */}
          <Bolum title="📊 Aylık Ameliyat Trendi">
            <BarChart data={ameliyatAy} color="#14B8A6" height={110} labels={AYLAR}/>
            <div style={{ display:'flex', gap:16, marginTop:12 }}>
              {[['Oca–May Toplam','591','var(--slate)'],['Aylık Ortalama','118.2','var(--teal)'],['En Yüksek','161 (Haz)','#059669'],['Büyüme','▲ %19','#059669']].map(([l,v,c])=>(
                <div key={l} style={{ flex:1, textAlign:'center', padding:'8px 0', borderRight:'1px solid var(--border)' }}>
                  <div style={{ fontSize:15, fontWeight:800, color:c, fontFamily:"'Outfit',sans-serif" }}>{v}</div>
                  <div style={{ fontSize:10, color:'var(--slate-light)', marginTop:2 }}>{l}</div>
                </div>
              ))}
            </div>
          </Bolum>

          {/* Salon Performansı */}
          <Bolum title="🏛 Salon Kullanım Oranları">
            {salonlar.map(s => (
              <div key={s.ad} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                <div style={{ width:56, fontSize:11, fontWeight:700, color:'var(--slate)', flexShrink:0 }}>{s.ad}</div>
                <div style={{ flex:1, height:8, background:'var(--border)', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${s.kullanum}%`, background: s.kullanum>70?'#059669':s.kullanum>40?'#D97706':'#DC2626', borderRadius:4, transition:'width 0.4s' }}/>
                </div>
                <div style={{ width:32, textAlign:'right', fontSize:12, fontWeight:700, color:'var(--slate-mid)' }}>{s.kullanum ? `%${s.kullanum}` : '—'}</div>
                <div style={{ width:60, fontSize:11, color:'var(--slate-light)' }}>{s.amel ? `${s.amel} amel.` : s.brans}</div>
                <div style={{ width:40, fontSize:11, fontWeight:700, color: s.up===true?'#059669':s.up===false?'#DC2626':'var(--slate-light)' }}>{s.trend}</div>
              </div>
            ))}
          </Bolum>
        </div>

        <div>
          {/* Branş Dağılımı */}
          <Bolum title="🔬 Branş Dağılımı">
            <div style={{ display:'flex', gap:16, alignItems:'center' }}>
              <DonutChart data={bransDist} size={110}/>
              <div style={{ flex:1 }}>
                {bransDist.map(d => (
                  <div key={d.lbl} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:d.color, flexShrink:0 }}/>
                    <span style={{ fontSize:12, color:'var(--slate-mid)', flex:1 }}>{d.lbl}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--slate)' }}>%{d.pct}</span>
                  </div>
                ))}
              </div>
            </div>
          </Bolum>

          {/* Performans Göstergeleri */}
          <Bolum title="🎯 Hedef / Gerçekleşen">
            {performans.map(p => (
              <div key={p.lbl} style={{ marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:11.5, color:'var(--slate-mid)' }}>{p.lbl}</span>
                  <div style={{ display:'flex', gap:8 }}>
                    <span style={{ fontSize:12, fontWeight:800, color:p.color }}>{p.val}</span>
                    <span style={{ fontSize:10, color:'var(--slate-light)', alignSelf:'center' }}>/ {p.hedef}</span>
                  </div>
                </div>
                <div style={{ height:5, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${p.pct}%`, background:p.color, borderRadius:3 }}/>
                </div>
              </div>
            ))}
          </Bolum>
        </div>
      </div>
    </div>
  );
}

// ── AMELİYATHANE SORUMLU HEMŞİRESİ (1) ──────────────────────
function IndAmeliyathaneSorumlu({ period, stats, rooms, surgeries, personel }) {
  const opAy    = [88,102,118,110,141,152,0,0,0,0,0,0];
  const iptalAy = [4,5,3,6,4,3,0,0,0,0,0,0];
  const sureAy  = [3.2,3.4,3.1,3.5,3.3,3.2,0,0,0,0,0,0];

  const ekip = (personel || []).filter(p => p.aktif !== false).slice(0, 6).map(p => ({
    ad: p.ad, rol: p.uzmanlik || p.gorev || '—',
    vaka: (surgeries || []).filter(s => s.ekip?.scrub === p.ad || s.ekip?.sirkule === p.ad).length,
    durum: p.aktif === false ? 'İzinde' : 'Aktif',
  }));

  const salonColors = ['#059669','#14B8A6','#D97706','#DC2626','#94A3B8','#0284C7','#7C3AED'];
  const salonKull = (rooms || []).map((r, i) => {
    const rSurgeries = (surgeries || []).filter(s => s.salon === r.ad);
    const done = rSurgeries.filter(s => s.st === 'dot-done').length;
    const pct = rSurgeries.length > 0 ? Math.round((done / rSurgeries.length) * 100) : (r.aktif ? 55 : 0);
    return { ad: r.ad, pct, color: salonColors[i % salonColors.length] };
  });

  const stDurum = s => s.st === 'dot-done' ? 'Tamamlandı' : s.st === 'dot-active' ? 'Devam Ediyor' : 'Bekliyor';
  const gunluk = (surgeries || [])
    .filter(s => s.tarih === new Date().toLocaleDateString('tr-TR'))
    .slice(0, 6)
    .map(s => ({
      saat: s.saat || '—', op: s.op || '—',
      ekip: s.ekip?.scrub || s.dr || '—',
      salon: s.salon || '—',
      sure: sureDk(s.saat, s.bitis) ? sureDk(s.saat, s.bitis) + ' dk' : '—',
      durum: stDurum(s),
    }));

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:14 }}>
        <KpiKart icon="🏥" val={stats?.buAyAmeliyat ?? 152}  lbl="Bu Ay Ameliyat"       trend="%8 artış"            trendUp={true}  color="#14B8A6" spark={opAy.filter(Boolean)}/>
        <KpiKart icon="⏱" val="3.2s" lbl="Ort. Ameliyat Süresi" trend="Hedef karşılandı ✓" trendUp={true}  color="#0284C7" spark={sureAy.filter(Boolean)}/>
        <KpiKart icon="❌" val="%2.6" lbl="İptal / Erteleme"     trend="Hedef: <%3 ✓"       trendUp={true}  color="#059669" spark={iptalAy.filter(Boolean)}/>
        <KpiKart icon="👥" val={stats?.aktifPersonel ?? 5}    lbl="Aktif Personel"        trend="1 izinde"            trendUp={null}  color="#7C3AED"/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, marginBottom:14 }}>
        <KpiKart icon="🔄" val="%18"  lbl="Turnover Süresi"      trend="Ort. 18 dk — hedef 15 dk" trendUp={false} color="#D97706" sub="Ameliyat arası hazırlık"/>
        <KpiKart icon="⏰" val="%4.1" lbl="Geç Başlama Oranı"    trend="Hedef: <%5 ✓"            trendUp={true}  color="#059669" sub="Zamanında başlama"/>
      </div>

      <div className="cg">
        <div>
          {/* Aylık Trend */}
          <Bolum title="📊 Aylık Ameliyat Trendi">
            <BarChart data={opAy} color="#14B8A6" height={100} labels={AYLAR}/>
            <div style={{ display:'flex', gap:12, marginTop:12 }}>
              {[['Toplam','593'],['Ort./Ay','118.6'],['İptal Oranı','%3.5'],['Geç Başlama','%5.2']].map(([l,v])=>(
                <div key={l} style={{ flex:1, textAlign:'center', padding:'8px 0', borderRight:'1px solid var(--border)' }}>
                  <div style={{ fontSize:15, fontWeight:800, color:'var(--teal)', fontFamily:"'Outfit',sans-serif" }}>{v}</div>
                  <div style={{ fontSize:10, color:'var(--slate-light)', marginTop:2 }}>{l}</div>
                </div>
              ))}
            </div>
          </Bolum>

          {/* Günlük Program */}
          <Bolum title="📅 Bugünün Programı">
            {gunluk.map((g,i) => {
              const dc = g.durum==='Tamamlandı'?'#059669':g.durum==='Devam Ediyor'?'#0284C7':'#D97706';
              return (
                <div key={i} style={{ display:'flex', gap:12, padding:'10px 0', borderBottom:'1px solid var(--border)', alignItems:'center' }}>
                  <div style={{ width:44, fontSize:13, fontWeight:800, color:'var(--slate)', fontFamily:"'Outfit',sans-serif", flexShrink:0 }}>{g.saat}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12.5, fontWeight:700, color:'var(--slate)' }}>{g.op}</div>
                    <div style={{ fontSize:11, color:'var(--slate-light)', marginTop:1 }}>{g.ekip} · {g.salon} · {g.sure}</div>
                  </div>
                  <span className={`tag ${g.durum==='Tamamlandı'?'t-green':g.durum==='Devam Ediyor'?'t-blue':'t-orange'}`} style={{fontSize:9}}>{g.durum}</span>
                </div>
              );
            })}
          </Bolum>
        </div>

        <div>
          {/* Salon Kullanım */}
          <Bolum title="🏛 Salon Kullanım Oranları">
            {salonKull.map(s => (
              <div key={s.ad} style={{ marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:12, fontWeight:600, color:'var(--slate)' }}>{s.ad}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:s.color }}>{s.pct ? `%${s.pct}` : 'Kapalı'}</span>
                </div>
                <div style={{ height:7, background:'var(--border)', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${s.pct}%`, background:s.color, borderRadius:4, transition:'width 0.4s' }}/>
                </div>
              </div>
            ))}
          </Bolum>

          {/* Ekip Performansı */}
          <Bolum title="👥 Ekip Performansı — Bu Ay">
            {ekip.map((p,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid var(--border)' }}>
                <div style={{ width:30, height:30, borderRadius:'50%', background:'var(--teal)', color:'white', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {p.ad.split(' ').map(w=>w[0]).join('').substring(0,2)}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--slate)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.ad}</div>
                  <div style={{ fontSize:10, color:'var(--slate-light)', marginTop:1 }}>{p.rol}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--slate)' }}>{p.vaka} vaka</div>
                  <div style={{ fontSize:10, color:'var(--slate-light)' }}>{p.durum}</div>
                </div>
                {p.durum !== 'Aktif' && <span className="tag t-orange" style={{fontSize:8}}>{p.durum}</span>}
              </div>
            ))}
          </Bolum>
        </div>
      </div>
    </div>
  );
}

// ── ANESTEZİ SORUMLUSU (2) ───────────────────────────────────
function IndAnestezi({ period, stats, personel, surgeries }) {
  const vaka = [88,102,118,110,141,0,0,0,0,0,0,0];
  const komplikasyon = [1.2,0.9,1.1,0.8,0.7,0,0,0,0,0,0,0];
  const sure = [3.1,3.4,3.2,3.6,3.3,0,0,0,0,0,0,0];

  const aneTipleri = [
    { lbl:'Genel Anestezi', pct:62, color:'#14B8A6', val:88  },
    { lbl:'Spinal',          pct:18, color:'#0284C7', val:26  },
    { lbl:'Epidural',        pct:11, color:'#7C3AED', val:16  },
    { lbl:'Lokal/Sedasyon', pct:9,  color:'#EA580C', val:11  },
  ];

  const teknisyenler = (personel || []).filter(p => p.aktif !== false).slice(0, 6).map(p => ({
    ad: p.ad,
    vaka: (surgeries || []).filter(s => s.ekip?.anestezi === p.ad || s.ekip?.cerrah === p.ad).length,
    sure: '—', komplik: '—', nöbet: '—', puan: '—',
  }));

  const komplikasyonlar = [
    { tip:'Zor Entübasyon',    sayi:3, oran:'%0.2', siddet:'Orta'   },
    { tip:'İlaç Reaksiyonu',   sayi:1, oran:'%0.07',siddet:'Hafif'  },
    { tip:'Kan Basıncı Krizi', sayi:5, oran:'%0.35',siddet:'Hafif'  },
    { tip:'Postop Bulantı',    sayi:18,oran:'%1.27',siddet:'Minör'  },
  ];

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:14 }}>
        <KpiKart icon="💉" val={stats?.buAyAmeliyat ?? 141}  lbl="Bu Ay Anestezi"        trend="%11 artış"                      trendUp={true}  color="#14B8A6" spark={vaka.filter(Boolean)}/>
        <KpiKart icon="⏱" val="3.3s" lbl="Ort. Anestezi Süresi"  trend="Hedefin içinde"                 trendUp={true}  color="#0284C7" spark={sure.filter(Boolean)}/>
        <KpiKart icon="⚠" val="%0.7" lbl="Komplikasyon Oranı"    trend="En düşük son 6 ayda ✓"         trendUp={true}  color="#059669" spark={komplikasyon.filter(Boolean)}/>
        <KpiKart icon="👨‍⚕️" val={stats?.aktifPersonel ?? 4} lbl="Aktif Teknisyen"      trend="Tam kadro"                      trendUp={true}  color="#7C3AED"/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:14 }}>
        <KpiKart icon="🩺" val="%98.6" lbl="Başarılı İndüksiyon" trend="Standart üzeri"  trendUp={true}  color="#059669"/>
        <KpiKart icon="⏰" val="12 dk" lbl="Ort. Derlenme Süresi" trend="Hedef: <15 dk ✓" trendUp={true} color="#D97706"/>
        <KpiKart icon="📋" val="%99.1" lbl="Belgeleme Tamamlama" trend="Eksik kayıt: 1"   trendUp={true}  color="#0284C7"/>
      </div>

      <div className="cg">
        <div>
          {/* Aylık Trend */}
          <Bolum title="📊 Aylık Anestezi Vakası Trendi">
            <BarChart data={vaka} color="#14B8A6" height={100} labels={AYLAR}/>
          </Bolum>

          {/* Komplikasyonlar */}
          <Bolum title="⚠ Komplikasyon Kaydı — Bu Ay">
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['Komplikasyon Tipi','Sayı','Oran','Şiddet'].map(h => (
                    <th key={h} style={{ fontSize:'9.5px', fontWeight:700, color:'var(--slate-light)', textTransform:'uppercase', letterSpacing:'0.4px', padding:'0 0 8px', textAlign: h==='Sayı'||h==='Oran'?'center':'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {komplikasyonlar.map((k,i) => (
                  <tr key={i} style={{ borderTop:'1px solid var(--border)' }}>
                    <td style={{ fontSize:12.5, fontWeight:600, color:'var(--slate)', padding:'9px 0' }}>{k.tip}</td>
                    <td style={{ textAlign:'center', fontSize:13, fontWeight:800, color:'var(--slate)' }}>{k.sayi}</td>
                    <td style={{ textAlign:'center', fontSize:12, color:'var(--slate-mid)' }}>{k.oran}</td>
                    <td>
                      <span className={`tag ${k.siddet==='Minör'||k.siddet==='Hafif'?'t-orange':'t-red'}`} style={{fontSize:9}}>{k.siddet}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Bolum>
        </div>

        <div>
          {/* Anestezi Tip Dağılımı */}
          <Bolum title="💊 Anestezi Tipi Dağılımı">
            <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:14 }}>
              <DonutChart data={aneTipleri} size={110}/>
              <div style={{ flex:1 }}>
                {aneTipleri.map(d => (
                  <div key={d.lbl} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:d.color, flexShrink:0 }}/>
                    <span style={{ fontSize:12, color:'var(--slate-mid)', flex:1 }}>{d.lbl}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--slate)' }}>{d.val} vaka</span>
                  </div>
                ))}
              </div>
            </div>
          </Bolum>

          {/* Teknisyen Performansı */}
          <Bolum title="👨‍⚕️ Teknisyen Performansı">
            {teknisyenler.map((t,i) => (
              <div key={i} style={{ padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <div style={{ fontSize:12.5, fontWeight:700, color:'var(--slate)' }}>{t.ad}</div>
                  <span style={{ fontSize:11, fontWeight:600, color:'var(--teal)' }}>{t.vaka} vaka</span>
                </div>
                <div style={{ display:'flex', gap:12, fontSize:10.5, color:'var(--slate-light)' }}>
                  <span>Toplam ameliyat katılımı</span>
                </div>
              </div>
            ))}
          </Bolum>
        </div>
      </div>
    </div>
  );
}

// ── STERİLİZASYON SORUMLUSU (8) ──────────────────────────────
function IndSterilizasyon({ period, stats }) {
  const sterilAy   = [310,342,389,367,421,0,0,0,0,0,0,0];
  const basariAy   = [99.1,99.4,99.2,99.6,99.2,0,0,0,0,0,0,0];
  const sure       = [42,45,41,44,43,0,0,0,0,0,0,0];

  const setDurum = [
    { lbl:'Steril & Hazır', val:28, pct:70, color:'#059669' },
    { lbl:'Kullanımda',     val:6,  pct:15, color:'#0284C7' },
    { lbl:'Sterilizasyonda',val:4,  pct:10, color:'#D97706' },
    { lbl:'Bakım/Arıza',   val:2,  pct:5,  color:'#DC2626' },
  ];

  const personel = [
    { ad:'Srl. Meral Doğan',  rol:'Sterilizasyon Sorumlusu',  islem:124, hata:0, sure:'43 dk', puan:'5.0', durum:'Aktif' },
    { ad:'Srl. Kerim Çelik',  rol:'Sterilizasyon Teknisyeni', islem:108, hata:1, sure:'45 dk', puan:'4.8', durum:'Aktif' },
    { ad:'Srl. Leyla Arslan', rol:'Sterilizasyon Teknisyeni', islem:97,  hata:0, sure:'41 dk', puan:'4.9', durum:'Aktif' },
    { ad:'Srl. Serkan Yıldız',rol:'Sterilizasyon Teknisyeni', islem:92,  hata:2, sure:'47 dk', puan:'4.5', durum:'İzinde'},
  ];

  const otoklav = [
    { ad:'Otoklav 1 (134°C)', doluluk:82, islem:186, hata:0, son:'08:45', durum:'Aktif'   },
    { ad:'Otoklav 2 (134°C)', doluluk:65, islem:142, hata:1, son:'09:12', durum:'Aktif'   },
    { ad:'Yıkama Makinesi 1', doluluk:45, islem:98,  hata:0, son:'07:30', durum:'Aktif'   },
    { ad:'Yıkama Makinesi 2', doluluk:0,  islem:0,   hata:0, son:'—',    durum:'Bakımda' },
  ];

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:14 }}>
        <KpiKart icon="🛡" val="421"   lbl="Bu Ay İşlenen Set"     trend="%14 artış"        trendUp={true}  color="#14B8A6" spark={sterilAy.filter(Boolean)}/>
        <KpiKart icon="✅" val="%99.2" lbl="Sterilizasyon Başarısı" trend="Standart: >%99 ✓" trendUp={true}  color="#059669" spark={basariAy.filter(Boolean)}/>
        <KpiKart icon="⏱" val="43 dk" lbl="Ort. Döngü Süresi"     trend="Hedef: <45 dk ✓"  trendUp={true}  color="#0284C7" spark={sure.filter(Boolean)}/>
        <KpiKart icon="📦" val={stats?.aktifSterilSet ?? 40}    lbl="Toplam Aktif Set"       trend="2 adet bakımda"   trendUp={null}  color="#7C3AED"/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:14 }}>
        <KpiKart icon="⚠" val="3"    lbl="Açık Arıza"      trend="Önce Artroskopi Kamerası" trendUp={false} color="#DC2626"/>
        <KpiKart icon="📋" val="%100" lbl="Belgeleme Oranı" trend="Tüm setler kayıtlı ✓"    trendUp={true}  color="#059669"/>
        <KpiKart icon="🔄" val="4.8"  lbl="Ortalama Set Rotasyonu" trend="Set/gün ortalaması" trendUp={true} color="#D97706"/>
      </div>

      <div className="cg">
        <div>
          {/* Trend */}
          <Bolum title="📊 Aylık Set İşleme Trendi">
            <BarChart data={sterilAy} color="#14B8A6" height={100} labels={AYLAR}/>
            <div style={{ display:'flex', gap:12, marginTop:12 }}>
              {[['Toplam (6 ay)','1829'],['Aylık Ort.','376.5'],['Başarı Oranı','%99.3'],['Hata Sayısı','13']].map(([l,v])=>(
                <div key={l} style={{ flex:1, textAlign:'center', padding:'8px 0', borderRight:'1px solid var(--border)' }}>
                  <div style={{ fontSize:14, fontWeight:800, color:'var(--teal)', fontFamily:"'Outfit',sans-serif" }}>{v}</div>
                  <div style={{ fontSize:10, color:'var(--slate-light)', marginTop:2 }}>{l}</div>
                </div>
              ))}
            </div>
          </Bolum>

          {/* Otoklav Durumu */}
          <Bolum title="⚙ Otoklav & Cihaz Durumu">
            {otoklav.map((o,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background:o.durum==='Aktif'?'#059669':'#DC2626', boxShadow:o.durum==='Aktif'?'0 0 0 3px rgba(5,150,105,0.2)':'' }}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12.5, fontWeight:700, color:'var(--slate)' }}>{o.ad}</div>
                  <div style={{ fontSize:10.5, color:'var(--slate-light)', marginTop:1 }}>{o.islem} işlem · Son: {o.son}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  {o.doluluk > 0 ? (
                    <>
                      <div style={{ fontSize:12, fontWeight:700, color:'var(--teal)' }}>%{o.doluluk} doluluk</div>
                      {o.hata > 0 && <div style={{ fontSize:10, color:'#DC2626', marginTop:1 }}>⚠ {o.hata} hata</div>}
                    </>
                  ) : (
                    <span className="tag t-orange" style={{fontSize:9}}>Bakımda</span>
                  )}
                </div>
              </div>
            ))}
          </Bolum>
        </div>

        <div>
          {/* Set Durum Dağılımı */}
          <Bolum title="🛡 Set Durum Dağılımı">
            <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:16 }}>
              <DonutChart data={setDurum} size={110}/>
              <div style={{ flex:1 }}>
                {setDurum.map(d => (
                  <div key={d.lbl} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:d.color, flexShrink:0 }}/>
                    <span style={{ fontSize:12, color:'var(--slate-mid)', flex:1 }}>{d.lbl}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:d.color }}>{d.val} set</span>
                  </div>
                ))}
              </div>
            </div>
          </Bolum>

          {/* Personel */}
          <Bolum title="👥 Personel Performansı">
            {personel.map((p,i) => (
              <div key={i} style={{ padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <div style={{ fontSize:12.5, fontWeight:700, color:'var(--slate)' }}>{p.ad}</div>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <span style={{ fontSize:11, fontWeight:700, color:'var(--teal)' }}>{p.islem} işlem</span>
                    {p.durum !== 'Aktif' && <span className="tag t-orange" style={{fontSize:8}}>{p.durum}</span>}
                  </div>
                </div>
                <div style={{ display:'flex', gap:10, fontSize:10.5, color:'var(--slate-light)' }}>
                  <span>⏱ Ort: {p.sure}</span>
                  <span style={{ color:p.hata>0?'#D97706':'var(--slate-light)' }}>⚠ Hata: {p.hata}</span>
                  <span>⭐ {p.puan}</span>
                </div>
              </div>
            ))}
          </Bolum>
        </div>
      </div>
    </div>
  );
}

// ── ANA COMPONENT ─────────────────────────────────────────────
const ROL_CFG = {
  0: { title:'Kurumsal İndikatörler',             sub:'Yönetimsel performans göstergeleri ve operasyonel KPI\'lar',             renk:'#14B8A6' },
  1: { title:'Ameliyathane İndikatörleri',         sub:'Ameliyathane operasyonları ve ekip performans göstergeleri',             renk:'#0284C7' },
  2: { title:'Anestezi İndikatörleri',             sub:'Anestezi uygulamaları, komplikasyonlar ve kadro performansı',            renk:'#7C3AED' },
  8: { title:'Sterilizasyon İndikatörleri',        sub:'Set işleme, sterilizasyon başarısı ve cihaz durum göstergeleri',        renk:'#D97706' },
};

const PERIOD_LBLS = { hafta:'Bu Hafta', ay:'Bu Ay', yil:'Bu Yıl' };

export default function Indikatörler() {
  const { curRole } = useAuthStore();
  const { showToast } = useUIStore();
  const { rooms, surgeries, personel } = useDataStore();
  const [period, setPeriod] = useState('ay');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch('http://localhost:4000/api/istatistikler', {
      headers: { Authorization: `Bearer ${localStorage.getItem('operio_access')}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStats(data); })
      .catch(() => {});
  }, []);

  const cfg = ROL_CFG[curRole];

  // Erişim kontrolü
  if (!cfg) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:12, color:'var(--slate-light)' }}>
        <div style={{ fontSize:36 }}>🔒</div>
        <div style={{ fontSize:14, fontWeight:700, color:'var(--slate)' }}>Bu sayfa sorumlu pozisyonundaki kullanıcılara özel</div>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

      {/* Başlık */}
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', padding:'0 0 16px', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:900, color:'var(--slate)', letterSpacing:'-0.5px', fontFamily:"'Outfit',sans-serif" }}>{cfg.title}</div>
          <div style={{ fontSize:12, color:'var(--slate-light)', marginTop:3 }}>{cfg.sub} — {PERIOD_LBLS[period]}</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {/* Dönem seçici */}
          <div className="period-sel">
            {['hafta','ay','yil'].map(k => (
              <div key={k} className={`period-opt${period===k?' active':''}`} onClick={() => { setPeriod(k); showToast(`${PERIOD_LBLS[k]} verileri yüklendi`); }}>{PERIOD_LBLS[k]}</div>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => showToast('Rapor PDF olarak indiriliyor…')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:12,height:12}}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Rapor İndir
          </button>
        </div>
      </div>

      {/* İçerik */}
      <div style={{ flex:1, overflowY:'auto' }}>
        {curRole === 0 && <IndUstYonetici period={period} stats={stats} rooms={rooms} surgeries={surgeries} personel={personel}/>}
        {curRole === 1 && <IndAmeliyathaneSorumlu period={period} stats={stats} rooms={rooms} surgeries={surgeries} personel={personel}/>}
        {curRole === 2 && <IndAnestezi period={period} stats={stats} personel={personel} surgeries={surgeries}/>}
        {curRole === 8 && <IndSterilizasyon period={period} stats={stats}/>}
      </div>
    </div>
  );
}
