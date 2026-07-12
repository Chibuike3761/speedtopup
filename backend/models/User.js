const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    walletBalance: { type: Number, default: 0 }, // cash, in Naira
    // One-time reward for running a speed test: a % off the user's first real purchase.
    // Earned once ever (not per test), only while isVerified, and expires if unused.
    speedtestDiscountPercent: { type: Number, default: 0 },
    speedtestDiscountEarnedAt: { type: Date, default: null },
    speedtestDiscountUsedAt: { type: Date, default: null },
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isAdmin: { type: Boolean, default: false },
    loyaltyPoints: { type: Number, default: 0 }, // 1 point per ₦100 spent on real purchases
    // Password reset: only a hash of the token is ever stored (like a
    // password itself) so a database leak alone can't be used to reset
    // anyone's account - the raw token only ever exists in the emailed link.
    resetPasswordTokenHash: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
