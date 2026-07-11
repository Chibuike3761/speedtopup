const mongoose = require('mongoose');

const autoTopUpSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    label: { type: String, required: true }, // shown in the UI, e.g. "Mum's MTN Data"
    category: { type: String, required: true },
    serviceID: { type: String, required: true },
    variationCode: { type: String },
    billersCode: { type: String, required: true }, // phone/meter/smartcard
    amount: { type: Number, required: true },
    frequencyDays: { type: Number, required: true }, // 1 = daily, 7 = weekly, 30 = monthly
    active: { type: Boolean, default: true },
    nextRunAt: { type: Date, required: true },
    lastRunAt: { type: Date },
    lastStatus: { type: String, enum: ['success', 'failed', null], default: null },
    lastMessage: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model('AutoTopUp', autoTopUpSchema);
