import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../store';
import Modal from '../components/ui/Modal';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const STATUS_CFG = {
  trial:    { lbl: 'Deneme Süresi', renk: '#0284C7', bg: 'rgba(2,132,199,0.1)'  },
  active:   { lbl: 'Aktif',        renk: '#059669', bg: 'rgba(5,150,105,0.1)'  },
  past_due: { lbl: 'Ödeme Bekliyor',renk: '#D97706', bg: 'rgba(217,119,6,0.1)' },
  cancelled:{ lbl: 'İptal Edildi', renk: '#DC2626', bg: 'rgba(220,38,38,0.1)'  },
  expired:  { lbl: 'Süresi Doldu', renk: '#94A3B8', bg: 'rgba(148,163,184,0.1)'},
};

function authFetch(path, opts = {}) {
  const token = localStorage.getItem('operio_access');
  return fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...(opts.headers || {}) },
  }).then(r => r.json());
}

const PLAN_NAMES = { basic: 'Basic', standard: 'Standard', pro: 'Pro', enterprise: 'Enterprise' };
const DURUM_MAP  = { aktif: 'active', trial: 'trial', iptal: 'cancelled', gecikti: 'past_due', doldu: 'expired' };

function mapSub(raw) {
  if (!raw) return null;
  const durum = raw.durum || 'active';
  return {
    status: DURUM_MAP[durum] || durum,
    plan_slug: raw.paket || 'basic',
    plan_name: PLAN_NAMES[raw.paket] || raw.paket || 'Basic',
    seat_count: raw.kullaniciSayisi || 10,
    features: Array.isArray(raw.moduller) ? raw.moduller : [],
    current_period_end: raw.donemBitis || null,
    trial_ends_at: raw.trialBitis || null,
    trialDaysLeft: raw.trialGunKalan ?? null,
  };
}

function mapInvoice(raw) {
  return {
    id: raw.id,
    invoice_number: raw.faturaNo || raw.id?.slice(-8).toUpperCase() || '—',
    period_start: raw.donemBaslangic || raw.tarih || null,
    period_end: raw.donemBitis || null,
    amount_try: (raw.tutar || 0) * 100,
    status: (raw.durum === 'ödendi' || raw.durum === 'paid') ? 'paid' : 'open',
    created_at: raw.tarih || raw.createdAt || new Date().toISOString(),
    e_invoice_url: raw.pdfUrl || null,
  };
}

function mapLimits(raw) {
  if (!raw) return { limits: { rooms: { used: 0, max: -1 }, users: { used: 0, max: -1 } } };
  return { limits: raw.limits || raw };
}

