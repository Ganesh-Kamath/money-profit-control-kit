import React, { useState } from 'react';
import { Sparkles, ArrowRight, ArrowLeft, Check, X, LayoutDashboard, Zap, FileText, BarChart3, ShieldCheck } from 'lucide-react';

interface GuidedTourModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuidedTourModal: React.FC<GuidedTourModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState<number>(0);

  if (!isOpen) return null;

  const steps = [
    {
      title: 'Welcome to ControlKit',
      icon: Sparkles,
      color: 'text-amber-500 bg-amber-50',
      description:
        'ControlKit is your local-first, zero-cloud financial dashboard. It gives you 100% control over cash, invoices, profit margins, and backups without sending any data over the internet.',
      tip: 'Everything is computed in pure integer paise, eliminating the rounding errors found in Excel.',
    },
    {
      title: '1. The 5 Core Questions',
      icon: LayoutDashboard,
      color: 'text-brand-600 bg-brand-50',
      description:
        'Every morning and evening, the Overview answers your 5 real questions in 5 seconds:\n• How much came in today?\n• How much went out?\n• What is my real operating profit?\n• How much cash is available?\n• What needs attention next?',
      tip: 'Tap any number to instantly see the exact transactions behind it.',
    },
    {
      title: '2. Sale in 3 Taps & Cash Closing',
      icon: Zap,
      color: 'text-emerald-600 bg-emerald-50',
      description:
        'When customers pay at your counter or send UPI, record it in under 4 seconds with "Sale in 3 Taps". At the end of the day, use the "Daily Cash" counter to reconcile loose notes in your drawer against your ledger.',
      tip: 'If you ever make a typo, an instant Undo toast lets you fix it in 1 tap.',
    },
    {
      title: '3. GST Invoicing & CA Exports',
      icon: FileText,
      color: 'text-indigo-600 bg-indigo-50',
      description:
        'Generate GST-compliant tax invoices with automatic CGST/SGST vs IGST routing, Indian amount in words, and a scannable UPI QR code. At month-end, download the "Accountant Pack" CSV ready for your Chartered Accountant.',
      tip: 'All CSV exports are sanitized to prevent formula injection in Excel.',
    },
    {
      title: '4. Absolute Data Privacy',
      icon: ShieldCheck,
      color: 'text-emerald-600 bg-emerald-50',
      description:
        'Your records live only on this device. You can download an encrypted full backup (.cpk) with AES-256-GCM encryption anytime from Import & Backup.',
      tip: 'Store a backup file once a week on email, Google Drive, or a USB stick.',
    },
  ];

  const current = steps[currentStep];
  const Icon = current.icon;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-card bg-white p-6 shadow-2xl border border-surface-border space-y-5">
        <div className="flex items-center justify-between pb-2 border-b border-surface-border">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-navy-400 uppercase tracking-wider">
              Sample Tour • Step {currentStep + 1} of {steps.length}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded text-navy-400 hover:text-navy-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="text-center space-y-3 py-2">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-sm ${current.color}`}>
            <Icon className="h-7 w-7" />
          </div>

          <h3 className="text-base font-bold text-navy-950">{current.title}</h3>

          <p className="text-xs text-navy-600 leading-relaxed whitespace-pre-line text-left px-2">
            {current.description}
          </p>

          <div className="p-3 bg-surface-subtle border border-surface-border rounded-control text-[11px] text-navy-800 text-left">
            <strong>Pro Tip:</strong> {current.tip}
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-surface-border">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="px-3 py-1.5 text-xs text-navy-600 hover:bg-surface-subtle rounded-control transition disabled:opacity-30 flex items-center gap-1 font-semibold"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  currentStep === i ? 'w-5 bg-brand-600' : 'w-1.5 bg-surface-border'
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-control transition text-xs shadow-xs flex items-center gap-1"
          >
            <span>{currentStep === steps.length - 1 ? 'Finish Tour' : 'Next'}</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
