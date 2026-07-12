// ===== Speed Topup i18n: English / Naija Pidgin toggle =====
// Covers static UI chrome only (nav, headings, buttons, forms, footer).
// Dynamic content (transaction lists, purchase results, alerts) stays in English.

const SPEEDTOPUP_I18N = {
  en: {
    "nav.home": "Home",
    "nav.services": "Services",
    "nav.speedmap": "Speed Map",
    "nav.wallet": "Wallet",
    "nav.login": "Login",
    "nav.register": "Register",
    "nav.logout": "Logout",

    "hero.title": "Cheapest Data in Nigeria",
    "hero.price": "\u20A6225 per 1GB (MTN SME)",
    "hero.sub": "Instant Delivery \u2022 Crypto Supported \u2022 Real-Time Speed Map",
    "hero.buy": "Buy Data Now",
    "hero.checkspeed": "Check Speed Map",

    "feat1.title": "Instant Delivery",
    "feat1.desc": "Data delivered in under 5 seconds, 24/7",
    "feat2.title": "Crypto Payments",
    "feat2.desc": "USDT, BTC, BNB \u2014 no bank stress",
    "feat3.title": "Diaspora Friendly",
    "feat3.desc": "Send data to family from anywhere",
    "feat4.title": "Student Discount",
    "feat4.desc": "15% off with .edu.ng or NIN verification",

    "map.title": "NaijaSpeed Live Map",
    "map.sub": "Real-time speeds reported by users across Nigeria",
    "map.selectPlaceholder": "Which network are you on? (optional)",
    "map.testbtn": "Test My Speed & Get 2% Off Your First Order",
    "map.legend.unspecified": "Network not specified",

    "bestnetwork.title": "Best Network Near You",
    "bestnetwork.sub": "Ranked from real speed tests recorded near your location in the last 30 days.",
    "bestnetwork.btn": "Find Best Network Near Me",

    "pricing.title": "Today's Live Prices",

    "status.buy": "Buy Data Now",

    "footer.copy": "\u00A9 2026 Speed Topup Data \u2014 Cheapest. Fastest. Smartest.",
    "footer.love": "Made with \u2764\uFE0F for Nigeria",

    "modal.title": "Buy Data",
    "modal.selectNetwork": "Select Network",
    "modal.phonePlaceholder": "Phone Number (08123456789)",
    "modal.amountPlaceholder": "Amount in GB",
    "modal.buyNow": "Buy Now",
    "modal.cancel": "Cancel",
    "modal.selectGeneric": "Select",
    "modal.selectPlan": "Select a plan",
    "modal.payNow": "Pay Now",
    "modal.phoneLabel": "Phone Number",
    "modal.enterValue": "Enter value",
    "modal.verify": "Verify",
    "modal.verifying": "Verifying...",
    "modal.verifyAgain": "Re-verify",
    "modal.fixedAmount": "Amount",

    "svc.nav.fundwallet": "+ Fund Wallet",
    "svc.heading": "What would you like to buy?",
    "svc.sub": "All in one place — data, airtime, TV, bills and exam PINs.",
    "svc.tile.airtime": "Airtime",
    "svc.tile.data": "Data",
    "svc.tile.tv": "DSTV / GOTV / StarTimes",
    "svc.tile.electricity": "Electricity Bill",
    "svc.tile.water": "Water Bill",
    "svc.tile.waec": "WAEC PIN",
    "svc.tile.neco": "NECO PIN",
    "svc.comingsoon": "Coming soon",
    "svc.beneficiaries.title": "Saved Beneficiaries",
    "svc.beneficiaries.addnew": "+ Add New",
    "svc.autotopup.title": "Auto Top-Up",
    "svc.autotopup.newschedule": "+ New Schedule",
    "svc.autotopup.sub": "Recurring purchases run automatically from your wallet - make sure it stays funded.",
    "svc.referral.title": "Invite Friends, Earn Money",
    "svc.referral.copy": "Copy Link",
    "svc.referral.totalearned": "Total Earned",
    "svc.referral.friendsinvited": "Friends Invited",

    "loyalty.title": "Loyalty Points",
    "loyalty.sub": "Earn 1 point for every ₦100 you spend on airtime, data, TV, or electricity. Redeem 100 points for ₦50 cashback.",
    "loyalty.pointsbalance": "Points Balance",
    "loyalty.redeemablevalue": "Redeemable Now",
    "loyalty.redeemplaceholder": "Points to redeem (multiples of 100)",
    "loyalty.redeembtn": "Redeem",
    "loyalty.hint": "100 points = ₦50 cashback to your wallet.",
    "svc.txhistory.title": "Transaction History",

    "loyalty.title": "Loyalty Points",
    "loyalty.sub": "Earn 1 point for every ₦100 you spend on airtime, data, TV, or electricity. Redeem 100 points for ₦50 cashback.",
    "loyalty.pointsbalance": "Points Balance",
    "loyalty.redeemablevalue": "Redeemable Now",
    "loyalty.redeemplaceholder": "Points to redeem (multiples of 100)",
    "loyalty.redeembtn": "Redeem",
    "loyalty.hint": "100 points = ₦50 cashback to your wallet.",

    "fund.title": "Fund Wallet",
    "fund.desc": "Choose how you'd like to pay - Paystack (card / bank transfer) or crypto (USDT, BTC, BNB).",
    "fund.paystack": "Paystack",
    "fund.crypto": "Crypto",
    "fund.hint.paystack": "Pay by card or bank transfer via Paystack.",
    "fund.hint.crypto": "Pay with USDT, BTC, BNB or other coins via a secure crypto invoice.",
    "fund.continue": "Continue to Payment",
    "fund.continueCrypto": "Continue with Crypto",

    "ben.title": "Add Beneficiary",
    "ben.labelPlaceholder": "Label (e.g. Mum's Phone)",
    "ben.selectCategory": "Select category",
    "ben.selectCategoryFirst": "Select category first",
    "ben.billersPlaceholder": "Phone / Meter / Smartcard number",
    "ben.save": "Save",

    "cat.tv": "TV Subscription",
    "cat.electricity": "Electricity",

    "atu.title": "New Auto Top-Up",
    "atu.labelPlaceholder": "Label (e.g. Mum's MTN Data)",
    "atu.freq.daily": "Daily",
    "atu.freq.weekly": "Weekly",
    "atu.freq.monthly": "Monthly",
    "atu.createSchedule": "Create Schedule",

    "amount.ngn": "Amount (₦)",

    "login.title": "Login to Speed Topup",
    "auth.emailPlaceholder": "Email Address",
    "auth.passwordPlaceholder": "Password",
    "login.btn": "Login",
    "login.noaccount": "Don't have an account?",
    "login.registerhere": "Register here",

    "register.title": "Create Account",
    "register.phonePlaceholder": "Phone Number",
    "register.passwordPlaceholder": "Create Password",
    "register.btn": "Register",
    "register.havacct": "Already have an account?",
    "register.loginhere": "Login here",

    "login.forgotPassword": "Forgot Password?",
    "forgot.title": "Forgot Password",
    "forgot.sub": "Enter the email on your account and we'll send you a link to reset your password.",
    "forgot.submit": "Send Reset Link",
    "forgot.successMsg": "If an account exists for that email, a password reset link has been sent. Check your inbox (and spam folder).",
    "forgot.backToLogin": "Back to Login",
    "reset.title": "Reset Password",
    "reset.sub": "Choose a new password for your account.",
    "reset.newPasswordPlaceholder": "New Password",
    "reset.confirmPasswordPlaceholder": "Confirm New Password",
    "reset.submit": "Reset Password",
    "reset.successMsg": "Your password has been reset. You can now log in.",
    "reset.goToLogin": "Go to Login",
    "reset.invalidMsg": "This reset link is missing or invalid.",
    "reset.requestNew": "Request a New Link",

    "back.home": "Back to Homepage",
    "back.services": "Back to Services",

    "verify.title": "Verify Your Phone",
    "verify.defaultsub": "Enter the 6-digit code we sent to your phone.",
    "verify.codePlaceholder": "6-digit code",
    "verify.btn": "Verify",
    "verify.resend": "Resend Code",

    "wallet.title": "Confirming your payment...",
    "wallet.defaultmsg": "Please wait a moment.",

    "lang.toggle": "Pidgin"
  },
  pcm: {
    "nav.home": "Home",
    "nav.services": "Wetin We Get",
    "nav.speedmap": "Speed Map",
    "nav.wallet": "Wallet",
    "nav.login": "Log In",
    "nav.register": "Sign Up",
    "nav.logout": "Comot",

    "hero.title": "Cheapest Data for Naija",
    "hero.price": "\u20A6225 for 1GB (MTN SME)",
    "hero.sub": "E Dey Enter Sharp Sharp \u2022 Crypto Dey Work \u2022 Live Speed Map",
    "hero.buy": "Buy Data Now Now",
    "hero.checkspeed": "Check Speed Map",

    "feat1.title": "E Dey Sharp Sharp",
    "feat1.desc": "Data go land under 5 seconds, 24/7",
    "feat2.title": "Crypto Money",
    "feat2.desc": "USDT, BTC, BNB \u2014 no bank wahala",
    "feat3.title": "For Naija People Abroad",
    "feat3.desc": "Send data give your family from anywhere you dey",
    "feat4.title": "Student Discount",
    "feat4.desc": "15% off if you get .edu.ng or NIN",

    "map.title": "NaijaSpeed Live Map",
    "map.sub": "Live speed wey people don report across Naija",
    "map.selectPlaceholder": "Which network you dey use? (no wahala if you no want)",
    "map.testbtn": "Check My Speed & Carry 2% Off Your First Order",
    "map.legend.unspecified": "Network no specify",

    "bestnetwork.title": "Best Network Near You",
    "bestnetwork.sub": "We rank am from real speed test wey people do near you for the last 30 days.",
    "bestnetwork.btn": "Find Best Network Near Me",

    "pricing.title": "Today Price List",

    "status.buy": "Buy Data Now Now",

    "footer.copy": "\u00A9 2026 Speed Topup Data \u2014 E Cheap. E Fast. E Smart.",
    "footer.love": "Make with \u2764\uFE0F for Naija",

    "modal.title": "Buy Data",
    "modal.selectNetwork": "Choose Network",
    "modal.phonePlaceholder": "Phone Number (08123456789)",
    "modal.amountPlaceholder": "How Many GB",
    "modal.buyNow": "Buy Am Now",
    "modal.cancel": "Cancel",
    "modal.selectGeneric": "Choose",
    "modal.selectPlan": "Choose a plan",
    "modal.payNow": "Pay Now Now",
    "modal.phoneLabel": "Phone Number",
    "modal.enterValue": "Type am",
    "modal.verify": "Check Am",
    "modal.verifying": "Dey check...",
    "modal.verifyAgain": "Check Am Again",
    "modal.fixedAmount": "Amount",

    "svc.nav.fundwallet": "+ Put Money",
    "svc.heading": "Wetin you wan buy?",
    "svc.sub": "Everything for one place — data, airtime, TV, bills and exam PIN.",
    "svc.tile.airtime": "Airtime",
    "svc.tile.data": "Data",
    "svc.tile.tv": "DSTV / GOTV / StarTimes",
    "svc.tile.electricity": "Light Bill",
    "svc.tile.water": "Water Bill",
    "svc.tile.waec": "WAEC PIN",
    "svc.tile.neco": "NECO PIN",
    "svc.comingsoon": "E dey come",
    "svc.beneficiaries.title": "People You Don Save",
    "svc.beneficiaries.addnew": "+ Add New One",
    "svc.autotopup.title": "Auto Top-Up",
    "svc.autotopup.newschedule": "+ New Plan",
    "svc.autotopup.sub": "E go dey buy am for you automatic from your wallet - make sure money dey inside.",
    "svc.referral.title": "Invite Friends, Chop Money",
    "svc.referral.copy": "Copy Link",
    "svc.referral.totalearned": "Total Wey You Don Chop",
    "svc.referral.friendsinvited": "Friends Wey You Invite",

    "loyalty.title": "Loyalty Points",
    "loyalty.sub": "You go earn 1 point for every ₦100 wey you spend on airtime, data, TV, or light bill. Redeem 100 points for ₦50 cashback.",
    "loyalty.pointsbalance": "Points Balance",
    "loyalty.redeemablevalue": "Wetin You Fit Chop Now",
    "loyalty.redeemplaceholder": "Points to redeem (na multiples of 100)",
    "loyalty.redeembtn": "Redeem Am",
    "loyalty.hint": "100 points = ₦50 cashback enter your wallet.",
    "svc.txhistory.title": "Transaction History",

    "loyalty.title": "Loyalty Points",
    "loyalty.sub": "Earn 1 point for every ₦100 wey you spend on airtime, data, TV, or light bill. Redeem 100 points for ₦50 cashback.",
    "loyalty.pointsbalance": "Points Wey You Get",
    "loyalty.redeemablevalue": "Wetin You Fit Redeem Now",
    "loyalty.redeemplaceholder": "Points to redeem (multiples of 100)",
    "loyalty.redeembtn": "Redeem Am",
    "loyalty.hint": "100 points = ₦50 cashback go your wallet.",

    "fund.title": "Put Money for Wallet",
    "fund.desc": "Choose how you wan pay - Paystack (card / bank transfer) or crypto (USDT, BTC, BNB).",
    "fund.paystack": "Paystack",
    "fund.crypto": "Crypto",
    "fund.hint.paystack": "Pay with card or bank transfer through Paystack.",
    "fund.hint.crypto": "Pay with USDT, BTC, BNB or other coin through secure crypto invoice.",
    "fund.continue": "Continue to Payment",
    "fund.continueCrypto": "Continue with Crypto",

    "ben.title": "Add Person",
    "ben.labelPlaceholder": "Label (e.g. Mummy Phone)",
    "ben.selectCategory": "Choose category",
    "ben.selectCategoryFirst": "Choose category first",
    "ben.billersPlaceholder": "Phone / Meter / Smartcard number",
    "ben.save": "Save Am",

    "cat.tv": "TV Subscription",
    "cat.electricity": "Light",

    "atu.title": "New Auto Top-Up",
    "atu.labelPlaceholder": "Label (e.g. Mummy MTN Data)",
    "atu.freq.daily": "Every Day",
    "atu.freq.weekly": "Every Week",
    "atu.freq.monthly": "Every Month",
    "atu.createSchedule": "Set Am Up",

    "amount.ngn": "Amount (₦)",

    "login.title": "Log In for Speed Topup",
    "auth.emailPlaceholder": "Email Address",
    "auth.passwordPlaceholder": "Password",
    "login.btn": "Log In",
    "login.noaccount": "You no get account?",
    "login.registerhere": "Sign up here",

    "register.title": "Open Account",
    "register.phonePlaceholder": "Phone Number",
    "register.passwordPlaceholder": "Create Password",
    "register.btn": "Sign Up",
    "register.havacct": "You don get account already?",
    "register.loginhere": "Log in here",

    "login.forgotPassword": "You forget password?",
    "forgot.title": "Forgot Password",
    "forgot.sub": "Type the email wey dey your account, we go send you link make you fit reset your password.",
    "forgot.submit": "Send Reset Link",
    "forgot.successMsg": "If account dey for that email, we don send password reset link go there. Check your inbox (and spam folder too).",
    "forgot.backToLogin": "Go Back to Login",
    "reset.title": "Reset Password",
    "reset.sub": "Choose new password for your account.",
    "reset.newPasswordPlaceholder": "New Password",
    "reset.confirmPasswordPlaceholder": "Confirm New Password",
    "reset.submit": "Reset Password",
    "reset.successMsg": "Your password don reset finish. You fit login now.",
    "reset.goToLogin": "Go Login",
    "reset.invalidMsg": "This reset link no correct or e don expire.",
    "reset.requestNew": "Request New Link",

    "back.home": "Go Back Home",
    "back.services": "Go Back to Services",

    "verify.title": "Confirm Your Phone",
    "verify.defaultsub": "Enter the 6-digit code we send go your phone.",
    "verify.codePlaceholder": "6-digit code",
    "verify.btn": "Confirm Am",
    "verify.resend": "Send Code Again",

    "wallet.title": "We dey confirm your payment...",
    "wallet.defaultmsg": "Abeg wait small.",

    "lang.toggle": "English"
  }
};

