// js/map.js - SINGLE SOURCE OF TRUTH
// Relative path works everywhere - localhost, phone via ngrok, or a real deployment -
// since the backend now also serves this frontend from the same origin.
const API_BASE = '/api';

document.addEventListener('DOMContentLoaded', function () {
  console.log('✅ NaijaFast loaded');

  initMap();
  initPriceGrid();
  updateAuthUI();
});

// ---------- MAP ----------
let naijaMap = null;

function initMap() {
  const el = document.getElementById('map');
  if (!el || typeof L === 'undefined') return;
  naijaMap = L.map('map').setView([9.0, 8.0], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(naijaMap);

  loadRecentSpeedTests();
}

const NETWORK_COLORS = {
  mtn: '#ffcc00',
  glo: '#00a859',
  airtel: '#ed1c24',
  etisalat: '#8b5cf6'
};
const NETWORK_LABELS = { mtn: 'MTN', glo: 'Glo', airtel: 'Airtel', etisalat: '9mobile' };

async function loadRecentSpeedTests() {
  if (!naijaMap) return;
  try {
    const res = await fetch(`${API_BASE}/speedtest/recent`);
    const data = await res.json();
    (data.results || []).forEach(r => {
      const color = NETWORK_COLORS[r.network] || '#94a3b8';
      const networkLabel = NETWORK_LABELS[r.network] || 'Network not specified';
      L.circleMarker([r.lat, r.lng], {
        radius: 6,
        color,
        fillColor: color,
        fillOpacity: 0.75
      })
        .addTo(naijaMap)
        .bindPopup(`<strong>${networkLabel}</strong><br>↓ ${r.downloadMbps} Mbps${r.uploadMbps ? ` · ↑ ${r.uploadMbps} Mbps` : ''}`);
    });
  } catch (e) {
    console.warn('Could not load live speed map data:', e.message);
  }
}

function plotOwnSpeedTest(lat, lng, downloadMbps, uploadMbps, network, accuracyMeters) {
  if (!naijaMap) return;
  if (window.__ownSpeedMarker) naijaMap.removeLayer(window.__ownSpeedMarker);
  if (window.__ownAccuracyCircle) naijaMap.removeLayer(window.__ownAccuracyCircle);

  const networkLabel = NETWORK_LABELS[network] || 'Network not specified';
  const accuracyNote = accuracyMeters
    ? `<br><small>Accurate to ~${Math.round(accuracyMeters)}m</small>`
    : '';

  window.__ownSpeedMarker = L.marker([lat, lng]) // default pin icon - visually distinct from the crowd dots
    .addTo(naijaMap)
    .bindPopup(`📍 <strong>Your speed test</strong> (${networkLabel})<br>↓ ${downloadMbps} Mbps &nbsp; ↑ ${uploadMbps} Mbps${accuracyNote}`)
    .openPopup();

  // Shows the margin of error as a shaded circle - honest about how precise this really is,
  // instead of implying pinpoint accuracy the browser can't actually guarantee.
  if (accuracyMeters) {
    window.__ownAccuracyCircle = L.circle([lat, lng], {
      radius: accuracyMeters,
      color: '#ef4444',
      fillColor: '#ef4444',
      fillOpacity: 0.1,
      weight: 1
    }).addTo(naijaMap);
  }

  naijaMap.setView([lat, lng], accuracyMeters && accuracyMeters > 5000 ? 9 : 12);
}

// ---------- LIVE PRICES ----------
function initPriceGrid() {
  const grid = document.getElementById('price-grid');
  if (!grid) return;
  const prices = [
    { name: 'MTN SME', amount: 225 },
    { name: 'Airtel CG', amount: 240 },
    { name: 'Glo', amount: 235 },
    { name: '9mobile', amount: 260 }
  ];
  grid.innerHTML = prices.map(p => `
    <div class="price-card">
      <h3>${p.name}</h3>
      <div class="price">₦${p.amount} <small>/GB</small></div>
    </div>
  `).join('');
}

// ---------- TOAST (non-blocking notification, unlike alert()) ----------
function showToast(message, duration = 4500) {
  let container = document.getElementById('nf-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'nf-toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'nf-toast';
  toast.innerHTML = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('nf-toast-out'), duration - 300);
  setTimeout(() => toast.remove(), duration);
}

// ---------- AUTH STATE (shared across every page) ----------
function updateAuthUI() {
  const statusEl = document.getElementById('auth-status');
  const navLogin = document.getElementById('nav-login');
  const navRegister = document.getElementById('nav-register');
  const navLogoutWrap = document.getElementById('nav-logout-wrap');
  const loggedIn = !!localStorage.getItem('token');

  if (statusEl) {
    statusEl.textContent = loggedIn ? '✅ You are logged in' : 'Not logged in';
  }

  if (navLogin) navLogin.style.display = loggedIn ? 'none' : 'inline';
  if (navRegister) navRegister.style.display = loggedIn ? 'none' : 'inline';
  if (navLogoutWrap) navLogoutWrap.style.display = loggedIn ? 'inline-flex' : 'none';

  const walletBalanceEl = document.getElementById('wallet-balance');
  const discountBadgeEl = document.getElementById('discount-badge');
  const loyaltyBalanceEl = document.getElementById('loyalty-points-balance');
  if ((walletBalanceEl || discountBadgeEl || loyaltyBalanceEl) && loggedIn) fetchWalletBalance();
}

// Services nav link: sends logged-in users straight to the hub, everyone else to login first.
window.goToServices = function () {
  window.location.href = localStorage.getItem('token') ? 'services.html' : 'login.html';
};

let loyaltyRedemptionBlock = 100;
let loyaltyRedemptionValue = 50;

async function fetchWalletBalance() {
  const el = document.getElementById('wallet-balance');
  const discountBadge = document.getElementById('discount-badge');
  const discountBadgeText = document.getElementById('discount-badge-text');
  const loyaltyBalanceEl = document.getElementById('loyalty-points-balance');
  const loyaltyValueEl = document.getElementById('loyalty-redeemable-value');
  if (!el && !discountBadge && !loyaltyBalanceEl) return;
  try {
    const res = await fetch(`${API_BASE}/wallet`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();
    // Note: the ₦ symbol already lives in the surrounding HTML - only the number goes here.
    if (el) el.textContent = data.balance ?? 0;

    // Only show the badge while there's an unused voucher to spend.
    if (discountBadge) {
      const discount = data.discount;
      const hasUnusedVoucher = discount && discount.earned && !discount.used;
      discountBadge.style.display = hasUnusedVoucher ? '' : 'none';
      if (hasUnusedVoucher && discountBadgeText) {
        discountBadgeText.textContent = `${discount.percent}% off first order`;
      }
    }

    if (data.loyaltyRedemptionBlock) loyaltyRedemptionBlock = data.loyaltyRedemptionBlock;
    if (data.loyaltyRedemptionValue) loyaltyRedemptionValue = data.loyaltyRedemptionValue;

    if (loyaltyBalanceEl) {
      const points = data.loyaltyPoints ?? 0;
      loyaltyBalanceEl.textContent = points.toLocaleString();
      const redeemableBlocks = Math.floor(points / loyaltyRedemptionBlock);
      if (loyaltyValueEl) loyaltyValueEl.textContent = `₦${(redeemableBlocks * loyaltyRedemptionValue).toLocaleString()}`;
    }
  } catch (e) {
    if (el) el.textContent = '0';
    if (discountBadge) discountBadge.style.display = 'none';
  }
}

window.logout = function () {
  localStorage.removeItem('token');
  localStorage.removeItem('isAdmin');
  alert('Logged out successfully');
  window.location.href = 'index.html';
};

// ---------- PASSWORD TOGGLE ----------
window.togglePassword = function (inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
};

// ---------- LOGIN ----------
window.performLogin = async function () {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) return alert('Email and password are required');

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (res.ok && data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('isAdmin', data.isAdmin ? 'true' : 'false');
      window.location.href = 'services.html'; // straight to the services hub, not the homepage
    } else if (data.needsVerification) {
      alert('Please verify your phone number first.');
      window.location.href = `verify-otp.html?phone=${encodeURIComponent(data.phone)}`;
    } else {
      alert(data.error || 'Login failed. Check your details.');
    }
  } catch (err) {
    alert('Could not reach the server. Is the backend running?');
  }
};

