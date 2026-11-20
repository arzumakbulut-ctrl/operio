const db                  = require('../utils/db');
const { audit }           = require('../utils/audit');
const { pushNotification } = require('../socket');
const { iyzico, stripe, generateInvoiceNumber } = require('./payment.provider');

// ── PLAN YÖNETİMİ ─────────────────────────────────────────────

async function getPlans() {
  const { rows } = await db.query(
    'SELECT * FROM plans WHERE is_active=TRUE ORDER BY price_try ASC'
  );
  return rows;
}

async function getPlan(slug) {
  const { rows } = await db.query(
    'SELECT * FROM plans WHERE slug=$1 AND is_active=TRUE', [slug]
  );
  return rows[0] || null;
}

// ── KUPON YÖNETİMİ ────────────────────────────────────────────

async function validateCoupon({ code, planSlug }) {
  const { rows } = await db.query(
    `SELECT * FROM coupons
     WHERE code = $1
       AND is_active = TRUE
       AND (valid_until IS NULL OR valid_until > NOW())
       AND (max_uses IS NULL OR used_count < max_uses)
       AND (plan_slug IS NULL OR plan_slug = $2)`,
    [code.toUpperCase().trim(), planSlug]
  );

  const coupon = rows[0];
  if (!coupon) return { valid: false, error: 'Kupon geçersiz veya süresi dolmuş' };

  return { valid: true, coupon };
}

async function applyCouponToPrice({ coupon, originalPriceTRY }) {
  let finalPrice = originalPriceTRY;
  let discountAmount = 0;

  if (coupon.discount_type === 'percent') {
    discountAmount = Math.floor(originalPriceTRY * coupon.discount_value / 100);
    finalPrice = originalPriceTRY - discountAmount;
  } else if (coupon.discount_type === 'fixed_try') {
    discountAmount = coupon.discount_value;
    finalPrice = Math.max(0, originalPriceTRY - discountAmount);
  }

  return { finalPrice, discountAmount, originalPrice: originalPriceTRY };
}

async function incrementCouponUsage(couponId) {
  await db.query('UPDATE coupons SET used_count = used_count + 1 WHERE id=$1', [couponId]);
}

// ── ABONELİK YÖNETİMİ ────────────────────────────────────────

/**
 * Mevcut aboneliği getir
 */
async function getSubscription(institutionId) {
  const { rows } = await db.query(
    `SELECT s.*, p.name AS plan_name, p.max_rooms, p.max_users, p.features,
            c.code AS coupon_code
     FROM subscriptions s
     JOIN plans p ON s.plan_slug = p.slug
     LEFT JOIN coupons c ON s.coupon_id = c.id
     WHERE s.institution_id = $1
     ORDER BY s.created_at DESC
     LIMIT 1`,
    [institutionId]
  );
  return rows[0] || null;
}

/**
 * Trial başlat (kayıt sonrası otomatik)
 */
async function startTrial({ institutionId, planSlug = 'pro', trialDays = 14 }) {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

  // Mevcut abonelik var mı?
  const existing = await getSubscription(institutionId);
  if (existing) return existing;

  const { rows } = await db.query(
    `INSERT INTO subscriptions
       (institution_id, plan_slug, status, trial_ends_at,
        current_period_start, current_period_end, seat_count)
     VALUES ($1, $2, 'trial', $3, NOW(), $3, 10)
     RETURNING *`,
    [institutionId, planSlug, trialEndsAt]
  );

  await audit({
    userId: null,
    action: 'CREATE',
    resource: 'subscription',
    resourceId: rows[0].id,
    newData: { planSlug, trialDays, institutionId },
  });

  return rows[0];
}

/**
 * İyzico ile ödeme başlat
 */
