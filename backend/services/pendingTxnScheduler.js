const cron = require('node-cron');
const Transaction = require('../models/Transaction');
const { requeryAndSettle, forceRefundStuckTransaction, STUCK_TIMEOUT_HOURS } = require('./purchaseEngine');

/**
 * Runs every 5 minutes: requeries every transaction still sitting in
 * 'pending' against VTpass, so most customers see their status flip to
 * success/failed automatically without ever needing to hit "refresh"
 * themselves. Anything still unresolved after STUCK_TIMEOUT_HOURS gets
 * force-refunded - money should never be silently stuck in limbo waiting
 * on a provider that may never answer.
 */
// Only these categories are ever fulfilled through VTpass - wallet-funding,
// speedtest-bonus, referral-bonus and loyalty-redemption settle through
// Paystack/NOWPayments webhooks or internal logic, and were never registered
// with VTpass, so requerying them would just fail with a confusing error.
const VTPASS_CATEGORIES = ['airtime', 'data', 'tv', 'electricity', 'waec'];

function startPendingTransactionScheduler() {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const pending = await Transaction.find({ status: 'pending', category: { $in: VTPASS_CATEGORIES } });
      if (pending.length === 0) return;

      console.log(`🔎 Requerying ${pending.length} pending transaction(s)...`);

      for (const txn of pending) {
        const ageMs = Date.now() - txn.createdAt.getTime();

        const result = await requeryAndSettle(txn);
        if (result.changed) {
          console.log(`   ✅ ${txn.reference} resolved -> ${txn.status}`);
          continue;
        }

        if (txn.status === 'pending' && ageMs >= STUCK_TIMEOUT_HOURS * 60 * 60 * 1000) {
          await forceRefundStuckTransaction(txn);
          console.log(`   ⏱️ ${txn.reference} auto-refunded after ${STUCK_TIMEOUT_HOURS}h with no confirmation`);
        }
      }
    } catch (err) {
      console.error('Pending transaction scheduler error:', err.message);
    }
  });

  console.log(`🔁 Pending transaction scheduler started (checks every 5 minutes, auto-refunds after ${STUCK_TIMEOUT_HOURS}h)`);
}

module.exports = startPendingTransactionScheduler;
