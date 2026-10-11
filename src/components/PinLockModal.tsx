import React, { useState } from 'react';
import { Lock, ShieldAlert, KeyRound } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const PinLockModal: React.FC = () => {
  const { isAppLocked, unlockApp } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);

  if (!isAppLocked) return null;

  const handleDigit = (digit: string) => {
    if (isLockedOut) return;
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError('');
      if (nextPin.length >= 4) {
        // Auto attempt if reached 4 or 6 digits or wait for enter
      }
    }
  };

  const handleBackspace = () => {
    if (isLockedOut) return;
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLockedOut) return;
    if (!pin) {
      setError('Please enter your passcode');
      return;
    }

    const success = await unlockApp(pin);
    if (!success) {
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      setPin('');
      if (nextAttempts >= 5) {
        setIsLockedOut(true);
        setError('Too many failed attempts. Security cooldown: 30 seconds.');
        setTimeout(() => {
          setIsLockedOut(false);
          setAttempts(0);
          setError('');
        }, 30000);
      } else {
        setError(`Incorrect passcode. ${5 - nextAttempts} attempts remaining.`);
      }
    } else {
      setPin('');
      setError('');
      setAttempts(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/90 backdrop-blur-md p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-navy-50 text-navy-900 mb-4 border border-navy-100 shadow-sm">
          <Lock className="h-6 w-6 text-brand-600" />
        </div>

        <h2 className="text-xl font-bold text-navy-900">App Locked</h2>
        <p className="mt-1 text-xs text-slate-500">
          Enter your security passcode to access your local financial records.
        </p>

        {/* PIN dots */}
        <div className="my-6 flex justify-center gap-3">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`h-4 w-4 rounded-full border transition-all ${
                pin.length > idx
                  ? 'bg-brand-600 border-brand-600 scale-110'
                  : 'bg-slate-100 border-slate-300'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 flex items-center justify-center gap-1.5 text-xs font-medium text-rose-600">
            <ShieldAlert className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* On-screen Keypad */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              type="button"
              disabled={isLockedOut}
              onClick={() => handleDigit(d)}
              className="flex h-12 items-center justify-center rounded-xl bg-slate-50 text-lg font-semibold text-navy-900 border border-slate-200 hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-50"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            disabled={isLockedOut || pin.length === 0}
            onClick={handleBackspace}
            className="flex h-12 items-center justify-center rounded-xl bg-slate-50 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-50"
          >
            Delete
          </button>
          <button
            type="button"
            disabled={isLockedOut}
            onClick={() => handleDigit('0')}
            className="flex h-12 items-center justify-center rounded-xl bg-slate-50 text-lg font-semibold text-navy-900 border border-slate-200 hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            disabled={isLockedOut || pin.length < 4}
            onClick={() => handleUnlock()}
            className="flex h-12 items-center justify-center rounded-xl bg-navy-900 text-xs font-semibold text-white hover:bg-navy-800 active:scale-95 transition-all disabled:opacity-50 shadow-sm"
          >
            Unlock
          </button>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-center gap-1">
          <KeyRound className="h-3 w-3" />
          <span>Local passcode check via WebCrypto PBKDF2</span>
        </div>
      </div>
    </div>
  );
};
