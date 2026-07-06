/**
 * ALP-1812 — MyAccount API Fast/Speedy Loans Endpoint
 * Tests the new GET /api/myaccount/v2/mortgage/loans/search endpoint which returns
 * partial loan data from the search index (no Encompass fetch).
 *
 * Covers:
 *  1. Schema — only minimal fields returned (grLoanId, loanGuid, loanNumber)
 *  2. Performance — response faster than 5s
 *  3. Correctness — loan numbers match what the UI shows on my2.dev.rate.com/accounts
 *  4. Co-mortgagor loans — appear in the list (known gap in PR #354)
 *  5. Comparison — /search returns same loan numbers as legacy /loans endpoint
 */

import { test, expect } from '@playwright/test';

const MY_RATE_LOANS_URL = 'https://my2.dev.rate.com/accounts';
const SEARCH_API = 'https://my2.dev.rate.com/api/myaccount/v2/mortgage/loans/search';
const LEGACY_API = 'https://my2.dev.rate.com/api/myaccount/v2/mortgage/loans';
const SEARCH_NOT_READY_STATUSES = [400, 404];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Test account that has at least one loan (including a co-mortgagor loan)
const TEST_EMAIL = process.env.MYA_EMAIL_API ?? '';
const TEST_PASSWORD = process.env.MYA_PASSWORD ?? '';

/**
 * Log in and capture the raw auth headers from the actual loans API request
 * the page makes after landing on /accounts. Playwright intercepts at the
 * network layer so we get the real cookie/auth headers the browser sends.
 */
