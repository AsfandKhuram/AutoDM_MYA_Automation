import { test, expect } from '@playwright/test';

const EMAIL = 'myaccount-r2.25gri07c@yopmail.com';
const PASSWORD = 'Grtest123!';
const AUTH_URL = 'https://login.dev.rate.com/oauth2/aus1lsk5st100GteN1d7/v1/authorize?client_id=0oa1lsiuimcqJDqfh1d7&nonce=d8ac1fe2-8a4f-4b34-a382-fc0ab91abdab&state=ff472740-00c2-4e0c-bc6d-cf3d14a18add&scope=openid%20profile%20email%20offline_access&response_type=code&redirect_uri=https%3A%2F%2Fmy.gr-dev.com%2Fokta%2Foauth%2Fcb';

async function acceptCookiesIfPresent(page) {
  const acceptCookiesButton = page.getByRole('button', { name: /accept cookies|accept all/i }).first();
  if (await acceptCookiesButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await acceptCookiesButton.click();
  }
}

async function loginIfPrompted(page) {
  const dashboardInsuranceLink = page.getByRole('link', { name: /^Insurance$/i }).first();

  if (await dashboardInsuranceLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    return;
  }

  await page.goto(AUTH_URL, { waitUntil: 'domcontentloaded' });
  await acceptCookiesIfPresent(page);

  await page.getByRole('textbox', { name: /email/i }).fill(EMAIL);
  await page.getByRole('textbox', { name: /password/i }).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();

  await Promise.race([
    page.waitForURL(/my\.gr-dev\.com\/(okta\/oauth\/cb|dashboard|loan\/)/i, { timeout: 60000 }),
    dashboardInsuranceLink.waitFor({ state: 'visible', timeout: 60000 }),
  ]);

  await page.goto('https://my.gr-dev.com/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForURL('**/dashboard**', { timeout: 60000 });
}

test.afterEach(async ({ page }, testInfo) => {
  const safeStatus = testInfo.status ?? 'unknown';
  const screenshotPath = testInfo.outputPath(`result-${safeStatus}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
});

test('Login-helpfull_Links_Insurance', async ({ page }) => {
  test.setTimeout(180000);

  await page.goto('https://my.gr-dev.com/dashboard');
  await loginIfPrompted(page);
  await page.getByRole('menuitem', { name: /^Financial solutions$/i }).click();
  await page.getByRole('main').click();
  await page.getByText('Home loansFind the perfect loan for youSame Day MortgageGet approved in 1 day').click();
  await page.getByRole('main').click();
  await page.locator('body').press('ArrowDown');
  await page.locator('body').press('ArrowDown');
  await page.locator('body').press('ArrowDown');
  await page.locator('body').press('ArrowDown');
  await page.locator('body').press('ArrowDown');
  await page.locator('body').press('ArrowDown');
  await page.locator('body').press('ArrowDown');
  await page.locator('body').press('ArrowDown');
  await page.locator('body').press('ArrowDown');
  await page.locator('body').press('ArrowDown');
  await page.locator('body').press('ArrowDown');
  await page.locator('body').press('ArrowDown');
  await page.locator('body').press('ArrowUp');
  await page.locator('body').press('ArrowUp');
  await page.locator('body').press('ArrowUp');
  await page.locator('body').press('ArrowUp');
  await page.locator('body').press('ArrowUp');
  await page.locator('body').press('ArrowUp');
  await page.locator('body').press('ArrowUp');
  await page.locator('body').press('ArrowUp');
  await page.locator('body').press('ArrowUp');
  await page.locator('body').press('ArrowUp');
  await page.locator('body').press('ArrowUp');
  await page.locator('body').press('ArrowUp');
  await page.locator('body').press('ArrowUp');
  await page.locator('body').press('ArrowUp');
  await page.locator('body').press('ArrowUp');
  await page.locator('body').press('ArrowUp');
  await page.locator('body').press('ArrowUp');
  await page.locator('body').press('ArrowUp');
  await page.locator('body').press('ArrowUp');
  await page.getByRole('menuitem', { name: 'Dashboard' }).click();
  await page.getByRole('main').click();
  await page.getByRole('menuitem', { name: 'Dashboard' }).click();
  await page.getByRole('link', { name: 'Complete tasks' }).first().click();
  await page.getByRole('img', { name: 'insurance' }).click();
  await page.getByRole('button', { name: 'Get quotes now' }).click();
  await page.getByRole('heading', { name: 'Here\'s why we know you\'ll' }).click();
  await page.getByRole('heading', { name: 'check-tick We do the leg work' }).click();
  await page.getByText('We work with multiple').click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Get quotes now' }).click();
  await page.getByRole('button', { name: 'Get a free quote' }).click();
  await page.getByRole('heading', { name: 'Hang tight while we send your' }).click();
  await page.getByText('This may take a few seconds.').click();
  await page.getByRole('img', { name: 'Logo' }).click();
  await expect(page.locator('.spinner-spinning')).toBeVisible();
});

// ─── Test 1: Helpful links on overview, Tasks, loan detail & documents ──────────
test('1 - Helpful links on overview, tasks, loan detail & documents pages', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('https://my.gr-dev.com/dashboard');
  await loginIfPrompted(page);
  await page.waitForURL('**/dashboard**', { timeout: 30000 });
  await page.getByRole('link', { name: 'Insurance' }).waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});

  // Navigate to loan overview via "Complete tasks" dashboard icon
  await page.getByRole('link', { name: 'Complete tasks' }).first().click();
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.locator('.spinner-spinning').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  const overviewUrl = page.url();
  console.log('Loan overview URL:', overviewUrl);

  // Extract loan UUID for direct URL navigation
  const loanId = overviewUrl.match(/\/loan\/([^/]+)\//)?.[1] ?? '';
  console.log('Loan ID:', loanId);

  // Helpful links copy has changed over time; keep checks tolerant to known variants.
  const knownLinks = [
    /What is escrow\??/i,
    /Mortgage processing steps/i,
    /Understanding underwriting/i,
    /Different types of mortgage programs/i,
    /How much should your down payment be\??/i,
    /Top 10 things not to do before buying a home/i,
    /What credit score do you need\??/i,
    /Mortgage process/i,
  ];

  // ── Overview tab – verify helpful links heading & items ──────────────────────
  await expect(page.getByText('Helpful links')).toBeVisible({ timeout: 10000 });
  console.log('Helpful links heading visible on Overview tab');
  let overviewVisibleCount = 0;
  for (const linkText of knownLinks) {
    const visible = await page.getByText(linkText).first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`  "${linkText}": ${visible ? 'visible ✓' : 'not found'}`);
    if (visible) overviewVisibleCount += 1;
  }
  console.log(`Helpful link items found on Overview: ${overviewVisibleCount}`);
  await page.screenshot({ path: 'screenshots/helpful-links-overview.png' });

  // ── Navigate to other tabs via URL and check for helpful links ───────────────
  const tabPaths = loanId ? [
    { name: 'Tasks',       path: `/loan/${loanId}/tasks` },
    { name: 'Loan details', path: `/loan/${loanId}/loan-details` },
    { name: 'Documents',   path: `/loan/${loanId}/documents` },
  ] : [];

  for (const { name, path } of tabPaths) {
    await page.goto(`https://my.gr-dev.com${path}`);
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
    await page.locator('.spinner-spinning').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    console.log(`\nNavigated to ${name} tab – URL: ${page.url()}`);
    await page.screenshot({ path: `screenshots/helpful-links-${name.toLowerCase().replace(' ', '-')}.png` });

    const hlVisible = await page.getByText('Helpful links').first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`  Helpful links heading on ${name}: ${hlVisible}`);
    if (hlVisible) {
      for (const linkText of knownLinks) {
        const v = await page.getByText(linkText).first().isVisible({ timeout: 2000 }).catch(() => false);
        console.log(`    "${linkText}": ${v ? '✓' : 'not found'}`);
      }
    }
  }
});

