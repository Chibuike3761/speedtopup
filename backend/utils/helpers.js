const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

function generateReference(prefix = 'NFD') {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
}

function generateReferralCode() {
  return crypto.randomBytes(5).toString('hex').toUpperCase().slice(0, 7); // e.g. "A3F9C1B"
}

module.exports = { generateToken, generateOtpCode, generateReference, generateReferralCode };
