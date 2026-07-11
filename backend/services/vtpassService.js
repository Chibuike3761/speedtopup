const axios = require('axios');

function getClient() {
  return axios.create({
    baseURL: process.env.VTPASS_BASE_URL || 'https://sandbox.vtpass.com/api',
    headers: {
      'api-key': process.env.VTPASS_API_KEY,
      'secret-key': process.env.VTPASS_SECRET_KEY,
      'Content-Type': 'application/json'
    }
  });
}

function assertConfigured() {
  if (!process.env.VTPASS_API_KEY || !process.env.VTPASS_SECRET_KEY) {
    const err = new Error(
      'VTpass is not configured yet. Add VTPASS_API_KEY / VTPASS_PUBLIC_KEY / VTPASS_SECRET_KEY to your .env (see .env.example) after signing up at vtpass.com.'
    );
    err.code = 'VTPASS_NOT_CONFIGURED';
    throw err;
  }
}

/** GET available variations for a service (data bundles, TV bouquets, electricity type) */
async function getVariations(serviceID) {
  assertConfigured();
  const client = axios.create({
    baseURL: process.env.VTPASS_BASE_URL || 'https://sandbox.vtpass.com/api',
    headers: {
      'api-key': process.env.VTPASS_API_KEY,
      'public-key': process.env.VTPASS_PUBLIC_KEY
    }
  });
  const res = await client.get('/service-variations', { params: { serviceID } });
  return res.data;
}

/** Verify a billersCode before payment (meter number, smartcard number) */
async function verifyBillersCode({ serviceID, billersCode, type }) {
  assertConfigured();
  const client = getClient();
  const res = await client.post('/merchant-verify', { serviceID, billersCode, type });
  return res.data;
}

/**
 * Generic purchase call. VTpass uses ONE endpoint (/pay) for every category -
 * airtime, data, tv, electricity, education pins - the payload shape just
 * varies slightly per category.
 */
async function purchase({ requestId, serviceID, variationCode, amount, phone, billersCode }) {
  assertConfigured();
  const client = getClient();

  const payload = { request_id: requestId, serviceID };
  if (variationCode) payload.variation_code = variationCode;
  if (amount) payload.amount = amount;
  if (phone) payload.phone = phone;
  if (billersCode) payload.billersCode = billersCode;

  const res = await client.post('/pay', payload);
  return res.data;
}

/** Requery a transaction status (VTpass recommends this if a purchase times out) */
async function requery(requestId) {
  assertConfigured();
  const client = getClient();
  const res = await client.post('/requery', { request_id: requestId });
  return res.data;
}

module.exports = { getVariations, verifyBillersCode, purchase, requery };