async function initiateIyzicoCheckout({ institutionId, planSlug, seatCount, couponCode, buyer, ip }) {
  const plan = await getPlan(planSlug);
  if (!plan) throw new Error('Plan bulunamadı');
  if (planSlug === 'enterprise') throw new Error('Enterprise plan için bizimle iletişime geçin');

  // Koltuk sayısına göre fiyat
  const basePrice = plan.price_try;
  const seatPrice = seatCount > plan.max_users
    ? Math.ceil((seatCount - plan.max_users) * (basePrice * 0.1)) // %10 ek koltuk ücreti
    : 0;
  let totalPrice = basePrice + seatPrice;

  // Kupon
  let couponRow = null;
  if (couponCode) {
    const couponResult = await validateCoupon({ code: couponCode, planSlug });
    if (!couponResult.valid) throw Object.assign(new Error(couponResult.error), { statusCode: 400 });
    const priced = await applyCouponToPrice({ coupon: couponResult.coupon, originalPriceTRY: totalPrice });
    totalPrice = priced.finalPrice;
    couponRow  = couponResult.coupon;
  }

  const referenceCode = `OPR-${institutionId.slice(0,8)}-${Date.now()}`;

  const result = await iyzico.createCheckout({
    referenceCode,
    amountTRY: totalPrice,
    buyer: {
      ...buyer,
      ip: ip || '85.34.78.112',
    },
    billingAddress: {
      contactName: buyer.name + ' ' + buyer.surname,
      city:        buyer.city || 'İstanbul',
      country:     'Turkey',
      address:     buyer.address || 'İstanbul',
    },
    basketItems: [{
      id:       planSlug,
      name:     `Operio ${plan.name} - ${seatCount} Koltuk`,
      price:    totalPrice,
      category: 'SaaS Yazılım',
    }],
  });

  // Bekleyen abonelik kaydı oluştur
  await db.query(
    `INSERT INTO subscriptions
       (institution_id, plan_slug, status, seat_count, coupon_id, billing_name, billing_email)
     VALUES ($1,$2,'pending',$3,$4,$5,$6)
     ON CONFLICT DO NOTHING`,
    [institutionId, planSlug, seatCount,
     couponRow?.id ?? null,
     buyer.name + ' ' + buyer.surname,
     buyer.email]
  );

  return { ...result, totalPrice, couponApplied: !!couponRow };
}

/**
 * İyzico ödeme doğrulama (callback)
 */
async function verifyIyzicoPayment({ token, institutionId }) {
  const result = await iyzico.verifyCheckout(token);

  if (!result.success) {
    throw new Error('Ödeme doğrulanamadı');
  }

  // Aboneliği aktifleştir
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const { rows } = await db.query(
    `UPDATE subscriptions
     SET status = 'active',
         current_period_start = NOW(),
         current_period_end   = $1,
         iyzico_subscription_id = $2,
         updated_at = NOW()
     WHERE institution_id = $3 AND status = 'pending'
     RETURNING *`,
    [periodEnd, result.paymentId, institutionId]
  );

  const sub = rows[0];

  if (sub) {
    // Fatura oluştur
    await createInvoice({
      subscriptionId: sub.id,
      institutionId,
      amountTRY:      Math.round(parseFloat(result.paidPrice) * 100),
      provider:       'iyzico',
      paymentId:      result.paymentId,
    });

    // Kupon kullanım sayısını artır
    if (sub.coupon_id) await incrementCouponUsage(sub.coupon_id);

    await pushNotification({
      institutionId,
      type:    'tamamlandi',
      title:   'Abonelik Aktifleştirildi 🎉',
      message: `${sub.plan_slug.charAt(0).toUpperCase() + sub.plan_slug.slice(1)} planınız başarıyla aktifleştirildi.`,
    });
  }

  return { success: true, subscription: sub };
}

/**
 * Stripe ile ödeme başlat
 */
async function initiateStripeCheckout({ institutionId, planSlug, seatCount, couponCode, customerEmail, trialDays = 0 }) {
  const plan = await getPlan(planSlug);
  if (!plan) throw new Error('Plan bulunamadı');

  let stripeCouponId = null;
  if (couponCode) {
    // Stripe'ta kupon var mı? Yoksa İyzico kupon mantığını kullan
    const couponResult = await validateCoupon({ code: couponCode, planSlug });
    if (!couponResult.valid) throw Object.assign(new Error(couponResult.error), { statusCode: 400 });
  }

  const referenceCode = `STR-${institutionId.slice(0,8)}-${Date.now()}`;

  const result = await stripe.createCheckout({
    referenceCode,
    planSlug,
    seatCount,
    customerEmail,
    trialDays,
    couponId: stripeCouponId,
  });

  return result;
}

/**
 * Stripe webhook işle
 */
