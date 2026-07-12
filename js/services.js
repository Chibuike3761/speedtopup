// js/services.js - powers the post-login services hub (services.html)

if (!localStorage.getItem('token')) {
  window.location.href = 'login.html';
}

const SERVICE_CONFIG = {
  airtime: {
    title: 'Buy Airtime',
    networks: [
      { value: 'mtn', label: 'MTN' },
      { value: 'glo', label: 'Glo' },
      { value: 'airtel', label: 'Airtel' },
      { value: 'etisalat', label: '9mobile' }
    ],
    needsVariation: false,
    billersLabel: 'Phone Number',
    billersIsPhone: true
  },
  data: {
    title: 'Buy Data',
    networks: [
      { value: 'mtn-data', label: 'MTN' },
      { value: 'glo-data', label: 'Glo' },
      { value: 'airtel-data', label: 'Airtel' },
      { value: 'etisalat-data', label: '9mobile' }
    ],
    needsVariation: true,
    amountFromVariation: true, // price comes from the selected bundle, no manual amount entry
    billersLabel: 'Phone Number',
    billersIsPhone: true
  },
  tv: {
    title: 'TV Subscription',
    networks: [
      { value: 'dstv', label: 'DSTV' },
      { value: 'gotv', label: 'GOTV' },
      { value: 'startimes', label: 'StarTimes' }
    ],
    needsVariation: true,
    amountFromVariation: true, // price comes from the selected bouquet, no manual amount entry
    needsVerify: true, // look up the customer's name from their smartcard/IUC before paying
    billersLabel: 'Smartcard / IUC Number',
    billersIsPhone: false
  },
  electricity: {
    title: 'Electricity Bill',
    networks: [
      { value: 'ikeja-electric', label: 'Ikeja Electric' },
      { value: 'eko-electric', label: 'Eko Electric' },
      { value: 'abuja-electric', label: 'Abuja Electric' },
      { value: 'kano-electric', label: 'Kano Electric' },
      { value: 'portharcourt-electric', label: 'Port Harcourt Electric' },
      { value: 'ibadan-electric', label: 'Ibadan Electric' },
      { value: 'jos-electric', label: 'Jos Electric' },
      { value: 'kaduna-electric', label: 'Kaduna Electric' },
      { value: 'enugu-electric', label: 'Enugu Electric' },
      { value: 'benin-electric', label: 'Benin Electric' }
    ],
    needsVariation: true,
    variationOptions: [
      { value: 'prepaid', label: 'Prepaid' },
      { value: 'postpaid', label: 'Postpaid' }
    ],
    needsVerify: true, // look up the customer's name from their meter number before paying
    billersLabel: 'Meter Number',
    billersIsPhone: false
  },
  waec: {
    title: 'WAEC Result Checker PIN',
    networks: [{ value: 'waec', label: 'WAEC Result Checker' }],
    needsVariation: true,
    amountFromVariation: true, // real price comes from VTpass, nothing typed manually
    needsEmail: true, // PIN + serial number get emailed here, not just to the account owner
    billersLabel: 'Phone Number (to receive PIN)',
    billersIsPhone: true
  },
  water: { comingSoon: true, title: 'Water Bill', note: 'No national water-billing API exists in Nigeria yet - this will be enabled the moment one becomes available.' },
  neco: { comingSoon: true, title: 'NECO Result Checker PIN', note: 'No VTU aggregator currently offers NECO PIN vending (unlike WAEC). This tile is a placeholder for when one does.' }
};

// ---------- FUND WALLET (Paystack or Crypto) ----------
let selectedFundProvider = 'paystack';
let cryptoMinAmountCache = null; // { minAmountUsdt, minAmountNgn } once fetched, reused for the session
let cryptoNgnPerUsd = null; // derived from the above once available - lets us show a live USD estimate

function openFundModal() {
  document.getElementById('fund-amount').value = '';
  document.getElementById('fund-usd-estimate').style.display = 'none';
  selectFundProvider('paystack');
  document.getElementById('fundModal').classList.add('active');
}

function closeFundModal() {
  document.getElementById('fundModal').classList.remove('active');
}

function selectFundProvider(provider) {
  selectedFundProvider = provider;

  document.getElementById('fund-provider-paystack').classList.toggle('active', provider === 'paystack');
  document.getElementById('fund-provider-crypto').classList.toggle('active', provider === 'crypto');

  const hintEl = document.getElementById('fund-provider-hint');
  const currentLang = localStorage.getItem('speedtopup_lang') || 'en';
  const dict = (typeof SPEEDTOPUP_I18N !== 'undefined' && SPEEDTOPUP_I18N[currentLang]) || {};
  hintEl.setAttribute('data-i18n', provider === 'crypto' ? 'fund.hint.crypto' : 'fund.hint.paystack');
  hintEl.textContent = provider === 'crypto'
    ? (dict['fund.hint.crypto'] || 'Pay with USDT, BTC, BNB or other coins via a secure crypto invoice.')
    : (dict['fund.hint.paystack'] || 'Pay by card or bank transfer via Paystack.');

  const minEl = document.getElementById('fund-crypto-min');
  if (provider === 'crypto') {
    minEl.style.display = 'block';
    loadCryptoMinAmount();
  } else {
    minEl.style.display = 'none';
  }

  updateUsdEstimate();
}

async function loadCryptoMinAmount(forceRefresh = false) {
  const minEl = document.getElementById('fund-crypto-min');
  if (!minEl) return;

  if (cryptoMinAmountCache && !forceRefresh) {
    renderCryptoMinAmount(cryptoMinAmountCache);
    return;
  }

  minEl.classList.remove('is-error');
  minEl.textContent = 'Checking live minimum...';

  try {
    const res = await fetch(`${API_BASE}/wallet/fund/crypto/min-amount`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();

    if (res.ok && data.minAmountUsdt) {
      cryptoMinAmountCache = data;
      if (data.minAmountNgn) cryptoNgnPerUsd = Number(data.minAmountNgn) / Number(data.minAmountUsdt);
      renderCryptoMinAmount(data);
      updateUsdEstimate();
    } else {
      minEl.classList.add('is-error');
      minEl.textContent = data.error || 'Could not fetch the live minimum right now.';
    }
  } catch (err) {
    minEl.classList.add('is-error');
    minEl.textContent = 'Could not reach the server to check the minimum.';
  }
}

function renderCryptoMinAmount(data) {
  const minEl = document.getElementById('fund-crypto-min');
  if (!minEl) return;
  minEl.classList.remove('is-error');
  const usdt = Number(data.minAmountUsdt).toFixed(2);
  const ngn = data.minAmountNgn ? Math.ceil(Number(data.minAmountNgn)).toLocaleString() : null;
  minEl.textContent = ngn
    ? `Minimum crypto deposit: ~${usdt} USDT (≈ ₦${ngn})`
    : `Minimum crypto deposit: ~${usdt} USDT`;
}

// Shows a live "≈ $X.XX" estimate under the Naira input while crypto is
// selected, using the NGN/USD rate implied by NOWPayments' own min-amount
// data. Nothing here changes what's actually charged - the wallet is still
// funded in Naira - this is purely informational so the customer knows
// roughly how much USD-equivalent value they're paying.
function updateUsdEstimate() {
  const estimateEl = document.getElementById('fund-usd-estimate');
  if (!estimateEl) return;

  const amount = Number(document.getElementById('fund-amount').value);
  if (selectedFundProvider !== 'crypto' || !cryptoNgnPerUsd || !amount) {
    estimateEl.style.display = 'none';
    return;
  }

  const usd = amount / cryptoNgnPerUsd;
  estimateEl.textContent = `≈ $${usd.toFixed(2)} USD`;
  estimateEl.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
  const fundAmountInput = document.getElementById('fund-amount');
  if (fundAmountInput) fundAmountInput.addEventListener('input', updateUsdEstimate);
});

