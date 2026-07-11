const express = require('express');
const User = require('../models/User');
const WhatsAppSession = require('../models/WhatsAppSession');
const whatsapp = require('../services/whatsappService');
const vtpass = require('../services/vtpassService');
const { executePurchase } = require('../services/purchaseEngine');
const CATALOG = require('../services/whatsappCatalog');

const router = express.Router();

// ---------- WEBHOOK VERIFICATION (Meta calls this once, when you register the URL) ----------
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token && process.env.WHATSAPP_VERIFY_TOKEN && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// ---------- INCOMING MESSAGES ----------
router.post('/webhook', async (req, res) => {
  // Meta expects a fast 200 regardless of what we do with the message -
  // acknowledge immediately, then process. A slow webhook gets retried
  // (and eventually disabled) by Meta.
  res.sendStatus(200);

  try {
    if (!whatsapp.verifySignature(req.rawBody, req.get('X-Hub-Signature-256'))) {
      console.warn('WhatsApp webhook: signature missing/invalid, ignoring payload');
      return;
    }

    const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return; // delivery/read receipts and other non-message events land here too - nothing to do

    const from = message.from; // e.g. "2348012345678"
    const text = extractText(message);
    if (!from || text == null) return;

    await handleIncomingMessage(from, text);
  } catch (err) {
    console.error('WhatsApp webhook processing error:', err.response?.data || err.message);
  }
});

function extractText(message) {
  if (message.type === 'text') return message.text?.body?.trim() || '';
  if (message.type === 'interactive') {
    const i = message.interactive;
    if (i.type === 'button_reply') return i.button_reply.id;
    if (i.type === 'list_reply') return i.list_reply.id;
  }
  return null; // unsupported message type (image, voice note, etc.) - ignore rather than guess
}

// ---------- USER LOOKUP ----------
// Registration doesn't normalize phone format, so match on the last 10
// digits (the part that's identical whether someone typed "080..." or
// "+234 80...") rather than requiring an exact string match.
async function findUserByWhatsApp(waPhone) {
  const digits = String(waPhone).replace(/\D/g, '');
  const last10 = digits.slice(-10);
  if (last10.length < 10) return null;
  return User.findOne({ phone: { $regex: `${last10}$` } });
}

// ---------- CONVERSATION ROUTER ----------
async function handleIncomingMessage(from, text) {
  const lower = text.toLowerCase();

  if (['hi', 'hello', 'hey', 'menu', 'start', 'help'].includes(lower)) {
    return startOrder(from);
  }
  if (lower === 'balance') {
    return sendBalance(from);
  }
  if (lower === 'cancel') {
    await WhatsAppSession.deleteOne({ phone: from });
    return whatsapp.sendText(from, "Order cancelled. Send 'menu' anytime to start a new one.");
  }

  const user = await findUserByWhatsApp(from);
  if (!user) return sendNotRegistered(from);

  const session = await WhatsAppSession.findOne({ phone: from });
  if (!session) return startOrder(from); // nothing in progress - treat any message as "start"

  switch (session.step) {
    case 'category': return handleCategoryReply(from, user, session, text);
    case 'network': return handleNetworkReply(from, user, session, text);
    case 'variation': return handleVariationReply(from, user, session, text);
    case 'billers': return handleBillersReply(from, user, session, text);
    case 'amount': return handleAmountReply(from, user, session, text);
    case 'confirm': return handleConfirmReply(from, user, session, lower);
    default: return startOrder(from);
  }
}

async function sendNotRegistered(from) {
  const site = process.env.CLIENT_ORIGIN || 'the NaijaFast website';
  await whatsapp.sendText(from,
    `We couldn't find a NaijaFast account using this WhatsApp number. Please register at ${site} with this exact phone number, then message us again to order.`
  );
}

async function sendBalance(from) {
  const user = await findUserByWhatsApp(from);
  if (!user) return sendNotRegistered(from);
  await whatsapp.sendText(from, `💰 Wallet balance: ₦${user.walletBalance}\n⭐ Loyalty points: ${user.loyaltyPoints}\n\nSend 'menu' to place an order.`);
}

