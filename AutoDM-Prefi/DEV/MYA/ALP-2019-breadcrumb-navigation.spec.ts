import { test, expect, type Page } from '@playwright/test';

/**
 * ALP-2019 — Integrate the Breadcrumb component on all nested pages
 *
 * The `ui` Breadcrumb component should appear on the MyAccount (v2) nested pages.
 *
 * Breadcrumb observed on dev (https://my2.dev.rate.com), rendered as
 * <nav aria-label="Breadcrumb">:
 *   Accounts (link → /accounts)  /  My loan (current page)
 *
 * It is present on the loan detail tab pages (overview/tasks/documents) and on
 * deeper nested pages (e.g. an individual task).
 *
 * This spec verifies:
 *   1. The breadcrumb renders on the loan detail pages and nested pages.
 *   2. The "Accounts" crumb links back to /accounts and works when clicked.
 *   3. A current-page crumb is present (non-link).
 */

const TEST_EMAIL = process.env.MYA_EMAIL_TABS ?? '';
const TEST_PASSWORD = process.env.MYA_PASSWORD ?? '';
const MY2_ACCOUNTS_URL = 'https://my2.dev.rate.com/accounts';

/** Log into MyAccount v2 via the Okta-hosted login (single-step email + password). */
async function login(page: Page): Promise<void> {
  await page.goto(MY2_ACCOUNTS_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  await page
    .waitForURL(/login\.dev\.rate\.com|okta|my2\.dev\.rate\.com.*login/i, { timeout: 8000 })
    .catch(() => {});

  if (/login|okta/i.test(page.url())) {
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

  await page.waitForURL(/my2\.dev\.rate\.com\/accounts/i, { timeout: 60_000 });
  await page.waitForLoadState('networkidle').catch(() => {});
}

/** Discover the first mortgage loan id for the test user. */
async function getFirstLoanId(page: Page): Promise<string> {
  await page.goto(MY2_ACCOUNTS_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const loanLink = page.locator('a[href*="/accounts/mortgage/"]').first();
  await loanLink.waitFor({ state: 'visible', timeout: 30_000 });
  const href = await loanLink.getAttribute('href');
  const loanId = href?.match(/\/accounts\/mortgage\/([^/?#]+)/i)?.[1] ?? '';
  expect(loanId, 'Expected at least one mortgage loan for the test user').not.toEqual('');
  return loanId;
}

/** Assert the breadcrumb component is present and well-formed on the current page. */
async function assertBreadcrumb(page: Page): Promise<void> {
  const breadcrumb = page.getByRole('navigation', { name: /breadcrumb/i });
  await expect(breadcrumb).toBeVisible();

  // First crumb links back to the accounts list.
  const accountsCrumb = breadcrumb.getByRole('link', { name: /^Accounts$/i });
  await expect(accountsCrumb).toBeVisible();
  await expect(accountsCrumb).toHaveAttribute('href', /\/accounts$/i);

  // There is at least one non-link (current page) crumb after "Accounts".
  const crumbItems = breadcrumb.getByRole('listitem');
  expect(await crumbItems.count()).toBeGreaterThan(1);
}

test('[ALP-2019] Breadcrumb renders on loan detail and nested pages', async ({ page }) => {
  await login(page);
  const loanId = await getFirstLoanId(page);

  const nestedPaths = [
    `mortgage/${loanId}/overview`,
    `mortgage/${loanId}/tasks`,
    `mortgage/${loanId}/documents`,
    `mortgage/${loanId}/tasks/1`,
  ];

  // 1. Breadcrumb present on every nested page.
  for (const p of nestedPaths) {
    await page.goto(`${MY2_ACCOUNTS_URL}/${p}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await assertBreadcrumb(page);
  }

  // 2. Clicking the "Accounts" crumb navigates back to the accounts list.
  await page.goto(`${MY2_ACCOUNTS_URL}/mortgage/${loanId}/overview`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page
    .getByRole('navigation', { name: /breadcrumb/i })
    .getByRole('link', { name: /^Accounts$/i })
    .click();
  await expect(page).toHaveURL(/\/accounts$/i);
});
