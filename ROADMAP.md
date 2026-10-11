# Product Roadmap & Future Architecture

This roadmap details planned future capabilities for **Money & Profit Control Kit**. In keeping with our product principles, all additions must uphold the local-first, zero-cloud custody promise.

---

## 🗺️ Milestone Roadmap

### 1. Tauri Desktop Native Application (Optional Desktop Wrapper)
- **Status:** Architectural Draft
- **Objective:** Provide a standalone `.exe` (Windows) and `.dmg` (macOS) application wrapped via [Tauri](https://tauri.app).
- **Benefits:**
  - True OS-level file system access for automatic continuous backups to local hard drives (`~/Documents/ControlKitBackups`).
  - Zero browser cache eviction risks on macOS/iOS.
  - Native system tray notifications for month-end reconciliation reminders.

### 2. RBI Account Aggregator (AA) Local Import Bridge
- **Status:** Research & Partner Exploration
- **Objective:** Enable one-click retrieval of bank statements directly into the device via the Reserve Bank of India (RBI) regulated Account Aggregator ecosystem (e.g., Setu, Anumati).
- **Local-First Rule:** Tokens and statement data stream directly to the browser; zero financial telemetry stored on an intermediate relay.

### 3. Tally & Zoho Bridge Exports
- **Status:** Specification Phase
- **Objective:** One-click export format formatted specifically for Tally Prime (`.xml`) and Zoho Books (`.csv`), allowing the user's Chartered Accountant to import entries directly into their statutory audit software without manual data entry.

### 4. On-Device Local OCR (Receipt Auto-Fill)
- **Status:** Experimental Sandbox
- **Objective:** Run Tesseract.js / WebAssembly locally on the user's device to read vendor name, total amount, and date from uploaded bill photos.
- **Guardrails:** Always show an interactive confirmation modal before saving; never send receipt images to cloud computer vision APIs.

### 5. Zero-Knowledge E2EE Sync (Multi-Device)
- **Status:** Future Architecture
- **Objective:** Allow an owner to sync their laptop and mobile phone seamlessly without trusting a central server.
- **Design:** End-to-End Encrypted (E2EE) synchronisation using WebRTC direct peer-to-peer data channels or a zero-knowledge blob relay where the server only sees encrypted ciphertext.