// ---------- REGISTER ----------
window.performRegister = async function () {
  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const password = document.getElementById('reg-password').value;
  if (!email || !phone || !password) return alert('All fields are required');

  const referralCode = new URLSearchParams(window.location.search).get('ref') || undefined;

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, phone, password, referralCode })
    });
    const data = await res.json();

    if (res.ok) {
      // devOtp is only ever sent when the backend has no TERMII_API_KEY set (dev mode)
      if (data.devOtp) console.log(`📩 DEV OTP for ${phone}: ${data.devOtp}`);
      window.location.href = `verify-otp.html?phone=${encodeURIComponent(phone)}${data.devOtp ? `&dev=${data.devOtp}` : ''}`;
    } else {
      alert(data.error || 'Registration failed');
    }
  } catch (err) {
    alert('Could not reach the server. Is the backend running?');
  }
};

// ---------- OTP VERIFICATION ----------
window.performVerifyOtp = async function (phone) {
  const code = document.getElementById('otp-code').value.trim();
  if (!code) return alert('Enter the 6-digit code');

  try {
    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code })
    });
    const data = await res.json();

    if (res.ok && data.token) {
      localStorage.setItem('token', data.token);
      alert('Phone verified! Welcome to NaijaFast.');
      window.location.href = 'services.html';
    } else {
      alert(data.error || 'Verification failed');
    }
  } catch (err) {
    alert('Could not reach the server. Is the backend running?');
  }
};

