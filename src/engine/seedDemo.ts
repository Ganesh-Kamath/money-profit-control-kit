import { db, type Workspace, type Account, type Category, type Transaction, type Invoice } from '../storage/db';

export async function seedDemoWorkspace(): Promise<string> {
  // Wipe previous demo workspace if it exists
  const existingDemo = await db.workspaces.filter((w) => Boolean(w.isDemo)).first();
  if (existingDemo) {
    await clearWorkspaceData(existingDemo.id);
  }

  const workspaceId = 'demo-workspace-home-bakery';
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Workspace
  const demoWs: Workspace = {
    id: workspaceId,
    name: 'Sweet Crumb Patisserie (Demo Workspace)',
    businessType: 'home_bakery',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    fyStartMonth: 4,
    isDemo: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  await db.workspaces.put(demoWs);

  // 2. Accounts
  const accounts: Account[] = [
    {
      id: `${workspaceId}-acc-bank`,
      workspaceId,
      name: 'HDFC Current Bank Account',
      accountType: 'bank',
      accountNumberLast4: '4821',
      openingBalancePaise: 4500000, // ₹45,000.00
      openingBalanceDate: '2026-07-01',
      currentBalancePaise: 4500000,
      isDefault: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: `${workspaceId}-acc-upi`,
      workspaceId,
      name: 'Bakery PhonePe UPI QR',
      accountType: 'upi',
      openingBalancePaise: 500000, // ₹5,000.00
      openingBalanceDate: '2026-07-01',
      currentBalancePaise: 500000,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: `${workspaceId}-acc-cash`,
      workspaceId,
      name: 'Cash Register Drawer',
      accountType: 'cash',
      openingBalancePaise: 800000, // ₹8,000.00
      openingBalanceDate: '2026-07-01',
      currentBalancePaise: 800000,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];
  await db.accounts.bulkPut(accounts);

  // 3. Categories
  const categories: Category[] = [
    { id: `${workspaceId}-cat-cakes`, workspaceId, name: 'Custom Cakes & Orders', type: 'income', icon: 'Cake', color: '#059669', isDefault: true, createdAt: nowIso },
    { id: `${workspaceId}-cat-pastries`, workspaceId, name: 'Pastries & Desserts', type: 'income', icon: 'Croissant', color: '#10B981', isDefault: true, createdAt: nowIso },
    { id: `${workspaceId}-cat-corporate`, workspaceId, name: 'Corporate Catering', type: 'income', icon: 'Briefcase', color: '#2563EB', isDefault: true, createdAt: nowIso },
    { id: `${workspaceId}-cat-raw`, workspaceId, name: 'Flour, Butter & Chocolate', type: 'expense', icon: 'ShoppingBag', color: '#D97706', isStock: true, isDefault: true, createdAt: nowIso },
    { id: `${workspaceId}-cat-packaging`, workspaceId, name: 'Cake Boxes & Ribbons', type: 'expense', icon: 'Package', color: '#64748B', isDefault: true, createdAt: nowIso },
    { id: `${workspaceId}-cat-rent`, workspaceId, name: 'Commercial Kitchen Rent', type: 'expense', icon: 'Home', color: '#DC2626', isDefault: true, createdAt: nowIso },
    { id: `${workspaceId}-cat-utilities`, workspaceId, name: 'Electricity & Gas Bills', type: 'expense', icon: 'Zap', color: '#EA580C', isDefault: true, createdAt: nowIso },
    { id: `${workspaceId}-cat-delivery`, workspaceId, name: 'Porter & Dunzo Delivery', type: 'expense', icon: 'Truck', color: '#4F46E5', isDefault: true, createdAt: nowIso },
    { id: `${workspaceId}-cat-marketing`, workspaceId, name: 'Instagram Ads', type: 'expense', icon: 'Megaphone', color: '#0284C7', isDefault: true, createdAt: nowIso },
    { id: `${workspaceId}-cat-equipment`, workspaceId, name: 'Oven & Mixer Equipment', type: 'expense', icon: 'Tool', color: '#7C3AED', isEquipment: true, isDefault: true, createdAt: nowIso },
  ];
  await db.categories.bulkPut(categories);

  // 4. Generate 3 months of realistic transactions
  const transactions: Transaction[] = [];

  // Anchor dates over past 90 days
  const baseTime = now.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 85; i >= 0; i--) {
    const txDate = new Date(baseTime - i * dayMs);
    const dateStr = txDate.toISOString();

    // Daily Sales (UPI & Cash)
    transactions.push({
      id: `${workspaceId}-tx-upi-${i}`,
      workspaceId,
      type: 'income',
      amountPaise: (800 + (i % 7) * 350) * 100, // ₹800 to ₹2,900
      occurredAt: dateStr,
      accountId: `${workspaceId}-acc-upi`,
      categoryId: `${workspaceId}-cat-pastries`,
      description: `Daily counter UPI orders #${1000 + i}`,
      status: 'active',
      source: 'manual',
      createdAt: dateStr,
      updatedAt: dateStr,
    });

    if (i % 2 === 0) {
      transactions.push({
        id: `${workspaceId}-tx-cash-${i}`,
        workspaceId,
        type: 'income',
        amountPaise: (400 + (i % 5) * 200) * 100, // ₹400 to ₹1,200
        occurredAt: dateStr,
        accountId: `${workspaceId}-acc-cash`,
        categoryId: `${workspaceId}-cat-pastries`,
        description: `Walk-in cash counter sales #${500 + i}`,
        status: 'active',
        source: 'manual',
        createdAt: dateStr,
        updatedAt: dateStr,
      });
    }

    // Weekend Celebration Cakes
    if (txDate.getDay() === 0 || txDate.getDay() === 6) {
      transactions.push({
        id: `${workspaceId}-tx-cake-${i}`,
        workspaceId,
        type: 'income',
        amountPaise: (2500 + (i % 4) * 1000) * 100, // ₹2,500 - ₹5,500
        occurredAt: dateStr,
        accountId: `${workspaceId}-acc-bank`,
        categoryId: `${workspaceId}-cat-cakes`,
        description: `Celebration birthday tiered cake order #${300 + i}`,
        referenceNumber: `CAKE-${i}`,
        status: 'active',
        source: 'manual',
        createdAt: dateStr,
        updatedAt: dateStr,
      });
    }

    // Weekly Ingredient & Raw Material Purchases
    if (i % 5 === 0) {
      transactions.push({
        id: `${workspaceId}-tx-raw-${i}`,
        workspaceId,
        type: 'expense',
        amountPaise: (1800 + (i % 6) * 450) * 100, // ₹1,800 to ₹4,050
        occurredAt: dateStr,
        accountId: `${workspaceId}-acc-bank`,
        categoryId: `${workspaceId}-cat-raw`,
        description: `Amul Butter & Callebaut Chocolate stock purchase`,
        referenceNumber: `INV-RAW-${i}`,
        status: 'active',
        source: 'manual',
        createdAt: dateStr,
        updatedAt: dateStr,
      });
    }

    // Delivery Porter Expense
    if (i % 3 === 0) {
      transactions.push({
        id: `${workspaceId}-tx-porter-${i}`,
        workspaceId,
        type: 'expense',
        amountPaise: 28000, // ₹280.00
        occurredAt: dateStr,
        accountId: `${workspaceId}-acc-upi`,
        categoryId: `${workspaceId}-cat-delivery`,
        description: `Porter delivery to client location`,
        status: 'active',
        source: 'manual',
        createdAt: dateStr,
        updatedAt: dateStr,
      });
    }

    // Weekly Transfer from UPI QR to Bank (Neutral)
    if (i % 7 === 0) {
      transactions.push({
        id: `${workspaceId}-tx-transfer-${i}`,
        workspaceId,
        type: 'transfer',
        amountPaise: 800000, // ₹8,000.00
        occurredAt: dateStr,
        accountId: `${workspaceId}-acc-upi`,
        toAccountId: `${workspaceId}-acc-bank`,
        description: 'Auto-settlement transfer UPI to HDFC Current Bank',
        status: 'active',
        source: 'manual',
        createdAt: dateStr,
        updatedAt: dateStr,
      });
    }

    // Monthly Rent
    if (i === 60 || i === 30 || i === 2) {
      transactions.push({
        id: `${workspaceId}-tx-rent-${i}`,
        workspaceId,
        type: 'expense',
        amountPaise: 1200000, // ₹12,000.00
        occurredAt: dateStr,
        accountId: `${workspaceId}-acc-bank`,
        categoryId: `${workspaceId}-cat-rent`,
        description: 'Kitchen monthly lease rent to landlord',
        referenceNumber: `RENT-MONTH-${i}`,
        status: 'active',
        source: 'manual',
        createdAt: dateStr,
        updatedAt: dateStr,
      });

      transactions.push({
        id: `${workspaceId}-tx-util-${i}`,
        workspaceId,
        type: 'expense',
        amountPaise: 245000, // ₹2,450.00
        occurredAt: dateStr,
        accountId: `${workspaceId}-acc-bank`,
        categoryId: `${workspaceId}-cat-utilities`,
        description: 'Commercial electricity & LPG gas cylinders',
        status: 'active',
        source: 'manual',
        createdAt: dateStr,
        updatedAt: dateStr,
      });
    }
  }

  // Intentional Duplicate for Quality Gate testing
  const dupDate = new Date(baseTime - 1 * dayMs).toISOString();
  transactions.push({
    id: `${workspaceId}-tx-dup-orig`,
    workspaceId,
    type: 'expense',
    amountPaise: 240000, // ₹2,400.00
    occurredAt: dupDate,
    accountId: `${workspaceId}-acc-bank`,
    categoryId: `${workspaceId}-cat-packaging`,
    description: 'Custom Gold Embossed Cake Boxes (Pack of 100)',
    referenceNumber: 'BOX-991',
    status: 'active',
    source: 'manual',
    createdAt: dupDate,
    updatedAt: dupDate,
  });
  transactions.push({
    id: `${workspaceId}-tx-dup-copy`,
    workspaceId,
    type: 'expense',
    amountPaise: 240000, // Same ₹2,400.00
    occurredAt: dupDate,
    accountId: `${workspaceId}-acc-bank`,
    categoryId: `${workspaceId}-cat-packaging`,
    description: 'Custom Gold Embossed Cake Boxes (Pack of 100)',
    referenceNumber: 'BOX-991',
    status: 'active',
    source: 'manual',
    createdAt: dupDate,
    updatedAt: dupDate,
  });

  // Intentional Unusual Expense (> ₹15,000)
  const outlierDate = new Date(baseTime - 12 * dayMs).toISOString();
  transactions.push({
    id: `${workspaceId}-tx-outlier`,
    workspaceId,
    type: 'expense',
    amountPaise: 1850000, // ₹18,500.00
    occurredAt: outlierDate,
    accountId: `${workspaceId}-acc-bank`,
    categoryId: `${workspaceId}-cat-equipment`,
    description: 'Heavy-Duty 7-Litre Planetary Stand Mixer',
    referenceNumber: 'MIXER-EQUIP-401',
    status: 'active',
    source: 'manual',
    createdAt: outlierDate,
    updatedAt: outlierDate,
  });

  await db.transactions.bulkPut(transactions);

  // 5. Invoices & Receivables
  const invoices: Invoice[] = [
    {
      id: `${workspaceId}-inv-01`,
      workspaceId,
      invoiceNumber: 'INV-2026-001',
      contactName: 'Infosys Team Celebrations',
      issueDate: '2026-10-01',
      dueDate: '2026-10-15',
      totalAmountPaise: 1500000, // ₹15,000.00
      paidAmountPaise: 500000,  // ₹5,000.00 paid
      status: 'partially_paid',
      notes: 'Diwali hamper gift boxes for 50 employees (₹10,000 balance pending)',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: `${workspaceId}-inv-02`,
      workspaceId,
      invoiceNumber: 'INV-2026-002',
      contactName: 'Preeti Wedding Planning',
      issueDate: '2026-10-05',
      dueDate: '2026-10-20',
      totalAmountPaise: 2200000, // ₹22,000.00
      paidAmountPaise: 0,
      status: 'unpaid',
      notes: 'Wedding reception dessert table booking',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];
  await db.invoices.bulkPut(invoices);

  // 6. Recalculate balances for all accounts
  for (const acc of accounts) {
    const opening = acc.openingBalancePaise;
    const txs = transactions.filter((t) => t.status === 'active');
    
    const inflows = txs
      .filter((t) => t.accountId === acc.id && t.type === 'income')
      .reduce((s, t) => s + t.amountPaise, 0);

    const outflows = txs
      .filter((t) => t.accountId === acc.id && t.type === 'expense')
      .reduce((s, t) => s + t.amountPaise, 0);

    const tin = txs
      .filter((t) => t.toAccountId === acc.id && t.type === 'transfer')
      .reduce((s, t) => s + t.amountPaise, 0);

    const tout = txs
      .filter((t) => t.accountId === acc.id && t.type === 'transfer')
      .reduce((s, t) => s + t.amountPaise, 0);

    const closing = opening + inflows - outflows + (tin - tout);
    await db.accounts.update(acc.id, { currentBalancePaise: closing });
  }

  return workspaceId;
}

export async function clearWorkspaceData(workspaceId: string) {
  await db.transactions.where('workspaceId').equals(workspaceId).delete();
  await db.categories.where('workspaceId').equals(workspaceId).delete();
  await db.accounts.where('workspaceId').equals(workspaceId).delete();
  await db.receipts.where('workspaceId').equals(workspaceId).delete();
  await db.contacts.where('workspaceId').equals(workspaceId).delete();
  await db.invoices.where('workspaceId').equals(workspaceId).delete();
  await db.reconciliations.where('workspaceId').equals(workspaceId).delete();
  await db.periodLocks.where('workspaceId').equals(workspaceId).delete();
  await db.auditEvents.where('workspaceId').equals(workspaceId).delete();
  await db.alerts.where('workspaceId').equals(workspaceId).delete();
  await db.workspaces.delete(workspaceId);
}