async function submitFundWallet(btn) {
  const amount = document.getElementById('fund-amount').value;
  if (!amount || amount < 100) return alert('Enter at least ₦100');

  if (selectedFundProvider === 'crypto' && cryptoMinAmountCache?.minAmountNgn && Number(amount) < Number(cryptoMinAmountCache.minAmountNgn)) {
    return alert(`Crypto payments below ₦${Math.ceil(cryptoMinAmountCache.minAmountNgn).toLocaleString()} (~${cryptoMinAmountCache.minAmountUsdt} USDT) will be rejected as too small. Please enter at least that amount.`);
  }

  const original = btn.textContent;
  btn.textContent = 'Redirecting...';
  btn.disabled = true;

  const endpoint = selectedFundProvider === 'crypto'
    ? `${API_BASE}/wallet/fund/crypto/initialize`
    : `${API_BASE}/wallet/fund/initialize`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ amount: Number(amount) })
    });
    const data = await res.json();

    const redirectUrl = data.authorizationUrl || data.invoiceUrl;
    if (res.ok && redirectUrl) {
      window.location.href = redirectUrl; // off to Paystack or the crypto invoice page
    } else {
      alert(data.error || 'Could not start payment');
      btn.textContent = original;
      btn.disabled = false;
    }
  } catch (err) {
    alert('Could not reach the server. Is the backend running?');
    btn.textContent = original;
    btn.disabled = false;
  }
}

// ---------- REFERRALS ----------
async function loadReferralInfo() {
  const explainerEl = document.getElementById('referral-explainer');
  const linkEl = document.getElementById('referral-link');
  if (!explainerEl) return;

  try {
    const res = await fetch(`${API_BASE}/referrals/me`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();
    if (!res.ok) {
      explainerEl.textContent = data.error || 'Could not load referral info';
      return;
    }

    explainerEl.textContent = `Share your link - your friend gets ₦${data.welcomeBonus} on signup, you get ₦${data.referrerBonus} once they make their first purchase.`;
    linkEl.value = `${window.location.origin}/register.html?ref=${data.referralCode}`;
    document.getElementById('referral-total-earned').textContent = `₦${data.totalEarned}`;
    document.getElementById('referral-count').textContent = data.referrals.length;

    const listEl = document.getElementById('referral-list');
    if (data.referrals.length === 0) {
      listEl.innerHTML = `<p style="color:var(--gray); font-size:0.88rem; margin-top:1rem;">No referrals yet - share your link above!</p>`;
    } else {
      listEl.innerHTML = data.referrals.map(r => `
        <div class="tx-row">
          <div>
            <strong>${r.email}</strong>
            <div class="tx-date">Joined ${new Date(r.joinedAt).toLocaleDateString('en-NG')}</div>
          </div>
          <span class="tx-status ${r.status === 'completed' ? 'tx-success' : 'tx-pending'}">${r.status === 'completed' ? 'earned' : 'pending purchase'}</span>
        </div>
      `).join('');
    }
  } catch (err) {
    explainerEl.textContent = 'Could not reach the server.';
  }
}

function copyReferralLink() {
  const linkEl = document.getElementById('referral-link');
  linkEl.select();
  navigator.clipboard?.writeText(linkEl.value).then(() => {
    showToast('🔗 Referral link copied!', 2500);
  }).catch(() => {
    document.execCommand('copy'); // fallback for older browsers
    showToast('🔗 Referral link copied!', 2500);
  });
}

// ---------- LOYALTY POINTS ----------
async function redeemLoyaltyPoints(btn) {
  const input = document.getElementById('loyalty-redeem-amount');
  const points = Number(input.value);

  if (!points || points <= 0) return alert('Enter how many points you want to redeem.');
  if (points % loyaltyRedemptionBlock !== 0) {
    return alert(`Points must be redeemed in blocks of ${loyaltyRedemptionBlock}.`);
  }

  const original = btn.textContent;
  btn.textContent = 'Redeeming...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/wallet/redeem-points`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ points })
    });
    const data = await res.json();

    if (res.ok && data.ok) {
      showToast(`🎉 ₦${data.cashback.toLocaleString()} added to your wallet!`, 4000);
      input.value = '';
      fetchWalletBalance();
    } else {
      alert(data.error || 'Could not redeem points right now.');
    }
  } catch (err) {
    alert('Could not reach the server. Is the backend running?');
  } finally {
    btn.textContent = original;
    btn.disabled = false;
  }
}

// ---------- SAVED BENEFICIARIES ----------
// Mirrors the Auto Top-Up modal's input pattern (uses the same SERVICE_CONFIG):
// Data/TV let you remember a specific plan, TV/Electricity require a
// name-verify before saving so a beneficiary never gets saved with a typo'd
// meter/smartcard number.
let benVerifiedBillers = null;

function openBeneficiaryModal() {
  document.getElementById('ben-label').value = '';
  document.getElementById('ben-category').value = '';
  document.getElementById('ben-network').innerHTML = '<option value="">Select category first</option>';
  document.getElementById('ben-variation-wrap').style.display = 'none';
  document.getElementById('ben-billers-label').textContent = 'Phone / Meter / Smartcard number';
  document.getElementById('ben-billers').value = '';
  document.getElementById('ben-verify-btn').style.display = 'none';
  document.getElementById('ben-verify-result').style.display = 'none';
  benVerifiedBillers = null;
  updateBenSubmitState();
  document.getElementById('beneficiaryModal').classList.add('active');
}
function closeBeneficiaryModal() { document.getElementById('beneficiaryModal').classList.remove('active'); }

