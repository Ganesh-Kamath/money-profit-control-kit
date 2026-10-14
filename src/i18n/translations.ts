/**
 * Lightweight Zero-Dependency Translation Engine for ControlKit.
 * Supports English and Hindi with natural colloquial Indian business terms.
 * Built with an extensible string table to allow Marathi, Gujarati, Tamil later.
 */

export type SupportedLanguage = 'en' | 'hi';

export interface TranslationDictionary {
  appName: string;
  tagline: string;
  // Nav
  navOverview: string;
  navTransactions: string;
  navExpenses: string;
  navSalesProfit: string;
  navAccounts: string;
  navInvoices: string;
  navReports: string;
  navImportBackup: string;
  navSettings: string;
  navHelp: string;

  // The 5 Core Questions
  q1Title: string; // How much came in today?
  q2Title: string; // How much went out and on what?
  q3Title: string; // What is my real operating profit?
  q4Title: string; // How much cash do I have right now?
  q5Title: string; // What needs attention next?

  // Actions
  actionAddSale: string;
  actionAddExpense: string;
  actionTransfer: string;
  actionQuickSale: string;
  actionTakeBackup: string;
  actionMonthEndReview: string;
  actionLockPeriod: string;
  actionUndo: string;

  // Overview Badges & Cards
  cardTodayIn10Sec: string;
  cardDailyClosing: string;
  cardCashAvailable: string;
  cardAttentionRequired: string;
  cardOperatingProfit: string;
  cardWeeklyInsights: string;

  // Invoicing & GST
  invoiceSimpleBill: string;
  invoiceTaxInvoice: string;
  invoiceNumber: string;
  customerName: string;
  gstinLabel: string;
  placeOfSupply: string;
  totalInWords: string;
  printInvoice: string;
  recordCollection: string;

  // Data Safety & Privacy
  backupHealthGood: string;
  backupHealthWarning: string;
  backupHealthDanger: string;
  backupHealthNever: string;
  zeroCloudProof: string;
  dataStorageAdvice: string;

  // Common
  save: string;
  cancel: string;
  delete: string;
  viewAll: string;
  statusActive: string;
  statusVoided: string;
}