// ---------- STEP 1: CATEGORY ----------
async function startOrder(from) {
  const user = await findUserByWhatsApp(from);
  if (!user) return sendNotRegistered(from);

  await WhatsAppSession.findOneAndUpdate(
    { phone: from },
    { phone: from, step: 'category', category: null, serviceID: null, serviceLabel: null, variationCode: null, variationLabel: null, billersCode: null, amount: null, pendingOptions: [], updatedAt: new Date() },
    { upsert: true }
  );

  await whatsapp.sendList(
    from,
    `Hi ${user.email.split('@')[0]}! 👋 What would you like to buy today?`,
    'Choose',
    [{ title: 'Services', rows: Object.entries(CATALOG).map(([key, cfg]) => ({ id: `cat:${key}`, title: cfg.label })) }]
  );
}

// ---------- STEP 2: NETWORK/PROVIDER ----------
async function handleCategoryReply(from, user, session, text) {
  const key = text.replace('cat:', '');
  const cfg = CATALOG[key];
  if (!cfg) return whatsapp.sendText(from, "Please pick an option from the list above, or send 'menu' to restart.");

  session.category = key;
  session.step = 'network';
  session.updatedAt = new Date();
  await session.save();

  await whatsapp.sendList(from, `${cfg.label} — choose a network/provider:`, 'Choose',
    [{ title: cfg.label, rows: cfg.networks.map(n => ({ id: `net:${n.value}`, title: n.label })) }]);
}

// ---------- STEP 3: VARIATION (data plans / TV bouquets / meter type) ----------
async function handleNetworkReply(from, user, session, text) {
  const cfg = CATALOG[session.category];
  const value = text.replace('net:', '');
  const network = cfg.networks.find(n => n.value === value);
  if (!network) return whatsapp.sendText(from, "Please pick a network from the list above, or send 'menu' to restart.");

  session.serviceID = network.value;
  session.serviceLabel = network.label;

  if (cfg.variationOptions) {
    // Fixed options (electricity prepaid/postpaid) - no VTpass lookup needed.
    session.step = 'variation';
    session.pendingOptions = cfg.variationOptions.map(v => ({ code: v.value, label: v.label, amount: null }));
    session.updatedAt = new Date();
    await session.save();
    return whatsapp.sendList(from, 'Prepaid or postpaid?', 'Choose',
      [{ title: 'Meter type', rows: cfg.variationOptions.map((v, idx) => ({ id: `var:${idx}`, title: v.label })) }]);
  }

  if (cfg.needsVariation) {
    session.step = 'variation';
    session.updatedAt = new Date();
    await session.save();

    let variations = [];
    try {
      const result = await vtpass.getVariations(network.value);
      variations = (result?.content?.varations || result?.content?.variations || []).slice(0, 10);
    } catch (err) {
      console.error('WhatsApp variation fetch failed:', err.response?.data || err.message);
    }

    if (variations.length === 0) {
      // VTpass unreachable/not configured - fall back to manual amount entry
      // rather than leaving the person stuck with an empty list.
      session.step = 'billers';
      session.pendingOptions = [];
      await session.save();
      await whatsapp.sendText(from, "Couldn't load live plans right now - no problem, we'll do this manually.");
      return askForBillers(from, cfg);
    }

    session.pendingOptions = variations.map(v => ({ code: v.variation_code, label: v.name, amount: Number(v.variation_amount) }));
    await session.save();
    return whatsapp.sendList(from, `Pick a ${cfg.label} plan:`, 'Choose',
      [{ title: 'Plans', rows: variations.map((v, idx) => ({ id: `var:${idx}`, title: String(v.name).slice(0, 24), description: `₦${v.variation_amount}` })) }]);
  }

  // Plain airtime - no variation step at all.
  session.step = 'billers';
  session.updatedAt = new Date();
  await session.save();
  return askForBillers(from, cfg);
}

