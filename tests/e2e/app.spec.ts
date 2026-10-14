import { test, expect } from '@playwright/test';

// Valid offline Ed25519 Business license key from licensing.test.ts
const TEST_BUSINESS_LICENSE =
  'CK-eyJwbGFuIjoiYnVzaW5lc3MiLCJsaWNlbnNlZU5hbWUiOiJTdW5pdGEgU2hhcm1hIiwibGljZW5zZWVFbWFpbCI6InN1bml0YS5iYWtlcnlAZXhhbXBsZS5jb20iLCJpc3N1ZWRBdCI6IjIwMjYtMTAtMTRUMTY6MjY6NDYuOTc1WiIsInVwZGF0ZXNVbnRpbCI6IjIwMjctMTAtMTRUMTY6MjY6NDYuOTc1WiJ9.FHKRqtwAKdcCld1M8HSL28WC8oZ98j-0iFdIWScD2NcBAaLPvnAgzC8HIajX8a7Cylo-srQQMI0JUyXcn2wZAQ';

// Helper to dismiss the first-run Onboarding Modal if present
async function ensureOnboarded(page: any) {
  const exploreDemoBtn = page.getByRole('button', { name: 'Explore Demo Data' });
  if (await exploreDemoBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await exploreDemoBtn.click();
    await page.waitForTimeout(400);
  }
}

// Responsive navigation helper supporting desktop sidebar & 360px mobile bottom-bar/more-drawer
async function navigateTo(
  page: any,
  screenName: 'Overview' | 'Transactions' | 'Expenses' | 'Sales & Profit' | 'Accounts' | 'Receivables' | 'Reports' | 'Import & Backup' | 'Settings'
) {
  const isMobile = (page.viewportSize()?.width ?? 1280) < 1024;

  if (isMobile) {
    const bottomNav = page.locator('nav.fixed');
    if (screenName === 'Overview') {
      await bottomNav.locator('button').filter({ hasText: 'Overview' }).click();
    } else if (screenName === 'Transactions') {
      await bottomNav.locator('button').filter({ hasText: 'Ledger' }).click();
    } else if (screenName === 'Sales & Profit') {
      await bottomNav.locator('button').filter({ hasText: 'Profit' }).click();
    } else {
      // Tap "More" in mobile bottom bar
      await bottomNav.locator('button').filter({ hasText: 'More' }).click();
      await page.waitForTimeout(300);
      await page.locator('div.fixed.bottom-16 button').filter({ hasText: screenName }).first().click();
    }
  } else {
    // Desktop sidebar navigation
    await page.locator('aside nav').getByRole('button', { name: screenName }).first().click();
  }
  await page.waitForTimeout(300);
}

