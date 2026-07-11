const axios = require('axios');

function getClient() {
  return axios.create({
    baseURL: 'https://api.paystack.co',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json'
    }
  });
}

function assertConfigured() {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    const err = new Error(
      'Paystack is not configured yet. Add PAYSTACK_SECRET_KEY to your .env (see .env.example) after signing up at paystack.com.'
    );
    err.code = 'PAYSTACK_NOT_CONFIGURED';
    throw err;
  }
}

/** Starts a payment - returns a hosted checkout URL to send the user to. */
async function initializeTransaction({ email, amountKobo, reference, callbackUrl }) {
  assertConfigured();
  const client = getClient();
  const res = await client.post('/transaction/initialize', {
    email,
    amount: amountKobo,
    reference,
    callback_url: callbackUrl
  });
  return res.data; // { status, data: { authorization_url, access_code, reference } }
}

/**
 * The only source of truth for "did this payment actually succeed, and for
 * how much" - never trust a client-supplied amount, always verify here.
 */
async function verifyTransaction(reference) {
  assertConfigured();
  const client = getClient();
  const res = await client.get(`/transaction/verify/${encodeURIComponent(reference)}`);
  return res.data; // { status, data: { status: 'success'|'failed', amount, ... } }
}

module.exports = { initializeTransaction, verifyTransaction };