function populateBenNetworks() {
  const category = document.getElementById('ben-category').value;
  const cfg = SERVICE_CONFIG[category];
  const networkSelect = document.getElementById('ben-network');
  const variationWrap = document.getElementById('ben-variation-wrap');
  const variationSelect = document.getElementById('ben-variation');
  const billersLabel = document.getElementById('ben-billers-label');
  const billersInput = document.getElementById('ben-billers');
  const verifyBtn = document.getElementById('ben-verify-btn');
  const verifyResult = document.getElementById('ben-verify-result');

  benVerifiedBillers = null;
  verifyResult.style.display = 'none';
  billersInput.value = '';

  if (!cfg) {
    networkSelect.innerHTML = '<option value="">Select category first</option>';
    variationWrap.style.display = 'none';
    verifyBtn.style.display = 'none';
    updateBenSubmitState();
    return;
  }

  networkSelect.innerHTML = '<option value="">Select</option>' +
    cfg.networks.map(n => `<option value="${n.value}">${n.label}</option>`).join('');
  billersLabel.textContent = cfg.billersLabel;
  billersInput.placeholder = cfg.billersLabel;
  verifyBtn.style.display = cfg.needsVerify ? 'inline-block' : 'none';

  if (cfg.needsVariation) {
    variationWrap.style.display = 'block';
    if (cfg.variationOptions) {
      variationSelect.innerHTML = '<option value="">Select</option>' +
        cfg.variationOptions.map(v => `<option value="${v.value}">${v.label}</option>`).join('');
      variationSelect.disabled = false;
    } else {
      variationSelect.innerHTML = '<option value="">Choose network first...</option>';
      variationSelect.disabled = true;
    }
  } else {
    variationWrap.style.display = 'none';
  }

  updateBenSubmitState();
}

function updateBenSubmitState() {
  const category = document.getElementById('ben-category').value;
  const cfg = SERVICE_CONFIG[category];
  const submitBtn = document.getElementById('ben-submit-btn');
  submitBtn.disabled = !!(cfg && cfg.needsVerify && !benVerificationMatches());
}

function benVerificationMatches() {
  if (!benVerifiedBillers) return false;
  const serviceID = document.getElementById('ben-network').value;
  const billersCode = document.getElementById('ben-billers').value.trim();
  const variationCode = document.getElementById('ben-variation').value;
  return benVerifiedBillers.serviceID === serviceID &&
    benVerifiedBillers.billersCode === billersCode &&
    benVerifiedBillers.variationCode === variationCode;
}