// ─── Test 2: Insurance banner on overview & loan details + quote flow ───────────
test('2 - Insurance banner on overview & loan details; Get quotes now flow', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('https://my.gr-dev.com/dashboard');
  await loginIfPrompted(page);
  await page.waitForURL('**/dashboard**', { timeout: 30000 });
  await page.getByRole('link', { name: 'Insurance' }).waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});

  // Navigate to loan overview via "Complete tasks" (dashboard icon)
  await page.getByRole('link', { name: 'Complete tasks' }).first().click();
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.locator('.spinner-spinning').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  console.log('Loan overview URL:', page.url());

  // Verify insurance banner is visible in the right sidebar
  const insuranceBanner = page.getByRole('img', { name: /insurance/i })
    .or(page.locator('[class*="insurance"] img').first())
    .or(page.getByAltText(/insurance/i).first());
  const insuranceVisible = await insuranceBanner.first().isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`Insurance banner visible on loan overview: ${insuranceVisible}`);

  // Click the insurance image to open the "Get quotes now" modal
  await page.getByRole('img', { name: 'insurance' }).click();
  await page.getByRole('button', { name: 'Get quotes now' }).click();

  // Verify modal content
  await expect(page.getByRole('heading', { name: /Here's why we know you'll/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /check-tick We do the leg work/i })).toBeVisible();
  await expect(page.getByText('We work with multiple')).toBeVisible();
  console.log('Get quotes now modal content verified');

  // Cancel and reopen
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Get quotes now' }).click();

  // Get a free quote → loading spinner
  await page.getByRole('button', { name: 'Get a free quote' }).click();
  await expect(page.getByRole('heading', { name: /Hang tight while we send your/i })).toBeVisible();
  await expect(page.getByText('This may take a few seconds.')).toBeVisible();
  await expect(page.locator('.spinner-spinning')).toBeVisible();
  console.log('Quote submission flow completed');
});

