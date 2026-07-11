const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema(
  {
    referrer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    referredUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' }, // completed = referrer bonus paid
    welcomeBonusPaid: { type: Boolean, default: false }, // paid to the new signup on verification
    referrerBonusPaid: { type: Boolean, default: false }, // paid to the referrer on the friend's first purchase
    completedAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Referral', referralSchema);
