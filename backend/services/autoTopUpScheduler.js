const cron = require('node-cron');
const AutoTopUp = require('../models/AutoTopUp');
const { executePurchase } = require('./purchaseEngine');

/**
 * Runs every 15 minutes: finds active auto top-ups whose nextRunAt has
 * passed, executes each one through the SAME purchase engine the manual
 * "Buy Now" button uses (debit -> VTpass -> refund-on-failure), then
 * schedules the next run. A failure here does not retry immediately - it
 * waits for the next scheduled interval, so a temporarily empty wallet
 * doesn't cause repeated failed-purchase spam.
 */
function startAutoTopUpScheduler() {
  cron.schedule('*/15 * * * *', async () => {
    try {
      const due = await AutoTopUp.find({ active: true, nextRunAt: { $lte: new Date() } });
      if (due.length === 0) return;

      console.log(`⏰ Running ${due.length} due auto top-up(s)...`);

      for (const item of due) {
        const result = await executePurchase({
          userId: item.user,
          category: item.category,
          serviceID: item.serviceID,
          variationCode: item.variationCode,
          amount: item.amount,
          phone: item.billersCode,
          billersCode: item.billersCode
        });

        item.lastRunAt = new Date();
        item.lastStatus = result.ok ? 'success' : 'failed';
        item.lastMessage = result.ok ? (result.message || 'Purchase successful') : result.error;
        item.nextRunAt = new Date(Date.now() + item.frequencyDays * 24 * 60 * 60 * 1000);
        await item.save();

        console.log(`   ${result.ok ? '✅' : '❌'} ${item.label}: ${item.lastMessage}`);
      }
    } catch (err) {
      console.error('Auto top-up scheduler error:', err.message);
    }
  });

  console.log('🔁 Auto top-up scheduler started (checks every 15 minutes)');
}

module.exports = startAutoTopUpScheduler;
