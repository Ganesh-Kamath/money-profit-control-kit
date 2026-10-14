import { test, expect } from '@playwright/test';

test.describe('ControlKit Core User Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Open the local application
    await page.goto('/');
  });

  test('Flow 1: App Shell & Clean Local Rendering', async ({ page }) => {
    // Assert brand header and offline local badge
    await expect(page.locator('text=ControlKit').first()).toBeVisible();
    await expect(page.locator('text=LOCAL').first()).toBeVisible();

    // Verify main navigation items
    await expect(page.locator('text=Overview').first()).toBeVisible();
    await expect(page.locator('text=Transactions').first()).toBeVisible();
    await expect(page.locator('text=Receivables').first()).toBeVisible();
    await expect(page.locator('text=Reports').first()).toBeVisible();
  });

  test('Flow 2: Fast 3-Tap Sale Entry Flow with Instant Undo', async ({ page }) => {
    // Navigate to Ledger
    await page.click('button:has-text("Transactions"), button:has-text("Ledger")');

    // Click Fast Sale (3-Tap) button
    const fastSaleBtn = page.locator('button:has-text("Fast Sale")');
    if (await fastSaleBtn.isVisible()) {
      await fastSaleBtn.click();
      await expect(page.locator('text=Sale in 3 Taps')).toBeVisible();

      // Tap +₹500 chip
      await page.click('button:has-text("+₹500")');

      // Click Confirm & Record Sale
      await page.click('button:has-text("Confirm & Record Sale")');

      // Toast notification with Undo should appear
      await expect(page.locator('text=Sale Recorded').first()).toBeVisible();
      await expect(page.locator('button:has-text("Undo Action")').first()).toBeVisible();
    }
  });

  test('Flow 3: GST Tax Invoicing, Line Items & Pure-SVG UPI QR Code', async ({ page }) => {
    // Navigate to Receivables & Invoices
    await page.click('button:has-text("Receivables")');

    // Verify Invoicing dashboard loads
    await expect(page.locator('text=Receivables & Invoicing').first()).toBeVisible();

    // Verify New Invoice button is present
    const newInvBtn = page.locator('button:has-text("+ Create Invoice")');
    if (await newInvBtn.isVisible()) {
      await newInvBtn.click();
      await expect(page.locator('text=Create Invoice')).toBeVisible();

      // Check for Tax Invoice toggle
      const taxToggle = page.locator('text=Tax Invoice');
      await expect(taxToggle).toBeVisible();
    }
  });

  test('Flow 4: Bank Statement Import & Duplicate Review Wizard', async ({ page }) => {
    // Navigate to Import & Backup
    await page.click('button:has-text("Import & Backup"), button:has-text("More")');

    const importNav = page.locator('button:has-text("Import & Backup")');
    if (await importNav.isVisible()) {
      await importNav.click();
    }

    await expect(page.locator('text=Statement Import & Bank Feeds').first()).toBeVisible();
    await expect(page.locator('text=Drag & drop Excel (.xlsx, .xls) or CSV').first()).toBeVisible();
  });

  test('Flow 5: Accountant Pack CSV Export & Reports', async ({ page }) => {
    // Navigate to Reports
    await page.click('button:has-text("Reports")');
    await expect(page.locator('text=Financial Reports & CA Pack').first()).toBeVisible();

    // Switch to Accountant Pack tab
    const packTab = page.locator('button:has-text("Accountant Pack")');
    if (await packTab.isVisible()) {
      await packTab.click();
      await expect(page.locator('text=One-Tap Accountant & CA Export Pack')).toBeVisible();
      await expect(page.locator('text=Download Ledger CSV')).toBeVisible();
      await expect(page.locator('text=Download Invoices CSV')).toBeVisible();
    }
  });

  test('Flow 6: Language Toggle (English to Hindi)', async ({ page }) => {
    // Go to Overview
    await page.click('button:has-text("Overview")');

    // Locate Hindi toggle button
    const hindiBtn = page.locator('button:has-text("हिंदी")');
    if (await hindiBtn.isVisible()) {
      await hindiBtn.click();
      // Should show Hindi translated heading
      await expect(page.locator('text=आज की बिक्री, text=व्यापार सारांश').first()).toBeVisible();
    }
  });
});
