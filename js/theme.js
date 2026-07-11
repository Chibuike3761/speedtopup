// js/theme.js - dark/light mode toggle, shared across every page.
// Applies a data-theme="dark" attribute on <html>, which css/style.css reads
// to swap a small set of CSS variables (surface/border/text colors).
// Persisted in localStorage so the choice carries across pages and visits.

const NAIJAFAST_THEME_KEY = 'naijafast_theme';

function naijafastApplyTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');

  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  }
}

function naijafastToggleTheme() {
  const current = localStorage.getItem(NAIJAFAST_THEME_KEY) || 'light';
  const next = current === 'light' ? 'dark' : 'light';
  localStorage.setItem(NAIJAFAST_THEME_KEY, next);
  naijafastApplyTheme(next);
}

// Applied immediately (not waiting for DOMContentLoaded) to avoid a flash of
// the wrong theme while the rest of the page is still loading.
(function () {
  const saved = localStorage.getItem(NAIJAFAST_THEME_KEY) || 'light';
  document.documentElement.setAttribute('data-theme', saved === 'dark' ? 'dark' : 'light');
})();

document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem(NAIJAFAST_THEME_KEY) || 'light';
  naijafastApplyTheme(saved);
});
