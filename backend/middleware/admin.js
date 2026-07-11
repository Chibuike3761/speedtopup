const User = require('../models/User');

// Always use AFTER requireAuth - it relies on req.userId already being set.
module.exports = async function requireAdmin(req, res, next) {
  try {
    const user = await User.findById(req.userId).select('isAdmin');
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (err) {
    console.error('Admin check failed:', err.message);
    res.status(500).json({ error: 'Could not verify admin access' });
  }
};
