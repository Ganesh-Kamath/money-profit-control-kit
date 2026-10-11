# Customer Guide & Operational Handbook

Welcome to **Money & Profit Control Kit (ControlKit)**. This guide explains how to get the most out of your local financial dashboard, protect your data, and collaborate smoothly with your accountant.

---

## 🧭 Getting Started in 5 Minutes

### 1. Setting Up Your Accounts
Navigate to **Cash & Accounts**. Configure your actual financial channels:
- **Bank Accounts:** HDFC, SBI, ICICI, etc.
- **Merchant Wallets:** PhonePe Merchant, Paytm Business, Google Pay.
- **Physical Cash Box / Petty Cash.**

Enter the opening balance as of a specific date (e.g., 1st of the month).  
*Note:* Entering an opening balance does not magically pull past history; it establishes the baseline from which all future ledger entries calculate your closing balances.

### 2. Daily Habits: Answering the 5 Questions
Every evening or end-of-business, open the app:
1. **How much came in today?** Check the Overview top card. Tap "+ Add Transaction" to log cash sales or counter collections if not using statement import.
2. **How much went out and on what?** Log vendor purchases, milk, butter, packaging boxes, delivery charges. Snap a photo of the bill or receipt.
3. **What is my real operating profit?** View **Sales & Profit**. Remember: money received from an old invoice is cash inflow, not new profit. Internal bank transfers are cash movements, never expenses.
4. **How much cash is available now?** Check the consolidated balance total across all accounts.
5. **What needs attention next?** Review the **Attention Centre** at the bottom of the Overview for unreviewed receipts or overdue tasks.

---

## 🛡️ Protecting Your Data: Backups & Device Migration

Because ControlKit operates **100% on your device** without a centralized cloud server, **you are the owner of your data**. Here is how to keep it safe:

### Regular Backups (The 1-Minute Habit)
1. Go to **Import & Backup → Backup & Restore**.
2. Enter a memorable passphrase and click **Download Encrypted Full Backup (`.cpk`)**.
3. Save the file to your computer, a USB thumb drive, or send it to yourself on email / Google Drive / WhatsApp.
4. If you ever clear your browser cache or lose your device, your encrypted file can restore your entire business state in 2 seconds.

> **Caution:** We use AES-256-GCM encryption with 100,000 PBKDF2 iterations. If you forget your backup passphrase, nobody on earth can decrypt your file. Store your passphrase securely!

### Moving to a New Laptop or Phone
1. On your old device: Export an Encrypted Backup (`.cpk`).
2. Transfer the `.cpk` file to your new device.
3. Open ControlKit in the browser on your new device.
4. Go to **Import & Backup → Restore Backup**.
5. Select the file, type your passphrase, and choose **Replace Existing Data**.
6. All transactions, accounts, categories, and receipt attachments are instantly restored.

---

## 📥 Importing Bank & UPI Statements

Avoid typing hundreds of entries manually:
1. Download a CSV statement from your bank or merchant portal (HDFC, SBI, ICICI, Axis, Kotak, PhonePe, Paytm).
2. Go to **Import & Backup → Bank & UPI Statements**.
3. Select your statement preset or use the **Column Mapping Wizard**.
4. The wizard previews your transactions and checks for duplicates.
5. Confirm import. All account balances update atomically.

---

## 🤝 Working with Your Accountant / CA

ControlKit is built to **complement** your accountant, not replace them:
- **What ControlKit Does:** Daily operational control, cash availability, customer receivables, receipt storage, and real-time operating profit margins.
- **What Your CA Does:** Statutory bookkeeping, GST returns (GSTR-1, GSTR-3B), depreciation schedules, advance tax calculation, and balance sheet audits.

### Month-End Routine for Your CA
1. At the end of every calendar month, go to **Reports → Month-End Review**.
2. Verify all accounts are reconciled against your bank passbook.
3. Click **Export Month-End CSV** to send clean, categorized ledger entries to your accountant.
4. For Business plan users: Click **Lock Accounting Period**. This prevents accidental retroactive edits to finalized months.
