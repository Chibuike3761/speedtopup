const mongoose = require('mongoose');

/**
 * One document per WhatsApp phone number mid-order. Stateless webhooks need
 * *something* to remember "this number picked Data, then MTN, now waiting
 * for a phone number" between messages - this is that memory.
 *
 * TTL-expires after 10 minutes of inactivity (see `updatedAt` index) so an
 * abandoned order doesn't confuse someone who messages again next week.
 */
const whatsappSessionSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true }, // WhatsApp wa_id, digits only e.g. "2348012345678"
  step: { type: String, default: 'category' }, // category | network | variation | billers | amount | confirm
  category: String,
  serviceID: String,
  serviceLabel: String,
  variationCode: String,
  variationLabel: String,
  billersCode: String,
  amount: Number,
  // Whatever list of options was just offered (variation plans, meter types) -
  // WhatsApp list replies only give back a short id, so we stash the real
  // data here and look it up by index when the reply comes in.
  pendingOptions: [{ code: String, label: String, amount: Number }],
  updatedAt: { type: Date, default: Date.now, expires: 600 }
});

module.exports = mongoose.model('WhatsAppSession', whatsappSessionSchema);
