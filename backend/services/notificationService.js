const { sendEmail } = require('./emailService');

const CATEGORY_LABELS = {
  airtime: 'Airtime',
  data: 'Data',
  tv: 'TV Subscription',
  electricity: 'Electricity Bill',
  water: 'Water Bill',
  waec: 'WAEC PIN',
  neco: 'NECO PIN',
  'wallet-funding': 'Wallet Funding',
  'referral-bonus': 'Referral Bonus',
  'loyalty-redemption': 'Loyalty Points Redemption'
};

function naira(amount) {
  return `₦${Number(amount || 0).toLocaleString()}`;
}

function emailWrapper(headline, bodyHtml) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif; max-width:480px; margin:0 auto; padding:24px 20px; color:#0f172a;">
    <div style="text-align:center; margin-bottom:20px;">
      <span style="font-size:1.3rem; font-weight:800;">Speed Topup <span style="color:#00d4aa;">Data</span></span>
    </div>
    <h2 style="font-size:1.1rem; margin-bottom:12px;">${headline}</h2>
    ${bodyHtml}
    <p style="margin-top:28px; font-size:0.8rem; color:#64748b;">
      This is an automated message from Speed Topup Data. If you didn't expect this, please contact support.
    </p>
  </div>`;
}

/**
 * Sends a transaction-related email to a user. Called after a Transaction's
 * status settles to 'success' or 'failed' - never for 'pending', since
 * nothing has actually happened yet at that point.
 *
 * options.kind lets a caller disambiguate a category that covers more than
 * one real-world event (right now, only 'referral-bonus' needs this - the
 * welcome bonus and the referrer bonus are both that category but very
 * different emails).
 *
 * Fire-and-forget: any failure here is logged, never thrown, so a broken
 * email never breaks the transaction flow it's reporting on.
 */
async function notifyTransaction(user, txn, options = {}) {
  try {
    if (!user?.email || !txn) return;
    if (txn.status !== 'success' && txn.status !== 'failed') return; // nothing settled yet

    const { subject, html } = buildTransactionEmail(user, txn, options);
    if (!subject) return; // no template for this case - skip quietly
    await sendEmail({ to: user.email, subject, html });

    // WAEC (and anything else that sets recipientEmail in future) also goes to
    // whoever the PIN is actually for, which may not be the account owner.
    if (txn.recipientEmail && txn.recipientEmail !== user.email) {
      await sendEmail({ to: txn.recipientEmail, subject, html });
    }
  } catch (err) {
    console.error('notifyTransaction failed:', err.message);
  }
}

function buildTransactionEmail(user, txn, options) {
  const amount = naira(txn.amount);
  const isSuccess = txn.status === 'success';

  if (txn.category === 'wallet-funding') {
    const providerLabel = txn.provider === 'crypto' ? 'crypto' : 'Paystack';
    if (isSuccess) {
      return {
        subject: `Wallet funded: ${amount} added`,
        html: emailWrapper('Your wallet has been funded ✅', `
          <p>Hi there,</p>
          <p><strong>${amount}</strong> was added to your Speed Topup wallet via <strong>${providerLabel}</strong>.</p>
          <p style="background:#f0fdf9; border-radius:10px; padding:14px; font-size:0.9rem;">
            Reference: <span style="font-family:monospace;">${txn.reference}</span>
          </p>
        `)
      };
    }
    return {
      subject: `Payment not completed - ${amount}`,
      html: emailWrapper('Your payment did not go through ⚠️', `
        <p>Hi there,</p>
        <p>Your attempt to fund your wallet with <strong>${amount}</strong> via <strong>${providerLabel}</strong> was not successful. No funds were deducted from your wallet.</p>
        <p>You can try again anytime from the Fund Wallet button on the Services page.</p>
      `)
    };
  }

  if (txn.category === 'referral-bonus') {
    if (options.kind === 'referral-welcome') {
      return {
        subject: `Welcome bonus credited: ${amount}`,
        html: emailWrapper('You just earned a welcome bonus 🎁', `
          <p>Hi there,</p>
          <p>Thanks for joining Speed Topup through a friend's invite! <strong>${amount}</strong> has been credited to your wallet.</p>
        `)
      };
    }
    if (options.kind === 'referral-referrer') {
      return {
        subject: `Referral bonus earned: ${amount}`,
        html: emailWrapper('Your referral just paid off 💰', `
          <p>Hi there,</p>
          <p>A friend you invited just made their first purchase, so <strong>${amount}</strong> has been credited to your wallet as your referral bonus.</p>
          <p>Keep sharing your referral link from the Services page to earn more.</p>
        `)
      };
    }
    return null; // shouldn't happen, but don't send a vague email if it does
  }

  if (txn.category === 'loyalty-redemption') {
    return {
      subject: `Points redeemed: ${amount} cashback`,
      html: emailWrapper('Your loyalty points just became cash 💵', `
        <p>Hi there,</p>
        <p><strong>${amount}</strong> has been added to your wallet from redeeming your loyalty points.</p>
        <p>Keep buying airtime, data, TV, or electricity through Speed Topup to earn more points automatically.</p>
      `)
    };
  }

  // Regular service purchases: airtime, data, tv, electricity, water, waec, neco
  const label = CATEGORY_LABELS[txn.category] || txn.category;
  if (isSuccess) {
    const pointsLine = options.pointsEarned > 0
      ? `<p style="color:#059669; font-size:0.9rem;">+${options.pointsEarned} loyalty points earned 🎉</p>`
      : '';

    // WAEC's actual deliverable - the PIN/serial the customer needs to check
    // their result - comes back from VTpass in purchased_code. Surface it
    // prominently since it's the whole point of this email.
    const pinCode = txn.providerResponse?.purchased_code || txn.providerResponse?.content?.purchased_code;
    const pinBlock = (txn.category === 'waec' && pinCode)
      ? `<p style="background:#0f172a; color:#00d4aa; border-radius:10px; padding:16px; font-size:1rem; font-weight:700; text-align:center; letter-spacing:0.5px;">${pinCode}</p>
         <p style="font-size:0.85rem; color:#64748b;">Keep this safe - you'll need it to check your WAEC result online.</p>`
      : '';

    return {
      subject: `${label} purchase successful - ${amount}`,
      html: emailWrapper(`Your ${label.toLowerCase()} purchase went through ✅`, `
        <p>Hi there,</p>
        <p>Your purchase of <strong>${amount}</strong> ${label.toLowerCase()}${txn.billersCode ? ` for ${txn.billersCode}` : ''} was successful.</p>
        ${pinBlock}
        ${pointsLine}
        <p style="background:#f0fdf9; border-radius:10px; padding:14px; font-size:0.9rem;">
          Reference: <span style="font-family:monospace;">${txn.reference}</span>
        </p>
      `)
    };
  }
  return {
    subject: `${label} purchase failed - refunded`,
    html: emailWrapper(`Your ${label.toLowerCase()} purchase failed ⚠️`, `
      <p>Hi there,</p>
      <p>Your purchase of <strong>${amount}</strong> ${label.toLowerCase()} could not be completed, and <strong>${amount}</strong> has been refunded to your wallet.</p>
      <p>Please try again, or reach out if this keeps happening.</p>
    `)
  };
}

/**
 * Sends the "you unlocked a discount" email after a speed test earns the
 * one-time first-purchase voucher. Kept separate from notifyTransaction
 * because the voucher isn't a Transaction record at all - it lives directly
 * on the user's speedtestDiscountPercent/EarnedAt fields until it's spent.
 */
async function notifySpeedtestDiscount(user, percent) {
  try {
    if (!user?.email) return;
    await sendEmail({
      to: user.email,
      subject: `You unlocked ${percent}% off your first purchase!`,
      html: emailWrapper('Discount unlocked 🎉', `
        <p>Hi there,</p>
        <p>Thanks for testing your network speed! A <strong>${percent}% discount</strong> has been added to your account and will be applied automatically to your first purchase.</p>
        <p>This is a one-time reward, so make it count - it expires in 30 days.</p>
      `)
    });
  } catch (err) {
    console.error('notifySpeedtestDiscount failed:', err.message);
  }
}

module.exports = { notifyTransaction, notifySpeedtestDiscount };
