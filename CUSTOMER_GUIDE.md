# Customer Guide & Operational Handbook: ControlKit

Welcome to **Money & Profit Control Kit (ControlKit)**. This guide provides comprehensive instructions on how to use every feature of your local financial dashboard, protect your data, and collaborate smoothly with your Chartered Accountant.

---

## 🧭 1. First-Run Onboarding & Quick Setup

When you first launch ControlKit, the onboarding wizard helps configure your business in under 60 seconds:

1. **Select Your Business Archetype:**
   - **Home Bakery / Custom Food:** Tailored categories for raw ingredients, packaging boxes, delivery charges, and counter sales.
   - **School / College Tutor:** Categories for student tuition fees, study materials, and batch rent.
   - **Kirana / Small Retail:** Fast cash counter sales, supplier stock, and utility dues.
   - **Solo Consultant / Freelancer:** Service revenue, professional software tools, client travel, and home office costs.
   - **Small Workshop / Fabricator:** Job-work income, raw materials (metal, sheets, fasteners), machine maintenance, and worker wages.
2. **Establish Starting Baselines:**
   - Enter your current cash on hand (e.g. ₹5,000) and starting bank balance (e.g. ₹25,000).
   - *Note:* Entering an opening balance establishes the baseline from which all future transactions calculate your live closing balances.
3. **Optional GST Setup:**
   - Enter your 15-digit GSTIN (e.g. `27AAAAA0000A1Z5`). The system automatically verifies the format and derives your home state.

---

## ⚡ 2. Fast 3-Tap Entry & Instant Undo

Small business owners don't have time to fill out lengthy forms for counter or UPI sales.

1. **Sale in 3 Taps:**
   - Click or tap **Fast Sale (3-Tap)** on the overview or ledger header.
   - Tap one of the quick amount chips (`+₹100`, `+₹250`, `+₹500`, `+₹1,000`, `+₹2,000`) or type an amount.
   - Tap your payment account (Cash or UPI Bank Account).
   - Tap **Confirm & Record Sale**.
2. **Instant Undo Toast:**
   - If you tap the wrong amount by mistake, a prominent floating banner appears for 6 seconds with an **"Undo Action"** button.
   - Clicking Undo completely rolls back the transaction and recalculates account balances instantly.

---

## 💵 3. Daily Cash Drawer Closing

Avoid the end-of-day headache of unexplained cash shortages:

1. Tap **Daily Cash** in the ledger or overview.
2. Enter the physical note counts in your register drawer:
   - ₹500, ₹200, ₹100, ₹50, ₹20, ₹10, and coins.
3. The counter displays:
   - **Total Physical Cash Counted**
   - **Ledger System Cash Balance**
   - **Difference / Discrepancy**
4. If there is a minor variance (e.g. ₹50 unreturned change), tap **Record Reconciliation Entry** to atomically balance the register with an audit note.

---

## 📄 4. GST Tax Invoicing & UPI QR Code Payments

ControlKit includes a full-fledged Indian tax invoicing engine:

1. **Creating an Invoice:**
   - Navigate to **Receivables & Invoicing → Create Invoice**.
   - Enter Customer Name, GSTIN (optional), and Place of Supply state.
   - Add line items with quantity, unit rate in rupees, HSN/SAC code, and GST rate (0%, 5%, 12%, 18%, 28%).
2. **Intra-State vs Inter-State Tax Calculations:**
   - If the customer state matches your business state: Automatically calculates **50% CGST + 50% SGST**.
   - If different: Automatically calculates **100% IGST**.
   - All calculations are performed in **integer paise**, eliminating floating-point rounding errors.
3. **Indian Amount in Words:**
   - Generates the legal amount in words (e.g. *"Rupees Twelve Thousand Five Hundred and Paise Zero Only"*).
4. **Offline UPI Payment QR Code:**
   - Renders a pure-SVG QR code containing a standard UPI URI (`upi://pay?pa=...&am=...&cu=INR`).
   - Customers can scan with Google Pay, PhonePe, Paytm, or BHIM to pay the exact invoice amount.
5. **Print or Save as PDF:**
   - Tap **Print / Save as PDF** to generate a clean, professional A4 printout using the built-in print stylesheet.

---

## 📥 5. Statement Import & Duplicate Detection Wizard

