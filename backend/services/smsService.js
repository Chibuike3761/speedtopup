const axios = require('axios');

/**
 * Sends an OTP SMS via Termii (https://termii.com).
 * If TERMII_API_KEY is not set, runs in DEV MODE: logs the code to the
 * console instead of sending a real SMS, so you can test the full flow
 * for free before paying for SMS credits.
 */
async function sendOtpSms(phone, code) {
  const apiKey = process.env.TERMII_API_KEY;

  if (!apiKey) {
    console.log(`\n📩 [DEV MODE] OTP for ${phone}: ${code}\n`);
    return { devMode: true };
  }

  try {
    const res = await axios.post('https://api.ng.termii.com/api/sms/send', {
      to: phone,
      from: process.env.TERMII_SENDER_ID || 'NaijaFast',
      sms: `Your NaijaFast Data verification code is ${code}. It expires in 10 minutes.`,
      type: 'plain',
      channel: 'dnd',
      api_key: apiKey
    });
    return res.data;
  } catch (err) {
    console.error('Termii send error:', err.response?.data || err.message);
    throw new Error('Failed to send OTP SMS');
  }
}

module.exports = { sendOtpSms };