async function handleStripeWebhook({ rawBody, signature }) {
  const event = stripe.handleWebhook(rawBody, signature);

  if (event.type === 'invoice.payment_succeeded') {
    const inv = event.data;
    const metadata = inv.subscription_details?.metadata || {};
    const institutionId = metadata.institutionId;

    if (institutionId) {
      await db.query(
        `UPDATE subscriptions SET status='active', updated_at=NOW()
         WHERE stripe_subscription_id=$1`,
        [inv.subscription]
      );

      await pushNotification({
        institutionId,
        type:    'tamamlandi',
        title:   'Ödeme Alındı',
        message: `$${(inv.amount_paid / 100).toFixed(2)} ödemeniz başarıyla alındı.`,
      });
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    await db.query(
      `UPDATE subscriptions SET status='cancelled', cancelled_at=NOW(), updated_at=NOW()
       WHERE stripe_subscription_id=$1`,
      [event.data.id]
    );
  }

  // Webhook'u işlenmiş olarak işaretle
  await db.query(
    'INSERT INTO payment_events (provider, event_type, payload, processed) VALUES ($1,$2,$3,TRUE)',
    ['stripe', event.type, JSON.stringify(event.data)]
  );

  return { processed: true };
}

/**
 * Abonelik iptal
 */
async function cancelSubscription({ institutionId, userId, req }) {
  const sub = await getSubscription(institutionId);
  if (!sub) throw new Error('Aktif abonelik bulunamadı');

  if (sub.stripe_subscription_id) {
    await stripe.cancelSubscription(sub.stripe_subscription_id);
  } else if (sub.iyzico_subscription_id) {
    await iyzico.cancelSubscription(sub.iyzico_subscription_id);
  }

  await db.query(
    `UPDATE subscriptions SET status='cancelled', cancelled_at=NOW(), updated_at=NOW()
     WHERE id=$1`,
    [sub.id]
  );

  await audit({
    userId, action: 'DELETE', resource: 'subscription',
    resourceId: sub.id, req,
  });

  await pushNotification({
    institutionId,
    type:    'uyari',
    title:   'Abonelik İptal Edildi',
    message: 'Aboneliğiniz dönem sonuna kadar aktif kalmaya devam edecek.',
  });

  return { cancelled: true };
}

// ── FATURA ───────────────────────────────────────────────────

async function createInvoice({ subscriptionId, institutionId, amountTRY, provider, paymentId }) {
  const invoiceNumber = generateInvoiceNumber();
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const { rows } = await db.query(
    `INSERT INTO invoices
       (subscription_id, institution_id, invoice_number, amount_try, currency, status,
        period_start, period_end, paid_at, iyzico_payment_id, line_items)
     VALUES ($1,$2,$3,$4,'TRY','paid',NOW(),$5,NOW(),$6,$7)
     RETURNING *`,
    [subscriptionId, institutionId, invoiceNumber, amountTRY, periodEnd,
     provider === 'iyzico' ? paymentId : null,
     JSON.stringify([{ description: 'Operio Aylık Abonelik', amount: amountTRY }])]
  );

  return rows[0];
}

async function getInvoices(institutionId, limit = 12) {
  const { rows } = await db.query(
    `SELECT * FROM invoices WHERE institution_id=$1 ORDER BY created_at DESC LIMIT $2`,
    [institutionId, limit]
  );
  return rows;
}

// ── LİMİT KONTROL ────────────────────────────────────────────

/**
 * Kurumun planına göre limitleri kontrol et
 * Middleware olarak kullanılabilir
 */
async function checkPlanLimit({ institutionId, resource }) {
  const sub = await getSubscription(institutionId);
  if (!sub) return { allowed: false, reason: 'Aktif abonelik yok' };
  if (sub.status === 'trial') return { allowed: true, isTrial: true };
  if (!['active'].includes(sub.status)) return { allowed: false, reason: 'Abonelik aktif değil' };

  if (resource === 'rooms' && sub.max_rooms !== -1) {
    const { rows } = await db.query(
      'SELECT COUNT(*) FROM operating_rooms WHERE institution_id=$1', [institutionId]
    );
    const count = parseInt(rows[0].count);
    if (count >= sub.max_rooms) {
      return { allowed: false, reason: `${sub.plan_name} planı en fazla ${sub.max_rooms} salon destekler` };
    }
  }

  if (resource === 'users' && sub.max_users !== -1) {
    const { rows } = await db.query(
      'SELECT COUNT(*) FROM users WHERE institution_id=$1 AND is_active=TRUE', [institutionId]
    );
    const count = parseInt(rows[0].count);
    if (count >= sub.max_users) {
      return { allowed: false, reason: `${sub.plan_name} planı en fazla ${sub.max_users} kullanıcı destekler` };
    }
  }

  return { allowed: true };
}

module.exports = {
  getPlans, getPlan,
  validateCoupon,
  startTrial,
  getSubscription,
  initiateIyzicoCheckout, verifyIyzicoPayment,
  initiateStripeCheckout, handleStripeWebhook,
  cancelSubscription,
  createInvoice, getInvoices,
  checkPlanLimit,
};