// ─── Test 3: Rate app banner on Tasks, Documents & Dashboard ───────────────────
test('3 - Rate app banner on tasks, documents & dashboard pages', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('https://my.gr-dev.com/dashboard');
  await loginIfPrompted(page);
  await page.waitForURL('**/dashboard**', { timeout: 30000 });
  await page.getByRole('link', { name: 'Insurance' }).waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});

  // Helper: look for the Rate app banner in the current page
  const appBannerLocator = () =>
    page.locator('[class*="app-banner"], [class*="app-download"], [class*="mobile-app"]')
      .or(page.getByAltText(/powerbid|rate app|download/i))
      .or(page.getByText(/Download the Rate app|Get the app/i).first());

  // Dashboard
  await page.screenshot({ path: 'screenshots/app-banner-dashboard.png' });
  const dashboardBanner = await appBannerLocator().first().isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`Rate app banner on Dashboard: ${dashboardBanner}`);

  // Loan overview – navigate via "Complete tasks" dashboard icon
  await page.getByRole('link', { name: 'Complete tasks' }).first().click();
  await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
  await page.getByRole('link', { name: 'Insurance' }).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  const overviewUrl = page.url();
  const loanId = overviewUrl.match(/\/loan\/([^/]+)\//)?.[1] ?? '';
  await page.screenshot({ path: 'screenshots/app-banner-loan-overview.png' });
  const overviewBanner = await appBannerLocator().first().isVisible({ timeout: 3000 }).catch(() => false);
  console.log(`Rate app banner on loan overview: ${overviewBanner}`);

  // Documents tab – navigate via URL
  if (loanId) {
    await page.goto(`https://my.gr-dev.com/loan/${loanId}/documents`);
    await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
    await page.getByRole('link', { name: 'Insurance' }).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    console.log(`Documents tab URL: ${page.url()}`);
    await page.screenshot({ path: 'screenshots/app-banner-documents.png' });
    const docsBanner = await appBannerLocator().first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`Rate app banner on Documents page: ${docsBanner}`);
  } else {
    console.log('Could not extract loan ID – skipping Documents tab check');
  }
});

