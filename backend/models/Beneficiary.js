const mongoose = require('mongoose');

const beneficiarySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    label: { type: String, required: true, trim: true }, // e.g. "Mum's Phone", "House Meter"
    category: { type: String, required: true }, // airtime, data, tv, electricity, waec
    serviceID: { type: String, required: true }, // mtn, dstv, ikeja-electric, etc.
    billersCode: { type: String, required: true }, // phone number / meter number / smartcard number
    variationCode: { type: String } // remembered plan/bouquet, optional
  },
  { timestamps: true }
);

module.exports = mongoose.model('Beneficiary', beneficiarySchema);
