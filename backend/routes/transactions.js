const express = require('express');
const requireAuth = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const { requeryAndSettle } = require('../services/purchaseEngine');

const router = express.Router();

// ---------- LIST CURRENTLY PENDING TRANSACTIONS ----------
// Powers the "Pending" badge/panel so a user can see at a glance if anything
// is still processing, without having to dig through full history.
router.get('/pending', requireAuth, async (req, res) => {
  try {
    const pending = await Transaction.find({ user: req.userId, status: 'pending' }).sort({ createdAt: -1 });
    res.json({ pending });
  } catch (err) {
    console.error('List pending transactions error:', err.message);
    res.status(500).json({ error: 'Could not load pending transactions' });
  }
});

// ---------- CHECK / REFRESH ONE TRANSACTION'S STATUS ----------
// Only actually hits VTpass while the transaction is still 'pending' - once
// it has resolved one way or another, this just returns what's stored, so
// repeated polling from the frontend never spams the provider.
router.get('/:reference/status', requireAuth, async (req, res) => {
  try {
    const txn = await Transaction.findOne({ reference: req.params.reference, user: req.userId });
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });

    let note;
    if (txn.status === 'pending') {
      const result = await requeryAndSettle(txn);
      note = result.note;
    }

    res.json({
      reference: txn.reference,
      category: txn.category,
      amount: txn.amount,
      discountApplied: txn.discountApplied,
      status: txn.status,
      createdAt: txn.createdAt,
      updatedAt: txn.updatedAt,
      note
    });
  } catch (err) {
    console.error('Transaction status check error:', err.message);
    res.status(500).json({ error: 'Could not check transaction status right now' });
  }
});

module.exports = router;
