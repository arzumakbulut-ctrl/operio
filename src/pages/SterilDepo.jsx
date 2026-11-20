import { useState } from 'react';
import { useDataStore, useUIStore } from '../store';
import { useNavigate } from 'react-router-dom';

export default function SterilDepo() {
  const { sterilSetlerV2, tekliAletler, sterilAkis, durumSetCfg } = useDataStore();
  const navigate = useNavigate();
  const [filtre, setFiltre] = useState('Tümü');
  const raflar = ['A', 'B', 'C', 'D', 'E'];

  const ASAMA_CFG = {
    kirli_teslim:    { lbl:'Kirli Teslim', icon:'📦', color:'#DC2626' },
    yikamada:        { lbl:'Yıkamada',     icon:'💧', color:'#0284C7' },
    sterilizasyonda: { lbl:'Sterilizasyonda',icon:'⚙',color:'#D97706' },
    steril:          { lbl:'Steril',       icon:'✅', color:'#059669' },
    depoda:          { lbl:'Depoda',       icon:'🏪', color:'#14B8A6' },
  };

  function filtreItem(durum) {
    if (filtre === 'Tümü') return true;
    return durum === filtre;
  }

  return (
    <div>
      <div className="page-hd" style={{ marginBottom: 16 }}>
        <div>
          <div className="page-hd-title">Steril Depo</div>
          <div className="page-hd-sub">Raf bazlı cerrahi set ve alet envanteri</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['Tümü', 'Steril — Hazır', 'Sterilizasyonda', 'Kullanımda'].map((f, i) => (
            <button key={f} className={`btn btn-sm ${filtre === f ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFiltre(f)}>{f}</button>
          ))}
        </div>
      </div>

      <div className="depo-layout">
        {raflar.map(raf => {
          const rafSetler = sterilSetlerV2.filter(s => s.raf.startsWith(raf) && filtreItem(s.durum));
          const rafAletler = tekliAletler.filter(a => a.raf.startsWith(raf) && filtreItem(a.durum));
          if (!rafSetler.length && !rafAletler.length) return null;
          return (
            <div className="raf-blok" key={raf}>
              <div className="raf-header">
                <div className="raf-harf">{raf}</div>
                <div>
                  <div className="raf-title">{raf} Rafı</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--slate-light)', marginTop: 1 }}>
                    {rafSetler.length} cerrahi set · {rafAletler.length} tekli alet
                  </div>
                </div>
                <span className="tag t-teal" style={{ fontSize: 9, marginLeft: 'auto' }}>
                  {rafSetler.length + rafAletler.length} kalem
                </span>
              </div>
              <div className="raf-items">
                {rafSetler.map(s => {
                  const dcfg = durumSetCfg[s.durum] || { color: '#94A3B8' };
                  const cls = s.durum === 'Steril — Hazır' ? 'steril' : s.durum === 'Kullanımda' ? 'kullanimda' : 'sterilizasyonda';
                  return (
                    <div key={s.id} className={`raf-item ${cls}`}
                      onClick={() => navigate('/set-takip')}
                      style={{ cursor: 'pointer' }}>
                      <div className="ri-name">{s.name}</div>
                      <div className="ri-doc">{s.doktor}</div>
                      <div className="ri-footer">
                        <span className="ri-raf">Raf: {s.raf}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div className="ri-status-dot" style={{ background: dcfg.color }} />
                          <span style={{ fontSize: 9, fontWeight: 600, color: dcfg.color }}>{s.durum}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {rafAletler.map(a => {
                  const dcfg = durumSetCfg[a.durum] || { color: '#94A3B8' };
                  return (
                    <div key={a.id} className="raf-item" style={{ borderStyle: 'dashed' }}>
                      <div className="ri-name" style={{ fontSize: 11 }}>{a.ad}</div>
                      <div className="ri-doc">{a.kat}{a.doktor ? ' · ' + a.doktor : ''}</div>
                      <div className="ri-footer">
                        <span className="ri-raf">Raf: {a.raf}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div className="ri-status-dot" style={{ background: dcfg.color }} />
                          <span style={{ fontSize: 9, fontWeight: 600, color: dcfg.color }}>{a.durum}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
