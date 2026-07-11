const User = require('../models/User');
const Transaction = require('../models/Transaction');
const vtpass = require('./vtpassService');
const { generateReference } = require('../utils/helpers');
const { maybeAwardReferrerBonus } = require('./referralService');
const { notifyTransaction } = require('./notificationService');
const { awardPurchasePoints } = require('./loyaltyService');

// Ceiling on how many naira the one-time speedtest discount can be worth,
// regardless of order size - a 2% voucher on a huge order shouldn't turn
// into a huge giveaway. Kept here (not on the route) so it applies no
// matter which screen/flow the purchase comes through.
const DISCOUNT_MAX_NAIRA = 500;
const DISCOUNT_VALIDITY_DAYS = 30;

// If VTpass still hasn't confirmed a transaction one way or the other after
// this long, we stop waiting on them and auto-refund the customer - money
// should never be silently stuck in limbo. See requery scheduler.
const STUCK_TIMEOUT_HOURS = 2;

/**
 * Figures out whether this purchase qualifies for the user's speedtest
 * discount voucher, and if so, how many naira it's worth (already capped).
 * Returns 0 whenever the voucher doesn't apply - unearned, already used,
 * expired, or this wouldn't be the user's first real purchase.
 */
async function getDiscountAmount(user, amount) {
  if (!user.speedtestDiscountPercent || user.speedtestDiscountUsedAt || !user.speedtestDiscountEarnedAt) return 0;

  const expiresAt = new Date(user.speedtestDiscountEarnedAt.getTime() + DISCOUNT_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
  if (Date.now() > expiresAt.getTime()) return 0;

  // "First real purchase" mirrors the referral system's definition - funding
  // the wallet or previous bonus payouts don't count against this.
  const priorRealPurchases = await Transaction.countDocuments({
    user: user._id,
    status: 'success',
    category: { $nin: ['wallet-funding', 'referral-bonus'] }
  });
  if (priorRealPurchases > 0) return 0;

  return Math.min(Math.round((Number(amount) * user.speedtestDiscountPercent) / 100), DISCOUNT_MAX_NAIRA);
}

/** Reverses a debit (and gives back an unused discount voucher, if one was spent) on failure. */
async function refundToWallet(user, amountToCharge, discountAmount) {
  user.walletBalance += amountToCharge;
  if (discountAmount > 0) user.speedtestDiscountUsedAt = null; // give the voucher back so they can retry
  await user.save();
}

/**
 * Applies the side effects of a transaction settling as SUCCESS - referral
 * bonus check, loyalty points, notification. Shared by the initial purchase
 * call AND by the later requery path, since VTpass sometimes confirms a
 * purchase minutes after the initial call came back "pending".
 */
async function onSuccess(user, txn, amountToCharge) {
  try {
    await maybeAwardReferrerBonus(user._id);
  } catch (refErr) {
    console.error('Referral bonus check failed:', refErr.message);
  }
  const pointsEarned = await awardPurchasePoints(user, amountToCharge);
  notifyTransaction(user, txn, { pointsEarned });
  return pointsEarned;
}

/**
 * Takes a VTpass response code (from either /pay or /requery) and moves the
 * transaction to its next state, running the matching side effects. Central
 * so "success" and "failed" mean the same thing everywhere they can happen.
 */
async function settleFromProviderResponse({ user, txn, result, amountToCharge, discountAmount }) {
  const newStatus = result.code === '000' ? 'success' : result.code === '099' ? 'pending' : 'failed';
  const changed = newStatus !== txn.status;
  txn.status = newStatus;
  txn.providerResponse = result;
  await txn.save();

  if (!changed) return { pointsEarned: 0 };

  if (newStatus === 'failed') {
    await refundToWallet(user, amountToCharge, discountAmount);
    notifyTransaction(user, txn);
    return { pointsEarned: 0 };
  }

  if (newStatus === 'success') {
    const pointsEarned = await onSuccess(user, txn, amountToCharge);
    return { pointsEarned };
  }

  return { pointsEarned: 0 }; // still pending - nothing to do yet
}

/**
 * Runs one purchase end-to-end: validates, debits the wallet, calls VTpass,
 * and reverses the debit if anything fails. Shared by:
 *  - the manual "Buy Now" button (routes/services.js)
 *  - the auto top-up scheduler (services/autoTopUpScheduler.js)
 * so both go through exactly the same money-safety logic.
 */
async function executePurchase({ userId, category, serviceID, variationCode, amount, phone, billersCode }) {
  if (!category || !serviceID || !amount) {
    return { ok: false, error: 'category, serviceID and amount are required' };
  }
  if (category === 'neco') {
    return { ok: false, error: 'NECO PIN vending is not available yet - no aggregator currently supports it.' };
  }
  if (category === 'water') {
    return { ok: false, error: 'Water bill payment is not available yet - no national aggregator API exists for it currently.' };
  }

  const user = await User.findById(userId);
  if (!user) return { ok: false, error: 'User not found' };

  // Discount is computed server-side only, capped, and only ever valid for a
  // user's first real purchase - see getDiscountAmount() above.
  const discountAmount = await getDiscountAmount(user, amount);
  const amountToCharge = Number(amount) - discountAmount;

  if (user.walletBalance < amountToCharge) {
    return { ok: false, error: 'Insufficient wallet balance. Please fund your wallet.' };
  }

  const reference = generateReference(category.toUpperCase());

  user.walletBalance -= amountToCharge;
  if (discountAmount > 0) user.speedtestDiscountUsedAt = new Date();
  await user.save();

  const txn = await Transaction.create({
    user: user._id,
    category,
    serviceID,
    variationCode,
    billersCode,
    amount,
    discountApplied: discountAmount,
    status: 'pending',
    reference
  });

  try {
    // The full nominal amount is still requested from VTpass - the service
    // delivered is worth full value; the discount is what NaijaFast absorbs.
    const result = await vtpass.purchase({ requestId: reference, serviceID, variationCode, amount, phone, billersCode });
    const { pointsEarned } = await settleFromProviderResponse({ user, txn, result, amountToCharge, discountAmount });

    if (txn.status === 'failed') {
      return { ok: false, error: result.response_description || 'Purchase failed', reference };
    }

    return {
      ok: true,
      message: txn.status === 'pending'
        ? "Purchase is processing - we'll keep checking automatically and email you the moment it confirms."
        : 'Purchase successful',
      reference,
      status: txn.status,
      balance: user.walletBalance,
      discountApplied: discountAmount,
      pointsEarned,
      loyaltyPoints: user.loyaltyPoints,
      providerResponse: result
    };
  } catch (err) {
    await refundToWallet(user, amountToCharge, discountAmount);
    txn.status = 'failed';
    txn.providerResponse = { error: err.message };
    await txn.save();
    notifyTransaction(user, txn);

    if (err.code === 'VTPASS_NOT_CONFIGURED') {
      return { ok: false, error: err.message, code: err.code };
    }
    console.error('VTpass error:', err.response?.data || err.message);
    return { ok: false, error: 'The service provider could not be reached. Please try again shortly.' };
  }
}

/**
 * Re-checks a still-pending transaction against VTpass's /requery endpoint
 * and settles it if VTpass now has a definite answer. Safe to call on a
 * transaction that has already settled - it's a no-op. Used by:
 *  - the transaction status API (routes/transactions.js), for a user hitting
 *    "refresh" on the live status tracker
 *  - the pending-transaction scheduler, which does this automatically so
 *    most people never have to check manually at all
 */
async function requeryAndSettle(txn) {
  if (txn.status !== 'pending') {
    return { ok: true, status: txn.status, changed: false };
  }

  const user = await User.findById(txn.user);
  if (!user) return { ok: false, error: 'User not found' };

  const amountToCharge = Number(txn.amount) - Number(txn.discountApplied || 0);

  try {
    const result = await vtpass.requery(txn.reference);
    const statusBefore = txn.status;
    await settleFromProviderResponse({ user, txn, result, amountToCharge, discountAmount: txn.discountApplied || 0 });
    return { ok: true, status: txn.status, changed: txn.status !== statusBefore };
  } catch (err) {
    if (err.code === 'VTPASS_NOT_CONFIGURED') {
      return { ok: true, status: txn.status, changed: false, note: 'VTpass is not configured, so status can\'t be refreshed live yet.' };
    }
    console.error(`Requery failed for ${txn.reference}:`, err.response?.data || err.message);
    return { ok: true, status: txn.status, changed: false, note: 'Could not reach the provider to refresh status just now.' };
  }
}

/**
 * Last-resort safety net for a transaction that's been pending for so long
 * (STUCK_TIMEOUT_HOURS) that we stop waiting on VTpass and refund the
 * customer ourselves. Only called by the scheduler, and only once requery
 * has already been tried and still came back inconclusive.
 */
async function forceRefundStuckTransaction(txn) {
  const user = await User.findById(txn.user);
  if (!user) return;

  const amountToCharge = Number(txn.amount) - Number(txn.discountApplied || 0);

  txn.status = 'failed';
  txn.providerResponse = {
    ...(txn.providerResponse || {}),
    autoRefunded: true,
    reason: `No confirmation from the provider after ${STUCK_TIMEOUT_HOURS}h - auto-refunded for safety`
  };
  await txn.save();

  await refundToWallet(user, amountToCharge, txn.discountApplied || 0);
  notifyTransaction(user, txn);
}

module.exports = { executePurchase, requeryAndSettle, forceRefundStuckTransaction, STUCK_TIMEOUT_HOURS };
