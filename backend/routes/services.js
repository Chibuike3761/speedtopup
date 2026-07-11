const express = require('express');
const requireAuth = require('../middleware/auth');
const vtpass = require('../services/vtpassService');
const { executePurchase } = require('../services/purchaseEngine');

const router = express.Router();

// Service catalog shown on the frontend. Add more entries here as you enable
// them on your VTpass account - the purchase route below is fully generic.
const CATALOG = {
  airtime: { label: 'Airtime', providers: ['mtn', 'glo', 'airtel', 'etisalat'] },
  data: { label: 'Data', providers: ['mtn-data', 'glo-data', 'airtel-data', 'etisalat-data'] },
  tv: { label: 'TV Subscription', providers: ['dstv', 'gotv', 'startimes'] },
  electricity: {
    label: 'Electricity',
    providers: [
      'ikeja-electric', 'eko-electric', 'kano-electric', 'portharcourt-electric',
      'jos-electric', 'ibadan-electric', 'kaduna-electric', 'abuja-electric', 'enugu-electric', 'benin-electric'
    ]
  },
  water: { label: 'Water Bill', providers: [] }, // no national aggregator API exists for this yet
  waec: { label: 'WAEC Result Checker PIN', providers: ['waec'] },
  neco: { label: 'NECO Result Checker PIN', providers: [] } // not offered by VTpass or other major aggregators
};

router.get('/catalog', (req, res) => res.json({ catalog: CATALOG }));

// Live variations (data bundle sizes, TV bouquets, electricity meter types) straight from VTpass
router.get('/variations/:serviceID', requireAuth, async (req, res) => {
  try {
    const data = await vtpass.getVariations(req.params.serviceID);
    res.json(data);
  } catch (err) {
    handleVtpassError(err, res);
  }
});

// Verify a meter/smartcard number before charging (electricity + TV)
router.post('/verify', requireAuth, async (req, res) => {
  try {
    const { serviceID, billersCode, type } = req.body;
    if (!serviceID || !billersCode) return res.status(400).json({ error: 'serviceID and billersCode are required' });
    const data = await vtpass.verifyBillersCode({ serviceID, billersCode, type });
    res.json(data);
  } catch (err) {
    handleVtpassError(err, res);
  }
});

/**
 * ---------- UNIFIED PURCHASE ENDPOINT ----------
 * body: { category, serviceID, variationCode?, amount, phone, billersCode? }
 * Delegates to the shared purchase engine - same logic the auto top-up
 * scheduler uses, so manual and automatic purchases behave identically.
 */
router.post('/purchase', requireAuth, async (req, res) => {
  const result = await executePurchase({ userId: req.userId, ...req.body });
  if (!result.ok) {
    const status = result.code === 'VTPASS_NOT_CONFIGURED' ? 503 : 400;
    return res.status(status).json({ error: result.error, reference: result.reference });
  }
  res.json({ success: true, ...result });
});

function handleVtpassError(err, res) {
  if (err.code === 'VTPASS_NOT_CONFIGURED') {
    return res.status(503).json({ error: err.message });
  }
  console.error('VTpass error:', err.response?.data || err.message);
  return res.status(502).json({ error: 'The service provider could not be reached. Please try again shortly.' });
}

module.exports = router;
