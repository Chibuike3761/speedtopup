const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { generateToken, generateOtpCode, generateReferralCode, generateSecureToken, hashToken } = require('../utils/helpers');
const { sendOtpSms } = require('../services/smsService');
const { sendEmail } = require('../services/emailService');
const { handleVerificationBonus } = require('../services/referralService');

const router = express.Router();

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { error: 'Too many OTP requests. Please wait a few minutes and try again.' }
});

// Caps login attempts per IP so a password can't be brute-forced. Generous
// enough that a genuine user who mistypes their password a few times won't
// get locked out, but closes off scripted guessing.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please wait 15 minutes and try again.' }
});

// ---------- REGISTER (creates unverified user + sends OTP) ----------
router.post('/register', otpLimiter, async (req, res) => {
  try {
    const { email, phone, password, referralCode } = req.body;
    if (!email || !phone || !password) {
      return res.status(400).json({ error: 'Email, phone and password are all required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      return res.status(409).json({ error: 'An account with that email or phone already exists' });
    }

    let referrer = null;
    if (referralCode) {
      referrer = await User.findOne({ referralCode: referralCode.trim().toUpperCase() });
      // silently ignore an invalid/unknown code - registration still proceeds normally
    }

    // Generate this user's own referral code, retrying on the rare collision.
    let ownCode;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateReferralCode();
      const taken = await User.findOne({ referralCode: candidate });
      if (!taken) { ownCode = candidate; break; }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      phone,
      passwordHash,
      isVerified: false,
      referralCode: ownCode,
      referredBy: referrer ? referrer._id : null
    });

    const code = generateOtpCode();
    await Otp.create({ phone, code, purpose: 'register' });
    const smsResult = await sendOtpSms(phone, code);

    return res.status(201).json({
      message: 'Account created. Enter the OTP sent to your phone to verify.',
      phone: user.phone,
      // Only present when TERMII_API_KEY is unset (dev mode) - lets you test without real SMS.
      devOtp: smsResult.devMode ? code : undefined
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ---------- VERIFY OTP ----------
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ error: 'Phone and code are required' });

    const otpRecord = await Otp.findOne({ phone, purpose: 'register' }).sort({ createdAt: -1 });
    if (!otpRecord) {
      return res.status(400).json({ error: 'No pending OTP for this number. Please register again.' });
    }

    if (otpRecord.attempts >= 5) {
      return res.status(429).json({ error: 'Too many incorrect attempts. Request a new OTP.' });
    }

    if (otpRecord.code !== code) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ error: 'Incorrect OTP' });
    }

    const user = await User.findOneAndUpdate({ phone }, { isVerified: true }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });

    await Otp.deleteMany({ phone, purpose: 'register' });
    await handleVerificationBonus(user._id);

    const token = generateToken(user._id);
    res.json({ message: 'Phone verified successfully', token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// ---------- RESEND OTP ----------
router.post('/resend-otp', otpLimiter, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone is required' });

    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ error: 'No account found for this phone number' });
    if (user.isVerified) return res.status(400).json({ error: 'This account is already verified' });

    await Otp.deleteMany({ phone, purpose: 'register' });
    const code = generateOtpCode();
    await Otp.create({ phone, code, purpose: 'register' });
    const smsResult = await sendOtpSms(phone, code);

    res.json({ message: 'A new OTP has been sent', devOtp: smsResult.devMode ? code : undefined });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not resend OTP' });
  }
});

// ---------- LOGIN ----------
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    if (!user.isVerified) {
      return res.status(403).json({
        error: 'Please verify your phone number first',
        needsVerification: true,
        phone: user.phone
      });
    }

    // Anyone whose email is listed in ADMIN_EMAILS (.env) gets promoted the
    // next time they log in - no separate admin-creation flow needed.
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (!user.isAdmin && adminEmails.includes(user.email.toLowerCase())) {
      user.isAdmin = true;
      await user.save();
    }

    const token = generateToken(user._id);
    res.json({ message: 'Login successful', token, isAdmin: user.isAdmin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Same limiter budget as OTP requests - generous for genuine retries, but
// stops someone from hammering the endpoint to spam an inbox or probe which
// emails are registered.
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many requests. Please wait a few minutes and try again.' }
});

// ---------- FORGOT PASSWORD (request a reset link) ----------
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Always return the same generic message whether or not the account
    // exists - confirming/denying an email's existence here would let
    // someone enumerate registered users.
    const genericMessage = 'If an account exists for that email, a password reset link has been sent.';

    if (user) {
      const rawToken = generateSecureToken();
      user.resetPasswordTokenHash = hashToken(rawToken);
      user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      await user.save();

      const resetLink = `${req.protocol}://${req.get('host')}/reset-password.html?token=${rawToken}`;
      await sendEmail({
        to: user.email,
        subject: 'Reset your Speed Topup password',
        html: `
          <div style="font-family:sans-serif; max-width:480px; margin:0 auto;">
            <h2 style="color:#0f172a;">Reset your password</h2>
            <p>We got a request to reset the password on your Speed Topup account. This link expires in 30 minutes.</p>
            <p style="text-align:center; margin:24px 0;">
              <a href="${resetLink}" style="background:#00d4aa; color:#0b0f14; padding:14px 28px; border-radius:10px; text-decoration:none; font-weight:700;">Reset Password</a>
            </p>
            <p style="font-size:0.85rem; color:#64748b;">If you didn't request this, you can safely ignore this email - your password won't change.</p>
            <p style="font-size:0.8rem; color:#94a3b8;">Or paste this link into your browser: ${resetLink}</p>
          </div>
        `
      });
    }

    res.json({ message: genericMessage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not process this request. Please try again.' });
  }
});

// ---------- RESET PASSWORD (using the token from the emailed link) ----------
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and new password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const tokenHash = hashToken(token);
    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ message: 'Your password has been reset. You can now log in.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not reset password. Please try again.' });
  }
});

module.exports = router;
