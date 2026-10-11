// Commercial and licensing configuration
// Update these payment link URLs with your live Razorpay Payment Page/Links before publishing.

export const COMMERCE_CONFIG = {
  productName: 'Money & Profit Control Kit',
  tagline: '100% Local Financial Control for Indian Small Businesses',
  currency: 'INR',
  supportEmail: 'support@moneycontrolkit.in',
  
  plans: {
    solo: {
      id: 'solo',
      name: 'Solo Control Kit',
      priceINR: 2999,
      formattedPrice: '₹2,999',
      billingType: 'One-time payment (Lifetime Software Access)',
      paymentLink: 'https://rzp.io/l/controlkit-solo', // Replace with your Razorpay link
      workspaces: 1,
      features: [
        '1 Local Business Workspace',
        'Pure on-device calculation engine (integer paise accuracy)',
        'Daily In/Out ledger, Cash & Bank balances',
        'Transparent Estimated Net Profit & Margin analysis',
        'Deterministic "Ask about my numbers" query tool (Zero AI)',
        'Local receipt attachment & SHA-256 duplicate detection',
        'Bank statement CSV/XLSX import wizard with 8+ presets',
        'Encrypted AES-256-GCM full backup & restore',
        'App Passcode PIN lock & WebCrypto security',
        '12 months of free updates included (never locks afterwards)',
      ],
      notIncluded: [
        'Multiple workspaces (Max 1)',
        'Customer Invoices & Receivables tracking',
        'Month-end period locking & audited adjustments',
      ],
    },
    business: {
      id: 'business',
      name: 'Business Control Kit',
      priceINR: 3999,
      formattedPrice: '₹3,999',
      billingType: 'One-time payment (Lifetime Software Access)',
      paymentLink: 'https://rzp.io/l/controlkit-biz', // Replace with your Razorpay link
      workspaces: 5,
      features: [
        'Up to 5 Local Business Workspaces',
        'Everything in Solo, plus:',
        'Customer Receivables & Outstanding payment tracking',
        'Partial & full invoice collections (no double revenue counting)',
        'Printable professional GST/Standard Invoice PDF generator',
        'Month-End Review protocol & Period Locking',
        'Audited post-lock adjustments with historical tracking',
        'Year-over-Year and Month-over-Month multi-period comparisons',
        'Priority email assistance directly from the engineers',
        '12 months of free updates included (never locks afterwards)',
      ],
      notIncluded: [
        'Statutory GST return filing (not an ERP / tax portal replacement)',
        'Cloud multi-user concurrent editing (100% private to device)',
      ],
    },
  },

  legalDisclaimers: {
    accountantComplement:
      'ControlKit is an on-device management dashboard designed to help business owners understand cashflow, operational margins, and day-to-day profit. It is not an accounting ERP, statutory ledger, or GST tax filing portal, and does not replace the counsel of a certified chartered accountant.',
  },
};
