# NaijaFast Data — Setup Guide

## What's real vs. what needs your accounts

This backend is fully functional code, not a mock. But three things need
**your own real, free-to-start accounts** before it can send actual SMS or
process actual airtime/data/TV/electricity purchases:

| Feature | Provider | Cost to start |
|---|---|---|
| Database | MongoDB Atlas (atlas.mongodb.com) | Free tier |
| OTP SMS | Termii (termii.com) | Free trial credit, then pay-as-you-go |
| Airtime/Data/TV/Electricity/WAEC | VTpass (vtpass.com) | Free sandbox; live needs a funded wallet |
| Wallet funding (card/bank) | Paystack (paystack.com) | Free to sign up; test mode needs no real money |
| Wallet funding (crypto) | NOWPayments (nowpayments.io) | Free to sign up; sandbox mode available |
| Email notifications | Resend (resend.com) | Free tier: 100/day, 3,000/month |

Until you add those API keys, the app runs in **dev mode**:
- OTP codes print to your server console (and are shown on the verify screen) instead of being texted.
- Purchases return a clear "VTpass not configured" error instead of pretending to succeed — you're never silently charged for something that didn't happen.
- Transaction notification emails print to your server console instead of being sent.

## 1. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

> If you're updating an existing install rather than starting fresh, run `npm install` again after pulling new files — new features occasionally add new dependencies (e.g. `node-cron` for auto top-ups), and skipping this step is the #1 cause of "Cannot find module" errors.

Edit `.env`:
- `MONGO_URI` — from MongoDB Atlas (or `mongodb://127.0.0.1:27017/naijafast` if you run Mongo locally)
- `JWT_SECRET` — any long random string
- Leave `TERMII_API_KEY` and `VTPASS_*` blank at first to test everything in dev mode

Run it:
```bash
npm run dev
```
You should see `🚀 NaijaFast backend running on http://localhost:5000`.

## 2. Frontend setup

Open `index.html` with a local server (VS Code's "Live Server" extension works well —
opening the file directly with `file://` will break API calls due to CORS).

If your live server doesn't run on `http://127.0.0.1:5500`, update `CLIENT_ORIGIN`
in the backend `.env` to match.

## 3. Try the full flow

1. Go to `register.html`, sign up.
2. You'll land on `verify-otp.html` — in dev mode the code is shown right on the page
   and printed in your backend terminal.