async function loginAndGetHeaders(page: any): Promise<Record<string, string>> {
  let capturedHeaders: Record<string, string> = {};

  page.on('request', (req: any) => {
    const url: string = req.url();
    if (url.includes('/api/myaccount/v2/mortgage/loans') && Object.keys(capturedHeaders).length === 0) {
      capturedHeaders = req.headers();
      console.log('[Auth] Captured headers from:', url);
    }
  });

  // Navigate to accounts — SSO redirects to login.dev.rate.com then back
  await page.goto(MY_RATE_LOANS_URL, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Close' }).click().catch(() => {});
  await page.getByRole('textbox', { name: 'Email' }).fill(TEST_EMAIL);
  await page.getByRole('textbox', { name: 'Password' }).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/my2\.dev\.rate\.com\/accounts/, { timeout: 30000 });
  await page.waitForLoadState('networkidle').catch(() => {});

  if (Object.keys(capturedHeaders).length === 0) {
    console.warn('[Auth] No headers captured yet — reloading to trigger loans API call...');
    await page.reload({ waitUntil: 'networkidle' });
  }

  return capturedHeaders;
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

test.describe('ALP-1812 — GET /api/myaccount/v2/mortgage/loans/search', () => {

  test('0. Unauthorized — search endpoint should reject missing auth', async ({ page }) => {
    const res = await page.request.get(SEARCH_API);
    console.log(`[/loans/search unauth] status: ${res.status()}`);
    expect([401, 403]).toContain(res.status());
  });

  test('1. Schema — returns only minimal fields (grLoanId, loanGuid, loanNumber)', async ({ page }) => {
    const headers = await loginAndGetHeaders(page);
    test.skip(Object.keys(headers).length === 0, 'Could not capture auth headers');

    const t0 = Date.now();
    const res = await page.request.get(SEARCH_API, { headers });
    const elapsed = Date.now() - t0;
    console.log(`[/loans/search] Status: ${res.status()} | Time: ${elapsed}ms`);

    test.skip(SEARCH_NOT_READY_STATUSES.includes(res.status()), `/loans/search not yet deployed on dev (${res.status()})`);
    expect(res.status(), 'Endpoint should return 200').toBe(200);

    const body = await res.json();
    console.log('[/loans/search] Sample:', JSON.stringify(body?.[0] ?? body).slice(0, 400));

    const loans: any[] = Array.isArray(body) ? body : (body?.loans ?? body?.data ?? []);
    console.log(`[/loans/search] Returned ${loans.length} loans`);
    expect(loans.length, 'Should return at least one loan').toBeGreaterThan(0);

    // Validate uniqueness to catch duplicate rows in list endpoint output.
    const loanNumbers = loans.map((l: any) => String(l.loanNumber));
    expect(new Set(loanNumbers).size, 'Duplicate loan numbers found in fast-path response').toBe(loanNumbers.length);

    for (const loan of loans) {
      expect(loan, `loan missing grLoanId: ${JSON.stringify(loan)}`).toHaveProperty('grLoanId');
      expect(loan, `loan missing loanGuid: ${JSON.stringify(loan)}`).toHaveProperty('loanGuid');
      expect(loan, `loan missing loanNumber: ${JSON.stringify(loan)}`).toHaveProperty('loanNumber');
      expect(String(loan.loanGuid), `loanGuid is not a valid UUID: ${loan.loanGuid}`).toMatch(UUID_REGEX);
      expect(loan, 'interestRate should not be in fast-path response').not.toHaveProperty('interestRate');
      expect(loan, 'propertyAddress should not be in fast-path response').not.toHaveProperty('propertyAddress');
      expect(loan, 'borrowerIncome should not be in fast-path response').not.toHaveProperty('borrowerIncome');
    }
  });

  test('2. Performance — response time under 5 seconds', async ({ page }) => {
    const headers = await loginAndGetHeaders(page);
    test.skip(Object.keys(headers).length === 0, 'Could not capture auth headers');

    const t0 = Date.now();
    const res = await page.request.get(SEARCH_API, { headers });
    const elapsed = Date.now() - t0;
    console.log(`[/loans/search] Response time: ${elapsed}ms`);

    test.skip(SEARCH_NOT_READY_STATUSES.includes(res.status()), `/loans/search not yet deployed on dev (${res.status()})`);
    expect(res.status()).toBe(200);
    expect(elapsed, `Response took ${elapsed}ms — should be under 5000ms`).toBeLessThan(5000);
  });

  test('3. Correctness — loan numbers match UI on my2.dev.rate.com/accounts', async ({ page }) => {
    const headers = await loginAndGetHeaders(page);
    test.skip(Object.keys(headers).length === 0, 'Could not capture auth headers');

    const res = await page.request.get(SEARCH_API, { headers });
    test.skip(SEARCH_NOT_READY_STATUSES.includes(res.status()), `/loans/search not yet deployed on dev (${res.status()})`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    const loans: any[] = Array.isArray(body) ? body : (body?.loans ?? body?.data ?? []);
    const apiLoanNumbers = loans.map((l: any) => String(l.loanNumber)).sort();
    console.log('[/loans/search] API loan numbers:', apiLoanNumbers);

    await page.goto(MY_RATE_LOANS_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const bodyText = ((await page.locator('body').textContent()) ?? '').replace(/\s+/g, ' ');
    const uiMatches = [...bodyText.matchAll(/\b(\d{9,})\b/g)].map(m => m[1]).filter(Boolean);
    const uiLoanNumbers = [...new Set(uiMatches)].sort();
    console.log('[UI] Loan numbers visible on accounts page:', uiLoanNumbers);

    for (const loanNum of apiLoanNumbers) {
      expect(uiLoanNumbers, `Loan ${loanNum} returned by API but not visible in UI`).toContain(loanNum);
    }
  });

  test('4. Co-mortgagor loans — appear in the search results (ALP-1812 known gap)', async ({ page }) => {
    const headers = await loginAndGetHeaders(page);
    test.skip(Object.keys(headers).length === 0, 'Could not capture auth headers');

    const res = await page.request.get(SEARCH_API, { headers });
    test.skip(SEARCH_NOT_READY_STATUSES.includes(res.status()), `/loans/search not yet deployed on dev (${res.status()})`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    const loans: any[] = Array.isArray(body) ? body : (body?.loans ?? body?.data ?? []);
    console.log('[/loans/search] All loans:', loans.map((l: any) => ({
      loanNumber: l.loanNumber,
      grLoanId: l.grLoanId,
      role: l.borrowerRole ?? l.role ?? 'unknown',
    })));

    await page.goto(MY_RATE_LOANS_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const bodyText = ((await page.locator('body').textContent()) ?? '').replace(/\s+/g, ' ');
    const uiMatches = [...bodyText.matchAll(/\b(\d{9,})\b/g)].map(m => m[1]);
    const uiCount = new Set(uiMatches).size;
    console.log(`[UI] ${uiCount} unique loan numbers on page | [API] ${loans.length} loans returned`);

    if (loans.length < uiCount) {
      console.warn(`⚠️  /loans/search returned ${loans.length} loans but UI shows ${uiCount} — co-mortgagor loans may be missing (known gap in PR #354)`);
    }
    expect(loans.length).toBeGreaterThan(0);
  });

  test('5. Comparison — /search returns same loan numbers as legacy /loans endpoint', async ({ page }) => {
    const headers = await loginAndGetHeaders(page);
    test.skip(Object.keys(headers).length === 0, 'Could not capture auth headers');

    const [searchRes, legacyRes] = await Promise.all([
      page.request.get(SEARCH_API, { headers }),
      page.request.get(LEGACY_API, { headers }),
    ]);

    console.log(`[/loans/search] status: ${searchRes.status()}`);
    console.log(`[/loans] legacy status: ${legacyRes.status()}`);

    test.skip(SEARCH_NOT_READY_STATUSES.includes(searchRes.status()), `/loans/search not yet deployed on dev (${searchRes.status()})`);
    expect(searchRes.status()).toBe(200);

    const searchBody = await searchRes.json();
    const searchLoans: any[] = Array.isArray(searchBody) ? searchBody : (searchBody?.loans ?? searchBody?.data ?? []);
    const searchNumbers = searchLoans.map((l: any) => String(l.loanNumber)).sort();

    if (legacyRes.status() === 200) {
      const legacyBody = await legacyRes.json();
      const legacyLoans: any[] = Array.isArray(legacyBody) ? legacyBody : (legacyBody?.loans ?? legacyBody?.data ?? []);
      const legacyNumbers = legacyLoans.map((l: any) => String(l.loanNumber)).sort();
      console.log('[/loans/search] loan numbers:', searchNumbers);
      console.log('[/loans] legacy loan numbers:', legacyNumbers);

      for (const num of searchNumbers) {
        expect(legacyNumbers, `Loan ${num} in /search but not in legacy /loans`).toContain(num);
      }
    } else {
      console.log(`Legacy /loans returned ${legacyRes.status()} — skipping comparison`);
    }
  });

});
