import { useEffect, useRef, useState } from 'react';
import { useDataStore } from '../store';

const QR_PREFIX = 'OPER-SET-';

// Basit QR görselleştirme — üretimde qrcode kütüphanesi kullanılır
function QRPlaceholder({ text, size = 120 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Basit QR pattern simülasyonu (görsel amaçlı)
    ctx.fillStyle = '#0F172A';
    const cell = Math.floor(size / 21);

    // Köşe kareleri
    const corners = [[0,0],[14,0],[0,14]];
    corners.forEach(([cx,cy]) => {
      ctx.fillRect(cx*cell, cy*cell, 7*cell, 7*cell);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect((cx+1)*cell, (cy+1)*cell, 5*cell, 5*cell);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect((cx+2)*cell, (cy+2)*cell, 3*cell, 3*cell);
      ctx.fillStyle = '#0F172A';
    });

    // Sahte veri noktaları
    const seed = text.split('').reduce((a,c) => a + c.charCodeAt(0), 0);
    for (let r = 0; r < 21; r++) {
      for (let c = 0; c < 21; c++) {
        if (r < 9 && (c < 9 || c > 11)) continue;
        if (r > 11 && c < 9) continue;
        const bit = (seed * (r+1) * (c+1)) % 7 > 3;
        if (bit) { ctx.fillStyle = '#0F172A'; ctx.fillRect(c*cell, r*cell, cell, cell); }
      }
    }

    // Orta: metin
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(8*cell, 8*cell, 5*cell, 5*cell);
    ctx.fillStyle = '#0F172A';
    ctx.font = `bold ${Math.floor(cell*1.2)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('QR', size/2, size/2 + cell/3);
  }, [text, size]);

  return <canvas ref={canvasRef} width={size} height={size} style={{ display: 'block', imageRendering: 'pixelated' }}/>;
}

export default function QREtiketler() {
  const { sterilSetler } = useDataStore();
  const [selected, setSelected] = useState([]);
  const [labelSize, setLabelSize] = useState('medium'); // small | medium | large

  const sizes = { small: 80, medium: 120, large: 160 };
  const qrSize = sizes[labelSize];

  function toggleAll() {
    if (selected.length === sterilSetler.length) setSelected([]);
    else setSelected(sterilSetler.map(s => s.id));
  }

  function toggleOne(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function handlePrint() {
    window.print();
  }

  const selectedSets = sterilSetler.filter(s => selected.includes(s.id));

  return (
    <div>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { display: block !important; }
          body { background: white !important; }
          .label-grid { display: grid !important; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
          .label-card { break-inside: avoid; border: 1px solid #ddd !important; }
        }
        @media screen {
          .print-area { display: block; }
        }
      `}</style>

      {/* Kontrol paneli */}
      <div className="no-print">
        <div className="page-hd">
          <div>
            <div className="page-hd-title">QR Etiket Üretici</div>
            <div className="page-hd-sub">Cerrahi setler için barkod etiketleri oluştur ve yazdır</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              className="fi"
              value={labelSize}
              onChange={e => setLabelSize(e.target.value)}
              style={{ width: 140 }}>
              <option value="small">Küçük (80px)</option>
              <option value="medium">Orta (120px)</option>
              <option value="large">Büyük (160px)</option>
            </select>
            <button className="btn btn-secondary" onClick={toggleAll}>
              {selected.length === sterilSetler.length ? 'Seçimi Kaldır' : 'Tümünü Seç'}
            </button>
            <button
              className="btn btn-primary"
              disabled={selected.length === 0}
              onClick={handlePrint}
              style={{ opacity: selected.length === 0 ? 0.5 : 1 }}>
              🖨️ Yazdır ({selected.length})
            </button>
          </div>
        </div>

        {/* Set seçim listesi */}
        <div className="panel" style={{ marginBottom: 18 }}>
          <div className="panel-hd">
            <div className="panel-title">Set Seçimi</div>
            <span style={{ fontSize: 11, color: 'var(--slate-light)' }}>
              {selected.length} / {sterilSetler.length} seçili
            </span>
          </div>
          <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sterilSetler.map(s => (
              <label key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px',
                borderRadius: 8, cursor: 'pointer',
                background: selected.includes(s.id) ? 'rgba(20,184,166,0.05)' : 'transparent',
                border: `1px solid ${selected.includes(s.id) ? 'rgba(20,184,166,0.2)' : 'transparent'}`,
                transition: 'all 0.12s',
              }}>
                <input
                  type="checkbox"
                  checked={selected.includes(s.id)}
                  onChange={() => toggleOne(s.id)}
                  style={{ accentColor: 'var(--teal)', width: 16, height: 16 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate)' }}>{s.ad || s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--slate-light)', marginTop: 1 }}>
                    {s.kod || s.code} · QR: {QR_PREFIX}{s.kod || s.code}
                  </div>
                </div>
                <span className="tag t-gray">{s.raf || s.shelfLocation || '—'}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Önizleme + baskı alanı */}
      {selectedSets.length > 0 && (
        <div className="print-area">
          <div className="no-print" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              Önizleme
            </div>
          </div>

          <div className="label-grid" style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${qrSize + 60}px, 1fr))`,
            gap: 12,
          }}>
            {selectedSets.map(s => {
              const qrText = `${QR_PREFIX}${s.kod || s.code}`;
              return (
                <div key={s.id} className="label-card" style={{
                  background: 'white',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 10,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  breakInside: 'avoid',
                }}>
                  {/* QR kod */}
                  <div style={{
                    background: 'white',
                    padding: 6,
                    borderRadius: 6,
                    border: '1px solid #f1f5f9',
                  }}>
                    <QRPlaceholder text={qrText} size={qrSize}/>
                  </div>

                  {/* Set bilgisi */}
                  <div style={{ textAlign: 'center', width: '100%' }}>
                    <div style={{
                      fontSize: Math.max(10, qrSize / 12),
                      fontWeight: 800,
                      color: '#0F172A',
                      lineHeight: 1.2,
                      marginBottom: 3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {s.ad || s.name}
                    </div>
                    <div style={{
                      fontSize: Math.max(9, qrSize / 14),
                      color: '#64748B',
                      fontFamily: 'monospace',
                      letterSpacing: '0.5px',
                    }}>
                      {s.kod || s.code}
                    </div>
                    {s.raf || s.shelfLocation ? (
                      <div style={{
                        marginTop: 4,
                        fontSize: Math.max(9, qrSize / 15),
                        fontWeight: 700,
                        color: '#0F766E',
                        background: '#CCFBF1',
                        padding: '2px 8px',
                        borderRadius: 20,
                        display: 'inline-block',
                      }}>
                        Raf: {s.raf || s.shelfLocation}
                      </div>
                    ) : null}
                    <div style={{
                      marginTop: 4,
                      fontSize: 8,
                      color: '#94A3B8',
                      fontFamily: 'monospace',
                    }}>
                      {qrText}
                    </div>
                  </div>

                  {/* Operio logosu */}
                  <div style={{
                    width: '100%',
                    borderTop: '1px solid #f1f5f9',
                    paddingTop: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2.5">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                    </svg>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#14B8A6', letterSpacing: '0.5px' }}>
                      OPERİO
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedSets.length === 0 && (
        <div className="empty panel no-print">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 24, height: 24 }}>
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3M17 17h3M14 20h3"/>
            </svg>
          </div>
          <div className="empty-text">En az bir set seçin</div>
          <div className="empty-sub">Seçilen setler için QR etiketler oluşturulacak</div>
        </div>
      )}
    </div>
  );
}