async function verifyBenBillersCode(btn) {
  const category = document.getElementById('ben-category').value;
  const cfg = SERVICE_CONFIG[category];
  const serviceID = document.getElementById('ben-network').value;
  const billersCode = document.getElementById('ben-billers').value.trim();
  const variationCode = document.getElementById('ben-variation').value;
  const verifyResult = document.getElementById('ben-verify-result');

  if (!serviceID) return alert('Please select a provider first');
  if (!billersCode) return alert(`Please enter the ${cfg.billersLabel.toLowerCase()}`);
  if (category === 'electricity' && !variationCode) return alert('Please select Prepaid or Postpaid first');

  const original = btn.textContent;
  btn.textContent = 'Verifying...';
  btn.disabled = true;
  verifyResult.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/services/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ serviceID, billersCode, type: category === 'electricity' ? variationCode : undefined })
    });
    const data = await res.json();
    const name = data?.content?.Customer_Name || data?.content?.customerName || data?.content?.customer_name;

    if (res.ok && name) {
      benVerifiedBillers = { serviceID, billersCode, variationCode, name };
      verifyResult.className = 'verify-result verify-ok';
      verifyResult.textContent = `✅ ${name}`;
      verifyResult.style.display = 'block';
    } else {
      benVerifiedBillers = null;
      verifyResult.className = 'verify-result verify-fail';
      verifyResult.textContent = `❌ ${data.error || data?.content?.error || 'Could not verify this number - please check it and try again.'}`;
      verifyResult.style.display = 'block';
    }
  } catch (err) {
    benVerifiedBillers = null;
    verifyResult.className = 'verify-result verify-fail';
    verifyResult.textContent = '❌ Could not reach the server. Is the backend running?';
    verifyResult.style.display = 'block';
  } finally {
    btn.textContent = original;
    btn.disabled = false;
    updateBenSubmitState();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const benNetworkSelect = document.getElementById('ben-network');
  const benVariationSelect = document.getElementById('ben-variation');
  if (!benNetworkSelect || !benVariationSelect) return; // this page doesn't have the modal

  benNetworkSelect.addEventListener('change', async (e) => {
    benVerifiedBillers = null;
    document.getElementById('ben-verify-result').style.display = 'none';
    updateBenSubmitState();

    const category = document.getElementById('ben-category').value;
    const cfg = SERVICE_CONFIG[category];
    if (!cfg || !cfg.needsVariation || cfg.variationOptions) return; // electricity uses fixed prepaid/postpaid

    const serviceID = e.target.value;
    if (!serviceID) return;

    benVariationSelect.disabled = true;
    benVariationSelect.innerHTML = '<option>Loading plans...</option>';
    try {
      const res = await fetch(`${API_BASE}/services/variations/${serviceID}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      const list = data?.content?.varations || data?.content?.variations || [];
      if (!res.ok || !list.length) throw new Error('none');

      benVariationSelect.innerHTML = '<option value="">Select a plan</option>' +
        list.map(v => `<option value="${v.variation_code}" data-amount="${v.variation_amount}">${v.name} - ₦${v.variation_amount}</option>`).join('');
      benVariationSelect.disabled = false;
    } catch (err) {
      benVariationSelect.innerHTML = '<option value="">Plans unavailable right now (VTpass not connected yet)</option>';
    }
  });

  benVariationSelect.addEventListener('change', () => {
    benVerifiedBillers = null;
    document.getElementById('ben-verify-result').style.display = 'none';
    updateBenSubmitState();
  });

  document.getElementById('ben-billers').addEventListener('input', () => {
    benVerifiedBillers = null;
    document.getElementById('ben-verify-result').style.display = 'none';
    updateBenSubmitState();
  });
});

async function submitBeneficiary(btn) {
  const label = document.getElementById('ben-label').value.trim();
  const category = document.getElementById('ben-category').value;
  const cfg = SERVICE_CONFIG[category];
  const serviceID = document.getElementById('ben-network').value;
  const variationCode = document.getElementById('ben-variation').value;
  const billersCode = document.getElementById('ben-billers').value.trim();

  if (!label || !category || !serviceID || !billersCode) return alert('All fields are required');
  if (cfg && cfg.needsVerify && !benVerificationMatches()) {
    return alert(`Please verify the ${cfg.billersLabel.toLowerCase()} first so you can confirm the customer name before saving.`);
  }

  const original = btn.textContent;
  btn.textContent = 'Saving...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/beneficiaries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ label, category, serviceID, billersCode, variationCode: variationCode || undefined })
    });
    const data = await res.json();
    if (res.ok) {
      closeBeneficiaryModal();
      loadBeneficiaries();
    } else {
      alert(data.error || 'Could not save beneficiary');
    }
  } catch (err) {
    alert('Could not reach the server.');
  } finally {
    btn.textContent = original;
    btn.disabled = false;
  }
}
// Reuses SERVICE_CONFIG (defined above for the main Buy/Pay modal) so this
// modal behaves identically per category: Data/TV pull real plan prices with
// no manual amount entry, TV/Electricity require a name-verify before saving,
// and Airtime/Electricity keep a manual amount field.
let atuVerifiedBillers = null;

function openAutoTopUpModal() {
  document.getElementById('atu-label').value = '';
  document.getElementById('atu-category').value = '';
  document.getElementById('atu-network').innerHTML = '<option value="">Select category first</option>';
  document.getElementById('atu-variation-wrap').style.display = 'none';
  document.getElementById('atu-billers-label').textContent = 'Phone / Meter / Smartcard number';
  document.getElementById('atu-billers').value = '';
  document.getElementById('atu-verify-btn').style.display = 'none';
  document.getElementById('atu-verify-result').style.display = 'none';
  document.getElementById('atu-amount').value = '';
  document.getElementById('atu-amount').style.display = 'block';
  document.getElementById('atu-amount-display').style.display = 'none';
  atuVerifiedBillers = null;
  updateAtuSubmitState();
  document.getElementById('autoTopUpModal').classList.add('active');
}
function closeAutoTopUpModal() { document.getElementById('autoTopUpModal').classList.remove('active'); }

function populateAtuNetworks() {
  const category = document.getElementById('atu-category').value;
  const cfg = SERVICE_CONFIG[category];
  const networkSelect = document.getElementById('atu-network');
  const variationWrap = document.getElementById('atu-variation-wrap');
  const variationSelect = document.getElementById('atu-variation');
  const billersLabel = document.getElementById('atu-billers-label');
  const billersInput = document.getElementById('atu-billers');
  const verifyBtn = document.getElementById('atu-verify-btn');
  const verifyResult = document.getElementById('atu-verify-result');
  const amountInput = document.getElementById('atu-amount');
  const amountDisplay = document.getElementById('atu-amount-display');

  atuVerifiedBillers = null;
  verifyResult.style.display = 'none';
  billersInput.value = '';
  amountInput.value = '';

  if (!cfg) {
    networkSelect.innerHTML = '<option value="">Select category first</option>';
    variationWrap.style.display = 'none';
    verifyBtn.style.display = 'none';
    amountInput.style.display = 'block';
    amountDisplay.style.display = 'none';
    updateAtuSubmitState();
    return;
  }

  networkSelect.innerHTML = '<option value="">Select</option>' +
    cfg.networks.map(n => `<option value="${n.value}">${n.label}</option>`).join('');
  billersLabel.textContent = cfg.billersLabel;
  billersInput.placeholder = cfg.billersLabel;
  verifyBtn.style.display = cfg.needsVerify ? 'inline-block' : 'none';

  if (cfg.needsVariation) {
    variationWrap.style.display = 'block';
    if (cfg.variationOptions) {
      variationSelect.innerHTML = '<option value="">Select</option>' +
        cfg.variationOptions.map(v => `<option value="${v.value}">${v.label}</option>`).join('');
      variationSelect.disabled = false;
    } else {
      variationSelect.innerHTML = '<option value="">Choose network first...</option>';
      variationSelect.disabled = true;
    }
  } else {
    variationWrap.style.display = 'none';
  }

  if (cfg.amountFromVariation) {
    amountInput.style.display = 'none';
    amountDisplay.style.display = 'block';
    amountDisplay.textContent = 'Select a plan to see the price';
  } else {
    amountInput.style.display = 'block';
    amountDisplay.style.display = 'none';
  }

  updateAtuSubmitState();
}

function updateAtuSubmitState() {
  const category = document.getElementById('atu-category').value;
  const cfg = SERVICE_CONFIG[category];
  const submitBtn = document.getElementById('atu-submit-btn');
  submitBtn.disabled = !!(cfg && cfg.needsVerify && !atuVerificationMatches());
}

function atuVerificationMatches() {
  if (!atuVerifiedBillers) return false;
  const serviceID = document.getElementById('atu-network').value;
  const billersCode = document.getElementById('atu-billers').value.trim();
  const variationCode = document.getElementById('atu-variation').value;
  return atuVerifiedBillers.serviceID === serviceID &&
    atuVerifiedBillers.billersCode === billersCode &&
    atuVerifiedBillers.variationCode === variationCode;
}

async function verifyAtuBillersCode(btn) {
  const category = document.getElementById('atu-category').value;
  const cfg = SERVICE_CONFIG[category];
  const serviceID = document.getElementById('atu-network').value;
  const billersCode = document.getElementById('atu-billers').value.trim();
  const variationCode = document.getElementById('atu-variation').value;
  const verifyResult = document.getElementById('atu-verify-result');

  if (!serviceID) return alert('Please select a provider first');
  if (!billersCode) return alert(`Please enter the ${cfg.billersLabel.toLowerCase()}`);
  if (category === 'electricity' && !variationCode) return alert('Please select Prepaid or Postpaid first');

  const original = btn.textContent;
  btn.textContent = 'Verifying...';
  btn.disabled = true;
  verifyResult.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/services/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ serviceID, billersCode, type: category === 'electricity' ? variationCode : undefined })
    });
    const data = await res.json();
    const name = data?.content?.Customer_Name || data?.content?.customerName || data?.content?.customer_name;

    if (res.ok && name) {
      atuVerifiedBillers = { serviceID, billersCode, variationCode, name };
      verifyResult.className = 'verify-result verify-ok';
      verifyResult.textContent = `✅ ${name}`;
      verifyResult.style.display = 'block';
    } else {
      atuVerifiedBillers = null;
      verifyResult.className = 'verify-result verify-fail';
      verifyResult.textContent = `❌ ${data.error || data?.content?.error || 'Could not verify this number - please check it and try again.'}`;
      verifyResult.style.display = 'block';
    }
  } catch (err) {
    atuVerifiedBillers = null;
    verifyResult.className = 'verify-result verify-fail';
    verifyResult.textContent = '❌ Could not reach the server. Is the backend running?';
    verifyResult.style.display = 'block';
  } finally {
    btn.textContent = original;
    btn.disabled = false;
    updateAtuSubmitState();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const atuNetworkSelect = document.getElementById('atu-network');
  const atuVariationSelect = document.getElementById('atu-variation');
  if (!atuNetworkSelect || !atuVariationSelect) return; // this page doesn't have the modal

  atuNetworkSelect.addEventListener('change', async (e) => {
    atuVerifiedBillers = null;
    document.getElementById('atu-verify-result').style.display = 'none';
    updateAtuSubmitState();

    const category = document.getElementById('atu-category').value;
    const cfg = SERVICE_CONFIG[category];
    if (cfg && cfg.amountFromVariation) {
      document.getElementById('atu-amount-display').textContent = 'Select a plan to see the price';
      document.getElementById('atu-amount').value = '';
    }
    if (!cfg || !cfg.needsVariation || cfg.variationOptions) return; // electricity uses fixed prepaid/postpaid

    const serviceID = e.target.value;
    if (!serviceID) return;

    atuVariationSelect.disabled = true;
    atuVariationSelect.innerHTML = '<option>Loading plans...</option>';
    try {
      const res = await fetch(`${API_BASE}/services/variations/${serviceID}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      const list = data?.content?.varations || data?.content?.variations || [];
      if (!res.ok || !list.length) throw new Error('none');

      atuVariationSelect.innerHTML = '<option value="">Select a plan</option>' +
        list.map(v => `<option value="${v.variation_code}" data-amount="${v.variation_amount}">${v.name} - ₦${v.variation_amount}</option>`).join('');
      atuVariationSelect.disabled = false;
    } catch (err) {
      atuVariationSelect.innerHTML = '<option value="">Plans unavailable right now (VTpass not connected yet)</option>';
    }
  });

  atuVariationSelect.addEventListener('change', (e) => {
    atuVerifiedBillers = null;
    document.getElementById('atu-verify-result').style.display = 'none';
    updateAtuSubmitState();

    const category = document.getElementById('atu-category').value;
    const cfg = SERVICE_CONFIG[category];
    if (!cfg || !cfg.amountFromVariation) return;

    const selectedOption = e.target.selectedOptions[0];
    const amount = selectedOption ? selectedOption.getAttribute('data-amount') : null;
    const amountDisplay = document.getElementById('atu-amount-display');
    const amountInput = document.getElementById('atu-amount');

    if (amount) {
      amountInput.value = amount;
      amountDisplay.textContent = `Amount: ₦${Number(amount).toLocaleString()}`;
    } else {
      amountInput.value = '';
      amountDisplay.textContent = 'Select a plan to see the price';
    }
  });

  document.getElementById('atu-billers').addEventListener('input', () => {
    atuVerifiedBillers = null;
    document.getElementById('atu-verify-result').style.display = 'none';
    updateAtuSubmitState();
  });
});

