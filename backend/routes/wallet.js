const express = require('express');
const requireAuth = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const paystack = require('../services/paystackService');
const crypto = require('../services/cryptoService');
const { notifyTransaction } = require('../services/notificationService');
const { redeemPoints, REDEMPTION_BLOCK_POINTS, REDEMPTION_BLOCK_VALUE, NAIRA_PER_POINT } = require('../services/loyaltyService');
const { generateReference } = require('../utils/helpers');

const router = express.Router();

// ---------- GET BALANCE ----------
router.get('/', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId)
    .select('walletBalance speedtestDiscountPercent speedtestDiscountEarnedAt speedtestDiscountUsedAt loyaltyPoints');
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    balance: user.walletBalance,
    discount: {
      percent: user.speedtestDiscountPercent,
      earned: !!user.speedtestDiscountEarnedAt,
      used: !!user.speedtestDiscountUsedAt
    },
    loyaltyPoints: user.loyaltyPoints,
    loyaltyRedemptionBlock: REDEMPTION_BLOCK_POINTS,
    loyaltyRedemptionValue: REDEMPTION_BLOCK_VALUE,
    loyaltyEarnRate: NAIRA_PER_POINT
  });
});

// ---------- TRANSACTION HISTORY ----------
router.get('/transactions', requireAuth, async (req, res) => {
  const transactions = await Transaction.find({ user: req.userId }).sort({ createdAt: -1 }).limit(50);
  res.json({ transactions });
});

/**
 * ---------- STEP 1: START A PAYMENT ----------
 * Creates a pending transaction and asks Paystack for a hosted checkout URL.
 * The amount here is just "what we intend to charge" - it is NOT what
 * credits the wallet. Only a verified Paystack response does that (step 2).
 */
router.post('/fund/initialize', requireAuth, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'A valid amount is required' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const reference = generateReference('FUND');

    await Transaction.create({
      user: user._id,
      category: 'wallet-funding',
      amount,
      status: 'pending',
      reference
    });

    const callbackUrl = `${req.protocol}://${req.get('host')}/wallet-callback.html`;

    const result = await paystack.initializeTransaction({
      email: user.email,
      amountKobo: Math.round(amount * 100),
      reference,
      callbackUrl
    });

    if (!result.status) {
      return res.status(502).json({ error: result.message || 'Could not start payment' });
    }

    res.json({
      authorizationUrl: result.data.authorization_url,
      reference
    });
  } catch (err) {
    handlePaystackError(err, res);
  }
});

/**
 * ---------- STEP 2: VERIFY & CREDIT ----------
 * Called after the user returns from Paystack's checkout page. This is the
 * ONLY place the wallet actually gets credited, and only using the amount
 * Paystack itself confirms was paid - never a number the client sent us.
 * Safe to call more than once (e.g. page refresh) - already-settled
 * transactions are simply returned as-is, not credited twice.
 */
router.get('/fund/verify/:reference', requireAuth, async (req, res) => {
  try {
    const { reference } = req.params;

    const txn = await Transaction.findOne({ reference, user: req.userId, category: 'wallet-funding' });
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (txn.status === 'success') {
      return res.json({ success: true, alreadyProcessed: true, balance: user.walletBalance });
    }

    const result = await paystack.verifyTransaction(reference);
    const paid = result?.data?.status === 'success';

    if (!paid) {
      txn.status = 'failed';
      txn.providerResponse = result;
      await txn.save();
      notifyTransaction(user, txn);
      return res.status(400).json({ error: 'Payment was not successful', status: result?.data?.status });
    }

    // Trust ONLY what Paystack confirms was actually paid, in kobo -> naira.
    const confirmedAmount = result.data.amount / 100;

    user.walletBalance += confirmedAmount;
    await user.save();

    txn.status = 'success';
    txn.amount = confirmedAmount;
    txn.providerResponse = result;
    await txn.save();
    notifyTransaction(user, txn);

    res.json({ success: true, balance: user.walletBalance, amount: confirmedAmount });
  } catch (err) {
    handlePaystackError(err, res);
  }
});

function handlePaystackError(err, res) {
  if (err.code === 'PAYSTACK_NOT_CONFIGURED') {
    return res.status(503).json({ error: err.message });
  }
  console.error('Paystack error:', err.response?.data || err.message);
  return res.status(502).json({ error: 'Could not reach the payment provider. Please try again shortly.' });
}

/**
 * ---------- STEP 1 (CRYPTO): START A PAYMENT ----------
 * Same idea as /fund/initialize above, but hands the customer a NOWPayments
 * hosted invoice instead of a Paystack checkout, so they can pay in
 * USDT, BTC, BNB or any other coin NOWPayments supports.
 */
