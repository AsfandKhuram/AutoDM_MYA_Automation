import { test, expect, type Page } from '@playwright/test';

/**
 * ALP-2020 — Implement tab navigation on loan detail pages using the ui Tabs components
 *
 * Scope (per ticket): wire up the `ui` library Tabs component for navigation on the
 * MyAccount (v2) loan detail pages. Badges/counters are OUT of scope (ALP-1979).
 *
 * Loan detail tabs observed on dev (https://my2.dev.rate.com):
 *   - "My loan"   → /accounts/mortgage/{id}/overview
 *   - "Tasks"     → /accounts/mortgage/{id}/tasks
 *   - "Documents" → /accounts/mortgage/{id}/documents
 *
 * This spec verifies:
 *   1. The tablist renders with the expected tabs on a loan detail page.
 *   2. Clicking each tab activates it, updates the URL, and deselects the others.
 *   3. Deep-linking directly to a tab route selects the correct tab.
 */

const TEST_EMAIL = 'myaccount-alp0706-01a@yopmail.com';
const TEST_PASSWORD = 'Grtest123!';
const MY2_ACCOUNTS_URL = 'https://my2.dev.rate.com/accounts';

const TAB_ROUTES: Array<{ name: RegExp; segment: string }> = [
  { name: /^My loan$/i, segment: 'overview' },
  { name: /^Tasks$/i, segment: 'tasks' },
  { name: /^Documents$/i, segment: 'documents' },
];

/** Log into MyAccount v2 via the Okta-hosted login (single-step email + password). */
async function login(page: Page): Promise<void> {
  await page.goto(MY2_ACCOUNTS_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  // If the Okta login screen appears, authenticate. If we're already signed in
  // (valid session), the accounts dashboard renders directly.
  await page
    .waitForURL(/login\.dev\.rate\.com|okta|my2\.dev\.rate\.com.*login/i, { timeout: 8000 })
    .catch(() => {});

  if (/login|okta/i.test(page.url())) {
    // Best-effort cookie banner dismissal so it can't intercept the submit.
    await page.getByRole('button', { name: /accept cookies/i }).click({ timeout: 3000 }).catch(() => {});

    const emailField = page
      .locator('input[name="identifier"], input[name="username"], input[type="email"]')
      .first();
    await emailField.waitFor({ state: 'visible', timeout: 15_000 });
    await emailField.fill(TEST_EMAIL);

    const passwordField = page.locator('input[name="password"], input[type="password"]').first();
    await passwordField.fill(TEST_PASSWORD);

    await page.getByRole('button', { name: /sign in|log in|submit/i }).first().click();
  }

  // Land back on the accounts dashboard.
  await page.waitForURL(/my2\.dev\.rate\.com\/accounts/i, { timeout: 60_000 });
  await page.waitForLoadState('networkidle').catch(() => {});
}

/** Open the first mortgage loan and return once the loan-detail overview is loaded. */
async function openFirstMortgageLoan(page: Page): Promise<string> {
  await page.goto(MY2_ACCOUNTS_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const loanLink = page.locator('a[href*="/accounts/mortgage/"]').first();
  await loanLink.waitFor({ state: 'visible', timeout: 30_000 });
  const href = await loanLink.getAttribute('href');
  expect(href, 'Expected at least one mortgage loan for the test user').toBeTruthy();

  const loanId = href!.match(/\/accounts\/mortgage\/([^/?#]+)/i)?.[1] ?? '';
  expect(loanId, 'Could not parse loan id from href').not.toEqual('');

  await page.goto(`${MY2_ACCOUNTS_URL}/mortgage/${loanId}/overview`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.getByRole('tablist').waitFor({ state: 'visible', timeout: 30_000 });
  return loanId;
}

test('[ALP-2020] Loan detail tabs render, switch, and deep-link correctly', async ({ page }) => {
  await login(page);
  const loanId = await openFirstMortgageLoan(page);

  // 1. Tablist renders with all expected tabs.
  const tablist = page.getByRole('tablist');
  await expect(tablist).toBeVisible();
  for (const { name } of TAB_ROUTES) {
    await expect(page.getByRole('tab', { name })).toBeVisible();
  }

  // On the overview route, "My loan" is the selected tab.
  await expect(page.getByRole('tab', { name: /^My loan$/i })).toHaveAttribute('aria-selected', 'true');

  // 2. Click each tab → it becomes selected, the URL updates, others deselect.
  for (const { name, segment } of TAB_ROUTES) {
    await page.getByRole('tab', { name }).click();
    await expect(page).toHaveURL(new RegExp(`/accounts/mortgage/${loanId}/${segment}(?:[/?#]|$)`, 'i'));
    await expect(page.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');

    // Every other tab must not be selected.
    for (const other of TAB_ROUTES) {
      if (other.segment === segment) continue;
      await expect(page.getByRole('tab', { name: other.name })).toHaveAttribute('aria-selected', 'false');
    }
  }

  // 3. Deep-link: navigating directly to a tab route selects that tab.
  await page.goto(`${MY2_ACCOUNTS_URL}/mortgage/${loanId}/tasks`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await expect(page.getByRole('tab', { name: /^Tasks$/i })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: /^My loan$/i })).toHaveAttribute('aria-selected', 'false');
});
