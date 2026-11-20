import { useState, useEffect } from 'react';
import { useUIStore } from '../store';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const PLAN_ICONS    = { starter: '🌱', pro: '⚡', enterprise: '🏢' };
const PLAN_COLORS   = { starter: '#059669', pro: '#0284C7', enterprise: '#7C3AED' };
const PLAN_POPULAR  = { starter: false, pro: true, enterprise: false };

const FEATURE_ICONS = {
  'AI Asistan': '🤖', 'WebSocket bildirimler': '🔔',
  'HBYS/E-Nabız': '🏥', 'SLA garantisi': '✅',
  'Sınırsız': '♾️', 'Öncelikli destek': '⚡',
};

function featureIcon(feature) {
  for (const [k, v] of Object.entries(FEATURE_ICONS)) {
    if (feature.includes(k)) return v;
  }
  return '✓';
}

export default function Fiyatlandirma() {
  const { showToast } = useUIStore();
  const [plans, setPlans]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [period, setPeriod]         = useState('monthly'); // monthly | annual
  const [coupon, setCoupon]         = useState('');
  const [couponData, setCouponData] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [seats, setSeats]           = useState(10);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/billing/plans`)
      .then(r => r.json())
      .then(d => {
        const raw = d.data || d || [];
        if (!Array.isArray(raw) || raw.length === 0) { setLoading(false); return; }
        // Map Turkish backend fields to component's expected fields
        const mapped = raw.map(p => ({
          id: p.id || p.slug,
          slug: p.slug || p.id,
          name: p.name || p.ad || p.id,
          price_try: p.price_try ?? (p.fiyat != null ? p.fiyat * 100 : 0),
          max_rooms: p.max_rooms ?? p.maxSalon ?? -1,
          max_users: p.max_users ?? p.maxKullanici ?? -1,
          features: Array.isArray(p.features) ? p.features : Array.isArray(p.moduller) ? p.moduller : [],
        }));
        setPlans(mapped);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const discount = period === 'annual' ? 0.20 : 0; // %20 yıllık indirim

  function calcPrice(plan) {
    if (plan.price_try === 0) return null; // Enterprise
    let price = Math.round(plan.price_try / 100); // kuruş → TL
    if (period === 'annual') price = Math.round(price * (1 - discount));
    if (couponData?.discountType === 'percent') price = Math.round(price * (1 - couponData.discountValue / 100));
    if (couponData?.discountType === 'fixed_try') price = Math.max(0, price - Math.round(couponData.discountValue / 100));
    return price;
  }

  async function handleCouponCheck() {
    if (!coupon.trim() || !selectedPlan) return;
    setCheckingCoupon(true);
    setCouponError('');
    setCouponData(null);

    const token = localStorage.getItem('operio_access');
    try {
      const res = await fetch(`${API}/billing/coupon/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ code: coupon.toUpperCase(), planSlug: selectedPlan.slug }),
      });
      const data = await res.json();
      const isValid = data.success !== undefined ? data.success : data.valid;
      const couponResult = data.data || (data.valid ? { discountType: data.discountType || 'percent', discountValue: data.discount || 0 } : null);
      if (isValid && couponResult) {
        setCouponData(couponResult);
        showToast('✅ Kupon uygulandı!');
      } else {
        setCouponError(data.error?.message || data.message || 'Geçersiz kupon');
      }
    } catch {
      setCouponError('Kupon kontrol edilemedi');
    } finally {
      setCheckingCoupon(false);
    }
  }

  async function handleCheckout(plan, provider = 'iyzico') {
    if (plan.slug === 'enterprise') {
      window.open('mailto:satis@operio.com.tr?subject=Enterprise Plan Talebi', '_blank');
      return;
    }

    const token = localStorage.getItem('operio_access');
    if (!token) { showToast('⚠️ Önce giriş yapın'); return; }

    setCheckoutLoading(true);
    try {
      const endpoint = `${API}/billing/${provider}/checkout`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          planSlug:   plan.slug,
          seatCount:  seats,
          couponCode: couponData ? coupon.toUpperCase() : undefined,
          trialDays:  14,
          buyer: {
            name:    'Demo',
            surname: 'Kullanıcı',
            email:   'demo@hastane.tr',
            phone:   '+905551234567',
            address: 'İstanbul',
            city:    'İstanbul',
          },
        }),
      });

      const data = await res.json();

      if (!data.success && !data.url) {
        showToast(`⚠️ ${data.error?.message || data.message || 'Hata oluştu'}`);
        return;
      }

      if (provider === 'iyzico' && data.data?.checkoutFormContent) {
        // İyzico form'u ayrı pencerede aç (sandbox)
        const win = window.open('', '_blank');
        win.document.write(data.data.checkoutFormContent);
        showToast('📋 İyzico ödeme formu açıldı');
      } else if (provider === 'stripe' && data.data?.checkoutUrl) {
        window.location.href = data.data.checkoutUrl;
      } else {
        showToast('✅ Ödeme başlatıldı');
      }
    } catch (err) {
      showToast('⚠️ Ödeme başlatılamadı: ' + err.message);
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--slate-light)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
          <div>Planlar yükleniyor…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Başlık */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
          Fiyatlandırma
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 900, color: 'var(--slate)', fontFamily: "'Outfit',sans-serif", letterSpacing: '-1px', marginBottom: 12 }}>
          Kurumunuza Uygun Planı Seçin
        </h1>
        <p style={{ fontSize: 15, color: 'var(--slate-light)', maxWidth: 520, margin: '0 auto 24px' }}>
          14 gün ücretsiz deneyin. Kredi kartı gerekmez.
        </p>

        {/* Dönem seçici */}
        <div style={{ display: 'inline-flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 30, padding: 4, gap: 2 }}>
          {[['monthly','Aylık'],['annual','Yıllık']].map(([k,l]) => (
            <button key={k} onClick={() => setPeriod(k)} style={{
              padding: '7px 18px', borderRadius: 26, fontSize: 13, fontWeight: 600,
              background: period===k ? 'var(--teal)' : 'transparent',
              color: period===k ? 'white' : 'var(--slate-mid)',
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {l}
              {k==='annual' && <span style={{ marginLeft: 6, fontSize: 10, background: period==='annual'?'rgba(255,255,255,0.2)':'rgba(5,150,105,0.12)', color: period==='annual'?'white':'#059669', padding: '1px 6px', borderRadius: 20, fontWeight: 700 }}>%20</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Plan kartları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18, marginBottom: 32 }}>
        {plans.map(plan => {
          const price   = calcPrice(plan);
          const color   = PLAN_COLORS[plan.slug] || '#14B8A6';
          const popular = PLAN_POPULAR[plan.slug];
          const features = Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features || '[]');

          return (
            <div key={plan.id} style={{
              background: 'var(--card-bg)',
              border: `${popular ? '2.5px' : '1px'} solid ${popular ? color : 'var(--border)'}`,
              borderRadius: 20, overflow: 'hidden',
              position: 'relative',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 16px 40px rgba(0,0,0,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=''; }}
            >
              {popular && (
                <div style={{ background: color, color: 'white', fontSize: 10, fontWeight: 800, padding: '4px 0', textAlign: 'center', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                  En Popüler
                </div>
              )}

              <div style={{ padding: '24px 24px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                    {PLAN_ICONS[plan.slug]}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--slate)', fontFamily: "'Outfit',sans-serif" }}>{plan.name}</div>
                    <div style={{ fontSize: 11, color: color, fontWeight: 600 }}>
                      {plan.max_rooms === -1 ? 'Sınırsız salon' : `${plan.max_rooms} salona kadar`}
                    </div>
                  </div>
                </div>

                {/* Fiyat */}
                <div style={{ marginBottom: 20 }}>
                  {price !== null ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span style={{ fontSize: 14, color: 'var(--slate-light)', fontWeight: 600 }}>₺</span>
                        <span style={{ fontSize: 40, fontWeight: 900, color: 'var(--slate)', fontFamily: "'Outfit',sans-serif", letterSpacing: '-2px' }}>
                          {price.toLocaleString('tr-TR')}
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--slate-light)' }}>/ay</span>
                      </div>
                      {period === 'annual' && (
                        <div style={{ fontSize: 11, color: color, fontWeight: 600, marginTop: 3 }}>
                          Yıllık faturalanır · %20 tasarruf
                        </div>
                      )}
                      <div style={{ fontSize: 11.5, color: 'var(--slate-light)', marginTop: 4 }}>
                        {plan.max_users === -1 ? 'Sınırsız kullanıcı' : `${plan.max_users} kullanıcıya kadar`}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--slate)', fontFamily: "'Outfit',sans-serif" }}>Teklif Alın</div>
                  )}
                </div>

                {/* CTA butonları */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                  {plan.slug !== 'enterprise' ? (
                    <>
                      <button
                        onClick={() => { setSelectedPlan(plan); handleCheckout(plan, 'iyzico'); }}
                        disabled={checkoutLoading}
                        style={{
                          width: '100%', padding: '11px', borderRadius: 10, fontSize: 13,
                          fontWeight: 700, cursor: 'pointer', border: 'none',
                          background: color, color: 'white', transition: 'opacity 0.15s',
                          opacity: checkoutLoading ? 0.7 : 1,
                        }}>
                        {checkoutLoading && selectedPlan?.id === plan.id ? 'Yönlendiriliyor…' : '14 Gün Ücretsiz Dene'}
                      </button>
                      <button
                        onClick={() => { setSelectedPlan(plan); handleCheckout(plan, 'stripe'); }}
                        style={{
                          width: '100%', padding: '8px', borderRadius: 10, fontSize: 11.5,
                          fontWeight: 600, cursor: 'pointer',
                          border: '1px solid var(--border)', background: 'var(--surface)',
                          color: 'var(--slate-mid)',
                        }}>
                        💳 Kredi Kartı ile Öde (Stripe)
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleCheckout(plan)}
                      style={{
                        width: '100%', padding: '11px', borderRadius: 10, fontSize: 13,
                        fontWeight: 700, cursor: 'pointer', border: `2px solid ${color}`,
                        background: 'transparent', color: color,
                      }}>
                      Bize Ulaşın →
                    </button>
                  )}
                </div>

                {/* Özellikler */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {features.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>{featureIcon(f)}</span>
                      <span style={{ fontSize: 12.5, color: 'var(--slate-mid)' }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Kupon + Koltuk ayarları */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
        {/* Kupon */}
        <div className="panel" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate)', marginBottom: 12, fontFamily: "'Outfit',sans-serif" }}>
            🎫 Kupon Kodu
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="fi"
              placeholder="Kupon kodunu girin"
              value={coupon}
              onChange={e => { setCoupon(e.target.value.toUpperCase()); setCouponData(null); setCouponError(''); }}
              style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '1px' }}
            />
            <button
              onClick={handleCouponCheck}
              disabled={!coupon.trim() || checkingCoupon || !selectedPlan}
              className="btn btn-primary btn-sm"
              style={{ flexShrink: 0 }}>
              {checkingCoupon ? '…' : 'Uygula'}
            </button>
          </div>
          {couponData && (
            <div style={{ marginTop: 8, padding: '7px 12px', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 8, fontSize: 12, color: '#059669', fontWeight: 600 }}>
              ✅ {coupon} uygulandı — {couponData.discountType === 'percent' ? `%${couponData.discountValue} indirim` : `₺${(couponData.discountValue/100).toFixed(0)} indirim`}
            </div>
          )}
          {couponError && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#DC2626' }}>⚠️ {couponError}</div>
          )}
          {!selectedPlan && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--slate-light)' }}>Önce bir plan seçin</div>
          )}
        </div>

        {/* Koltuk sayısı */}
        <div className="panel" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate)', marginBottom: 12, fontFamily: "'Outfit',sans-serif" }}>
            👥 Kullanıcı Koltukları
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="range" min={5} max={200} step={5} value={seats}
              onChange={e => setSeats(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <div style={{ minWidth: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--teal)', fontFamily: "'Outfit',sans-serif" }}>{seats}</div>
              <div style={{ fontSize: 10, color: 'var(--slate-light)' }}>kullanıcı</div>
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--slate-light)', marginTop: 6 }}>
            10 koltuk üzeri için ek ücret uygulanır
          </div>
        </div>
      </div>

      {/* SSS */}
      <div className="panel" style={{ padding: '24px 28px' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--slate)', fontFamily: "'Outfit',sans-serif", marginBottom: 18 }}>
          Sık Sorulan Sorular
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            ['Trial nasıl çalışır?', '14 gün boyunca Pro planın tüm özelliklerini ücretsiz kullanırsınız. Kart bilgisi gerekmez, süre sonunda otomatik ücretlendirme yapılmaz.'],
            ['Plan değiştirebilir miyim?', 'İstediğiniz zaman plan yükseltme veya düşürme yapabilirsiniz. Kalan günler orantılı olarak hesaplanır.'],
            ['Faturalama nasıl yapılır?', 'Her ay abonelik döneminin başında otomatik fatura kesilir ve sisteme yüklenir. E-fatura desteği mevcuttur.'],
            ['İptal edersem ne olur?', 'İstediğiniz zaman iptal edebilirsiniz. Dönem sonuna kadar erişiminiz devam eder, kalan günler için iade yapılmaz.'],
          ].map(([q, a]) => (
            <div key={q} style={{ padding: '14px 16px', background: 'var(--surface)', borderRadius: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate)', marginBottom: 6 }}>{q}</div>
              <div style={{ fontSize: 12, color: 'var(--slate-mid)', lineHeight: 1.6 }}>{a}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