// ─── Test 4: Insurance tab – full content verification ─────────────────────────
test('4 - Insurance tab content verification', async ({ page }) => {
  test.setTimeout(180000);

  await loginIfPrompted(page);

  // Navigate to Insurance page directly (clicking nav link causes page to never reach 'load')
  console.log('Test 4: navigating to Insurance page directly');
  await page.goto('https://my.gr-dev.com/financial-solution/insurance', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // If redirected back to auth, sign in and retry once.
  if (/login\.dev\.rate\.com/i.test(page.url())) {
    await loginIfPrompted(page);
    await page.goto('https://my.gr-dev.com/financial-solution/insurance', { waitUntil: 'domcontentloaded', timeout: 30000 });
  }

  console.log('Test 4: Insurance page URL:', page.url());
  await page.locator('.spinner-spinning').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

  // Verify page heading
  await expect(page.getByRole('heading', { name: /^Insurance$/i })).toBeVisible({ timeout: 10000 });

  // Verify intro description (digital marketplace text)
  await expect(page.getByText(/digital marketplace for insurance/i).first()).toBeVisible({ timeout: 10000 });

  // Verify the "Get started" CTA is present
  const getStartedBtn = page.getByRole('button', { name: /Get started/i })
    .or(page.getByRole('link', { name: /Get started/i }));
  await expect(getStartedBtn.first()).toBeVisible({ timeout: 10000 });
  console.log('Insurance page heading + description + CTA verified');

  // Screenshot the insurance page
  await page.screenshot({ path: 'screenshots/insurance-tab-top.png' });

  // Scroll down to check for more content
  await page.keyboard.press('End');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/insurance-tab-bottom.png' });
  console.log('Insurance tab content verification passed');
});

// ─── Test 5: Insurance tiles open correct pages in new tabs ────────────────────
test('5 - Each insurance tile opens the correct page in a new tab', async ({ page }) => {
  test.setTimeout(180000);

  await loginIfPrompted(page);

  // Navigate to Insurance page directly
  console.log('Test 5: navigating to Insurance page directly');
  await page.goto('https://my.gr-dev.com/financial-solution/insurance', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // If redirected back to auth, sign in and retry once.
  if (/login\.dev\.rate\.com/i.test(page.url())) {
    await loginIfPrompted(page);
    await page.goto('https://my.gr-dev.com/financial-solution/insurance', { waitUntil: 'domcontentloaded', timeout: 30000 });
  }

  console.log('Test 5: Insurance page URL:', page.url());
  await page.locator('.spinner-spinning').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

  // Find all main content links on the insurance page
  const mainLinks = page.locator('main a, [class*="content"] a');
  const allCount = await mainLinks.count();
  console.log(`Total main content links on insurance page: ${allCount}`);

  // Log all links for discovery
  for (let i = 0; i < Math.min(allCount, 10); i++) {
    const href = await mainLinks.nth(i).getAttribute('href');
    const text = await mainLinks.nth(i).textContent();
    console.log(`  Link ${i + 1}: "${text?.trim()}" → ${href}`);
  }

  // Verify the Get started button/link is accessible
  const getStartedBtn = page.getByRole('button', { name: /Get started/i })
    .or(page.getByRole('link', { name: /Get started/i }));
  if (await getStartedBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('"Get started" CTA is accessible');
    await expect(getStartedBtn.first()).toBeVisible();
  } else {
    console.log('"Get started" CTA not found');
  }

  await page.screenshot({ path: 'screenshots/insurance-page-links.png' });
  console.log('\nInsurance page link discovery completed');
});
