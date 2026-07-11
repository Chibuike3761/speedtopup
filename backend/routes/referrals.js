const express = require('express');
const requireAuth = require('../middleware/auth');
const User = require('../models/User');
const Referral = require('../models/Referral');
const { WELCOME_BONUS, REFERRER_BONUS } = require('../services/referralService');

const router = express.Router();

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).select('referralCode');
  if (!user) return res.status(404).json({ error: 'User not found' });

  const referrals = await Referral.find({ referrer: req.userId })
    .populate('referredUser', 'email createdAt')
    .sort({ createdAt: -1 });

  const totalEarned = referrals.filter(r => r.referrerBonusPaid).length * REFERRER_BONUS;

  res.json({
    referralCode: user.referralCode,
    welcomeBonus: WELCOME_BONUS,
    referrerBonus: REFERRER_BONUS,
    totalEarned,
    referrals: referrals.map(r => ({
      email: maskEmail(r.referredUser?.email),
      status: r.status,
      joinedAt: r.createdAt
    }))
  });
});

function maskEmail(email) {
  if (!email) return 'Unknown';
  const [name, domain] = email.split('@');
  if (!domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(name.length - 2, 1))}@${domain}`;
}

module.exports = router;
