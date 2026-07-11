const express = require('express');
const requireAuth = require('../middleware/auth');
const AutoTopUp = require('../models/AutoTopUp');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const items = await AutoTopUp.find({ user: req.userId }).sort({ createdAt: -1 });
  res.json({ autoTopUps: items });
});

router.post('/', requireAuth, async (req, res) => {
  const { label, category, serviceID, variationCode, billersCode, amount, frequencyDays } = req.body;
  if (!label || !category || !serviceID || !billersCode || !amount || !frequencyDays) {
    return res.status(400).json({ error: 'label, category, serviceID, billersCode, amount and frequencyDays are required' });
  }
  if (![1, 7, 30].includes(Number(frequencyDays))) {
    return res.status(400).json({ error: 'frequencyDays must be 1 (daily), 7 (weekly) or 30 (monthly)' });
  }

  const nextRunAt = new Date(Date.now() + frequencyDays * 24 * 60 * 60 * 1000);

  const item = await AutoTopUp.create({
    user: req.userId,
    label,
    category,
    serviceID,
    variationCode,
    billersCode,
    amount,
    frequencyDays,
    nextRunAt
  });
  res.status(201).json({ autoTopUp: item });
});

router.patch('/:id/toggle', requireAuth, async (req, res) => {
  const item = await AutoTopUp.findOne({ _id: req.params.id, user: req.userId });
  if (!item) return res.status(404).json({ error: 'Not found' });
  item.active = !item.active;
  // if re-activating and the schedule already passed while it was off, push it to now + frequency
  if (item.active && item.nextRunAt < new Date()) {
    item.nextRunAt = new Date(Date.now() + item.frequencyDays * 24 * 60 * 60 * 1000);
  }
  await item.save();
  res.json({ autoTopUp: item });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const deleted = await AutoTopUp.findOneAndDelete({ _id: req.params.id, user: req.userId });
  if (!deleted) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
});

module.exports = router;
