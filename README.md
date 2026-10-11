# Money & Profit Control Kit (ControlKit)

> **100% Local, Privacy-First Financial Control for Small Indian Businesses.**  
> *Your financial data never leaves your device.*

Money & Profit Control Kit is an offline-first commercial web application (PWA) designed for small Indian businesses, solo service providers, home bakeries, tutors, and small retail shops. It replaces messy notebooks, WhatsApp groups, and fragile Excel sheets with a calm, dependable, integer-paise financial control dashboard.

---

## ⚡ The Five Core Questions

ControlKit answers five vital questions in seconds every single day:
1. **How much came in today?** (Inflows categorized across Cash, UPI, and Bank)
2. **How much went out and on what?** (Categorized expenses, stored receipts, SHA-256 duplicate checks)
3. **What is my real operating profit?** (Revenue − Operating Expenses; manual COGS; excluding internal transfers)
4. **How much cash is available right now?** (Consolidated view across bank accounts, petty cash, and merchant UPI wallets)
5. **What needs attention next?** (Missing receipts, uncollected invoices, overdue backups, unusual expense outliers)

---

## 🔒 100% Local Architecture (Zero Cloud, Zero Telemetry)

- **Storage:** IndexedDB via Dexie.js (pure on-device ACID transactions; no server).
- **Security:** Content Security Policy restricting connections to `'self'` only; no analytics, no CDNs, no remote fonts.
- **Licensing:** Offline Ed25519 cryptographic tokens verified in the browser. Zero activation servers or phone-home pings.
- **Backups:** WebCrypto AES-256-GCM encryption with PBKDF2 (100,000 rounds) key derivation.
- **PWA Ready:** Service worker precaching for complete offline reliability after first load.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js (v18+ or v20+)
- npm

### 1. Installation
```bash
cd money-profit-control-kit
npm install
```

### 2. Run Local Dev Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 3. Run Quality Gates & Tests
```bash
# Run unit, property, encryption, storage, licensing and privacy tests:
npm run test

# Run TypeScript check and production build:
npm run build

# Preview production build locally:
npm run preview
```

---

## 🔑 Commercial Model & Issuing License Keys

ControlKit uses an offline, one-time purchase model:
- **Solo Plan (₹2,999):** 1 local business workspace, pure integer calculation engine, daily ledger, cash balances, AES-256 backup, lifetime software access.
- **Business Plan (₹3,999):** Up to 5 business workspaces, customer invoices & receivables, partial collections, printable GST invoice PDFs, month-end review & period locking.

### How to Sell via Payment Link (Razorpay)
1. Set up a payment link or payment page in your Razorpay dashboard (e.g. ₹2,999 for Solo, ₹3,999 for Business).
2. Configure the payment link in `src/config/commerce.ts`.
3. When a customer completes checkout, run the owner CLI tool to issue their signed offline key:

```bash
# Issue a Business license:
npx tsx tools/generate-license.ts business "Sunita Bakery" "sunita@sweetcrumb.in"

# Issue a Solo license:
npx tsx tools/generate-license.ts solo "Rahul Verma" "rahul@consulting.in"
```

Send the resulting token string (`CK-...`) to the customer via email or WhatsApp. The customer pastes the token into **Settings → License Info** or the first-launch welcome modal. The key verifies 100% offline.

> **Important:** Never commit the private signing key. See [SECURITY.md](file:///c:/Users/kamat/Desktop/Agents/money-profit-control-kit/SECURITY.md) for key storage procedures.

---

## 🌐 Static Hosting Deployment

Because ControlKit requires zero server backend, you can deploy the `dist/` directory to any static host:

### Vercel
```bash
npm run build
npx vercel deploy --prod
```

### Cloudflare Pages
```bash
npm run build
npx wrangler pages deploy dist --project-name controlkit
```

### Netlify
```bash
npm run build
npx netlify deploy --prod --dir=dist
```

Ensure headers from `index.html` (Content Security Policy) are served to enforce zero outbound connections.

---

## 📂 Project Structure

```
money-profit-control-kit/
├── dist/                  # Production static bundle
├── docs/
│   └── BLUEPRINT.md       # Product specifications & architectural contract
├── samples/               # Realistic bank & UPI sample CSV statements
│   ├── hdfc_sample_statement.csv
│   ├── sbi_sample_statement.csv
│   └── phonepe_sample_statement.csv
├── src/
│   ├── components/        # AppShell, AddTransactionModal, DrilldownModal, PinLockModal
│   ├── config/            # Commerce pricing, payment links, and plan features
│   ├── context/           # AppContext state, licensing, workspace manager, toasts
│   ├── engine/            # Pure calculation engine, statement parsers, license, encryption
│   ├── pages/             # 9 core application screens + public landing page
│   └── storage/           # Dexie IndexedDB schemas and atomic balance recalculation
├── tests/                 # Vitest suites (28 tests across 6 suites)
├── tools/                 # Owner keygen and license generator CLI utilities
├── ASSUMPTIONS.md         # Architecture decision log
├── CUSTOMER_GUIDE.md      # User guide, backups, device migration, and accountant tips
├── PRIVACY.md             # Privacy manifest & zero-cloud technical proofs
├── ROADMAP.md             # Future milestones (Account Aggregator, Tauri desktop, etc.)
└── SECURITY.md            # Threat model, WebCrypto AES-GCM encryption, offline licensing
```