3. Verify → you're logged in and redirected to `services.html`.
4. Try the speed test on the homepage — it's a real download-speed measurement
   (via Cloudflare's public test endpoint) and awards a wallet bonus once every 24 hours.
5. Try any service tile (Airtime, Data, TV, Electricity, WAEC) — with VTpass unconfigured
   you'll get an honest "not configured yet" message instead of a fake success.

## 4. Going live

- **Termii**: sign up, verify your business, get an API key, put it in `TERMII_API_KEY`. Real SMS OTPs start flowing immediately.
- **VTpass**: sign up, complete KYC, get sandbox keys first from the developer dashboard, test purchases in sandbox, then switch `VTPASS_BASE_URL` to `https://vtpass.com/api` and swap in live keys once your live wallet is funded.
- **Paystack**: sign up at paystack.com, go to Settings -> API Keys & Webhooks, copy your **test** secret key into `PAYSTACK_SECRET_KEY`. You can test the whole "Fund Wallet" flow immediately with Paystack's test card:
  - Card number: `4084 0840 8408 4081`
  - Expiry: any future date · CVV: `408` · PIN: `0000` · OTP: `123456`

  Only switch to live keys (`sk_live_...`) once you're ready to accept real payments — and note Paystack itself will need to verify your business before enabling live mode.
- **NOWPayments (crypto)**: sign up at nowpayments.io, verify your account, go to Settings -> API Keys, copy your API key into `NOWPAYMENTS_API_KEY` in `.env`, then restart the backend (`npm run dev`). Use their sandbox mode first to test the flow without real crypto. The "Crypto" button in Fund Wallet will show a clear "not configured yet" message until this key is set. When selected, the modal also shows the **live minimum deposit** (checked against the USDT-TRC20 pair via NOWPayments' `/v1/min-amount` endpoint) so customers see the floor before they try to pay, instead of finding out only after a too-small payment fails.
- **Resend (email notifications)**: sign up at resend.com, get an API key from their dashboard, put it in `RESEND_API_KEY`. Until then, notification emails just print to the server console (dev mode) so you can test the flow for free. Note that Resend only lets the default `onboarding@resend.dev` sender deliver to your own account email until you verify a real domain under Domains in their dashboard - add a domain there and update `RESEND_FROM_EMAIL` once you're ready to send to real customers.
- **Deploy the backend**: Render.com or Railway.app both have free tiers that work well for a Node/Express + MongoDB Atlas app.
- **Update `API_BASE`** at the top of `js/map.js` to your deployed backend URL.

## Live transaction status tracker

- Any purchase that comes back `pending` from VTpass (their code `099`, meaning "still processing") is no longer a dead end. `backend/services/pendingTxnScheduler.js` runs every 5 minutes, requeries every pending transaction against VTpass's `/requery` endpoint, and settles it the moment VTpass has an answer - success or failed, with the wallet refunded automatically on failure.
- If VTpass never gives a definite answer, `STUCK_TIMEOUT_HOURS` (2 hours, set in `backend/services/purchaseEngine.js`) is the ceiling: after that, the transaction is force-refunded to the customer's wallet so money never sits in limbo indefinitely.
- Customers see this happening live on `services.html` under **"Live Order Status"** - it polls `/api/transactions/pending` and `/api/transactions/:reference/status` every 20 seconds while anything is processing, with a manual "Check now" button for anyone who doesn't want to wait. The panel disappears automatically once nothing is pending.
- Referral bonuses and loyalty points are awarded correctly even when a purchase resolves to success *after* the initial pending response - this used to be a gap where a slow-to-confirm purchase would silently miss both.

## WhatsApp ordering

Customers can buy airtime, data, TV subscriptions, and electricity entirely from WhatsApp - no app or site visit needed. It's a guided, tap-to-select conversation (category → network → plan → phone/meter number → confirm) that ends by calling the exact same `executePurchase()` used by the website and auto top-up, so it gets the same wallet safety, discount, and loyalty-point logic for free.

**How it identifies who's ordering:** it matches the WhatsApp number against `User.phone` (last 10 digits, so local `080...` and international `+234 80...` formats both match). Someone messaging from an unregistered number is told to register on the site first - there's no separate WhatsApp signup, it rides on the existing account system.

**Commands anytime:** `menu` (start an order), `balance` (wallet + loyalty points), `cancel` (abandon the current order).

**Setup required** (this can't be automated - it needs a Meta developer account you control): see the `WHATSAPP_*` section in `.env.example` for the full walkthrough - create a Meta app, add the WhatsApp product, grab the phone number ID/access token/app secret, and point the webhook at `/api/whatsapp/webhook`. Until those env vars are set, incoming messages are simply ignored (the signature check fails closed).

**Session state:** each in-progress order lives in `WhatsAppSession` (MongoDB) keyed by phone number, and auto-expires after 10 minutes of inactivity via a TTL index - so an abandoned order doesn't confuse someone who messages again days later.

## Loyalty points

- Customers earn **1 point per ₦100** spent on real purchases (airtime, data, TV, electricity, WAEC) — never on wallet funding, since that isn't a sale.
- Points are redeemable in blocks of **100 points = ₦50 cashback**, credited straight to the wallet, from the gold "Loyalty Points" card on `services.html`. Redemption is server-validated (block size, sufficient balance) in `backend/services/loyaltyService.js` so the rules can't drift.
- Both earning and redeeming trigger the usual email notification, and points earned show up in the purchase success message too.
- The admin dashboard shows total points outstanding (a liability, like the wallet balances) and total cashback redeemed to date.
- Rates are defined once in `backend/services/loyaltyService.js` (`NAIRA_PER_POINT`, `REDEMPTION_BLOCK_POINTS`, `REDEMPTION_BLOCK_VALUE`) — change them there if you want a different earn/redeem ratio.

## Admin dashboard

- Visit `admin.html` while logged in to see live stats: total/verified users, wallet balance liability, all-time and today's revenue (broken down by service), wallet funding split between Paystack and crypto, loyalty points outstanding and redeemed, transaction counts by status, referral totals, plus searchable/paginated tables of every user and every transaction.
- **To make your account an admin**: register a normal account first (through `register.html`, same as any user), then add its email to `ADMIN_EMAILS` in `backend/.env` (comma-separated if you want more than one admin), and restart the backend. You're promoted automatically the next time you log in — no separate admin-creation flow.
- Every `/api/admin/*` route is protected server-side by `requireAdmin` middleware regardless of what's in the browser — a non-admin hitting `admin.html` directly gets a clean "Admin access required" screen, not real data.

## Notes on category availability

- **Water bill** and **NECO PIN**: no major Nigerian VTU aggregator (VTpass included) currently offers these as an API. The tiles are visible but marked "Coming soon" — wire them up the moment a provider exists.
- **WAEC PIN**: available through VTpass's `waec` service.