async function loadBeneficiaries() {
  const container = document.getElementById('beneficiary-list');
  if (!container) return;
  try {
    const res = await fetch(`${API_BASE}/beneficiaries`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();
    if (!data.beneficiaries || data.beneficiaries.length === 0) {
      container.innerHTML = `<p style="padding:1.2rem 1.5rem; color:var(--gray);">No saved beneficiaries yet.</p>`;
      return;
    }
    container.innerHTML = data.beneficiaries.map(b => `
      <div class="tx-row">
        <div>
          <strong>${b.label}</strong>
          <span class="tx-sub">${b.serviceID.toUpperCase()}</span>
          <div class="tx-date">${b.billersCode}</div>
        </div>
        <div class="tx-right">
          <button class="btn btn-primary" style="padding:6px 14px; font-size:0.8rem;" onclick="useBeneficiary('${b.category}','${b.serviceID}','${b.billersCode}','${b.variationCode || ''}')">Use</button>
          <button class="btn btn-secondary" style="padding:6px 14px; font-size:0.8rem; margin-top:6px;" onclick="deleteBeneficiary('${b._id}')">Delete</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<p style="padding:1.2rem 1.5rem; color:var(--gray);">Could not load beneficiaries.</p>`;
  }
}

function useBeneficiary(category, serviceID, billersCode, variationCode) {
  openServiceModal(category);
  setTimeout(() => {
    document.getElementById('service-network').value = serviceID;
    document.getElementById('service-network').dispatchEvent(new Event('change'));
    document.getElementById('service-billers').value = billersCode;

    // The network change above kicks off an async fetch of that provider's
    // plans (for Data/TV) - wait for it to actually finish populating before
    // trying to select the remembered plan, or the option won't exist yet.
    if (variationCode) {
      const variationSelect = document.getElementById('service-variation');
      let attempts = 0;
      const tryApply = setInterval(() => {
        attempts += 1;
        const hasOption = [...variationSelect.options].some(o => o.value === variationCode);
        if (hasOption) {
          variationSelect.value = variationCode;
          variationSelect.dispatchEvent(new Event('change'));
          clearInterval(tryApply);
        } else if (attempts > 20) { // ~4 seconds - plans never loaded (e.g. VTpass not connected)
          clearInterval(tryApply);
        }
      }, 200);
    }
  }, 50);
}

async function deleteBeneficiary(id) {
  if (!confirm('Remove this beneficiary?')) return;
  try {
    await fetch(`${API_BASE}/beneficiaries/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    loadBeneficiaries();
  } catch (err) {
    alert('Could not delete beneficiary.');
  }
}

async function submitAutoTopUp(btn) {
  const label = document.getElementById('atu-label').value.trim();
  const category = document.getElementById('atu-category').value;
  const cfg = SERVICE_CONFIG[category];
  const serviceID = document.getElementById('atu-network').value;
  const variationCode = document.getElementById('atu-variation').value;
  const billersCode = document.getElementById('atu-billers').value.trim();
  const amount = document.getElementById('atu-amount').value;
  const frequencyDays = document.getElementById('atu-frequency').value;

  if (!label || !category || !serviceID || !billersCode || !amount) return alert('All fields are required');
  if (cfg && cfg.needsVariation && !variationCode) return alert('Please select a plan/bouquet');
  if (cfg && cfg.needsVerify && !atuVerificationMatches()) {
    return alert(`Please verify the ${cfg.billersLabel.toLowerCase()} first so you can confirm the customer name before saving.`);
  }

  const original = btn.textContent;
  btn.textContent = 'Creating...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/autotopup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ label, category, serviceID, variationCode: variationCode || undefined, billersCode, amount: Number(amount), frequencyDays: Number(frequencyDays) })
    });
    const data = await res.json();
    if (res.ok) {
      closeAutoTopUpModal();
      loadAutoTopUps();
    } else {
      alert(data.error || 'Could not create schedule');
    }
  } catch (err) {
    alert('Could not reach the server.');
  } finally {
    btn.textContent = original;
    btn.disabled = false;
  }
}

const FREQUENCY_LABELS = { 1: 'Daily', 7: 'Weekly', 30: 'Monthly' };

async function loadAutoTopUps() {
  const container = document.getElementById('autotopup-list');
  if (!container) return;
  try {
    const res = await fetch(`${API_BASE}/autotopup`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();
    if (!data.autoTopUps || data.autoTopUps.length === 0) {
      container.innerHTML = `<p style="padding:1.2rem 1.5rem; color:var(--gray);">No auto top-ups set up yet.</p>`;
      return;
    }
    container.innerHTML = data.autoTopUps.map(a => {
      const nextRun = new Date(a.nextRunAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
      const statusBadge = a.active
        ? `<span class="tx-status tx-success">active</span>`
        : `<span class="tx-status tx-pending">paused</span>`;
      const lastRun = a.lastRunAt
        ? `<div class="tx-date">Last run: ${new Date(a.lastRunAt).toLocaleDateString('en-NG')} - ${a.lastStatus}</div>`
        : '';
      return `
        <div class="tx-row">
          <div>
            <strong>${a.label}</strong>
            <span class="tx-sub">${FREQUENCY_LABELS[a.frequencyDays] || a.frequencyDays + 'd'}</span>
            <div class="tx-date">₦${a.amount} · Next: ${nextRun}</div>
            ${lastRun}
          </div>
          <div class="tx-right">
            ${statusBadge}
            <div style="margin-top:6px;">
              <button class="btn btn-secondary" style="padding:6px 14px; font-size:0.8rem;" onclick="toggleAutoTopUp('${a._id}')">${a.active ? 'Pause' : 'Resume'}</button>
              <button class="btn btn-secondary" style="padding:6px 14px; font-size:0.8rem; margin-top:6px;" onclick="deleteAutoTopUp('${a._id}')">Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<p style="padding:1.2rem 1.5rem; color:var(--gray);">Could not load auto top-ups.</p>`;
  }
}

async function toggleAutoTopUp(id) {
  try {
    await fetch(`${API_BASE}/autotopup/${id}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    loadAutoTopUps();
  } catch (err) {
    alert('Could not update schedule.');
  }
}

async function deleteAutoTopUp(id) {
  if (!confirm('Delete this auto top-up schedule?')) return;
  try {
    await fetch(`${API_BASE}/autotopup/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    loadAutoTopUps();
  } catch (err) {
    alert('Could not delete schedule.');
  }
}

let currentCategory = null;

// ---------- TRANSACTION HISTORY ----------
const CATEGORY_LABELS = {
  airtime: 'Airtime', data: 'Data', tv: 'TV Subscription', electricity: 'Electricity',
  water: 'Water Bill', waec: 'WAEC PIN', neco: 'NECO PIN',
  'wallet-funding': 'Wallet Funding', 'speedtest-bonus': 'Speed Test Bonus'
};

let txCurrentPage = 1;
let txHasMore = false;
const TX_PAGE_SIZE = 10;

function getTransactionFilters() {
  return {
    category: document.getElementById('tx-filter-category')?.value || '',
    status: document.getElementById('tx-filter-status')?.value || '',
    dateFrom: document.getElementById('tx-filter-date-from')?.value || '',
    dateTo: document.getElementById('tx-filter-date-to')?.value || '',
    minAmount: document.getElementById('tx-filter-min-amount')?.value || '',
    maxAmount: document.getElementById('tx-filter-max-amount')?.value || ''
  };
}

function renderTransactionRows(transactions) {
  return transactions.map(t => {
    const label = CATEGORY_LABELS[t.category] || t.category;
    const date = new Date(t.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
    const statusClass = t.status === 'success' ? 'tx-success' : t.status === 'failed' ? 'tx-failed' : 'tx-pending';
    const amountLabel = t.category === 'speedtest-bonus' ? `${t.amount}MB` : `₦${t.amount}`;
    return `
      <div class="tx-row">
        <div>
          <strong>${label}</strong>
          ${t.serviceID ? `<span class="tx-sub">${t.serviceID.toUpperCase()}</span>` : ''}
          <div class="tx-date">${date}</div>
        </div>
        <div class="tx-right">
          <div class="tx-amount">${amountLabel}</div>
          <span class="tx-status ${statusClass}">${t.status}</span>
        </div>
      </div>
    `;
  }).join('');
}

// append=false: fresh load or a filter change, replaces everything shown.
// append=true: "See More" was clicked, adds the next page onto what's there.
async function loadTransactionHistory(append = false) {
  const container = document.getElementById('transaction-history');
  const seeMoreBtn = document.getElementById('tx-see-more-btn');
  if (!container) return;

  if (!append) {
    txCurrentPage = 1;
    container.innerHTML = `<p style="color:var(--gray);">Loading...</p>`;
  }

  try {
    const filters = getTransactionFilters();
    const params = new URLSearchParams({ page: txCurrentPage, limit: TX_PAGE_SIZE });
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });

    const res = await fetch(`${API_BASE}/wallet/transactions?${params.toString()}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();

    if (!res.ok) {
      container.innerHTML = `<p style="color:var(--gray);">${data.error || 'Could not load transaction history'}</p>`;
      if (seeMoreBtn) seeMoreBtn.style.display = 'none';
      return;
    }

    if (!data.transactions || data.transactions.length === 0) {
      if (!append) {
        container.innerHTML = `<p style="color:var(--gray);">No transactions match these filters yet.</p>`;
      }
      if (seeMoreBtn) seeMoreBtn.style.display = 'none';
      return;
    }

    const rowsHtml = renderTransactionRows(data.transactions);
    container.innerHTML = append ? container.innerHTML + rowsHtml : rowsHtml;

    txHasMore = !!data.hasMore;
    if (seeMoreBtn) seeMoreBtn.style.display = txHasMore ? 'block' : 'none';
  } catch (err) {
    if (!append) container.innerHTML = `<p style="color:var(--gray);">Could not reach the server to load your history.</p>`;
  }
}

function loadMoreTransactions() {
  if (!txHasMore) return;
  txCurrentPage += 1;
  loadTransactionHistory(true);
}

function applyTransactionFilters() {
  loadTransactionHistory(false);
}

function resetTransactionFilters() {
  ['tx-filter-category', 'tx-filter-status', 'tx-filter-date-from', 'tx-filter-date-to', 'tx-filter-min-amount', 'tx-filter-max-amount']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  loadTransactionHistory(false);
}

// ---------- LIVE PENDING TRANSACTION TRACKER ----------
// A purchase that comes back "pending" from VTpass (code 099) isn't stuck -
// the backend requeries it automatically every 5 minutes and auto-refunds
// after 2 hours if the provider never answers. This panel just makes that
// process visible in real time instead of leaving the customer guessing.
let pendingPollTimer = null;

async function loadPendingTransactions() {
  const section = document.getElementById('pending-tracker-section');
  const list = document.getElementById('pending-tracker-list');
  const countEl = document.getElementById('pending-tracker-count');
  if (!section || !list) return;

  try {
    const res = await fetch(`${API_BASE}/transactions/pending`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    if (!res.ok) { section.style.display = 'none'; return; }
    const data = await res.json();
    const pending = data.pending || [];

    if (pending.length === 0) {
      section.style.display = 'none';
      stopPendingPolling();
      return;
    }

    section.style.display = '';
    if (countEl) countEl.textContent = pending.length === 1 ? '1 processing' : `${pending.length} processing`;
    renderPendingList(pending);
    startPendingPolling();
  } catch (err) {
    // Silent - the pending panel just won't update this cycle, next poll will retry.
  }
}

function renderPendingList(pending) {
  const list = document.getElementById('pending-tracker-list');
  list.innerHTML = pending.map(t => {
    const label = CATEGORY_LABELS[t.category] || t.category;
    const date = new Date(t.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
    return `
      <div class="tx-row" id="pending-row-${t.reference}">
        <div>
          <strong>${label}</strong>
          ${t.serviceID ? `<span class="tx-sub">${t.serviceID.toUpperCase()}</span>` : ''}
          <div class="tx-date">${date} &middot; ${t.reference}</div>
        </div>
        <div class="tx-right">
          <div class="tx-amount">₦${t.amount}</div>
          <span class="tx-status tx-pending"><i class="fas fa-spinner fa-spin"></i> processing</span>
          <div><button class="btn btn-secondary" style="padding:2px 10px; font-size:0.75rem; margin-top:6px;" onclick="checkOneNow('${t.reference}', this)">Check now</button></div>
        </div>
      </div>
    `;
  }).join('');
}

// Polls every 20s while anything is pending - most customers will watch
// their order flip to "success" without ever touching "Check now".
function startPendingPolling() {
  if (pendingPollTimer) return; // already running
  pendingPollTimer = setInterval(checkAllPendingStatuses, 20000);
}

function stopPendingPolling() {
  if (pendingPollTimer) {
    clearInterval(pendingPollTimer);
    pendingPollTimer = null;
  }
}

async function checkAllPendingStatuses() {
  const rows = document.querySelectorAll('[id^="pending-row-"]');
  if (rows.length === 0) { stopPendingPolling(); return; }

  let anyResolved = false;
  for (const row of rows) {
    const reference = row.id.replace('pending-row-', '');
    try {
      const res = await fetch(`${API_BASE}/transactions/${reference}/status`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.status && data.status !== 'pending') anyResolved = true;
    } catch (err) {
      // Network hiccup - the next 20s cycle will just try again.
    }
  }

  if (anyResolved) {
    loadPendingTransactions();
    loadTransactionHistory();
    fetchWalletBalance();
  }
}

// Manual "Check now" button on a single row - same endpoint the poller uses,
// just for the person who doesn't want to wait 20 seconds.
async function checkOneNow(reference, btn) {
  const original = btn.textContent;
  btn.textContent = 'Checking...';
  btn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/transactions/${reference}/status`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();
    if (data.status && data.status !== 'pending') {
      loadPendingTransactions();
      loadTransactionHistory();
      fetchWalletBalance();
      return;
    }
  } catch (err) {
    // ignore - button just resets below
  }
  btn.textContent = original;
  btn.disabled = false;
}

// Tracks the last successful verification, so we know it's still valid for
// whatever's currently in the network/variation/billers fields. Cleared any
// time one of those changes, forcing a re-verify before Pay Now is allowed.
let verifiedBillers = null;

function openServiceModal(category) {
  const cfg = SERVICE_CONFIG[category];
  if (!cfg) return;

  if (cfg.comingSoon) {
    alert(`${cfg.title}\n\n${cfg.note}`);
    return;
  }

  currentCategory = category;
  verifiedBillers = null;
  document.getElementById('service-modal-title').textContent = cfg.title;

  const networkSelect = document.getElementById('service-network');
  networkSelect.innerHTML = '<option value="">Select</option>' +
    cfg.networks.map(n => `<option value="${n.value}">${n.label}</option>`).join('');

  const variationWrap = document.getElementById('variation-wrap');
  const variationSelect = document.getElementById('service-variation');
  if (cfg.needsVariation) {
    variationWrap.style.display = 'block';
    if (cfg.variationOptions) {
      variationSelect.innerHTML = '<option value="">Select</option>' +
        cfg.variationOptions.map(v => `<option value="${v.value}">${v.label}</option>`).join('');
      variationSelect.disabled = false;
    } else {
      variationSelect.innerHTML = '<option value="">Choose network first...</option>';
    }
  } else {
    variationWrap.style.display = 'none';
  }

  document.getElementById('service-billers-label').textContent = cfg.billersLabel;
  document.getElementById('service-billers').value = '';

  // Amount: either a manual field (airtime, electricity, waec) or a read-only
  // display driven by the chosen plan's price (data, tv).
  const amountInput = document.getElementById('service-amount');
  const amountDisplay = document.getElementById('service-amount-display');
  amountInput.value = '';
  if (cfg.amountFromVariation) {
    amountInput.style.display = 'none';
    amountDisplay.style.display = 'block';
    amountDisplay.textContent = 'Select a plan to see the price';
  } else {
    amountInput.style.display = 'block';
    amountDisplay.style.display = 'none';
  }

  // Verify row: only shown for categories where we look up a customer name
  // (TV smartcard/IUC, electricity meter) before allowing payment.
  const verifyBtn = document.getElementById('service-verify-btn');
  const verifyResult = document.getElementById('service-verify-result');
  verifyResult.style.display = 'none';
  verifyResult.className = 'verify-result';
  verifyBtn.style.display = cfg.needsVerify ? 'inline-block' : 'none';

  // Email row: only shown for categories where the deliverable (e.g. a WAEC
  // PIN) needs to be sent somewhere specific, which may not be the account
  // owner's own inbox.
  const emailWrap = document.getElementById('service-email-wrap');
  document.getElementById('service-email').value = '';
  emailWrap.style.display = cfg.needsEmail ? 'block' : 'none';

  updatePayButtonState();
  document.getElementById('serviceModal').classList.add('active');
}

// Pay Now is disabled until: (a) categories that need verification have a
// fresh, matching verified name, and (b) an amount is actually present.
function updatePayButtonState() {
  const cfg = SERVICE_CONFIG[currentCategory];
  const payBtn = document.getElementById('service-pay-btn');
  if (!cfg) { payBtn.disabled = false; return; }

  if (cfg.needsVerify && !currentVerificationMatches()) {
    payBtn.disabled = true;
    return;
  }
  payBtn.disabled = false;
}

function currentVerificationMatches() {
  if (!verifiedBillers) return false;
  const serviceID = document.getElementById('service-network').value;
  const billersCode = document.getElementById('service-billers').value.trim();
  const variationCode = document.getElementById('service-variation').value;
  return verifiedBillers.serviceID === serviceID &&
    verifiedBillers.billersCode === billersCode &&
    verifiedBillers.variationCode === variationCode;
}

function clearVerificationState() {
  verifiedBillers = null;
  const verifyResult = document.getElementById('service-verify-result');
  verifyResult.style.display = 'none';
  updatePayButtonState();
}

async function verifyBillersCode(btn) {
  const cfg = SERVICE_CONFIG[currentCategory];
  const serviceID = document.getElementById('service-network').value;
  const billersCode = document.getElementById('service-billers').value.trim();
  const variationCode = document.getElementById('service-variation').value;
  const verifyResult = document.getElementById('service-verify-result');

  if (!serviceID) return alert('Please select a provider first');
  if (!billersCode) return alert(`Please enter the ${cfg.billersLabel.toLowerCase()}`);
  if (currentCategory === 'electricity' && !variationCode) return alert('Please select Prepaid or Postpaid first');

  const original = btn.textContent;
  btn.textContent = (typeof SPEEDTOPUP_I18N !== 'undefined' && SPEEDTOPUP_I18N[localStorage.getItem('speedtopup_lang') || 'en']?.['modal.verifying']) || 'Verifying...';
  btn.disabled = true;
  verifyResult.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/services/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        serviceID,
        billersCode,
        type: currentCategory === 'electricity' ? variationCode : undefined
      })
    });
    const data = await res.json();

    const name = data?.content?.Customer_Name || data?.content?.customerName ||
      data?.content?.customer_name || data?.content?.Meter_Number_Name;

    if (res.ok && name) {
      verifiedBillers = { serviceID, billersCode, variationCode, name };
      verifyResult.className = 'verify-result verify-ok';
      verifyResult.textContent = `✅ ${name}`;
      verifyResult.style.display = 'block';
    } else {
      verifiedBillers = null;
      verifyResult.className = 'verify-result verify-fail';
      verifyResult.textContent = `❌ ${data.error || data?.content?.error || 'Could not verify this number - please check it and try again.'}`;
      verifyResult.style.display = 'block';
    }
  } catch (err) {
    verifiedBillers = null;
    verifyResult.className = 'verify-result verify-fail';
    verifyResult.textContent = '❌ Could not reach the server. Is the backend running?';
    verifyResult.style.display = 'block';
  } finally {
    btn.textContent = original;
    btn.disabled = false;
    updatePayButtonState();
  }
}

// When a network is picked for data/tv, fetch live variation plans from the backend
document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('isAdmin') === 'true') {
    const adminLink = document.getElementById('nav-admin-link');
    if (adminLink) adminLink.style.display = 'inline';
  }

  document.getElementById('service-network').addEventListener('change', async (e) => {
    clearVerificationState();

    const cfg = SERVICE_CONFIG[currentCategory];
    if (cfg && cfg.amountFromVariation) {
      document.getElementById('service-amount-display').textContent = 'Select a plan to see the price';
      document.getElementById('service-amount').value = '';
    }
    if (!cfg || !cfg.needsVariation || cfg.variationOptions) return; // electricity uses fixed prepaid/postpaid

    const variationSelect = document.getElementById('service-variation');
    const serviceID = e.target.value;
    if (!serviceID) return;

    variationSelect.innerHTML = '<option>Loading plans...</option>';
    try {
      const res = await fetch(`${API_BASE}/services/variations/${serviceID}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      const list = data?.content?.varations || data?.content?.variations || [];
      if (!res.ok || !list.length) throw new Error('none');

      variationSelect.innerHTML = '<option value="">Select a plan</option>' +
        list.map(v => `<option value="${v.variation_code}" data-amount="${v.variation_amount}">${v.name} - ₦${v.variation_amount}</option>`).join('');
    } catch (err) {
      variationSelect.innerHTML = '<option value="">Plans unavailable right now (VTpass not connected yet)</option>';
    }
  });

  document.getElementById('service-variation').addEventListener('change', (e) => {
    clearVerificationState();

    const cfg = SERVICE_CONFIG[currentCategory];
    if (!cfg || !cfg.amountFromVariation) return;

    const selectedOption = e.target.selectedOptions[0];
    const amount = selectedOption ? selectedOption.getAttribute('data-amount') : null;
    const amountDisplay = document.getElementById('service-amount-display');
    const amountInput = document.getElementById('service-amount');

    if (amount) {
      amountInput.value = amount;
      amountDisplay.textContent = `Amount: ₦${Number(amount).toLocaleString()}`;
    } else {
      amountInput.value = '';
      amountDisplay.textContent = 'Select a plan to see the price';
    }
  });

  document.getElementById('service-billers').addEventListener('input', clearVerificationState);
});

function closeServiceModal() {
  document.getElementById('serviceModal').classList.remove('active');
  currentCategory = null;
}

async function submitServicePurchase(btn) {
  const cfg = SERVICE_CONFIG[currentCategory];
  const serviceID = document.getElementById('service-network').value;
  const variationCode = document.getElementById('service-variation').value;
  const billersCode = document.getElementById('service-billers').value.trim();
  const amount = document.getElementById('service-amount').value;

  if (!serviceID) return alert('Please select a network/provider');
  if (cfg.needsVariation && !variationCode) return alert('Please select a plan/bouquet');
  if (!billersCode) return alert(`Please enter the ${cfg.billersLabel.toLowerCase()}`);
  if (!amount) return alert('Please enter an amount');
  if (cfg.needsVerify && !currentVerificationMatches()) {
    return alert(`Please verify the ${cfg.billersLabel.toLowerCase()} first so you can confirm the customer name before paying.`);
  }
  const recipientEmail = document.getElementById('service-email').value.trim();
  if (cfg.needsEmail && !recipientEmail) return alert('Please enter an email address to receive the PIN and serial number');

  const original = btn.textContent;
  btn.textContent = 'Processing...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/services/purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        category: currentCategory,
        serviceID,
        variationCode: variationCode || undefined,
        amount: Number(amount),
        phone: cfg.billersIsPhone ? billersCode : document.getElementById('service-billers').value,
        billersCode,
        recipientEmail: recipientEmail || undefined
      })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      const pointsMsg = data.pointsEarned > 0 ? ` You earned ${data.pointsEarned} loyalty points!` : '';
      const discountMsg = data.discountApplied > 0 ? ` Your first-purchase discount saved you ₦${data.discountApplied.toLocaleString()}!` : '';
      alert(data.message + discountMsg + pointsMsg);
      closeServiceModal();
      fetchWalletBalance();
      loadTransactionHistory();
      loadPendingTransactions();
    } else {
      alert(data.error || 'Purchase failed');
    }
  } catch (err) {
    alert('Could not reach the server. Is the backend running?');
  } finally {
    btn.textContent = original;
    btn.disabled = false;
  }
}
