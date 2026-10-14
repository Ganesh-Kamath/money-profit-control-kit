import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, X, Globe, ShieldCheck, Download, HardDrive } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (!isOpen) return null;

  const faqs = [
    {
      qEn: '1. Where is my financial data stored?',
      qHi: '1. मेरा वित्तीय डेटा कहाँ सुरक्षित रहता है?',
      aEn: '100% on your device inside your browser’s IndexedDB database. It is never uploaded to any cloud server, company database, or remote analytics service.',
      aHi: '100% आपके कंप्यूटर या फ़ोन के ब्राउज़र (IndexedDB) में सुरक्षित रहता है। यह कभी किसी बाहरी सर्वर या कंपनी के पास नहीं भेजा जाता।',
    },
    {
      qEn: '2. How do I move to a new phone or laptop?',
      qHi: '2. नए फ़ोन या लैपटॉप पर डेटा कैसे ले जाएं?',
      aEn: 'Go to Import & Backup → Download Encrypted Backup (.cpk). Send the file to yourself via email or USB drive. On your new device, open ControlKit, choose Restore Backup, and type your password.',
      aHi: 'इम्पोर्ट और बैकअप में जाकर "सुरक्षित बैकअप डाउनलोड करें (.cpk)" पर क्लिक करें। उस फ़ाइल को नए डिवाइस पर खोलें और पासवर्ड डालकर रीस्टोर करें।',
    },
    {
      qEn: '3. What if I make a mistake entering an amount?',
      qHi: '3. अगर रकम गलत दर्ज हो गई तो क्या करें?',
      aEn: 'Every Fast Sale offers a 6-second instant "Undo Action" toast. Alternatively, go to the Ledger, click on the transaction, and choose Edit or Soft Void.',
      aHi: 'बिक्री दर्ज करते ही नीचे 6 सेकंड तक "वापस लें (Undo)" बटन दिखता है। इसके अलावा लेन-देन सूची में जाकर कभी भी बदलाव या रद्द कर सकते हैं।',
    },
    {
      qEn: '4. How do I delete or void a transaction?',
      qHi: '4. किसी गलत एंट्री को कैसे हटाएं?',
      aEn: 'Click "Void" on the transaction in the Ledger and enter a reason. The amount is immediately reversed from your account balances atomically while preserving a tamper-evident audit record.',
      aHi: 'लेन-देन सूची में "Void" पर क्लिक करके कारण लिखें। खाते का बैलेंस तुरंत ठीक हो जाएगा और पूरा हिसाब सुरक्षित रहेगा।',
    },
    {
      qEn: '5. Can I import statements from HDFC, SBI, ICICI, or PhonePe?',
      qHi: '5. क्या मैं बैंक या PhonePe का स्टेटमेंट इम्पोर्ट कर सकता हूँ?',
      aEn: 'Yes! Upload any Excel (.xlsx, .xls) or CSV statement in Import & Backup. The wizard skips bank preambles, maps columns, and checks for duplicate entries automatically.',
      aHi: 'हाँ! बैंक या PhonePe का Excel (.xlsx) या CSV स्टेटमेंट अपलोड करें। सिस्टम बैंक का हेडर खुद छोड़ देगा और डुप्लीकेट एंट्री से बचाएगा।',
    },
    {
      qEn: '6. How does GST calculation work on invoices?',
      qHi: '6. इनवॉइस पर जीएसटी की गणना कैसे होती है?',
      aEn: 'If the customer state matches your state, it calculates 50% CGST + 50% SGST. For out-of-state customers, it calculates 100% IGST in exact integer paise with zero decimal rounding errors.',
      aHi: 'यदि ग्राहक आपके राज्य का है तो CGST + SGST (50-50%) कटेगा। अन्य राज्य के ग्राहक के लिए पूरा IGST लगेगा, वह भी बिना किसी पैसे के अंतर के।',
    },
    {
      qEn: '7. How do I print an A4 invoice or share a UPI QR code?',
      qHi: '7. A4 बिल कैसे प्रिंट करें या UPI QR कोड कैसे दें?',
      aEn: 'Open any invoice in Receivables and tap "Print / Save PDF". The system generates a crisp A4 page with a pure-SVG UPI QR code that customers can scan with any payment app.',
      aHi: 'बिल में "प्रिंट / PDF" पर क्लिक करें। साफ A4 साइज़ में बिल खुलेगा जिसमें UPI QR कोड होगा जिसे ग्राहक किसी भी ऐप से स्कैन कर भुगतान कर सकते हैं।',
    },
    {
      qEn: '8. What does "Period Lock" mean?',
      qHi: '8. "महीना लॉक (Period Lock)" का क्या मतलब है?',
      aEn: 'Available on the Business plan, Period Lock freezes financial entries on or before a selected date so historical tax records cannot be accidentally modified after CA review.',
      aHi: 'यह सुविधा पुराने महीनों के हिसाब को लॉक कर देती है ताकि सीए (CA) को हिसाब देने के बाद गलती से कोई पुराना रिकॉर्ड बदल न जाए।',
    },
    {
      qEn: '9. How do I send accounts to my Chartered Accountant (CA)?',
      qHi: '9. सीए (CA) को हिसाब कैसे भेजें?',
      aEn: 'Go to Reports → Accountant Pack. Click "Download Ledger CSV" and "Download Invoices CSV". They are formatted with Indian dates (DD/MM/YYYY) and clean debit/credit columns ready for Excel or Tally.',
      aHi: 'रिपोर्ट्स में "Accountant Pack" पर जाकर "Download Ledger CSV" पर क्लिक करें। यह भारतीय तारीख और डेबिट/क्रेडिट के साथ एक्सेल फॉर्मेट में डाउनलोड होगा।',
    },
    {
      qEn: '10. Can anyone else or ControlKit see my financial data?',
      qHi: '10. क्या कोई और या कंट्रोलकिट कंपनी मेरा डेटा देख सकती है?',
      aEn: 'No. ControlKit has no user accounts, no analytics, no cloud database, and strict browser network isolation. Your financial information is entirely yours.',
      aHi: 'बिल्कुल नहीं। न कोई खाता बनाना है, न इंटरनेट पर भेजना है। आपका हिसाब सिर्फ और सिर्फ आपके इस कंप्यूटर/फ़ोन में सुरक्षित रहता है।',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-card bg-white p-6 shadow-2xl border border-surface-border space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-surface-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-50 text-brand-600 rounded-control">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-navy-950">Help & 10 Essential Questions</h2>
              <p className="text-[11px] text-navy-500">Quick practical answers in plain English and Hindi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
              className="px-2.5 py-1 text-xs font-semibold bg-surface-subtle hover:bg-surface-base border border-surface-border rounded-control transition flex items-center gap-1 text-navy-800"
            >
              <Globe className="h-3 w-3 text-brand-600" />
              <span>{lang === 'en' ? 'हिन्दी' : 'English'}</span>
            </button>
            <button onClick={onClose} className="p-1 rounded text-navy-400 hover:text-navy-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 20-Second Explainer Banner */}
        <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-card space-y-1.5 text-xs text-emerald-950">
          <div className="font-bold flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>20-Second Rule for Data Safety</span>
          </div>
          <p className="text-[11px] leading-relaxed text-emerald-900">
            Because ControlKit does not use a cloud server, your data lives strictly in this browser. If you clear your browser cache or reset your phone, you need an encrypted backup file to restore it. <strong>Download an encrypted backup file once a week.</strong> It takes 5 seconds!
          </p>
        </div>

        {/* 10 FAQs Accordion */}
        <div className="space-y-2 text-xs">
          {faqs.map((faq, i) => (
            <div key={i} className="border border-surface-border rounded-control overflow-hidden">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full p-3 bg-surface-subtle hover:bg-surface-base text-left font-bold text-navy-950 flex items-center justify-between transition"
              >
                <span>{lang === 'hi' ? faq.qHi : faq.qEn}</span>
                {openIndex === i ? (
                  <ChevronUp className="h-4 w-4 text-navy-500 shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-navy-500 shrink-0" />
                )}
              </button>
              {openIndex === i && (
                <div className="p-3 bg-white text-navy-700 text-[11px] leading-relaxed border-t border-surface-border">
                  {lang === 'hi' ? faq.aHi : faq.aEn}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="pt-2 flex justify-end border-t border-surface-border">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-control transition text-xs shadow-xs"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
