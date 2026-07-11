const express = require('express');
const requireAuth = require('../middleware/auth');
const User = require('../models/User');
const SpeedTest = require('../models/SpeedTest');
const { notifySpeedtestDiscount } = require('../services/notificationService');

const router = express.Router();

// The voucher is a ONE-TIME reward per account (not per test, not per day):
// - only while the account is phone/email verified, so a throwaway signup can't farm it
// - only ever earned once, checked against speedtestDiscountEarnedAt
// - it expires DISCOUNT_VALIDITY_DAYS after being earned if the first purchase never happens
// - the % itself is fixed server-side (never trust a client-supplied percent)
// - purchaseEngine.js additionally caps the naira value it can be worth and only ever
//   applies it to a user's first real purchase, so the exposure per account is bounded
const DISCOUNT_PERCENT = 2;
const DISCOUNT_VALIDITY_DAYS = 30;

function discountExpiry(user) {
  if (!user.speedtestDiscountEarnedAt) return null;
  return new Date(user.speedtestDiscountEarnedAt.getTime() + DISCOUNT_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
}

// ---------- SUBMIT SPEED TEST RESULT ----------
// body: { downloadMbps, uploadMbps?, pingMs?, lat?, lng? }
// The actual measurement happens in the browser (js/map.js). This endpoint
// records the result (for the live map) and, the first time a verified user
// ever does this, unlocks a one-time 2% discount voucher for their first
// real purchase - separate from the cash wallet, so the numbers actually
// mean what the button promises.
router.post('/', requireAuth, async (req, res) => {
  try {
    const { downloadMbps, uploadMbps, pingMs, lat, lng, network } = req.body;
    if (downloadMbps == null) return res.status(400).json({ error: 'downloadMbps is required' });

    const user = await User.findById(req.userId);

    const alreadyHasVoucher = !!user.speedtestDiscountEarnedAt;
    const eligibleForVoucher = user.isVerified && !alreadyHasVoucher;

    await SpeedTest.create({
      user: req.userId,
      network: network || null,
      downloadMbps,
      uploadMbps,
      pingMs,
      lat: typeof lat === 'number' ? lat : undefined,
      lng: typeof lng === 'number' ? lng : undefined,
      location: typeof lat === 'number' && typeof lng === 'number' ? { type: 'Point', coordinates: [lng, lat] } : undefined,
      discountAwarded: eligibleForVoucher
    });

    if (!eligibleForVoucher) {
      return res.json({
        message: `Speed recorded: ${downloadMbps} Mbps down${uploadMbps ? `, ${uploadMbps} Mbps up` : ''}.`,
        discountAwarded: false,
        note: !user.isVerified
          ? 'Verify your account to unlock the first-purchase discount.'
          : user.speedtestDiscountUsedAt
            ? 'Your one-time first-purchase discount has already been used.'
            : 'You already claimed your one-time first-purchase discount.',
        walletBalance: user.walletBalance,
        discount: {
          percent: user.speedtestDiscountPercent,
          used: !!user.speedtestDiscountUsedAt,
          expiresAt: discountExpiry(user)
        }
      });
    }

    user.speedtestDiscountPercent = DISCOUNT_PERCENT;
    user.speedtestDiscountEarnedAt = new Date();
    await user.save();
    notifySpeedtestDiscount(user, DISCOUNT_PERCENT);

    res.json({
      message: `Speed recorded: ${downloadMbps} Mbps down${uploadMbps ? `, ${uploadMbps} Mbps up` : ''}. ${DISCOUNT_PERCENT}% first-purchase discount unlocked!`,
      discountAwarded: true,
      walletBalance: user.walletBalance,
      discount: {
        percent: user.speedtestDiscountPercent,
        used: false,
        expiresAt: discountExpiry(user)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not record speed test result' });
  }
});

// ---------- RECENT RESULTS FOR THE LIVE MAP (public, anonymized) ----------
router.get('/recent', async (req, res) => {
  try {
    const results = await SpeedTest.find({ lat: { $exists: true }, lng: { $exists: true } })
      .sort({ createdAt: -1 })
      .limit(200)
      .select('downloadMbps uploadMbps lat lng network createdAt -_id');
    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load recent speed tests' });
  }
});

// ---------- BEST NETWORK NEAR A LOCATION (public) ----------
// GET /api/speedtest/best-network?lat=6.5&lng=3.4&radiusKm=30
// Ranks networks by average speed among tests recorded within radiusKm of the
// given point, over the last 30 days - built directly from real crowd-sourced data.
router.get('/best-network', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radiusKm = parseFloat(req.query.radiusKm) || 30;

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'lat and lng query parameters are required' });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const results = await SpeedTest.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distanceMeters',
          maxDistance: radiusKm * 1000,
          spherical: true,
          query: { network: { $ne: null }, createdAt: { $gte: thirtyDaysAgo } }
        }
      },
      {
        $group: {
          _id: '$network',
          avgDownload: { $avg: '$downloadMbps' },
          avgUpload: { $avg: '$uploadMbps' },
          sampleCount: { $sum: 1 }
        }
      },
      { $sort: { avgDownload: -1 } }
    ]);

    const ranked = results.map(r => ({
      network: r._id,
      avgDownloadMbps: Math.round(r.avgDownload * 10) / 10,
      avgUploadMbps: r.avgUpload ? Math.round(r.avgUpload * 10) / 10 : null,
      sampleCount: r.sampleCount,
      lowConfidence: r.sampleCount < 3 // fewer than 3 tests - flag it as not very reliable yet
    }));

    res.json({ radiusKm, ranked });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not calculate best network for this location' });
  }
});

module.exports = router;
