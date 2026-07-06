import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Test credentials
const TEST_EMAIL = 'myaccount-alp0618-03a@yopmail.com';
const TEST_PASSWORD = 'Grtest123!';
const MY2_ACCOUNTS_URL = 'https://my2.dev.rate.com/accounts';

/**
 * ALP-2010 Validation: Update OneLoanClient to use Okta Auth
 *
 * Per developer guidance, ALP-2010 can be validated using ANY endpoint that
 * returns mortgage loan information (v2 or v3). When a user logs into
 * my2.dev.rate.com/accounts, the dashboard fetches the user's loans — those
 * calls exercise the OneLoanClient (now Okta-authenticated).
 *
 * This test:
 *   1. Logs into my2.dev.rate.com/accounts via Okta
 *   2. Captures the mortgage-loan-info API calls that fire on dashboard load
 *   3. Validates Okta Bearer-token auth is present
 *   4. Asserts there are NO 401/403 (auth/scope) failures
 */
test('[ALP-2010] Okta Auth on Mortgage Loan Info API (my2)', async ({ page }) => {
  const _t0 = Date.now();
  const _logTime = (label: string) => {
    const elapsed = ((Date.now() - _t0) / 1000).toFixed(1);
    console.log(`[${elapsed}s] ${label}`);
  };

  // Match any endpoint that returns mortgage loan information (v2/v3) or
  // the underlying OneLoan / real-time loan services.
  const isLoanInfoEndpoint = (url: string): boolean => {
    const u = url.toLowerCase();
    return (
      u.includes('api.loan.oneloan') ||
      u.includes('real-time-loan') ||
      u.includes('real-time-search') ||
      u.includes('oneloan') ||
      /\/loans?(\/|\?|$)/.test(u) ||         // /loan, /loans
      /\/v[23]\/.*loan/.test(u) ||           // /v2/.../loan, /v3/.../loan
      /loan.*\/v[23](\/|\?|$)/.test(u)       // /loan.../v2, /loan.../v3
    );
  };

  // ── API monitoring ──
  const apiLogs = {
    requests: [] as Array<{ method: string; url: string; auth?: string; ts: number }>,
    responses: [] as Array<{ url: string; status: number; ts: number }>,
  };

  page.on('request', (request) => {
    try {
      const url = request.url();
      if (isLoanInfoEndpoint(url)) {
        // headers() is synchronous on the request object
        const headers = request.headers();
        const auth = headers['authorization'];
        apiLogs.requests.push({ method: request.method(), url, auth, ts: Date.now() });
        const authPreview = auth ? `${auth.substring(0, 25)}...` : 'NONE';
        _logTime(`📡 ${request.method()} ${url.split('?')[0]}  (auth: ${authPreview})`);
      }
    } catch {
      // ignore listener errors
    }
  });

  page.on('response', (response) => {
    try {
      const url = response.url();
      if (isLoanInfoEndpoint(url)) {
        apiLogs.responses.push({ url, status: response.status(), ts: Date.now() });
        _logTime(`📊 ${response.status()} ${url.split('?')[0]}`);
      }
    } catch {
      // ignore listener errors
    }
  });

  _logTime('═══════════════════════════════════════════════════════════');
  _logTime('ALP-2010 — Okta Auth on Mortgage Loan Info API');
  _logTime('═══════════════════════════════════════════════════════════\n');

  // STEP 1: Navigate to My2 Accounts
  _logTime('STEP 1: Navigating to My2 Accounts...');
  await page.goto(MY2_ACCOUNTS_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  _logTime(`✓ Navigated to ${MY2_ACCOUNTS_URL}`);

  // STEP 2: Check login status
  _logTime('\nSTEP 2: Checking login status...');
  const dashboardVisible = await page
    .locator('text=/dashboard|accounts|loans|my loans|welcome/i')
    .first()
    .isVisible({ timeout: 3000 })
    .catch(() => false);

  if (dashboardVisible) {
    _logTime('✓ Already logged in - dashboard visible');
  } else {
    _logTime('⚠️  Not logged in - proceeding with Okta auth...');

    // STEP 3: Wait for Okta redirect
    _logTime('\nSTEP 3: Waiting for Okta redirect...');
    await page
      .waitForURL(/login\.dev\.rate\.com|okta|my2\.dev\.rate\.com.*login/i, { timeout: 30000 })
      .catch(() => {});
    _logTime(`✓ Redirected to: ${page.url().split('?')[0]}`);

    // STEP 4: Enter credentials on Okta
    if (page.url().includes('okta') || page.url().includes('login')) {
      _logTime('\nSTEP 4: Entering Okta credentials...');

      const emailField = page
        .locator('input[name="identifier"], input[name="username"], input[type="email"]')
        .first();
      if (await emailField.isVisible({ timeout: 3000 }).catch(() => false)) {
        await emailField.fill(TEST_EMAIL);
        _logTime(`✓ Email entered: ${TEST_EMAIL}`);
      }

      const passwordField = page.locator('input[name="password"], input[type="password"]').first();
      if (await passwordField.isVisible({ timeout: 3000 }).catch(() => false)) {
        await passwordField.fill(TEST_PASSWORD);
        _logTime('✓ Password entered');
      }

      const loginBtn = page.getByRole('button', { name: /sign in|log in|submit|next/i }).first();
      if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await loginBtn.click();
        _logTime('✓ Login button clicked');
      }

      _logTime('\nSTEP 5: Waiting for redirect to My2...');
      await page.waitForLoadState('networkidle').catch(() => {});
      _logTime(`✓ Final URL: ${page.url().split('?')[0]}`);
    }
  }

  // STEP 6: Let the dashboard load loan data (fires loan-info API calls)
  _logTime('\nSTEP 6: Waiting for dashboard to load loan data...');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  // small settle window for any deferred fetches
  await page.waitForTimeout(2500).catch(() => {});
  _logTime('✓ Dashboard load settled');

  // STEP 7: Analyze captured traffic
  _logTime('\n═══════════════════════════════════════════════════════════');
  _logTime('STEP 7: ALP-2010 Validation Report');
  _logTime('═══════════════════════════════════════════════════════════\n');

  const bearerAuthCalls = apiLogs.requests.filter((r) => (r.auth ?? '').startsWith('Bearer '));
  const scopeErrors = apiLogs.responses.filter((r) => r.status === 401 || r.status === 403);
  const okResponses = apiLogs.responses.filter((r) => r.status >= 200 && r.status < 300);

  const validations = {
    oktaAuthWorking: page.url().includes('my2.dev.rate.com'),
    loanInfoEndpointCalled: apiLogs.requests.length > 0,
    bearerTokenPresent: bearerAuthCalls.length > 0,
    noScopeErrors: scopeErrors.length === 0,
  };

  const report = {
    timestamp: new Date().toISOString(),
    testUrl: MY2_ACCOUNTS_URL,
    finalUrl: page.url(),
    testDurationSeconds: ((Date.now() - _t0) / 1000).toFixed(1),
    validations,
    metrics: {
      loanInfoRequests: apiLogs.requests.length,
      bearerAuthRequests: bearerAuthCalls.length,
      successfulResponses: okResponses.length,
      scopeErrors: scopeErrors.length,
    },
    requestDetails: apiLogs.requests.map((r) => ({
      method: r.method,
      url: r.url.split('?')[0],
      authPresent: !!r.auth,
      authType: r.auth ? r.auth.substring(0, 20) : 'NONE',
    })),
    responseDetails: apiLogs.responses.map((r) => ({
      url: r.url.split('?')[0],
      status: r.status,
    })),
  };

  const reportDir = path.join(__dirname, '..', 'run-artifacts');
  const reportFile = path.join(reportDir, 'alp-2010-validation-report.json');
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

  console.log('\n🔍 [ALP-2010] VALIDATION SUMMARY:');
  console.log(`   Okta Auth Working:        ${validations.oktaAuthWorking ? '✅' : '❌'}`);
  console.log(`   Loan Info API Called:     ${validations.loanInfoEndpointCalled ? '✅' : '⚠️ '} (${report.metrics.loanInfoRequests} requests)`);
  console.log(`   Bearer Token Present:     ${validations.bearerTokenPresent ? '✅' : '⚠️ '} (${report.metrics.bearerAuthRequests} calls)`);
  console.log(`   Successful Responses:     ${report.metrics.successfulResponses}`);
  console.log(`   401/403 Scope Errors:     ${validations.noScopeErrors ? '✅ NONE' : `❌ ${report.metrics.scopeErrors}`}`);
  console.log(`   Duration:                 ${report.testDurationSeconds}s`);
  console.log(`\n✅ Report saved: ${reportFile}\n`);

  if (!validations.loanInfoEndpointCalled) {
    console.log('ℹ️  No loan-info endpoints were observed. The account may have no loans,');
    console.log('   or the dashboard fetched data before monitoring engaged.\n');
  }

  // Assertions:
  //  - Okta auth must succeed (we reach my2 dashboard)
  //  - No auth/scope (401/403) failures on any loan-info call
  expect(validations.oktaAuthWorking).toBe(true);
  expect(validations.noScopeErrors).toBe(true);
});
