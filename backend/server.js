require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const serviceRoutes = require('./routes/services');
const speedtestRoutes = require('./routes/speedtest');
const beneficiaryRoutes = require('./routes/beneficiaries');
const autoTopUpRoutes = require('./routes/autotopup');
const referralRoutes = require('./routes/referrals');
const adminRoutes = require('./routes/admin');
const transactionRoutes = require('./routes/transactions');
const whatsappRoutes = require('./routes/whatsapp');
const startAutoTopUpScheduler = require('./services/autoTopUpScheduler');
const startPendingTransactionScheduler = require('./services/pendingTxnScheduler');

const app = express();

// Sets standard security headers (X-Content-Type-Options, HSTS, X-Frame-Options,
// etc). Content-Security-Policy is left off for now - the frontend loads
// scripts/fonts from unpkg, cdnjs and Google Fonts and uses a couple of inline
// <script> blocks, so the default CSP would break the site. Turn it on later
// with a policy allowlisting those specific hosts once you're ready to lock
// it down further.
app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json({
  // Captures the raw request bytes alongside the parsed body - the WhatsApp
  // webhook needs this exact byte sequence to verify Meta's HMAC signature.
  verify: (req, res, buf) => { req.rawBody = buf; }
}));

// Serve the frontend (index.html, css/, js/, etc.) from the same server -
// so one process + one ngrok tunnel gives you the whole site, not two.
app.use(express.static(path.join(__dirname, '..')));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/speedtest', speedtestRoutes);
app.use('/api/beneficiaries', beneficiaryRoutes);
app.use('/api/autotopup', autoTopUpRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Central error handler (catches anything thrown/rejected that wasn't handled)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 NaijaFast backend running on http://localhost:${PORT}`));
  startAutoTopUpScheduler();
  startPendingTransactionScheduler();
});
