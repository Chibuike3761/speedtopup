// js/admin.js - powers admin.html
// Client-side isAdmin flag is only used to skip a flash of content before the
// real check lands - every actual number on this page comes from /api/admin/*
// endpoints, which are protected server-side by requireAdmin regardless of
// what's sitting in this browser's localStorage.

if (!localStorage.getItem('token')) {
  window.location.href = 'login.html';
}

let usersPage = 1;
let txnPage = 1;
let usersSearchTimer = null;
let txnSearchTimer = null;

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

function money(n) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatDate(d) {
  return new Date(d).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
}

const CATEGORY_LABELS = {
  airtime: 'Airtime', data: 'Data', tv: 'TV', electricity: 'Electricity',
  water: 'Water', waec: 'WAEC', neco: 'NECO', 'wallet-funding': 'Wallet Funding',
  'speedtest-bonus': 'Speedtest Bonus', 'referral-bonus': 'Referral Bonus',
  'loyalty-redemption': 'Loyalty Redemption'
};

async function loadOverview() {
  const res = await fetch(`${API_BASE}/admin/overview`, { headers: authHeaders() });
  if (res.status === 403) {
    document.getElementById('admin-guard-message').style.display = 'block';
    document.getElementById('admin-content').style.display = 'none';
    return false;
  }
  if (!res.ok) throw new Error('overview failed');
  const data = await res.json();

  document.getElementById('admin-content').style.display = 'block';
  document.getElementById('admin-guard-message').style.display = 'none';

  document.getElementById('stat-total-users').textContent = data.users.totalUsers.toLocaleString();
  document.getElementById('stat-verified-users').textContent = data.users.verifiedUsers.toLocaleString();
  document.getElementById('stat-wallet-balance').textContent = money(data.users.totalWalletBalance);
  document.getElementById('stat-revenue-total').textContent = money(data.revenue.allTime);
  document.getElementById('stat-revenue-today').textContent = money(data.revenue.today);
  document.getElementById('stat-wallet-funded').textContent = money(data.walletFunding.total);
  document.getElementById('stat-loyalty-outstanding').textContent = `${data.loyalty.pointsOutstanding.toLocaleString()} pts`;
  document.getElementById('stat-loyalty-redeemed').textContent = money(data.loyalty.totalRedeemed);
  document.getElementById('stat-discount-cost').textContent =
    `${money(data.speedtestDiscount.cost)} (${data.speedtestDiscount.redemptions})`;

  renderBarList('revenue-by-category', data.revenue.byCategory.map((c) => ({
    label: CATEGORY_LABELS[c.category] || c.category,
    value: c.total,
    sub: `${c.count} txns`
  })), data.revenue.allTime);

  renderBarList('funding-by-provider', data.walletFunding.byProvider.map((p) => ({
    label: p.provider === 'crypto' ? 'Crypto' : 'Paystack',
    value: p.total,
    sub: `${p.count} txns`
  })), data.walletFunding.total);

  renderBarList('txn-by-status', data.transactionsByStatus.map((s) => ({
    label: s.status.charAt(0).toUpperCase() + s.status.slice(1),
    value: s.count,
    sub: `${s.count} txns`,
    isCount: true
  })), data.transactionsByStatus.reduce((sum, s) => sum + s.count, 0));

  document.getElementById('referral-total').textContent = data.referrals.totalReferrals;
  document.getElementById('referral-completed').textContent = data.referrals.completedReferrals;

  return true;
}

function renderBarList(containerId, items, total) {
  const el = document.getElementById(containerId);
  if (!items.length) {
    el.innerHTML = '<p class="admin-loading">No data yet.</p>';
    return;
  }
  el.innerHTML = items.map((item) => {
    const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
    const displayValue = item.isCount ? item.value : money(item.value);
    return `
      <div class="admin-bar-row">
        <div class="admin-bar-row-top">
          <span>${item.label}</span>
          <span>${displayValue} <small style="color:var(--gray);">(${item.sub})</small></span>
        </div>
        <div class="admin-bar-track"><div class="admin-bar-fill" style="width:${pct}%;"></div></div>
      </div>`;
  }).join('');
}

// Renders the state of a user's one-time speedtest discount voucher.
function discountCell(u) {
  if (!u.speedtestDiscountEarnedAt) return '<span style="color:var(--gray);">—</span>';
  if (u.speedtestDiscountUsedAt) return `<span class="admin-pill">Used (${u.speedtestDiscountPercent}%)</span>`;
  return `<span class="admin-pill success">${u.speedtestDiscountPercent}% unused</span>`;
}

