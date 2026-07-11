const express = require('express');
const requireAuth = require('../middleware/auth');
const Beneficiary = require('../models/Beneficiary');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const beneficiaries = await Beneficiary.find({ user: req.userId }).sort({ createdAt: -1 });
  res.json({ beneficiaries });
});

router.post('/', requireAuth, async (req, res) => {
  const { label, category, serviceID, billersCode, variationCode } = req.body;
  if (!label || !category || !serviceID || !billersCode) {
    return res.status(400).json({ error: 'label, category, serviceID and billersCode are required' });
  }
  const beneficiary = await Beneficiary.create({
    user: req.userId,
    label,
    category,
    serviceID,
    billersCode,
    variationCode
  });
  res.status(201).json({ beneficiary });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const deleted = await Beneficiary.findOneAndDelete({ _id: req.params.id, user: req.userId });
  if (!deleted) return res.status(404).json({ error: 'Beneficiary not found' });
  res.json({ message: 'Deleted' });
});

module.exports = router;
