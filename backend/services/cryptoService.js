const axios = require('axios');

// NOWPayments (nowpayments.io) lets us accept USDT, BTC, BNB, and 300+ other
// coins through one hosted invoice, the same way Paystack gives us one hosted
// checkout for cards/bank transfer. The customer picks their coin on
// NOWPayments' own page - we never touch wallet addresses or private keys.

function getClient() {
  return axios.create({
    baseURL: 'https://api.nowpayments.io/v1',
    headers: {
      'x-api-key': process.env.NOWPAYMENTS_API_KEY,
      'Content-Type': 'application/json'
    }
  });
}

function assertConfigured() {
  if (!process.env.NOWPAYMENTS_API_KEY) {
    const err = new Error(
      'Crypto payments are not configured yet. Add NOWPAYMENTS_API_KEY to your .env (see .env.example) after signing up at nowpayments.io.'
    );
    err.code = 'CRYPTO_NOT_CONFIGURED';
    throw err;
  }
}

/**
 * Starts a crypto payment - returns a hosted invoice URL where the customer
 * picks USDT / BTC / BNB / etc. and pays. The price is fixed in NGN;
 * NOWPayments converts it to the coin's live rate on their own page.
 */
async function initializeInvoice({ amountNaira, reference, callbackUrl }) {
  assertConfigured();
  const client = getClient();
  const res = await client.post('/invoice', {
    price_amount: amountNaira,
    price_currency: 'ngn',
    order_id: reference,
    order_description: 'Speed Topup wallet funding',
    ipn_callback_url: callbackUrl,
    success_url: `${callbackUrl}?provider=crypto&reference=${encodeURIComponent(reference)}`,
    cancel_url: `${callbackUrl}?provider=crypto&reference=${encodeURIComponent(reference)}&cancelled=1`
  });
  return res.data; // { id, invoice_url, order_id, price_amount, ... }
}

/**
 * The only source of truth for "did this crypto payment actually settle" -
 * never trust a client-supplied amount or status, always verify here using
 * the NOWPayments payment id.
 */
async function verifyPayment(paymentId) {
  assertConfigured();
  const client = getClient();
  const res = await client.get(`/payment/${encodeURIComponent(paymentId)}`);
  return res.data; // { payment_status, order_id, price_amount, actually_paid, pay_currency, ... }
}

/**
 * Looks up the live minimum payment amount for a coin pair. We check the
 * USDT-TRC20 mono-currency pair by default since it's the cheapest/most
 * common network for USDT and matches NOWPayments' own recommended way to
 * spot-check minimums. fiat_equivalent lets us also show the NGN estimate.
 */
async function getMinAmount({ currencyFrom = 'usdttrc20', currencyTo = 'usdttrc20', fiatEquivalent = 'ngn' } = {}) {
  assertConfigured();
  const client = getClient();
  const res = await client.get('/min-amount', {
    params: {
      currency_from: currencyFrom,
      currency_to: currencyTo,
      fiat_equivalent: fiatEquivalent
    }
  });
  return res.data; // { min_amount, fiat_equivalent }
}

module.exports = { initializeInvoice, verifyPayment, getMinAmount };