async function loadUsers(page = 1) {
  usersPage = page;
  const search = document.getElementById('user-search').value.trim();
  const url = `${API_BASE}/admin/users?page=${page}&limit=15${search ? `&search=${encodeURIComponent(search)}` : ''}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) return;
  const data = await res.json();

  const body = document.getElementById('users-table-body');
  if (!data.users.length) {
    body.innerHTML = '<tr><td colspan="7" class="admin-loading">No users found.</td></tr>';
  } else {
    body.innerHTML = data.users.map((u) => `
      <tr>
        <td>${u.email}${u.isAdmin ? ' <span class="admin-badge">admin</span>' : ''}</td>
        <td>${u.phone}</td>
        <td>${u.isVerified ? '<span class="admin-pill success">Yes</span>' : '<span class="admin-pill">No</span>'}</td>
        <td>${money(u.walletBalance)}</td>
        <td>${discountCell(u)}</td>
        <td>${(u.loyaltyPoints || 0).toLocaleString()} pts</td>
        <td>${formatDate(u.createdAt)}</td>
      </tr>`).join('');
  }

  renderPagination('users-pagination', data.page, data.pages, loadUsers);
}

async function loadTransactions(page = 1) {
  txnPage = page;
  const search = document.getElementById('txn-search').value.trim();
  const category = document.getElementById('txn-filter-category').value;
  const status = document.getElementById('txn-filter-status').value;
  const provider = document.getElementById('txn-filter-provider').value;

  const params = new URLSearchParams({ page, limit: 15 });
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  if (status) params.set('status', status);
  if (provider) params.set('provider', provider);

  const res = await fetch(`${API_BASE}/admin/transactions?${params}`, { headers: authHeaders() });
  if (!res.ok) return;
  const data = await res.json();

  const body = document.getElementById('txn-table-body');
  if (!data.transactions.length) {
    body.innerHTML = '<tr><td colspan="7" class="admin-loading">No transactions found.</td></tr>';
  } else {
    body.innerHTML = data.transactions.map((t) => `
      <tr>
        <td>${t.user?.email || 'Deleted user'}</td>
        <td>${CATEGORY_LABELS[t.category] || t.category}</td>
        <td>${money(t.amount)}</td>
        <td><span class="admin-pill ${t.status === 'success' ? 'success' : t.status === 'failed' ? 'failed' : ''}">${t.status}</span></td>
        <td>${t.category === 'wallet-funding' ? (t.provider === 'crypto' ? 'Crypto' : 'Paystack') : '-'}</td>
        <td class="admin-ref">${t.reference}</td>
        <td>${formatDate(t.createdAt)}</td>
      </tr>`).join('');
  }

  renderPagination('txn-pagination', data.page, data.pages, loadTransactions);
}

function renderPagination(containerId, page, pages, loadFn) {
  const el = document.getElementById(containerId);
  if (pages <= 1) { el.innerHTML = ''; return; }

  let html = '';
  html += `<button ${page <= 1 ? 'disabled' : ''} onclick="(${loadFn.name})(${page - 1})"><i class="fas fa-chevron-left"></i></button>`;
  html += `<span>Page ${page} of ${pages}</span>`;
  html += `<button ${page >= pages ? 'disabled' : ''} onclick="(${loadFn.name})(${page + 1})"><i class="fas fa-chevron-right"></i></button>`;
  el.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const ok = await loadOverview();
    if (!ok) return;
    await Promise.all([loadUsers(1), loadTransactions(1)]);
  } catch (err) {
    console.error(err);
    alert('Could not reach the server. Is the backend running?');
  }

  document.getElementById('user-search').addEventListener('input', () => {
    clearTimeout(usersSearchTimer);
    usersSearchTimer = setTimeout(() => loadUsers(1), 400);
  });

  document.getElementById('txn-search').addEventListener('input', () => {
    clearTimeout(txnSearchTimer);
    txnSearchTimer = setTimeout(() => loadTransactions(1), 400);
  });
  document.getElementById('txn-filter-category').addEventListener('change', () => loadTransactions(1));
  document.getElementById('txn-filter-status').addEventListener('change', () => loadTransactions(1));
  document.getElementById('txn-filter-provider').addEventListener('change', () => loadTransactions(1));
});
