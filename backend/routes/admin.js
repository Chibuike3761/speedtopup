const express = require('express');
const requireAuth = require('../middleware/auth');
const requireAdmin = require('../middleware/admin');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Referral = require('../models/Referral');

const router = express.Router();

// Every route here is both authenticated AND admin-only.
router.use(requireAuth, requireAdmin);

// Real product sales - what customers pay for. Wallet funding is float
// coming in, not revenue; referral/speedtest bonuses are payouts (a cost),
// not revenue either.
const REVENUE_CATEGORIES = ['airtime', 'data', 'tv', 'electricity', 'water', 'waec', 'neco'];

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ---------- OVERVIEW ----------
router.get('/overview', async (req, res) => {
  try {
    const [userStats, revenueTotal, revenueToday, walletFundedTotal, byCategory, byStatus, byProvider, loyaltyRedeemedTotal, discountCostTotal, recentTransactions] = await Promise.all([
      User.aggregate([
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            verifiedUsers: { $sum: { $cond: ['$isVerified', 1, 0] } },
            totalWalletBalance: { $sum: '$walletBalance' },
            discountVouchersEarned: { $sum: { $cond: ['$speedtestDiscountEarnedAt', 1, 0] } },
            discountVouchersUsed: { $sum: { $cond: ['$speedtestDiscountUsedAt', 1, 0] } },
            totalLoyaltyPointsOutstanding: { $sum: '$loyaltyPoints' }
          }
        }
      ]),
      Transaction.aggregate([
        { $match: { category: { $in: REVENUE_CATEGORIES }, status: 'success' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      Transaction.aggregate([
        { $match: { category: { $in: REVENUE_CATEGORIES }, status: 'success', createdAt: { $gte: startOfToday() } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      Transaction.aggregate([
        { $match: { category: 'wallet-funding', status: 'success' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      Transaction.aggregate([
        { $match: { category: { $in: REVENUE_CATEGORIES }, status: 'success' } },
        { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } }
      ]),
      Transaction.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Transaction.aggregate([
        { $match: { category: 'wallet-funding', status: 'success' } },
        { $group: { _id: '$provider', total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      Transaction.aggregate([
        { $match: { category: 'loyalty-redemption', status: 'success' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      // Real ₦ cost of the first-purchase speedtest discount so far - watch this
      // against discountVouchersUsed above; if the average creeps up, the per-order
      // cap in purchaseEngine.js (DISCOUNT_MAX_NAIRA) may need lowering.
      Transaction.aggregate([
        { $match: { status: 'success', discountApplied: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$discountApplied' }, count: { $sum: 1 } } }
      ]),
      Transaction.find().sort({ createdAt: -1 }).limit(10).populate('user', 'email')
    ]);

    const referralStats = await Referral.aggregate([
      {
        $group: {
          _id: null,
          totalReferrals: { $sum: 1 },
          completedReferrals: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
        }
      }
    ]);

    res.json({
      users: userStats[0] || { totalUsers: 0, verifiedUsers: 0, totalWalletBalance: 0, discountVouchersEarned: 0, discountVouchersUsed: 0, totalLoyaltyPointsOutstanding: 0 },
      speedtestDiscount: {
        cost: discountCostTotal[0]?.total || 0,
        redemptions: discountCostTotal[0]?.count || 0
      },
      revenue: {
        allTime: revenueTotal[0]?.total || 0,
        allTimeCount: revenueTotal[0]?.count || 0,
        today: revenueToday[0]?.total || 0,
        todayCount: revenueToday[0]?.count || 0,
        byCategory: byCategory.map((c) => ({ category: c._id, total: c.total, count: c.count }))
      },
      walletFunding: {
        total: walletFundedTotal[0]?.total || 0,
        count: walletFundedTotal[0]?.count || 0,
        byProvider: byProvider.map((p) => ({ provider: p._id, total: p.total, count: p.count }))
      },
      loyalty: {
        pointsOutstanding: userStats[0]?.totalLoyaltyPointsOutstanding || 0,
        totalRedeemed: loyaltyRedeemedTotal[0]?.total || 0,
        redemptionCount: loyaltyRedeemedTotal[0]?.count || 0
      },
      transactionsByStatus: byStatus.map((s) => ({ status: s._id, count: s.count })),
      referrals: referralStats[0] || { totalReferrals: 0, completedReferrals: 0 },
      recentTransactions
    });
  } catch (err) {
    console.error('Admin overview error:', err.message);
    res.status(500).json({ error: 'Could not load dashboard overview' });
  }
});

// ---------- USERS (paginated + search) ----------
router.get('/users', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const search = (req.query.search || '').trim();

    const filter = search
      ? { $or: [{ email: new RegExp(search, 'i') }, { phone: new RegExp(search, 'i') }] }
      : {};

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select('email phone isVerified isAdmin walletBalance speedtestDiscountPercent speedtestDiscountEarnedAt speedtestDiscountUsedAt loyaltyPoints referralCode createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
    ]);

    res.json({ users, total, page, pages: Math.ceil(total / limit) || 1 });
  } catch (err) {
    console.error('Admin users error:', err.message);
    res.status(500).json({ error: 'Could not load users' });
  }
});

// ---------- TRANSACTIONS (paginated + filters) ----------
router.get('/transactions', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const { category, status, provider, search } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (provider) filter.provider = provider;
    if (search) filter.reference = new RegExp(search.trim(), 'i');

    const [total, transactions] = await Promise.all([
      Transaction.countDocuments(filter),
      Transaction.find(filter)
        .populate('user', 'email phone')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
    ]);

    res.json({ transactions, total, page, pages: Math.ceil(total / limit) || 1 });
  } catch (err) {
    console.error('Admin transactions error:', err.message);
    res.status(500).json({ error: 'Could not load transactions' });
  }
});

module.exports = router;
