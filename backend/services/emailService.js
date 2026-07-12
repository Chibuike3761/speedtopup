const axios = require('axios');

/**
 * Sends an email via Resend (https://resend.com).
 * If RESEND_API_KEY is not set, runs in DEV MODE: logs the email to the
 * console instead of sending a real one, so you can test the whole
 * notification flow for free before paying for anything.
 */
async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`\n📧 [DEV MODE] Email to ${to}\nSubject: ${subject}\n${htmlToPlainPreview(html)}\n`);
    return { devMode: true };
  }

  try {
    const res = await axios.post(
      'https://api.resend.com/emails',
      {
        from: process.env.RESEND_FROM_EMAIL || 'Speed Topup Data <onboarding@resend.dev>',
        to,
        subject,
        html
      },
      { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
    );
    return res.data;
  } catch (err) {
    // Notifications should never break the transaction they're about -
    // log and move on rather than throwing.
    console.error('Resend send error:', err.response?.data || err.message);
    return { error: true };
  }
}

// Rough HTML -> plain-text so dev-mode console logs are actually readable.
function htmlToPlainPreview(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { sendEmail };
