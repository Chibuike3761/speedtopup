const axios = require('axios');
const crypto = require('crypto');

function assertConfigured() {
  if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    const err = new Error(
      'WhatsApp is not configured yet. Add WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID (see .env.example) after setting up a Meta WhatsApp Business app.'
    );
    err.code = 'WHATSAPP_NOT_CONFIGURED';
    throw err;
  }
}

function getClient() {
  return axios.create({
    baseURL: `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}`,
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
}

/** Plain text message. */
async function sendText(to, body) {
  assertConfigured();
  await getClient().post('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body }
  });
}

/**
 * Interactive list message - up to 10 rows total across all sections. This
 * is what powers the category/network/plan pickers, since it gives people
 * a tap-to-select menu instead of having to type an exact category name.
 * sections: [{ title, rows: [{ id, title, description? }] }]
 */
async function sendList(to, body, buttonText, sections) {
  assertConfigured();
  await getClient().post('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      action: { button: buttonText, sections }
    }
  });
}

/**
 * Verifies the X-Hub-Signature-256 header Meta sends on every webhook POST,
 * proving the payload actually came from Meta and not from someone who
 * guessed the webhook URL. Requires WHATSAPP_APP_SECRET to be set; if it
 * isn't, we fail closed (reject) rather than silently skip verification.
 */
function verifySignature(rawBody, signatureHeader) {
  if (!process.env.WHATSAPP_APP_SECRET) return false;
  if (!signatureHeader || !rawBody) return false;

  const expected = 'sha256=' + crypto.createHmac('sha256', process.env.WHATSAPP_APP_SECRET).update(rawBody).digest('hex');

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

module.exports = { sendText, sendList, verifySignature };
