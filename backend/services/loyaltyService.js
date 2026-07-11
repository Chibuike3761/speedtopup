const Transaction = require('../models/Transaction');
const { generateReference } = require('../utils/helpers');
const { notifyTransaction } = require('./notificationService');

// Earn 1 point per ₦100 spent on a real purchase (airtime, data, TV,
// electricity, WAEC - never on wallet funding, which isn't a sale).
const NAIRA_PER_POINT = 100;

// Redeem in blocks of 100 points for ₦50 cashback each (₦0.50 per point).
// Blocking it this way keeps the numbers round and gives a reason to keep
// coming back rather than cashing out one point at a time.
const REDEMPTION_BLOCK_POINTS = 100;
const REDEMPTION_BLOCK_VALUE = 50;

/**
 * Called right after a purchase settles to 'success'. Never throws - a
 * points-award hiccup should never break the purchase it's rewarding.
 * Returns the number of points actually awarded (0 if none).
 */
async function awardPurchasePoints(user, amountSpent) {
  try {
    const points = Math.floor(Number(amountSpent) / NAIRA_PER_POINT);
    if (points <= 0) return 0;
    user.loyaltyPoints += points;
    await user.save();
    return points;
  } catch (err) {
    console.error('awardPurchasePoints failed:', err.message);
    return 0;
  }
}

/**
 * Converts a block of points into wallet cashback. Points must be redeemed
 * in multiples of REDEMPTION_BLOCK_POINTS (100) - partial blocks don't
 * convert to a fraction of a naira, they just don't redeem.
 */
async function redeemPoints(user, pointsToRedeem) {
  const points = Number(pointsToRedeem);

  if (!Number.isInteger(points) || points <= 0) {
    return { ok: false, error: 'Enter a valid number of points to redeem.' };
  }
  if (points % REDEMPTION_BLOCK_POINTS !== 0) {
    return { ok: false, error: `Points must be redeemed in blocks of ${REDEMPTION_BLOCK_POINTS}.` };
  }
  if (points > user.loyaltyPoints) {
    return { ok: false, error: `You only have ${user.loyaltyPoints} points available.` };
  }

  const cashback = (points / REDEMPTION_BLOCK_POINTS) * REDEMPTION_BLOCK_VALUE;

  user.loyaltyPoints -= points;
  user.walletBalance += cashback;
  await user.save();

  const txn = await Transaction.create({
    user: user._id,
    category: 'loyalty-redemption',
    amount: cashback,
    status: 'success',
    reference: generateReference('LOYALTY')
  });

  notifyTransaction(user, txn, { kind: 'loyalty-redemption' });

  return { ok: true, cashback, pointsRedeemed: points, balance: user.walletBalance, remainingPoints: user.loyaltyPoints };
}

function redeemableValue(points) {
  const blocks = Math.floor(points / REDEMPTION_BLOCK_POINTS);
  return blocks * REDEMPTION_BLOCK_VALUE;
}

module.exports = {
  NAIRA_PER_POINT,
  REDEMPTION_BLOCK_POINTS,
  REDEMPTION_BLOCK_VALUE,
  awardPurchasePoints,
  redeemPoints,
  redeemableValue
};
