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
    billersLabel: 'Meter Number',
    billersIsPhone: false
  },
  waec: {
    title: 'WAEC Result Checker PIN',
    networks: [{ value: 'waec', label: 'WAEC Result Checker' }],
    needsVariation: false,
    billersLabel: 'Phone Number (to receive PIN)',
    billersIsPhone: true,
    fixedAmount: null // fetched live if VTpass is configured; otherwise ask the user
  },
  water: { comingSoon: true, title: 'Water Bill', note: 'No national water-billing API exists in Nigeria yet - this will be enabled the moment one becomes available.' },
  neco: { comingSoon: true, title: 'NECO Result Checker PIN', note: 'No VTU aggregator currently offers NECO PIN vending (unlike WAEC). This tile is a placeholder for when one does.' }
};

// ---------- FUND WALLET (Paystack or Crypto) ----------
let selectedFundProvider = 'paystack';
let cryptoMinAmountCache = null; // { minAmountUsdt, minAmountNgn } once fetched, reused for the session

function openFundModal() {
  document.getElementById('fund-amount').value = '';
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
  const currentLang = localStorage.getItem('naijafast_lang') || 'en';
  const dict = (typeof NAIJAFAST_I18N !== 'undefined' && NAIJAFAST_I18N[currentLang]) || {};
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
      renderCryptoMinAmount(data);
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
const BEN_NETWORKS = {
  airtime: [{ v: 'mtn', l: 'MTN' }, { v: 'glo', l: 'Glo' }, { v: 'airtel', l: 'Airtel' }, { v: 'etisalat', l: '9mobile' }],
  data: [{ v: 'mtn-data', l: 'MTN' }, { v: 'glo-data', l: 'Glo' }, { v: 'airtel-data', l: 'Airtel' }, { v: 'etisalat-data', l: '9mobile' }],
  tv: [{ v: 'dstv', l: 'DSTV' }, { v: 'gotv', l: 'GOTV' }, { v: 'startimes', l: 'StarTimes' }],
  electricity: [{ v: 'ikeja-electric', l: 'Ikeja Electric' }, { v: 'eko-electric', l: 'Eko Electric' }, { v: 'abuja-electric', l: 'Abuja Electric' }]
};

function populateBenNetworks() { fillNetworkSelect('ben-category', 'ben-network'); }
function populateAtuNetworks() { fillNetworkSelect('atu-category', 'atu-network'); }

function fillNetworkSelect(categoryId, networkId) {
  const category = document.getElementById(categoryId).value;
  const select = document.getElementById(networkId);
  const options = BEN_NETWORKS[category] || [];
  select.innerHTML = options.length
    ? '<option value="">Select</option>' + options.map(o => `<option value="${o.v}">${o.l}</option>`).join('')
    : '<option value="">Select category first</option>';
}

function openBeneficiaryModal() { document.getElementById('beneficiaryModal').classList.add('active'); }
function closeBeneficiaryModal() { document.getElementById('beneficiaryModal').classList.remove('active'); }

async function submitBeneficiary(btn) {
  const label = document.getElementById('ben-label').value.trim();
  const category = document.getElementById('ben-category').value;
  const serviceID = document.getElementById('ben-network').value;
  const billersCode = document.getElementById('ben-billers').value.trim();

  if (!label || !category || !serviceID || !billersCode) return alert('All fields are required');

  const original = btn.textContent;
  btn.textContent = 'Saving...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/beneficiaries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ label, category, serviceID, billersCode })
    });
    const data = await res.json();
    if (res.ok) {
      closeBeneficiaryModal();
      document.getElementById('ben-label').value = '';
      document.getElementById('ben-billers').value = '';
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
          <button class="btn btn-primary" style="padding:6px 14px; font-size:0.8rem;" onclick="useBeneficiary('${b.category}','${b.serviceID}','${b.billersCode}')">Use</button>
          <button class="btn btn-secondary" style="padding:6px 14px; font-size:0.8rem; margin-top:6px;" onclick="deleteBeneficiary('${b._id}')">Delete</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<p style="padding:1.2rem 1.5rem; color:var(--gray);">Could not load beneficiaries.</p>`;
  }
}

function useBeneficiary(category, serviceID, billersCode) {
  openServiceModal(category);
  setTimeout(() => {
    document.getElementById('service-network').value = serviceID;
    document.getElementById('service-network').dispatchEvent(new Event('change'));
    document.getElementById('service-billers').value = billersCode;
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

// ---------- AUTO TOP-UP ----------
function openAutoTopUpModal() { document.getElementById('autoTopUpModal').classList.add('active'); }
function closeAutoTopUpModal() { document.getElementById('autoTopUpModal').classList.remove('active'); }

async function submitAutoTopUp(btn) {
  const label = document.getElementById('atu-label').value.trim();
  const category = document.getElementById('atu-category').value;
  const serviceID = document.getElementById('atu-network').value;
  const billersCode = document.getElementById('atu-billers').value.trim();
  const amount = document.getElementById('atu-amount').value;
  const frequencyDays = document.getElementById('atu-frequency').value;

  if (!label || !category || !serviceID || !billersCode || !amount) return alert('All fields are required');

  const original = btn.textContent;
  btn.textContent = 'Creating...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/autotopup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ label, category, serviceID, billersCode, amount: Number(amount), frequencyDays: Number(frequencyDays) })
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

async function loadTransactionHistory() {
  const container = document.getElementById('transaction-history');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/wallet/transactions`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();

    if (!res.ok) {
      container.innerHTML = `<p style="color:var(--gray);">${data.error || 'Could not load transaction history'}</p>`;
      return;
    }

    if (!data.transactions || data.transactions.length === 0) {
      container.innerHTML = `<p style="color:var(--gray);">No transactions yet — your purchases and speed test bonuses will show up here.</p>`;
      return;
    }

    container.innerHTML = data.transactions.map(t => {
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
  } catch (err) {
    container.innerHTML = `<p style="color:var(--gray);">Could not reach the server to load your history.</p>`;
  }
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

function openServiceModal(category) {
  const cfg = SERVICE_CONFIG[category];
  if (!cfg) return;

  if (cfg.comingSoon) {
    alert(`${cfg.title}\n\n${cfg.note}`);
    return;
  }

  currentCategory = category;
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
  document.getElementById('service-amount').value = '';
  document.getElementById('serviceModal').classList.add('active');
}

// When a network is picked for data/tv, fetch live variation plans from the backend
document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('isAdmin') === 'true') {
    const adminLink = document.getElementById('nav-admin-link');
    if (adminLink) adminLink.style.display = 'inline';
  }

  document.getElementById('service-network').addEventListener('change', async (e) => {
    const cfg = SERVICE_CONFIG[currentCategory];
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
        list.map(v => `<option value="${v.variation_code}">${v.name} - ₦${v.variation_amount}</option>`).join('');
    } catch (err) {
      variationSelect.innerHTML = '<option value="">Type plan code manually below (VTpass not connected yet)</option>';
    }
  });
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
        billersCode
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