Import bank and UPI statements without manual data entry:

1. **Supported Formats:**
   - Excel (`.xlsx`, `.xls`) and CSV files from SBI, HDFC, ICICI, Axis, Kotak, PhonePe, Paytm, etc.
2. **Intelligent Preamble Skipping:**
   - The engine automatically skips bank header preambles (account numbers, branch IFSC, address lines) and detects where column headers begin.
3. **Messy Format Support:**
   - Parses Indian number formatting (`1,23,456.78`), debit/credit indicator columns (`Dr` / `Cr`), and negative parentheses (`(1,250.00)`).
   - Handles standard Indian date formats: `DD/MM/YYYY`, `DD-MM-YYYY`, `DD-MMM-YY`.
4. **Duplicate Candidate Review:**
   - The wizard cross-references imported transactions against existing ledger entries using a fuzzy matching window (matching amount and date within ±2 days).
   - Confirmed duplicates can be skipped with 1 click before final import.

---

## 🔁 6. Auto-Categorisation Rules & Recurring Bills

1. **Auto-Categorisation Rules:**
   - Navigate to **Ledger → Auto-Rules**.
   - Create rules like: *"When description contains `SWIGGY` → Categorize as Food Delivery"* or *"When description contains `PETROL` → Categorize as Fuel & Vehicle"*.
   - Tap **Apply Rules to Existing Transactions** to instantly re-categorize past unorganized entries.
2. **Recurring Bills (Rent, Salary, EMI):**
   - Navigate to **Ledger → Recurring**.
   - Set up recurring dues with recurrence frequency (Monthly, Quarterly, Annual).
   - The Overview Attention Centre flags dues on their due date, allowing 1-tap confirmation into the ledger.

---

## 📊 7. Reports, Financial Years, & CA Pack Export

1. **Indian Financial Year & Quarters:**
   - Switch between **FY (Apr–Mar)**, **Q1 (Apr–Jun)**, **Q2 (Jul–Sep)**, **Q3 (Oct–Dec)**, and **Q4 (Jan–Mar)**.
2. **Month-on-Month (MoM) & Year-on-Year (YoY) Comparisons:**
   - View revenue and profit deltas compared to the prior period with percentage growth indicators.
3. **Receivables Ageing:**
   - Visual breakdown of unpaid invoices: **0–30 Days (Current)**, **31–60 Days (Attention)**, and **61+ Days (Overdue)**.
4. **One-Tap Accountant CA Pack:**
   - Navigate to **Reports → Accountant Pack**.
   - **Download Ledger CSV:** Full double-entry general ledger with Indian date formats and debit/credit columns.
   - **Download Invoices CSV:** Complete invoice register with GST eligibility and payment statuses.
   - *Security Note:* All CSV exports automatically sanitize formula characters (`=`, `+`, `-`, `@`) to prevent spreadsheet injection vulnerabilities.
5. **Period Locking (Business Tier):**
   - Lock finalized accounting months to prevent accidental retroactive edits.

---

## 🛡️ 8. Data Security, Encrypted Backups, & Device Migration

Because ControlKit is **100% on-device** with zero cloud servers, you maintain absolute sovereignty over your financial data.

### The 1-Minute Backup Routine
1. Navigate to **Import & Backup → Backup & Restore**.
2. Enter a strong passphrase and click **Download Encrypted Full Backup (`.cpk`)**.
3. Save the `.cpk` file to a USB thumb drive, external drive, or email it to yourself.
4. **"Test My Backup" Validator:**
   - Tap **Test / Validate Backup File** to verify that your backup file is healthy and decryptable without overwriting your active database.
5. **Direct Directory Backup (File System Access API):**
   - On supported desktop browsers (Chrome, Edge), choose a local backup folder to write backups directly to your hard drive with 1 click.

> **Important Note:** We utilize AES-256-GCM encryption with 100,000 PBKDF2 iterations. There is no central server and no backdoor. Keep your backup passphrase in a safe place!

### App PIN Lock & Privacy Center
- Set a 4-digit PIN in **Settings → App Security**.
- The app locks automatically after 5 minutes of inactivity or upon clicking the lock icon in the sidebar.
- Navigate to **Privacy Centre** to inspect storage usage and confirm zero external network connections.