export default function AbonelikYonetim() {
  const navigate    = useNavigate();
  const { showToast } = useUIStore();
  const [sub, setSub]           = useState(null);
  const [limits, setLimits]     = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    Promise.all([
      authFetch('/billing/subscription').catch(() => null),
      authFetch('/billing/limits').catch(() => null),
      authFetch('/billing/invoices').catch(() => null),
    ]).then(([subRes, limRes, invRes]) => {
      setSub(mapSub(subRes?.data || subRes));
      setLimits(mapLimits(limRes?.data || limRes));
      const rawInv = invRes?.data || invRes || [];
      setInvoices(Array.isArray(rawInv) ? rawInv.map(mapInvoice) : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await authFetch('/billing/subscription/cancel', { method: 'POST' });
      if (res.success) {
        showToast('Abonelik iptal edildi');
        setSub(prev => ({ ...prev, status: 'cancelled' }));
        setCancelOpen(false);
      } else {
        showToast('⚠️ ' + (res.error?.message || 'İptal edilemedi'));
      }
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'var(--slate-light)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
          <div>Yükleniyor…</div>
        </div>
      </div>
    );
  }

  if (!sub) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 48 }}>📦</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--slate)' }}>Aktif abonelik bulunamadı</div>
        <button className="btn btn-primary" onClick={() => navigate('/fiyatlandirma')}>Planları İncele →</button>
      </div>
    );
  }

  const cfg          = STATUS_CFG[sub.status] || STATUS_CFG.active;
  const features     = Array.isArray(sub.features) ? sub.features : JSON.parse(sub.features || '[]');
  const periodEndFmt = sub.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' })
    : '—';
  const trialEndFmt  = sub.trial_ends_at
    ? new Date(sub.trial_ends_at).toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' })
    : null;

  return (
    <div>
      <div className="page-hd">
        <div>
          <div className="page-hd-title">Abonelik Yönetimi</div>
          <div className="page-hd-sub">Planınız, faturalarınız ve kullanım limitleriniz</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/fiyatlandirma')}>
          Plan Değiştir →
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>

        {/* Mevcut Plan */}
        <div className="panel">
          <div className="panel-hd">
            <div className="panel-title">Mevcut Plan</div>
            <span className="tag" style={{ background: cfg.bg, color: cfg.renk }}>{cfg.lbl}</span>
          </div>
          <div style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
              <div style={{ fontSize: 40 }}>
                {{ starter:'🌱', pro:'⚡', enterprise:'🏢' }[sub.plan_slug] || '📦'}
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--slate)', fontFamily:"'Outfit',sans-serif" }}>
                  {sub.plan_name || sub.plan_slug}
                </div>
                <div style={{ fontSize: 12, color: 'var(--slate-light)', marginTop: 3 }}>
                  {sub.seat_count} kullanıcı koltuğu
                </div>
              </div>
            </div>

            {/* Dönem bilgisi */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              {trialEndFmt && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--slate-light)' }}>Deneme süresi bitiş</span>
                  <span style={{ fontWeight: 600, color: '#0284C7' }}>{trialEndFmt}</span>
                </div>
              )}
              {sub.trialDaysLeft !== null && sub.status === 'trial' && (
                <div style={{ padding: '8px 12px', background: 'rgba(2,132,199,0.06)', border: '1px solid rgba(2,132,199,0.15)', borderRadius: 9, fontSize: 12, color: '#0284C7', fontWeight: 600 }}>
                  ⏳ Deneme sürenizde {sub.trialDaysLeft} gün kaldı
                </div>
              )}
              {sub.status === 'active' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--slate-light)' }}>Sonraki yenileme</span>
                  <span style={{ fontWeight: 600, color: 'var(--slate)' }}>{periodEndFmt}</span>
                </div>
              )}
            </div>

            {/* Özellikler */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--slate-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                Plan özellikleri
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {features.slice(0, 5).map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--slate-mid)' }}>
                    <span style={{ color: '#059669' }}>✓</span> {f}
                  </div>
                ))}
              </div>
            </div>

            {/* Aksiyon butonları */}
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => navigate('/fiyatlandirma')}>
                Planı Yükselt
              </button>
              {['active','trial'].includes(sub.status) && (
                <button className="btn btn-danger btn-sm" onClick={() => setCancelOpen(true)}>
                  İptal Et
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Kullanım limitleri */}
        <div className="panel">
          <div className="panel-hd"><div className="panel-title">Kullanım Limitleri</div></div>
          <div style={{ padding: '18px 20px' }}>
            {limits?.limits && Object.entries(limits.limits).map(([key, val]) => {
              const labels = { rooms: '🚪 Ameliyat Salonları', users: '👥 Kullanıcılar' };
              const pct    = val.max === -1 ? 0 : Math.round((val.used / val.max) * 100);
              const barColor = pct > 90 ? '#DC2626' : pct > 70 ? '#D97706' : '#059669';

              return (
                <div key={key} style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 7 }}>
                    <span style={{ color: 'var(--slate)', fontWeight: 500 }}>{labels[key] || key}</span>
                    <span style={{ color: val.max === -1 ? '#059669' : 'var(--slate)', fontWeight: 600 }}>
                      {val.used} / {val.max === -1 ? '∞' : val.max}
                    </span>
                  </div>
                  <div style={{ height: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden' }}>
                    {val.max !== -1 && (
                      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: barColor, borderRadius: 20, transition: 'width 0.5s' }}/>
                    )}
                    {val.max === -1 && (
                      <div style={{ height: '100%', width: '30%', background: '#059669', borderRadius: 20 }}/>
                    )}
                  </div>
                  {pct > 90 && val.max !== -1 && (
                    <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4, fontWeight: 600 }}>
                      ⚠️ Limite yaklaşıyorsunuz — plan yükseltin
                    </div>
                  )}
                </div>
              );
            })}

            {!limits?.limits && (
              <div style={{ color: 'var(--slate-light)', fontSize: 13, textAlign: 'center', padding: 24 }}>
                Limit bilgisi yüklenemedi
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Faturalar */}
      <div className="panel">
        <div className="panel-hd">
          <div className="panel-title">Faturalar</div>
          <span style={{ fontSize: 11, color: 'var(--slate-light)' }}>{invoices.length} fatura</span>
        </div>
        {invoices.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Fatura No</th>
                <th>Dönem</th>
                <th>Tutar</th>
                <th>Durum</th>
                <th>Tarih</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id}>
                  <td style={{ fontFamily:"'Outfit',sans-serif", fontWeight: 700, fontSize: 12 }}>{inv.invoice_number}</td>
                  <td style={{ fontSize: 12 }}>
                    {inv.period_start && new Date(inv.period_start).toLocaleDateString('tr-TR')}
                    {inv.period_end && ` — ${new Date(inv.period_end).toLocaleDateString('tr-TR')}`}
                  </td>
                  <td style={{ fontWeight: 700 }}>₺{(inv.amount_try / 100).toLocaleString('tr-TR')}</td>
                  <td>
                    <span className="tag" style={{
                      background: inv.status==='paid'?'rgba(5,150,105,0.1)':'rgba(220,38,38,0.1)',
                      color: inv.status==='paid'?'#059669':'#DC2626',
                    }}>
                      {inv.status==='paid'?'Ödendi':'Bekliyor'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{new Date(inv.created_at).toLocaleDateString('tr-TR')}</td>
                  <td>
                    {inv.e_invoice_url ? (
                      <a href={inv.e_invoice_url} target="_blank" rel="noreferrer"
                        className="btn btn-secondary btn-sm">
                        PDF İndir
                      </a>
                    ) : (
                      <button className="btn btn-secondary btn-sm" disabled style={{ opacity: 0.4 }}>PDF</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 22, height: 22 }}>
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <div className="empty-text">Henüz fatura yok</div>
          </div>
        )}
      </div>

      {/* İptal onay modal */}
      {cancelOpen && (
        <Modal title="Aboneliği İptal Et" onClose={() => setCancelOpen(false)}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ padding: '14px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, fontSize: 13, color: '#DC2626', lineHeight: 1.6, marginBottom: 14 }}>
              ⚠️ Aboneliğinizi iptal etmek üzeresiniz.
            </div>
            <div style={{ fontSize: 13, color: 'var(--slate-mid)', lineHeight: 1.7 }}>
              İptal ettikten sonra mevcut dönem sonuna kadar ({periodEndFmt}) erişiminiz devam edecek. Kalan günler için iade yapılmaz.
            </div>
          </div>
          <div className="mf">
            <button className="btn btn-secondary" onClick={() => setCancelOpen(false)}>Vazgeç</button>
            <button className="btn btn-danger" onClick={handleCancel} disabled={cancelling}
              style={{ opacity: cancelling ? 0.7 : 1 }}>
              {cancelling ? 'İptal ediliyor…' : 'Evet, İptal Et'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