// ---------- STEP 4: BILLERS CODE (phone/meter/smartcard) ----------
async function handleVariationReply(from, user, session, text) {
  const idx = parseInt(text.replace('var:', ''), 10);
  const opt = session.pendingOptions?.[idx];
  if (Number.isNaN(idx) || !opt) return whatsapp.sendText(from, "Please pick an option from the list above, or send 'menu' to restart.");

  session.variationCode = opt.code;
  session.variationLabel = opt.label;
  if (opt.amount) session.amount = opt.amount; // fixed-price plan - amount step gets skipped later
  session.pendingOptions = [];
  session.step = 'billers';
  session.updatedAt = new Date();
  await session.save();

  return askForBillers(from, CATALOG[session.category]);
}

async function askForBillers(from, cfg) {
  await whatsapp.sendText(from, `Please type the ${cfg.billersLabel}${cfg.billersIsPhone ? ' (or type "me" to use your registered number)' : ''}.`);
}

// ---------- STEP 5: AMOUNT (skipped if a fixed-price plan already set it) ----------
async function handleBillersReply(from, user, session, text) {
  const cfg = CATALOG[session.category];
  let billersCode = text.trim();
  if (cfg.billersIsPhone && billersCode.toLowerCase() === 'me') billersCode = user.phone;
  if (!billersCode) return whatsapp.sendText(from, `Please type a valid ${cfg.billersLabel}.`);

  session.billersCode = billersCode;
  session.updatedAt = new Date();

  if (session.amount) {
    session.step = 'confirm';
    await session.save();
    return sendConfirmation(from, session);
  }

  session.step = 'amount';
  await session.save();
  return whatsapp.sendText(from, 'How much would you like to pay, in Naira? (e.g. 1000)');
}

async function handleAmountReply(from, user, session, text) {
  const amount = Number(text.replace(/[^\d.]/g, ''));
  if (!amount || amount <= 0) return whatsapp.sendText(from, 'Please enter a valid amount in Naira, e.g. 1000');

  session.amount = amount;
  session.step = 'confirm';
  session.updatedAt = new Date();
  await session.save();
  return sendConfirmation(from, session);
}

// ---------- STEP 6: CONFIRM & EXECUTE ----------
async function sendConfirmation(from, session) {
  const cfg = CATALOG[session.category];
  const lines = [
    "You're about to buy:",
    `• ${cfg.label} — ${session.serviceLabel}`,
    session.variationLabel ? `• Plan: ${session.variationLabel}` : null,
    `• ${cfg.billersLabel}: ${session.billersCode}`,
    `• Amount: ₦${session.amount}`,
    '',
    'Reply YES to confirm, or CANCEL to stop.'
  ].filter(Boolean).join('\n');
  await whatsapp.sendText(from, lines);
}

async function handleConfirmReply(from, user, session, lower) {
  if (lower === 'cancel') {
    await WhatsAppSession.deleteOne({ phone: from });
    return whatsapp.sendText(from, "Order cancelled. Send 'menu' anytime to start a new one.");
  }
  if (lower !== 'yes' && lower !== 'y') {
    return whatsapp.sendText(from, 'Reply YES to confirm this order, or CANCEL to stop.');
  }

  await whatsapp.sendText(from, '⏳ Processing your order...');

  const result = await executePurchase({
    userId: user._id,
    category: session.category,
    serviceID: session.serviceID,
    variationCode: session.variationCode,
    amount: session.amount,
    phone: session.billersCode,
    billersCode: session.billersCode
  });

  await WhatsAppSession.deleteOne({ phone: from });

  if (!result.ok) {
    return whatsapp.sendText(from, `❌ Order failed: ${result.error}\n\nSend 'menu' to try again.`);
  }

  const discountLine = result.discountApplied > 0 ? `\n🎁 First-purchase discount saved you ₦${result.discountApplied}!` : '';
  const pointsLine = result.pointsEarned > 0 ? `\n⭐ You earned ${result.pointsEarned} loyalty points.` : '';
  const icon = result.status === 'pending' ? '⏳' : '✅';
  await whatsapp.sendText(from,
    `${icon} ${result.message}\nReference: ${result.reference}\nWallet balance: ₦${result.balance}${discountLine}${pointsLine}\n\nSend 'menu' to place another order.`
  );
}

module.exports = router;