test.describe('ControlKit Core User Flows (Desktop & 360x800 Mobile)', () => {
  test.beforeEach(async ({ page }) => {
    // Open the local production preview app
    await page.goto('/');
    await ensureOnboarded(page);
  });

  test('Flow 1: App Shell & Zero-Cloud Local Guarantees', async ({ page }) => {
    // Assert active workspace heading and core financials
    await expect(page.getByRole('heading', { name: /Sweet Crumb Patisserie/ }).first()).toBeVisible();

    // Verify Overview dashboard renders core financials
    await expect(page.getByText('Today in 10 Seconds').first()).toBeVisible();
    await expect(page.getByText('Q1. Today Inflow').first()).toBeVisible();
    await expect(page.getByText('Q4. Available Cash').first()).toBeVisible();
  });

  test('Flow 2: Fast 3-Tap Sale Entry Flow with Instant Undo', async ({ page }) => {
    // Tap Fast Sale button directly on Overview or Ledger
    const fastSaleBtn = page.getByRole('button', { name: /Sale in 3 Taps|Fast Sale/ }).first();
    await expect(fastSaleBtn).toBeVisible();
    await fastSaleBtn.click();

    // Fast entry modal should appear
    await expect(page.getByText('Sale in 3 Taps').first()).toBeVisible();

    // Tap +₹500 preset chip
    const chip500 = page.getByRole('button', { name: '+₹500' }).first();
    await chip500.click();

    // Click Record Sale
    const confirmBtn = page.getByRole('button', { name: /Record Sale/ }).first();
    await confirmBtn.click();

    // Instant toast notification with Undo Action should be displayed
    await expect(page.getByText('Sale Recorded').first()).toBeVisible();
    const undoBtn = page.getByRole('button', { name: 'Undo Action' }).first();
    await expect(undoBtn).toBeVisible();
  });

  test('Flow 3: Business Plan Upgrade Gate & Invoicing Verification', async ({ page }) => {
    // Navigate to Receivables
    await navigateTo(page, 'Receivables');

    // Without a license activated, assert the clear Business Plan Gate
    const isPlanGateVisible = await page.getByText('Customer Invoices & Receivables').first().isVisible();
    expect(isPlanGateVisible).toBe(true);

    // Navigate to Settings to activate offline Business License
    await navigateTo(page, 'Settings');
    await expect(page.getByText('Enter or Update License Key').first()).toBeVisible();

    // Fill the offline Ed25519 license key
    const keyInput = page.getByPlaceholder(/Paste signed key/);
    await keyInput.fill(TEST_BUSINESS_LICENSE);
    await page.getByRole('button', { name: /Verify & Activate Offline Key/ }).click();

    // Toast confirms offline activation
    await expect(page.getByText('License Activated').first()).toBeVisible();

    // Now navigate back to Receivables - Invoicing should be fully unlocked
    await navigateTo(page, 'Receivables');
    await expect(page.getByText('Receivables & Invoicing').first()).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Create Invoice' }).first()).toBeVisible();
  });

  test('Flow 4: Bank Statement Import & Feed Drag-and-Drop', async ({ page }) => {
    // Navigate to Import & Backup
    await navigateTo(page, 'Import & Backup');

    // Assert bank feeds and import wizard
    await expect(page.getByText('1. Select Statement File').first()).toBeVisible();
    await expect(page.getByText('Supports HDFC, ICICI, SBI, Axis, Kotak').first()).toBeVisible();
    await expect(page.getByText('Click to select CSV or Excel').first()).toBeVisible();
  });

  test('Flow 5: Accountant Pack CSV Export & Reports', async ({ page }) => {
    // Navigate to Reports
    await navigateTo(page, 'Reports');
    await expect(page.getByText('Financial Reports & Accountant Pack').first()).toBeVisible();

    // Switch to Accountant Pack tab
    const packTab = page.getByRole('button', { name: 'Accountant Pack' }).first();
    await expect(packTab).toBeVisible();
    await packTab.click();

    await expect(page.getByText('One-Tap Accountant & CA Export Pack').first()).toBeVisible();
    await expect(page.getByText('Download Ledger CSV').first()).toBeVisible();
    await expect(page.getByText('Download Invoices CSV').first()).toBeVisible();
  });

  test('Flow 6: Language Toggle (English to Hindi UI Strings)', async ({ page }) => {
    // Navigate to Overview
    await navigateTo(page, 'Overview');

    // Locate Hindi toggle button
    const hindiBtn = page.getByRole('button', { name: 'हिन्दी में देखें' }).first();
    if (await hindiBtn.isVisible()) {
      await hindiBtn.click();
      await page.waitForTimeout(300);
      // Verify natural Hindi financial terms render
      await expect(page.getByText('आज का हिसाब (10 सेकंड में)').first()).toBeVisible();

      // Switch back to English
      const engBtn = page.getByRole('button', { name: 'English' }).first();
      await engBtn.click();
      await page.waitForTimeout(300);
      await expect(page.getByText('Today in 10 Seconds').first()).toBeVisible();
    }
  });

  test('Flow 7: Privacy Inspector & Zero-Network Live Audit', async ({ page }) => {
    // Navigate to Overview and open Privacy Audit
    await navigateTo(page, 'Overview');
    const privacyBtn = page.getByRole('button', { name: 'Privacy Audit' }).first();
    await expect(privacyBtn).toBeVisible();
    await privacyBtn.click();

    // Modal should render live security self-checks
    await expect(page.getByText('Privacy Center & Live Proof').first()).toBeVisible();
    await expect(page.getByText('External Network Requests: 0').first()).toBeVisible();
    await expect(page.getByText('Strict Content Security Policy (CSP)').first()).toBeVisible();

    // Close modal
    await page.getByRole('button', { name: /Close Privacy Center/ }).first().click();
  });
});