export const TRANSLATIONS: Record<SupportedLanguage, TranslationDictionary> = {
  en: {
    appName: 'Money & Profit Control Kit',
    tagline: '100% On-Device Financial Control for Indian Businesses',
    navOverview: 'Overview',
    navTransactions: 'Transactions',
    navExpenses: 'Expenses & Receipts',
    navSalesProfit: 'Sales & Profit',
    navAccounts: 'Cash & Accounts',
    navInvoices: 'Invoices & Receivables',
    navReports: 'Reports & Accountant',
    navImportBackup: 'Import & Backup',
    navSettings: 'Settings & Privacy',
    navHelp: 'Help & FAQs',

    q1Title: 'How much came in today?',
    q2Title: 'How much went out and on what?',
    q3Title: 'What is my real operating profit?',
    q4Title: 'How much cash is available right now?',
    q5Title: 'What needs attention next?',

    actionAddSale: '+ Add Sale / Money In',
    actionAddExpense: '- Add Expense / Money Out',
    actionTransfer: 'Account Transfer',
    actionQuickSale: 'Sale in 3 Taps',
    actionTakeBackup: 'Backup Now',
    actionMonthEndReview: 'Month-End Review',
    actionLockPeriod: 'Lock Accounting Period',
    actionUndo: 'Undo',

    cardTodayIn10Sec: 'Today in 10 Seconds',
    cardDailyClosing: 'Daily Cash Closing',
    cardCashAvailable: 'Cash & Bank Available',
    cardAttentionRequired: 'Needs Your Attention',
    cardOperatingProfit: 'Real Operating Profit',
    cardWeeklyInsights: 'Weekly Insights',

    invoiceSimpleBill: 'Simple Bill',
    invoiceTaxInvoice: 'Tax Invoice (GST)',
    invoiceNumber: 'Invoice Number',
    customerName: 'Customer Name',
    gstinLabel: 'GSTIN',
    placeOfSupply: 'Place of Supply',
    totalInWords: 'Amount in Words',
    printInvoice: 'Print / Save PDF',
    recordCollection: 'Record Payment',

    backupHealthGood: 'Backup Up to Date',
    backupHealthWarning: 'Backup Due Soon',
    backupHealthDanger: 'Backup Overdue (> 14 days)',
    backupHealthNever: 'No Backup Taken Yet',
    zeroCloudProof: 'Zero Cloud • 100% Local Device',
    dataStorageAdvice: 'Your financial records stay exclusively inside your browser on this device.',

    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    viewAll: 'View All',
    statusActive: 'Active',
    statusVoided: 'Voided',
  },

  hi: {
    appName: 'कंट्रोलकिट (Money & Profit Kit)',
    tagline: 'भारतीय व्यापारियों के लिए 100% निजी और सुरक्षित वित्तीय कंट्रोल',
    navOverview: 'दैनिक स्थिति (Overview)',
    navTransactions: 'लेन-देन (Transactions)',
    navExpenses: 'खर्च और बिल (Expenses)',
    navSalesProfit: 'बिक्री और मुनाफा (Profit)',
    navAccounts: 'खाते और रोकड़ (Accounts)',
    navInvoices: 'ग्राहक बिल और बकाया (Invoices)',
    navReports: 'रिपोर्ट्स और CA पैक (Reports)',
    navImportBackup: 'इम्पोर्ट और बैकअप (Backup)',
    navSettings: 'सेटिंग्स और प्राइवेसी (Settings)',
    navHelp: 'मदद और सवाल (Help)',

    q1Title: 'आज कितना पैसा आया?',
    q2Title: 'आज कितना खर्च हुआ और किसपर?',
    q3Title: 'व्यापार का असली शुद्ध मुनाफा कितना है?',
    q4Title: 'अभी बैंक और गल्ले में कुल कितना पैसा है?',
    q5Title: 'आगे किस काम पर तुरंत ध्यान देना है?',

    actionAddSale: '+ नई बिक्री दर्ज करें (आवक)',
    actionAddExpense: '- खर्च दर्ज करें (जावक)',
    actionTransfer: 'खातों में ट्रांसफर',
    actionQuickSale: '3 टैप में तुरंत बिक्री',
    actionTakeBackup: 'सुरक्षित बैकअप लें',
    actionMonthEndReview: 'महीने का हिसाब समीक्षा',
    actionLockPeriod: 'महीना लॉक करें',
    actionUndo: 'वापस लें (Undo)',

    cardTodayIn10Sec: 'आज का हिसाब (10 सेकंड में)',
    cardDailyClosing: 'गल्ला रोकड़ मिलान (Daily Cash)',
    cardCashAvailable: 'उपलब्ध कुल रोकड़ व बैंक',
    cardAttentionRequired: 'ध्यान देने योग्य बातें',
    cardOperatingProfit: 'असली व्यापार मुनाफा',
    cardWeeklyInsights: 'साप्ताहिक वित्तीय अंतर्दृष्टि',

    invoiceSimpleBill: 'साधारण बिल (Simple Bill)',
    invoiceTaxInvoice: 'टैक्स इनवॉइस (GST Invoice)',
    invoiceNumber: 'बिल संख्या',
    customerName: 'ग्राहक का नाम',
    gstinLabel: 'जीएसटी नंबर (GSTIN)',
    placeOfSupply: 'सप्लाई राज्य (Place of Supply)',
    totalInWords: 'राशि शब्दों में',
    printInvoice: 'प्रिंट / PDF बनाएं',
    recordCollection: 'भुगतान जमा करें',

    backupHealthGood: 'बैकअप सुरक्षित है',
    backupHealthWarning: 'जल्द नया बैकअप लें',
    backupHealthDanger: 'बैकअप लिए 14 दिन से अधिक हो गए!',
    backupHealthNever: 'अभी तक कोई बैकअप नहीं लिया गया',
    zeroCloudProof: 'शून्य क्लाउड • 100% आपके डिवाइस पर',
    dataStorageAdvice: 'आपका व्यापारिक डेटा केवल इसी कंप्यूटर/फ़ोन में सुरक्षित रहता है।',

    save: 'सुरक्षित करें',
    cancel: 'रद्द करें',
    delete: 'हटाएं',
    viewAll: 'सभी देखें',
    statusActive: 'सक्रिय',
    statusVoided: 'रद्द (Void)',
  },
};

export function getTranslation(lang: SupportedLanguage = 'en'): TranslationDictionary {
  return TRANSLATIONS[lang] || TRANSLATIONS.en;
}
