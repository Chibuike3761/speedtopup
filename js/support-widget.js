// ---------- FLOATING SUPPORT BUTTON ----------
// Renders a fixed "need help?" button in the bottom-right corner of every
// page this script is included on, but ONLY for logged-in users (checked
// via the same 'token' localStorage key the rest of the site uses). Safe to
// include on pre-login pages like login.html - it just won't render there
// until the user has a token, and since login/logout both do a full page
// navigation in this app, a one-time check at load is enough - no need to
// watch for auth changes mid-page.
//
// Clicking it opens a small panel with two ways to reach a human: WhatsApp
// chat and email.
//
// TODO before going live: replace SUPPORT_WHATSAPP_NUMBER and SUPPORT_EMAIL
// below with your real contact details.
//
// SUPPORT_WHATSAPP_NUMBER can be the SAME number used for WhatsApp ordering
// (backend/routes/whatsapp.js) - customers can order there too - or a
// separate, human-staffed line if you'd rather keep bot orders and support
// conversations apart. International format, digits only, no + or spaces.
const SUPPORT_WHATSAPP_NUMBER = '2349036666700'; // TODO: replace with your real WhatsApp number
const SUPPORT_WHATSAPP_MESSAGE = 'Hi NaijaFast, I need help with my account.';
const SUPPORT_EMAIL = 'support@naijafast.example'; // TODO: replace with your real support email

(function renderSupportWidget() {
  if (document.getElementById('support-widget')) return; // guard against double-include
  if (!localStorage.getItem('token')) return; // support is for logged-in customers only

  const waLink = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(SUPPORT_WHATSAPP_MESSAGE)}`;

  const wrap = document.createElement('div');
  wrap.id = 'support-widget';
  wrap.innerHTML = `
    <div id="support-panel" class="support-panel" role="dialog" aria-label="Contact support">
      <div class="support-panel-header">
        <strong>Need help?</strong>
        <button type="button" id="support-panel-close" aria-label="Close">&times;</button>
      </div>
      <a class="support-option" href="${waLink}" target="_blank" rel="noopener">
        <i class="fa-brands fa-whatsapp"></i>
        <div>
          <strong>Chat on WhatsApp</strong>
          <span>Usually replies within minutes</span>
        </div>
      </a>
      <a class="support-option" href="mailto:${SUPPORT_EMAIL}">
        <i class="fa-solid fa-envelope"></i>
        <div>
          <strong>Email us</strong>
          <span>${SUPPORT_EMAIL}</span>
        </div>
      </a>
    </div>
    <button type="button" id="support-fab" class="support-fab" aria-label="Contact support" aria-expanded="false" aria-haspopup="dialog">
      <i class="fa-brands fa-whatsapp"></i>
    </button>
  `;
  document.body.appendChild(wrap);

  const fab = document.getElementById('support-fab');
  const panel = document.getElementById('support-panel');
  const closeBtn = document.getElementById('support-panel-close');

  function closePanel() {
    panel.classList.remove('open');
    fab.setAttribute('aria-expanded', 'false');
  }

  fab.addEventListener('click', () => {
    const isOpen = panel.classList.toggle('open');
    fab.setAttribute('aria-expanded', String(isOpen));
  });
  closeBtn.addEventListener('click', closePanel);
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) closePanel();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanel();
  });
})();
