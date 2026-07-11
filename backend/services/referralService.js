const User = require('../models/User');
const Referral = require('../models/Referral');
const Transaction = require('../models/Transaction');
const { generateReference } = require('../utils/helpers');
const { notifyTransaction } = require('./notificationService');

const WELCOME_BONUS = 50; // ₦ credited to a new signup who used a referral code, on verification
const REFERRER_BONUS = 100; // ₦ credited to the referrer once their friend completes a first real purchase

/**
 * Call this right after a user's phone is verified. If they signed up via a
 * referral code, credits their one-time welcome bonus and creates the
 * Referral record (status stays 'pending' until they actually buy something).
 */
async function handleVerificationBonus(userId) {
  const user = await User.findById(userId);
  if (!user || !user.referredBy) return;

  const existing = await Referral.findOne({ referredUser: user._id });
  if (existing) return; // already handled - don't double-pay on re-verification attempts

  const referral = await Referral.create({ referrer: user.referredBy, referredUser: user._id });

  user.walletBalance += WELCOME_BONUS;
  await user.save();

  await Transaction.create({
    user: user._id,
    category: 'referral-bonus',
    amount: WELCOME_BONUS,
    status: 'success',
    reference: generateReference('REFWELCOME')
  });

  const welcomeTxn = { category: 'referral-bonus', amount: WELCOME_BONUS, status: 'success' };
  notifyTransaction(user, welcomeTxn, { kind: 'referral-welcome' });

  referral.welcomeBonusPaid = true;
  await referral.save();
}

/**
 * Call this after ANY successful purchase. If this was the buyer's first
 * ever successful real purchase (not wallet-funding/speedtest/referral
 * credits) AND they were referred by someone, pays the referrer their bonus
 * exactly once.
 */
async function maybeAwardReferrerBonus(userId) {
  const referral = await Referral.findOne({ referredUser: userId, status: 'pending' });
  if (!referral) return;

  const realPurchaseCount = await Transaction.countDocuments({
    user: userId,
    status: 'success',
    category: { $nin: ['wallet-funding', 'speedtest-bonus', 'referral-bonus'] }
  });

  if (realPurchaseCount !== 1) return; // not their first real purchase - nothing to do

  const referrer = await User.findById(referral.referrer);
  if (!referrer) return;

  referrer.walletBalance += REFERRER_BONUS;
  await referrer.save();

  await Transaction.create({
    user: referrer._id,
    category: 'referral-bonus',
    amount: REFERRER_BONUS,
    status: 'success',
    reference: generateReference('REFBONUS')
  });

  const referrerTxn = { category: 'referral-bonus', amount: REFERRER_BONUS, status: 'success' };
  notifyTransaction(referrer, referrerTxn, { kind: 'referral-referrer' });

  referral.status = 'completed';
  referral.referrerBonusPaid = true;
  referral.completedAt = new Date();
  await referral.save();
}

module.exports = { handleVerificationBonus, maybeAwardReferrerBonus, WELCOME_BONUS, REFERRER_BONUS };