router.post('/fund/crypto/initialize', requireAuth, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'A valid amount is required' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const reference = generateReference('FUNDCRYPTO');

    await Transaction.create({
      user: user._id,
      category: 'wallet-funding',
      provider: 'crypto',
      amount,
      status: 'pending',
      reference
    });

    const callbackUrl = `${req.protocol}://${req.get('host')}/wallet-callback.html`;

    const result = await crypto.initializeInvoice({
      amountNaira: amount,
      reference,
      callbackUrl
    });

    if (!result.invoice_url) {
      return res.status(502).json({ error: 'Could not start crypto payment' });
    }

    res.json({
      invoiceUrl: result.invoice_url,
      reference
    });
  } catch (err) {
    handleCryptoError(err, res);
  }
});

/**
 * ---------- STEP 2 (CRYPTO): VERIFY & CREDIT ----------
 * Called after the customer returns from the NOWPayments invoice page.
 * Only a 'finished' payment_status from NOWPayments credits the wallet -
 * the fixed NGN price we asked for, never a client-supplied number.
 * Safe to call more than once - already-settled transactions are just
 * returned as-is, not credited twice.
 */
router.get('/fund/crypto/verify/:reference', requireAuth, async (req, res) => {
  try {
    const { reference } = req.params;
    const { paymentId } = req.query;

    const txn = await Transaction.findOne({ reference, user: req.userId, category: 'wallet-funding', provider: 'crypto' });
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (txn.status === 'success') {
      return res.json({ success: true, alreadyProcessed: true, balance: user.walletBalance });
    }

    if (!paymentId) return res.status(400).json({ error: 'Missing payment id from crypto provider' });

    const result = await crypto.verifyPayment(paymentId);
    const finished = result?.payment_status === 'finished';

    if (!finished) {
      // Still waiting, confirming, or failed/expired - leave the transaction
      // pending unless the provider has explicitly marked it as failed.
      if (['failed', 'expired', 'refunded'].includes(result?.payment_status)) {
        txn.status = 'failed';
        txn.providerResponse = result;
        await txn.save();
        notifyTransaction(user, txn);
      }
      return res.status(400).json({ error: 'Payment not confirmed yet', status: result?.payment_status });
    }

    // Trust ONLY the NGN price we originally asked NOWPayments to invoice for.
    const confirmedAmount = txn.amount;

    user.walletBalance += confirmedAmount;
    await user.save();

    txn.status = 'success';
    txn.providerResponse = result;
    await txn.save();
    notifyTransaction(user, txn);

    res.json({ success: true, balance: user.walletBalance, amount: confirmedAmount });
  } catch (err) {
    handleCryptoError(err, res);
  }
});

function handleCryptoError(err, res) {
  if (err.code === 'CRYPTO_NOT_CONFIGURED') {
    return res.status(503).json({ error: err.message });
  }
  console.error('Crypto payment error:', err.response?.data || err.message);
  return res.status(502).json({ error: 'Could not reach the crypto payment provider. Please try again shortly.' });
}

/**
 * ---------- CRYPTO: LIVE MINIMUM DEPOSIT ----------
 * Lets the frontend show "Minimum: X USDT (~₦Y)" before the customer types
 * an amount, instead of them finding out only after a payment fails for
 * being too small. Checked against USDT-TRC20 (cheapest common USDT network).
 */
router.get('/fund/crypto/min-amount', requireAuth, async (req, res) => {
  try {
    const result = await crypto.getMinAmount({ currencyFrom: 'usdttrc20', currencyTo: 'usdttrc20', fiatEquivalent: 'ngn' });
    res.json({
      minAmountUsdt: result.min_amount,
      minAmountNgn: result.fiat_equivalent
    });
  } catch (err) {
    handleCryptoError(err, res);
  }
});

/**
 * ---------- LOYALTY POINTS: REDEEM FOR CASHBACK ----------
 * Converts a block of points (multiples of 100) into wallet cashback.
 * All the validation (block size, sufficient balance) lives in
 * loyaltyService so the rules can't drift between here and anywhere else
 * that might redeem points in the future.
 */
router.post('/redeem-points', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const result = await redeemPoints(user, req.body.points);
    if (!result.ok) return res.status(400).json({ error: result.error });

    res.json(result);
  } catch (err) {
    console.error('Redeem points error:', err.message);
    res.status(500).json({ error: 'Could not redeem points right now. Please try again.' });
  }
});

module.exports = router;
