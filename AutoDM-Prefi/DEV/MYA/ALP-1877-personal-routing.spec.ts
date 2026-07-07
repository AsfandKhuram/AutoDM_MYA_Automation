import { test, expect, type Page } from '@playwright/test';

/**
 * ALP-1877 — MyAccount v2 Page Routing (personal loan)
 *
 * Companion to ALP-1877-page-routing.spec.ts (which covers the mortgage flow).
 * This verifies the PERSONAL loan detail route for an account that actually has
 * personal loans:
 *   /accounts/personal/:loanId  → redirects to  /accounts/personal/:loanId/overview
 *   - title "Personal Loan Overview"
 *   - the ui Breadcrumb component renders (Accounts / current)
 *   - the "Accounts" crumb links back to the accounts list and navigates there
 *
 * NOTE: personal loans do NOT render the mortgage tab bar (My loan/Tasks/Documents),
 * so tabs are intentionally not asserted here.
 *
 * Credentials come from .env: MYA_EMAIL_PERSONAL / MYA_PASSWORD.
 */

const TEST_EMAIL = process.env.MYA_EMAIL_PERSONAL ?? '';
const TEST_PASSWORD = process.env.MYA_PASSWORD ?? '';
const MY2_ACCOUNTS_URL = 'https://my2.dev.rate.com/accounts';

async function login(page: Page): Promise<void> {
  await page.goto(MY2_ACCOUNTS_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page
    .waitForURL(/login\.dev\.rate\.com|okta|my2\.dev\.rate\.com.*login/i, { timeout: 15_000 })
    .catch(() => {});

  if (/login|okta/i.test(page.url())) {
    await page.getByRole('button', { name: /accept cookies|allow all/i }).first().click({ timeout: 4000 }).catch(() => {});
    const emailField = page
      .locator('input[name="identifier"], input[name="username"], input[type="email"]')
      .first();
    await emailField.waitFor({ state: 'visible', timeout: 30_000 });
    await emailField.fill(TEST_EMAIL);
    await page.locator('input[name="password"], input[type="password"]').first().fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in|log in|submit/i }).first().click();
  }

  await page.waitForURL(/my2\.dev\.rate\.com\/accounts/i, { timeout: 60_000 });
  await page.waitForLoadState('networkidle').catch(() => {});
}

test('[ALP-1877] Personal loan route resolves with breadcrumb', async ({ page }) => {
  test.skip(!TEST_EMAIL, 'Set MYA_EMAIL_PERSONAL in .env to run the personal-loan routing test.');

  await login(page);

  // Accounts overview shows the personal loan(s).
  await page.goto(MY2_ACCOUNTS_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const loanLink = page.locator('a[href*="/accounts/personal/"]').first();
  await loanLink.waitFor({ state: 'visible', timeout: 30_000 });
  const href = await loanLink.getAttribute('href');
  const loanId = href?.match(/\/accounts\/personal\/([^/?#]+)/i)?.[1] ?? '';
  expect(loanId, 'Expected a personal loan for the test user').not.toEqual('');

  // Opening the personal loan lands on its typed overview route (not the global 404).
  await page.goto(`${MY2_ACCOUNTS_URL}/personal/${loanId}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await expect(page).toHaveURL(new RegExp(`/accounts/personal/${loanId}/overview`, 'i'));
  await expect(page).toHaveTitle(/Personal Loan Overview/i);
  await expect(page.getByRole('heading', { name: /page not found/i })).toHaveCount(0);

  // Breadcrumb renders with an Accounts crumb that links back to the accounts list.
  const breadcrumb = page.getByRole('navigation', { name: /breadcrumb/i });
  await expect(breadcrumb).toBeVisible();
  const accountsCrumb = breadcrumb.getByRole('link', { name: /^Accounts$/i });
  await expect(accountsCrumb).toBeVisible();
  await expect(accountsCrumb).toHaveAttribute('href', /\/accounts$/i);

  // Clicking the Accounts crumb navigates back to the accounts list.
  await accountsCrumb.click();
  await expect(page).toHaveURL(/\/accounts$/i);
});
