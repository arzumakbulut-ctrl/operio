/**
 * Ödeme Sağlayıcı Soyutlama Katmanı
 *
 * İyzico ve Stripe aynı arayüzden geçer.
 * Gelecekte başka sağlayıcı eklemek için sadece bu dosyayı genişletin.
 *
 * Her sağlayıcı şu metodları implemente eder:
 *   createCheckout(opts)   → { checkoutUrl, referenceCode }
 *   createSubscription(opts) → { subscriptionId, status }
 *   cancelSubscription(id)   → boolean
 *   getSubscription(id)      → { status, currentPeriodEnd }
 *   handleWebhook(payload, signature) → { type, data }
 */

const Iyzipay = require('iyzipay');
const Stripe  = require('stripe');

// ── İYZİCO PROVIDER ──────────────────────────────────────────

class IyzicoProvider {
  constructor() {
    this.client = new Iyzipay({
      apiKey:    process.env.IYZICO_API_KEY    || 'sandbox-key',
      secretKey: process.env.IYZICO_SECRET_KEY || 'sandbox-secret',
      uri:       process.env.IYZICO_BASE_URL   || 'https://sandbox-api.iyzipay.com',
    });
  }

  /**
   * İyzico Checkout Form başlat
   * @param {object} opts
   * @param {string} opts.referenceCode    — benzersiz sipariş kodu
   * @param {number} opts.amountTRY        — kuruş cinsinden (290000 = ₺2900)
   * @param {object} opts.buyer            — { id, name, surname, email, phone, address, city, country, ip }
   * @param {object} opts.billingAddress   — { contactName, city, country, address }
   * @param {Array}  opts.basketItems      — [{ id, name, price, category, itemType }]
   * @param {string} opts.callbackUrl      — ödeme sonrası yönlendirme
   */
  async createCheckout({ referenceCode, amountTRY, buyer, billingAddress, basketItems, callbackUrl }) {
    return new Promise((resolve, reject) => {
      const price = (amountTRY / 100).toFixed(2); // kuruş → TL

      const request = {
        locale:           Iyzipay.LOCALE.TR,
        conversationId:   referenceCode,
        price,
        paidPrice:        price,
        currency:         Iyzipay.CURRENCY.TRY,
        basketId:         referenceCode,
        paymentGroup:     Iyzipay.PAYMENT_GROUP.SUBSCRIPTION,
        callbackUrl:      callbackUrl || process.env.PAYMENT_SUCCESS_URL,
        enabledInstallments: [1, 2, 3, 6, 9, 12],

        buyer: {
          id:                  buyer.id,
          name:                buyer.name,
          surname:             buyer.surname,
          gsmNumber:           buyer.phone || '+905551234567',
          email:               buyer.email,
          identityNumber:      buyer.identityNumber || '11111111110',
          registrationAddress: buyer.address || 'İstanbul',
          ip:                  buyer.ip || '85.34.78.112',
          city:                buyer.city || 'İstanbul',
          country:             buyer.country || 'Turkey',
        },

        shippingAddress: billingAddress,
        billingAddress,

        basketItems: basketItems.map(item => ({
          id:          item.id,
          name:        item.name,
          category1:   item.category || 'SaaS',
          itemType:    Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
          price:       (item.price / 100).toFixed(2),
        })),
      };

      this.client.checkoutFormInitialize.create(request, (err, result) => {
        if (err) return reject(new Error('İyzico checkout başlatılamadı: ' + err));
        if (result.status !== 'success') {
          return reject(new Error('İyzico hatası: ' + result.errorMessage));
        }
        resolve({
          checkoutFormContent: result.checkoutFormContent, // HTML form
          token:               result.token,
          referenceCode,
          provider:            'iyzico',
        });
      });
    });
  }

  /**
   * Ödeme sonucunu doğrula (callback'ten sonra)
   */
  async verifyCheckout(token) {
    return new Promise((resolve, reject) => {
      this.client.checkoutForm.retrieve(
        { locale: Iyzipay.LOCALE.TR, token },
        (err, result) => {
          if (err) return reject(err);
          resolve({
            success:         result.status === 'success' && result.paymentStatus === 'SUCCESS',
            conversationId:  result.conversationId,
            paymentId:       result.paymentId,
            paidPrice:       result.paidPrice,
            raw:             result,
          });
        }
      );
    });
  }

  async cancelSubscription(subscriptionReferenceCode) {
    // İyzico abonelik iptali — sandbox'ta simüle
    return { cancelled: true, subscriptionReferenceCode };
  }

  async handleWebhook(payload) {
    // İyzico webhook imza doğrulama (üretimde implement edilmeli)
    return { type: payload.status, data: payload };
  }
}

// ── STRIPE PROVIDER ───────────────────────────────────────────

class StripeProvider {
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
      apiVersion: '2024-04-10',
    });
  }

  /**
   * Stripe Checkout Session başlat
   */
  async createCheckout({ referenceCode, planSlug, seatCount, customerEmail, trialDays, couponId }) {
    const priceId = planSlug === 'starter'
      ? process.env.STRIPE_PRICE_STARTER
      : process.env.STRIPE_PRICE_PRO;

    if (!priceId) {
      throw new Error('Stripe fiyat ID yapılandırılmamış');
    }

    const sessionParams = {
      mode:               'subscription',
      payment_method_types: ['card'],
      customer_email:     customerEmail,
      line_items: [{
        price:    priceId,
        quantity: seatCount,
      }],
      subscription_data: {
        trial_period_days: trialDays || 0,
        metadata:          { referenceCode, planSlug },
      },
      metadata:    { referenceCode, planSlug },
      success_url: `${process.env.PAYMENT_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  process.env.PAYMENT_FAIL_URL,
    };

    if (couponId) {
      sessionParams.discounts = [{ coupon: couponId }];
    }

    const session = await this.stripe.checkout.sessions.create(sessionParams);

    return {
      checkoutUrl:   session.url,
      sessionId:     session.id,
      referenceCode,
      provider:      'stripe',
    };
  }

  async cancelSubscription(stripeSubscriptionId) {
    const sub = await this.stripe.subscriptions.cancel(stripeSubscriptionId);
    return { cancelled: sub.status === 'canceled', sub };
  }

  async getSubscription(stripeSubscriptionId) {
    const sub = await this.stripe.subscriptions.retrieve(stripeSubscriptionId);
    return {
      status:           sub.status,
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
    };
  }

  /**
   * Stripe webhook doğrulama
   */
  handleWebhook(rawBody, signature) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET ayarlanmamış');

    const event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    return {
      type: event.type,
      data: event.data.object,
    };
  }
}

// ── FATURA NUMARASI ───────────────────────────────────────────

let _invoiceCounter = 1000;

function generateInvoiceNumber() {
  const year  = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const seq   = String(++_invoiceCounter).padStart(5, '0');
  return `OPR-${year}${month}-${seq}`;
}

// ── SINGLETON EXPORT ──────────────────────────────────────────

module.exports = {
  iyzico:              new IyzicoProvider(),
  stripe:              new StripeProvider(),
  generateInvoiceNumber,
};