window.performResendOtp = async function (phone) {
  try {
    const res = await fetch(`${API_BASE}/auth/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await res.json();
    if (res.ok) {
      alert('A new code has been sent.');
      if (data.devOtp) console.log(`📩 DEV OTP for ${phone}: ${data.devOtp}`);
    } else {
      alert(data.error || 'Could not resend code');
    }
  } catch (err) {
    alert('Could not reach the server. Is the backend running?');
  }
};

// ---------- BUY DATA MODAL (used on index.html) ----------
window.buyData = function () {
  if (!localStorage.getItem('token')) {
    alert('Please login first');
    window.location.href = 'login.html';
    return;
  }
  // On the homepage this opens the modal; on buy.html there is no modal so go straight there.
  const modal = document.getElementById('buyDataModal');
  if (modal) {
    modal.classList.add('active');
  } else {
    window.location.href = 'services.html';
  }
};

window.closeBuyModal = function () {
  const modal = document.getElementById('buyDataModal');
  if (modal) modal.classList.remove('active');
};

// Plans are fetched live from the backend (which pulls them from VTpass) so
// the price shown always matches what will actually be charged - nothing
// here is manually typed or hardcoded.
document.addEventListener('DOMContentLoaded', () => {
  const networkSelect = document.getElementById('modal-network');
  const variationSelect = document.getElementById('modal-variation');
  if (!networkSelect || !variationSelect) return; // this page doesn't have the modal

  networkSelect.addEventListener('change', async (e) => {
    const serviceID = e.target.value;
    const amountDisplay = document.getElementById('modal-amount-display');
    const payBtn = document.getElementById('modal-pay-btn');
    payBtn.disabled = true;
    amountDisplay.textContent = 'Select a plan to see the price';

    if (!serviceID) {
      variationSelect.innerHTML = '<option value="">Choose network first...</option>';
      variationSelect.disabled = true;
      return;
    }

    variationSelect.disabled = true;
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
      variationSelect.disabled = false;
    } catch (err) {
      variationSelect.innerHTML = '<option value="">Plans unavailable right now (VTpass not connected yet)</option>';
    }
  });

  variationSelect.addEventListener('change', (e) => {
    const selectedOption = e.target.selectedOptions[0];
    const amount = selectedOption ? selectedOption.getAttribute('data-amount') : null;
    const amountDisplay = document.getElementById('modal-amount-display');
    const payBtn = document.getElementById('modal-pay-btn');

    if (amount) {
      amountDisplay.textContent = `Amount: ₦${Number(amount).toLocaleString()}`;
      payBtn.disabled = false;
    } else {
      amountDisplay.textContent = 'Select a plan to see the price';
      payBtn.disabled = true;
    }
  });
});

window.submitBuyData = async function (buttonEl) {
  const serviceID = document.getElementById('modal-network').value;
  const variationSelect = document.getElementById('modal-variation');
  const variationCode = variationSelect.value;
  const phone = document.getElementById('modal-phone').value.trim();
  const selectedOption = variationSelect.selectedOptions[0];
  const amount = selectedOption ? selectedOption.getAttribute('data-amount') : null;

  if (!serviceID) return alert('Please select a network');
  if (!variationCode || !amount) return alert('Please select a data plan');
  if (!phone) return alert('Please enter a phone number');

  const btn = buttonEl || event.target;
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
        category: 'data',
        serviceID,
        variationCode,
        amount: Number(amount),
        phone,
        billersCode: phone
      })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      alert(data.message || 'Purchase successful!');
      closeBuyModal();
      fetchWalletBalance();
    } else {
      alert(data.error || 'Purchase failed');
    }
  } catch (err) {
    alert('Could not reach the server. Is the backend running?');
  } finally {
    btn.textContent = original;
    btn.disabled = false;
  }
};

// ---------- BEST NETWORK NEAR ME ----------
window.findBestNetwork = async function () {
  const btn = document.getElementById('best-network-btn');
  const resultsEl = document.getElementById('best-network-results');
  const original = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Locating you...';
  btn.disabled = true;
  resultsEl.innerHTML = '';

  try {
    const coords = await getLocationSafely();
    if (!coords) {
      resultsEl.innerHTML = `<p class="best-network-empty">We need location access to do this - please allow it and try again.</p>`;
      return;
    }

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking nearby tests...';
    const res = await fetch(`${API_BASE}/speedtest/best-network?lat=${coords.lat}&lng=${coords.lng}&radiusKm=30`);
    const data = await res.json();

    if (!res.ok) {
      resultsEl.innerHTML = `<p class="best-network-empty">${data.error || 'Something went wrong'}</p>`;
      return;
    }

    if (!data.ranked || data.ranked.length === 0) {
      resultsEl.innerHTML = `
        <p class="best-network-empty">
          No speed tests recorded within ${data.radiusKm}km of you yet.
          Be the first — run a speed test above and pick your network to start building this for your area!
        </p>`;
      return;
    }

    resultsEl.innerHTML = data.ranked.map((r, i) => {
      const color = NETWORK_COLORS[r.network] || '#94a3b8';
      const label = NETWORK_LABELS[r.network] || r.network;
      const medal = i === 0 ? '🏆 ' : '';
      return `
        <div class="network-rank-row">
          <span class="network-rank-dot" style="background:${color}"></span>
          <span class="network-rank-label">${medal}${label}</span>
          <span class="network-rank-speed">↓ ${r.avgDownloadMbps} Mbps${r.avgUploadMbps ? ` · ↑ ${r.avgUploadMbps} Mbps` : ''}</span>
          <span class="network-rank-samples">${r.sampleCount} test${r.sampleCount === 1 ? '' : 's'}${r.lowConfidence ? ' (limited data)' : ''}</span>
        </div>`;
    }).join('') + `<p class="best-network-radius">Based on tests within ${data.radiusKm}km of your current location, last 30 days.</p>`;
  } catch (err) {
    resultsEl.innerHTML = `<p class="best-network-empty">Could not reach the server. Is the backend running?</p>`;
  } finally {
    btn.innerHTML = original;
    btn.disabled = false;
  }
};

// ---------- SPEED TEST (real measurement) ----------
// Downloads AND uploads test data via Cloudflare's public, CORS-open speed-test
// endpoints and times each transfer - a genuine client-side measurement (the
// same technique most DIY speed tools use), not a fake timer. Like any
// browser-based test it's an estimate, not carrier-grade, but it's real.
window.runSpeedTest = async function () {
  if (!localStorage.getItem('token')) {
    alert('Please login to run a speed test and claim your bonus.');
    window.location.href = 'login.html';
    return;
  }

  const btn = document.getElementById('speed-test-btn');
  const original = btn ? btn.innerHTML : null;
  if (btn) btn.disabled = true;

  try {
    // --- Download ---
    if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing download...';
    const downloadBytes = 5_000_000; // 5MB
    const downloadUrl = `https://speed.cloudflare.com/__down?bytes=${downloadBytes}&cachebust=${Date.now()}`;
    const dlStart = performance.now();
    const dlRes = await fetch(downloadUrl, { cache: 'no-store' });
    const dlBlob = await dlRes.blob();
    const dlSeconds = (performance.now() - dlStart) / 1000;
    const downloadMbps = Number(((dlBlob.size * 8) / dlSeconds / 1_000_000).toFixed(2));

    // --- Upload ---
    if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing upload...';
    const uploadBytes = 2_000_000; // 2MB
    const uploadPayload = new Blob([new Uint8Array(uploadBytes)]);
    const ulStart = performance.now();
    await fetch(`https://speed.cloudflare.com/__up`, {
      method: 'POST',
      body: uploadPayload,
      cache: 'no-store'
    });
    const ulSeconds = (performance.now() - ulStart) / 1000;
    const uploadMbps = Number(((uploadBytes * 8) / ulSeconds / 1_000_000).toFixed(2));

    // --- Location (optional - the map is opt-in via the browser's own permission prompt) ---
    if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting location...';
    const coords = await getLocationSafely();

    const body = JSON.stringify({
      downloadMbps,
      uploadMbps,
      pingMs: null,
      lat: coords?.lat,
      lng: coords?.lng,
      network: document.getElementById('speedtest-network')?.value || undefined
    });

    const speedRes = await fetch(`${API_BASE}/speedtest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body
    });
    const data = await speedRes.json();
    const network = document.getElementById('speedtest-network')?.value;

    // Drop the pin immediately - doesn't wait on any dialog being dismissed.
    if (coords) plotOwnSpeedTest(coords.lat, coords.lng, downloadMbps, uploadMbps, network, coords.accuracyMeters);

    showToast(
      `✅ Download: <strong>${downloadMbps} Mbps</strong> · Upload: <strong>${uploadMbps} Mbps</strong><br>${data.note || data.message || ''}`
    );
    fetchWalletBalance();

    if (!coords) {
      showToast('📍 Location access was not granted, so this result won\'t appear as a pin on the map.', 5000);
    } else if (coords.accuracyMeters && coords.accuracyMeters > 5000) {
      showToast(
        `⚠️ Your location could only be estimated to within ~${Math.round(coords.accuracyMeters / 1000)}km. ` +
        `This is common on desktop/laptop (no GPS chip). For a precise pin, run the test on your phone with location services (GPS) turned on.`,
        7000
      );
    }
  } catch (err) {
    showToast('⚠️ Could not complete the speed test. Check your connection and try again.');
  } finally {
    if (btn) {
      btn.innerHTML = original;
      btn.disabled = false;
    }
  }
};

function getLocationSafely() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyMeters: pos.coords.accuracy
      }),
      () => resolve(null), // permission denied or unavailable - test still works, just won't appear on the map
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}
