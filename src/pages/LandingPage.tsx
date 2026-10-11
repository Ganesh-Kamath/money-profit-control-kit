import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  WifiOff,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronRight,
  TrendingUp,
  Receipt,
  Wallet,
  Sparkles,
  ArrowRight,
  FileText,
  AlertCircle,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import { COMMERCE_CONFIG } from '../config/commerce';
import { useApp } from '../context/AppContext';

export const LandingPage: React.FC = () => {
  const { setCurrentScreen, resetDemoWorkspace } = useApp();
  const [activeLegalTab, setActiveLegalTab] = useState<'privacy' | 'terms' | 'refunds' | null>(null);

  const handleLaunchApp = () => {
    setCurrentScreen('overview');
  };

  const handleTryDemo = async () => {
    await resetDemoWorkspace();
    setCurrentScreen('overview');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 selection:bg-emerald-500 selection:text-white">
      {/* 1. TOP NAVIGATION */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white font-black text-base shadow-lg shadow-emerald-500/20">
              ₹
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white">Money & Profit Control Kit</span>
              <span className="ml-2 text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                Local-First
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleTryDemo}
              className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Try Live Demo
            </button>
            <button
              onClick={handleLaunchApp}
              className="flex items-center gap-1.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl shadow-md transition-all active:scale-98"
            >
              <span>Open App</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative pt-16 pb-20 px-4 sm:px-6 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-emerald-400 text-xs font-medium mb-6">
          <WifiOff className="h-3.5 w-3.5" />
          <span>100% On-Device · Zero Cloud Storage · Zero Subscriptions</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-[1.15]">
          Your financial data <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">never leaves your device.</span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
          The calm, private financial control system for small Indian businesses that outgrew notebooks and messy Excel sheets, but don't need Tally or complex ERPs.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#pricing"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/20 active:scale-98 transition-all"
          >
            <span>Get Lifetime License</span>
            <ChevronRight className="h-4 w-4" />
          </a>
          <button
            onClick={handleTryDemo}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm border border-slate-700 transition-all"
          >
            <RotateCcw className="h-4 w-4 text-emerald-400" />
            <span>Explore Demo Workspace (Free)</span>
          </button>
        </div>

        <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto text-left">
          <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-800">
            <div className="text-xs text-slate-400">Security</div>
            <div className="text-sm font-semibold text-white mt-0.5">Zero Network Calls</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-800">
            <div className="text-xs text-slate-400">Calculations</div>
            <div className="text-sm font-semibold text-white mt-0.5">Integer Paise Exact</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-800">
            <div className="text-xs text-slate-400">Storage</div>
            <div className="text-sm font-semibold text-white mt-0.5">Encrypted AES-256</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-800">
            <div className="text-xs text-slate-400">License</div>
            <div className="text-sm font-semibold text-white mt-0.5">No Subscription</div>
          </div>
        </div>
      </section>

      {/* 3. THE FIVE CORE QUESTIONS */}
      <section className="py-16 bg-slate-950 border-y border-slate-800 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono">Instant Clarity</h2>
            <p className="mt-2 text-2xl sm:text-3xl font-bold text-white">Answers 5 questions in seconds every single day</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all">
              <div className="h-10 w-10 rounded-xl bg-emerald-950 text-emerald-400 flex items-center justify-center font-bold text-sm mb-4 border border-emerald-800/40">
                1
              </div>
              <h3 className="text-base font-bold text-white">How much came in today?</h3>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                Total inflows breakdown across Cash, UPI, and Bank with instant transaction verification and customer references.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all">
              <div className="h-10 w-10 rounded-xl bg-rose-950 text-rose-400 flex items-center justify-center font-bold text-sm mb-4 border border-rose-800/40">
                2
              </div>
              <h3 className="text-base font-bold text-white">How much went out & on what?</h3>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                Categorized expenses (packaging, ingredients, rent, utility) with stored receipts, SHA-256 duplicate checks, and vendor notes.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all">
              <div className="h-10 w-10 rounded-xl bg-cyan-950 text-cyan-400 flex items-center justify-center font-bold text-sm mb-4 border border-cyan-800/40">
                3
              </div>
              <h3 className="text-base font-bold text-white">What is my real operating profit?</h3>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                True profit is NOT just cash in minus cash out. We track manual COGS, operational margins, and exclude internal bank transfers so you know your true numbers.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all">
              <div className="h-10 w-10 rounded-xl bg-purple-950 text-purple-400 flex items-center justify-center font-bold text-sm mb-4 border border-purple-800/40">
                4
              </div>
              <h3 className="text-base font-bold text-white">How much cash is available now?</h3>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                Consolidated balance view across HDFC, SBI, PhonePe merchant wallet, and physical cash box with bank statement reconciliation.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all">
              <div className="h-10 w-10 rounded-xl bg-amber-950 text-amber-400 flex items-center justify-center font-bold text-sm mb-4 border border-amber-800/40">
                5
              </div>
              <h3 className="text-base font-bold text-white">What needs attention next?</h3>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                Proactive Attention Centre highlights missing receipts, potential double entries, overdue backups, and unusual statistical outlier spends.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-800/30">
              <div className="h-10 w-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-sm mb-4 shadow-md">
                ★
              </div>
              <h3 className="text-base font-bold text-white">Complements your accountant</h3>
              <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                Export clean CSVs and PDF summaries at month-end. You maintain day-to-day operational control while your CA handles statutory tax and GST filings.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. PRICING SECTION */}
      <section id="pricing" className="py-20 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono">Simple, Fair Pricing</h2>
          <p className="mt-2 text-3xl font-extrabold text-white">One-time purchase. Lifetime software access.</p>
          <p className="mt-2 text-sm text-slate-400">
            No monthly subscription. Offline cryptographic license key. 12 months free updates included.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* SOLO PLAN */}
          <div className="rounded-3xl bg-slate-900 p-8 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-all relative">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Solo Kit</span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-medium">1 Workspace</span>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-white">{COMMERCE_CONFIG.plans.solo.formattedPrice}</span>
                <span className="text-xs text-slate-400">one-time payment</span>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Ideal for solo bakers, freelance consultants, independent tutors, and home businesses.
              </p>

              <div className="mt-6 pt-6 border-t border-slate-800 space-y-2.5">
                {COMMERCE_CONFIG.plans.solo.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800">
              <a
                href={COMMERCE_CONFIG.plans.solo.paymentLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all border border-slate-700 hover:border-slate-600"
              >
                <span>Buy Solo License ({COMMERCE_CONFIG.plans.solo.formattedPrice})</span>
                <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
              </a>
              <div className="mt-2 text-center text-[10px] text-slate-500">
                Processed securely via Razorpay · License issued upon payment
              </div>
            </div>
          </div>

          {/* BUSINESS PLAN */}
          <div className="rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950/20 p-8 border-2 border-emerald-500/50 flex flex-col justify-between relative shadow-2xl shadow-emerald-950/50">
            <div className="absolute -top-3 right-6 bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-md">
              Most Popular
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Business Kit</span>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded font-medium border border-emerald-800/40">
                  Up to 5 Workspaces
                </span>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-white">{COMMERCE_CONFIG.plans.business.formattedPrice}</span>
                <span className="text-xs text-slate-400">one-time payment</span>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                For expanding shops, multiple brand outlets, customer invoice tracking, and disciplined month-end locking.
              </p>

              <div className="mt-6 pt-6 border-t border-slate-800 space-y-2.5">
                {COMMERCE_CONFIG.plans.business.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className={idx < 2 ? 'font-semibold text-white' : ''}>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800">
              <a
                href={COMMERCE_CONFIG.plans.business.paymentLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 active:scale-98"
              >
                <span>Buy Business License ({COMMERCE_CONFIG.plans.business.formattedPrice})</span>
                <ExternalLink className="h-3.5 w-3.5 text-slate-950" />
              </a>
              <div className="mt-2 text-center text-[10px] text-slate-400">
                Instant Razorpay checkout · Offline Ed25519 signed key
              </div>
            </div>
          </div>
        </div>

        {/* Honest What's Included / Not Included Notice */}
        <div className="mt-12 p-6 rounded-2xl bg-slate-900/60 border border-slate-800 max-w-4xl mx-auto">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <span>Honest Scope Notice</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-400">
            <div>
              <span className="font-semibold text-slate-200 block mb-1">What is included:</span>
              <ul className="list-disc pl-4 space-y-1">
                <li>Lifetime usage of your installed copy on this browser / device.</li>
                <li>Full access to all reports, ledger entries, and offline imports.</li>
                <li>12 months of free updates. The software never disables or locks your data after 12 months.</li>
              </ul>
            </div>
            <div>
              <span className="font-semibold text-slate-200 block mb-1">What is NOT included:</span>
              <ul className="list-disc pl-4 space-y-1">
                <li>Statutory GST or income tax e-filing portal integrations.</li>
                <li>Cloud multi-user concurrent databases (it is intentionally 100% on-device).</li>
                <li>Automated banking scrapers requiring your internet banking login passwords.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FREQUENTLY ASKED QUESTIONS */}
      <section className="py-16 bg-slate-950 border-t border-slate-800 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono">FAQ</h2>
            <p className="mt-2 text-2xl font-bold text-white">Frequently Asked Questions</p>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <h4 className="text-sm font-bold text-white">How does offline licensing work?</h4>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                When you purchase, you receive a license token string. The app verifies this token using an embedded Ed25519 public key in your browser. The app never contacts an activation server or phone-home telemetry.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <h4 className="text-sm font-bold text-white">Where is my data stored? What if I clear browser history?</h4>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Data is stored in your device's IndexedDB storage. You can request persistent storage with one tap in Settings. We strongly recommend downloading regular encrypted `.cpk` backups or exporting CSVs to your hard drive.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <h4 className="text-sm font-bold text-white">Can I move my data to a new laptop or phone?</h4>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Yes! Head to Import & Backup, export an Encrypted Full Backup (`.cpk`), transfer the file to your new device via pendrive, AirDrop, or WhatsApp to yourself, and click "Restore Backup". All receipts and records are restored intact.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <h4 className="text-sm font-bold text-white">Does it replace my accountant?</h4>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                No. It gives you daily operational clarity. For GST filing, tax returns, and audited financial statements, you can generate clean monthly CSV exports for your Chartered Accountant.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. LEGAL DRAFTS MODAL / EXPANDER */}
      <section className="py-12 border-t border-slate-800 px-4 sm:px-6 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center gap-6 mb-4">
            <button
              onClick={() => setActiveLegalTab(activeLegalTab === 'privacy' ? null : 'privacy')}
              className="hover:text-slate-300 underline"
            >
              Privacy Policy Draft
            </button>
            <button
              onClick={() => setActiveLegalTab(activeLegalTab === 'terms' ? null : 'terms')}
              className="hover:text-slate-300 underline"
            >
              Terms of Use Draft
            </button>
            <button
              onClick={() => setActiveLegalTab(activeLegalTab === 'refunds' ? null : 'refunds')}
              className="hover:text-slate-300 underline"
            >
              Refund & Support Policy Draft
            </button>
          </div>

          <div className="text-[11px] text-slate-500">
            ControlKit by independent developers. All rights reserved. Registered for Indian commercial operations.
          </div>

          {activeLegalTab && (
            <div className="mt-6 p-6 rounded-2xl bg-slate-900 border border-slate-800 text-left text-xs text-slate-300 max-w-2xl mx-auto animate-in fade-in">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800 font-bold text-white">
                <span className="uppercase tracking-wider">
                  {activeLegalTab === 'privacy' && 'Privacy Policy (Draft - Review with a lawyer)'}
                  {activeLegalTab === 'terms' && 'Terms of Use (Draft - Review with a lawyer)'}
                  {activeLegalTab === 'refunds' && 'Refunds & Support (Draft - Review with a lawyer)'}
                </span>
                <button onClick={() => setActiveLegalTab(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              {activeLegalTab === 'privacy' && (
                <div className="space-y-2 leading-relaxed text-slate-400">
                  <p><strong>1. Zero Data Collection:</strong> We do not operate a backend server to receive financial entries, transaction records, customer receipts, or banking credentials. 100% of information entered into the application remains in your local device browser storage.</p>
                  <p><strong>2. Telemetry & Tracking:</strong> No tracking cookies, Google Analytics, Facebook Pixels, or third-party advertising SDKs are loaded or executed.</p>
                  <p><strong>3. Cryptographic Backups:</strong> Any exported `.cpk` backup file is encrypted using client-side WebCrypto AES-256-GCM. We have no mathematical way to view or decrypt your backup if you forget your passphrase.</p>
                </div>
              )}

              {activeLegalTab === 'terms' && (
                <div className="space-y-2 leading-relaxed text-slate-400">
                  <p><strong>1. License Grant:</strong> Purchase of a Solo or Business license provides a non-exclusive, non-transferable lifetime license to run the software on your devices.</p>
                  <p><strong>2. No Financial or Legal Advice:</strong> Calculations and summaries provided by the software are for management information only and do not constitute statutory tax advice or certified accounting.</p>
                  <p><strong>3. Data Responsibility:</strong> Because all data is stored on-device, you are exclusively responsible for creating and maintaining regular backups of your records.</p>
                </div>
              )}

              {activeLegalTab === 'refunds' && (
                <div className="space-y-2 leading-relaxed text-slate-400">
                  <p><strong>1. 14-Day Satisfaction Guarantee:</strong> If the software does not meet your business requirements, email {COMMERCE_CONFIG.supportEmail} within 14 days of purchase for a full refund.</p>
                  <p><strong>2. Support Response:</strong> Technical support regarding installation and license key activation is provided via email within 2 business days.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
