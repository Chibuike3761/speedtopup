const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: {
      type: String,
      enum: [
        'airtime',
        'data',
        'tv',
        'electricity',
        'water',
        'waec',
        'neco',
        'wallet-funding',
        'speedtest-bonus',
        'referral-bonus',
        'loyalty-redemption'
      ],
      required: true
    },
    serviceID: String, // e.g. 'mtn', 'dstv', 'ikeja-electric'
    variationCode: String,
    billersCode: String, // meter no. / smartcard no. / phone
    recipientEmail: String, // optional - currently only used by WAEC so the PIN/serial can go to whoever needs it, not just the account owner
    amount: { type: Number, required: true },
    discountApplied: { type: Number, default: 0 }, // ₦ shaved off by a first-purchase speedtest voucher, for reporting/capping
    status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
    reference: { type: String, required: true, unique: true },
    provider: { type: String, enum: ['paystack', 'crypto'], default: 'paystack' }, // only meaningful for wallet-funding
    providerResponse: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
