import { useDataStore, useUIStore } from '../store';
import { useNavigate } from 'react-router-dom';

const DUR_CFG = {
  aktif:      { tag:'t-green',  txt:'Aktif',       bar:'#059669', ic:'✅' },
  beklemede:  { tag:'t-orange', txt:'Beklemede',   bar:'#D97706', ic:'⏳' },
  reddedildi: { tag:'t-red',    txt:'Reddedildi',  bar:'#DC2626', ic:'❌' },
  tamamlandi: { tag:'t-gray',   txt:'Tamamlandı',  bar:'#94A3B8', ic:'🏁' },
};

function dbDurumToUi(d) {
  if (d === 'Onaylandi' || d === 'Devam Ediyor') return 'aktif';
  if (d === 'Tamamlandi') return 'tamamlandi';
  if (d === 'Reddedildi') return 'reddedildi';
  return 'beklemede';
}

function makeAdimlar(uiDurum, salon, saat) {
  const sl = salon || '—';
  const sa = saat  || '—';
  if (uiDurum === 'tamamlandi') return [
    { lbl:'Talep Oluşturuldu',   icon:'📋', detay:'Ameliyat talebi sisteme iletildi.',         done:true,  aktif:false, color:'#94A3B8', zaman:'' },
    { lbl:'Onaylandı',           icon:'✅', detay:`Ameliyat onaylandı. ${sl}.`,                 done:true,  aktif:false, color:'#059669', zaman:'' },
    { lbl:'Ameliyat Tamamlandı', icon:'🎉', detay:`${sa}'de başarıyla gerçekleştirildi.`,      done:true,  aktif:false, color:'#059669', zaman:'' },
  ];
  if (uiDurum === 'aktif') return [
    { lbl:'Talep Oluşturuldu', icon:'📋', detay:'Ameliyat talebi sisteme iletildi.',           done:true,  aktif:false, color:'#94A3B8', zaman:'' },
    { lbl:'Onaylandı',         icon:'✅', detay:'Onay verildi.',                                done:true,  aktif:false, color:'#059669', zaman:'' },
    { lbl:'Ameliyat Günü',     icon:'🏥', detay:`${sl}, ${sa}.`,                               done:false, aktif:true,  color:'#059669', zaman:'' },
  ];
  if (uiDurum === 'reddedildi') return [
    { lbl:'Talep Oluşturuldu', icon:'📋', detay:'Ameliyat talebi sisteme iletildi.',           done:true,  aktif:false, color:'#94A3B8', zaman:'' },
    { lbl:'Reddedildi',        icon:'❌', detay:'Talep reddedildi. Yeni talep oluşturabilirsiniz.', done:true, aktif:false, color:'#DC2626', zaman:'' },
  ];
  return [
    { lbl:'Talep Oluşturuldu', icon:'📋', detay:'Ameliyat talebi sisteme iletildi.',           done:true,  aktif:false, color:'#94A3B8', zaman:'' },
    { lbl:'İnceleme Aşaması',  icon:'🔍', detay:'Sorumlu hemşire inceliyor, lütfen bekleyin.', done:false, aktif:true,  color:'#D97706', zaman:'' },
    { lbl:'Onay Bekleniyor',   icon:'⏳', detay:'Onay sonrası takvime eklenecektir.',           done:false, aktif:false, color:'#D97706', zaman:'' },
    { lbl:'Ameliyat Günü',     icon:'🏥', detay:'—',                                           done:false, aktif:false, color:'#D97706', zaman:'' },
  ];
}

