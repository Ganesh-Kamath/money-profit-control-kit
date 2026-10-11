# Privacy Manifest & Architecture Verification

> **The Core Promise:** *Your financial data never leaves your device.*

Financial records are sensitive business secrets. Most modern web software stores client accounting books in multitenant cloud databases prone to data breaches, subscription lockouts, or automated ad-tracking.

**Money & Profit Control Kit (ControlKit)** is engineered with a strict 100% local, zero-network architecture.

---

## 🔬 How to Verify Zero Network Activity (Developer & Auditor Guide)

You do not have to take our word for it. You can inspect and verify the application yourself in any modern browser:

### 1. Browser Network Tab Verification
1. Open ControlKit in Google Chrome, Mozilla Firefox, or Apple Safari.
2. Press `F12` or `Cmd+Option+I` to open Developer Tools.
3. Switch to the **Network** tab.
4. Filter by `Fetch/XHR`.
5. Perform common operations:
   - Add a transaction with an attached receipt image.
   - Run the "Ask about my numbers" assistant.
   - Switch workspaces or reconcile an account balance.
   - Export and restore an encrypted backup.
6. **Observation:** Exactly **0** outbound HTTP/HTTPS requests are initiated. The network log remains completely empty.

### 2. Disconnect Network Completely (Offline Test)
1. Load ControlKit once in your browser.
2. Turn off your Wi-Fi, unplug your Ethernet cable, or enable Airplane Mode.
3. Reload the page (`Ctrl+R` / `Cmd+R`).
4. Notice the application loads instantly via Service Worker precaching.
5. All calculations, filters, reports, and imports operate smoothly without internet connectivity.

### 3. Automated Test Suite Proof
Our CI test suite contains an automated test (`tests/privacy.test.ts`) that mocks the global network interface and asserts that zero outbound network requests are made during financial calculations, license verification, and data operations.

---

## 🗄️ Where Does Data Live on Your Device?

All financial information is stored in the browser's sandboxed local storage:
- **Database Engine:** IndexedDB (database named `ControlKit_DB`).
- **Tables:** `workspaces`, `categories`, `accounts`, `transactions`, `receipts`, `contacts`, `invoices`, `reconciliations`, `periodLocks`, `auditEvents`, `alerts`, `license`, `appSecurity`.
- **Receipt Files:** Stored as binary Blobs directly inside the browser's IndexedDB.

### Inspecting Local Data
To see the raw data on your machine:
1. Open DevTools (`F12`).
2. Navigate to **Application → Storage → IndexedDB → ControlKit_DB**.
3. View tables and entries directly in the browser inspector.

---

## 🚫 What Is NOT in ControlKit
- **NO Cloud Databases:** No Supabase, Firebase, AWS RDS, MongoDB, or Postgres.
- **NO External Analytics:** Zero Google Analytics, Mixpanel, Amplitude, or Sentry.
- **NO Ad Trackers:** Zero Facebook Pixel, Google Tag Manager, or tracking pixels.
- **NO Remote CDNs:** All fonts (Inter) and icon definitions (Lucide) are bundled locally into the build.
- **NO AI/LLM Server Calls:** "Ask about my numbers" runs deterministic algorithms on your local CPU.

---

## 🗑️ Data Deletion & Privacy Centre
In **Settings → Privacy Centre**, you can:
- Inspect total IndexedDB storage consumption.
- Verify storage persistence status.
- Perform a complete, irreversible **Wipe All Local Data** action with an export-first safety prompt.