const SPEEDTOPUP_LANG_KEY = "speedtopup_lang";

function speedtopupApplyLanguage(lang) {
  const dict = SPEEDTOPUP_I18N[lang] || SPEEDTOPUP_I18N.en;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) el.textContent = dict[key];
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (dict[key]) el.placeholder = dict[key];
  });

  document.documentElement.setAttribute("lang", lang === "pcm" ? "pcm" : "en");

  const toggleBtn = document.getElementById("lang-toggle-btn");
  if (toggleBtn) {
    // Toggle switch: knob slides to whichever side is active, both labels always visible
    toggleBtn.setAttribute("data-current-lang", lang);
    toggleBtn.setAttribute("aria-checked", lang === "pcm" ? "true" : "false");
    toggleBtn.setAttribute("aria-label", lang === "pcm" ? "Switch to English" : "Switch to Pidgin");
  }
}

function speedtopupToggleLanguage() {
  const current = localStorage.getItem(SPEEDTOPUP_LANG_KEY) || "en";
  const next = current === "en" ? "pcm" : "en";
  localStorage.setItem(SPEEDTOPUP_LANG_KEY, next);
  speedtopupApplyLanguage(next);
}

document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem(SPEEDTOPUP_LANG_KEY) || "en";
  speedtopupApplyLanguage(saved);
});