export default function RandevuDurum() {
  const navigate = useNavigate();
  const { showToast } = useUIStore();
  const { surgeries } = useDataStore();

  const randevular = surgeries.map(s => {
    const uiDurum = dbDurumToUi(s.durum);
    return {
      id:       s.id,
      op:       s.op || '—',
      hasta:    s.hasta || '—',
      tarih:    s.tarih || '—',
      saat:     s.saat || '—',
      salon:    s.salon || '—',
      durum:    uiDurum,
      adimlar:  makeAdimlar(uiDurum, s.salon, s.saat),
    };
  });

  const aktif      = randevular.filter(r => r.durum === 'aktif').length;
  const bekleyen   = randevular.filter(r => r.durum === 'beklemede').length;
  const reddedilen = randevular.filter(r => r.durum === 'reddedildi').length;

  return (
    <div>
      <div className="page-hd">
        <div>
          <div className="page-hd-title">Ameliyat Randevu Durumlarım</div>
          <div className="page-hd-sub">{randevular.length} talep — güncel durum takibi</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/randevu-talep')}>
          + Yeni Talep Oluştur
        </button>
      </div>

      {/* KPI kartlar */}
      <div className="stat-row" style={{ marginBottom:18 }}>
        {[
          { lbl:'Aktif Talepler',   val:aktif,             trend:'🟢 Onaylandı',       cls:'stat-card-1' },
          { lbl:'Beklemede',        val:bekleyen,          trend:'⏳ İnceleniyor',      cls:'stat-card-4' },
          { lbl:'Reddedilen',       val:reddedilen,        trend:'❌ İnceleme gerekli', cls:'stat-card-3' },
          { lbl:'Toplam Talep',     val:randevular.length, trend:'📋 Tüm kayıtlar',    cls:'stat-card-2' },
        ].map((k,i) => (
          <div key={i} className={`stat-card ${k.cls}`}>
            <div className="stat-glow"/>
            <div className="stat-val">{k.val}</div>
            <div className="stat-lbl">{k.lbl}</div>
            <div className="stat-trend">{k.trend}</div>
          </div>
        ))}
      </div>

      {/* Randevu kartları */}
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {randevular.length === 0 ? (
          <div style={{ textAlign:'center', padding:48, color:'var(--slate-light)' }}>
            <div style={{ fontSize:36, marginBottom:10 }}>📋</div>
            <div style={{ fontSize:14, fontWeight:600 }}>Kayıtlı randevu bulunamadı</div>
          </div>
        ) : randevular.map(r => {
          const dcfg = DUR_CFG[r.durum] || DUR_CFG.beklemede;
          return (
            <div key={r.id} style={{ background:'var(--card-bg)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden' }}>
              {/* Kart başlık */}
              <div style={{ display:'flex', alignItems:'center', gap:0, borderBottom:'1px solid var(--border)' }}>
                <div style={{ width:4, alignSelf:'stretch', background:dcfg.bar, flexShrink:0 }}/>
                <div style={{ flex:1, padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--slate)' }}>{r.op}</div>
                    <div style={{ fontSize:11.5, color:'var(--slate-light)', marginTop:3 }}>
                      Hasta: {r.hasta} · {r.tarih !== '—' ? r.tarih + ' · ' : ''}{r.saat}
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                    <span className={`tag ${dcfg.tag}`} style={{ fontSize:10 }}>{dcfg.txt}</span>
                    {r.salon && r.salon !== '—' && (
                      <span style={{ fontSize:10, color:'var(--slate-mid)', display:'flex', alignItems:'center', gap:3 }}>
                        🏥 {r.salon}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div style={{ padding:'16px 22px' }}>
                <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                  {r.adimlar.map((a, i) => (
                    <div key={i} style={{ display:'flex', gap:14, position:'relative' }}>
                      {i < r.adimlar.length - 1 && (
                        <div style={{ position:'absolute', left:15, top:32, bottom:0, width:2, background: a.done ? a.color + '44' : 'var(--border)' }}/>
                      )}
                      <div style={{
                        width:32, height:32, borderRadius:'50%', flexShrink:0, zIndex:1,
                        background: a.done ? a.color : a.aktif ? a.color : 'var(--surface)',
                        border: `2px solid ${a.done || a.aktif ? a.color : 'var(--border)'}`,
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize: a.done ? 13 : 11,
                      }}>
                        {a.done ? '✓' : a.aktif ? (
                          <div style={{ width:10, height:10, borderRadius:'50%', background:a.color }}/>
                        ) : <span style={{ color:'var(--slate-light)' }}>{i+1}</span>}
                      </div>
                      <div style={{ flex:1, paddingBottom:16 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                          <span style={{ fontSize:12.5, fontWeight:700, color: a.aktif ? a.color : a.done ? 'var(--slate)' : 'var(--slate-light)' }}>
                            {a.icon} {a.lbl}
                          </span>
                          {a.zaman && <span style={{ fontSize:10, color:'var(--slate-light)' }}>{a.zaman}</span>}
                          {a.aktif && <span className="tag t-teal" style={{ fontSize:8.5 }}>Güncel Durum</span>}
                        </div>
                        <div style={{ fontSize:11.5, color:'var(--slate-mid)', lineHeight:1.5 }}>{a.detay}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {r.durum === 'beklemede' && (
                  <div style={{ marginTop:4, padding:'10px 13px', background:'rgba(217,119,6,0.06)', border:'1px solid rgba(217,119,6,0.2)', borderRadius:8, fontSize:11, color:'#D97706', fontWeight:500 }}>
                    ⏳ Talebiniz inceleniyor. Onay bildirimi geldiğinde buradan takip edebilirsiniz.
                  </div>
                )}
                {r.durum === 'reddedildi' && (
                  <div style={{ marginTop:8, display:'flex', gap:8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => showToast('Talep düzenleme formu açılıyor…')}>Talebi Güncelle</button>
                    <button className="btn btn-primary btn-sm" onClick={() => navigate('/randevu-talep')}>Yeni Talep Oluştur</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
