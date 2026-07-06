import { test, expect, Page, Browser } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ALP-2066 — AutoDM / Co-mortgagor Communication Method
 * https://rate.atlassian.net/browse/ALP-2066
 *
 * Validates (UI must match the verification screenshots in the ticket's last comments):
 *   1. The co-mortgagor "Your Information" page shows a required "Communication method"
 *      dropdown whose options are exactly: Text, Email, Phone call, No preference.
 *   2. The "I agree and continue" button is gated (disabled) until a Communication
 *      method is selected.
 *   3. The co-borrower's information page shows the SAME "Communication method"
 *      dropdown with the SAME four options.
 *
 * The test is self-contained: it first generates a FRESH co-mortgagor invite via the
 * PowerVP LO flow (loan 265122608DEV), then drives that invite through the ERF flow.
 * Provide INVITE_URL=<full url> to skip invite generation and reuse an existing invite.
 */

const TEST_PASSWORD = process.env.TEST_PASSWORD ?? '';

// Loan used by the LO to generate a fresh co-mortgagor invite. Override with LOAN_NUMBER.
const LOAN_NUMBER = process.env.LOAN_NUMBER ?? '265122608DEV';

// PowerVP LO credentials for invite generation.
const LO_USERNAME = process.env.LO_USERNAME ?? 'Testlo@rate.com';
const LO_PASSWORD = process.env.LO_PASSWORD ?? '2th3P0in+Of$@l3';

// Skip invite generation and reuse an existing invite by setting INVITE_URL.
const inviteUrlOverride = process.env.INVITE_URL ?? '';

const EXPECTED_COMM_OPTIONS = ['Text', 'Email', 'Phone call', 'No preference'];

/** Unique yopmail address for the invited co-mortgagor. */
function generateCoMortgagorEmail(): string {
  const now = new Date();
  const mmdd = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const stateFile = path.join(__dirname, '..', 'run-artifacts', 'email-counter.json');

  let state: { date: string; counter: number } = { date: '', counter: 0 };
  if (fs.existsSync(stateFile)) {
    try { state = JSON.parse(fs.readFileSync(stateFile, 'utf-8')); } catch { /* use default */ }
  }
  if (state.date === mmdd) {
    state.counter += 1;
  } else {
    state.date = mmdd;
    state.counter = 1;
  }
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

  return `myaccount-alp${mmdd}-${String(state.counter).padStart(2, '0')}c@yopmail.com`;
}

/**
 * Logs in to PowerVP as the LO, opens loan LOAN_NUMBER, adds a co-mortgagor application
 * and sends the invite. Runs in an isolated browser context so the LO's Okta session does
 * not leak into the co-mortgagor flow. Returns the captured inviteLinkUrl.
 */
async function generateInvite(browser: Browser, coMortgagorEmail: string): Promise<string> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto('https://pos-qa.dev.saas.rate.com');
    await page.waitForURL(/oktapreview\.com/, { timeout: 15_000 });

    await page.getByRole('textbox', { name: 'Username' }).fill(LO_USERNAME);
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: 'Password' }).fill(LO_PASSWORD);
    await page.getByRole('button', { name: 'Verify' }).click();

    await page.waitForURL(/pos-qa\.dev\.saas\.rate\.com/, { timeout: 30_000 });
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Hi, Test')).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

    // Search for the loan and open it.
    await page.locator('[aria-label*="Search" i], [title*="Search" i], button[class*="search" i]').first().click({ timeout: 15_000 });
    await page.waitForTimeout(500);
    await page.keyboard.type(LOAN_NUMBER, { delay: 80 });
    await page.waitForSelector(`text=${LOAN_NUMBER}`, { timeout: 15_000 });
    await page.locator(`text=${LOAN_NUMBER}`).first().click();
    await page.waitForURL(/\/loan\//, { timeout: 15_000 });
    await page.waitForLoadState('domcontentloaded');

    // Credit tab → Add application.
    await page.getByText('Credit', { exact: true }).first().click({ timeout: 15_000 });
    await page.waitForURL(/\/credit/, { timeout: 15_000 });
    await page.waitForLoadState('domcontentloaded');

    // Click the 'Add' button to open the Add application drawer (proven single-click flow,
    // wrapped in a short retry to tolerate the credit panel re-rendering as data loads).
    await expect(async () => {
      await page.locator('button', { hasText: /^Add$/ })
        .or(page.getByRole('button', { name: /^\+?\s*Add$/i }))
        .first()
        .click({ timeout: 10_000 });
      await expect(page.getByText('Add application')).toBeVisible({ timeout: 4_000 });
    }).toPass({ timeout: 60_000 });

    // Fill the Add application form — force-click to focus each web-component input, then type
    // via the keyboard (these grwc-text-input components don't reliably reflect .fill() values).
    const addAppDrawer = page.getByTestId('Drawer');

    await addAppDrawer.getByRole('textbox', { name: 'First name*' }).click({ force: true });
    await page.keyboard.type('Mary', { delay: 50 });

    await addAppDrawer.getByRole('textbox', { name: 'Last name*' }).click({ force: true });
    await page.keyboard.type('Homeowner', { delay: 50 });

    await addAppDrawer.getByRole('textbox', { name: 'Email*' }).click({ force: true });
    await page.keyboard.type(coMortgagorEmail, { delay: 50 });

    await addAppDrawer.getByRole('textbox', { name: 'Phone*' }).click({ force: true });
    await page.keyboard.type('2482525525', { delay: 50 });

    const addAndSendBtn = addAppDrawer.getByRole('button', { name: 'Add & send' });
    await addAndSendBtn.scrollIntoViewIfNeeded();
    await addAndSendBtn.click({ timeout: 15_000 });

    await page.waitForSelector('button:has-text("Send invite"), [role="button"]:has-text("Send invite")', { timeout: 20_000 });

    const createInviteResponsePromise = page.waitForResponse(
      (response) => response.url().includes('create-invite') && response.request().method() === 'POST',
      { timeout: 30_000 }
    );
    await page.getByRole('button', { name: /send invite/i }).click({ timeout: 15_000 });
    const createInviteResponse = await createInviteResponsePromise;
    const responseBody = await createInviteResponse.json();
    const inviteLinkUrl: string = responseBody.inviteLinkUrl;
    expect(inviteLinkUrl, 'create-invite API should return an inviteLinkUrl').toBeTruthy();
    return inviteLinkUrl;
  } finally {
    await context.close();
  }
}

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    const screenshotBuffer = await page.screenshot({ fullPage: true }).catch(() => null);
    if (screenshotBuffer) {
      const screenshotDir = path.resolve('screenshots');
      fs.mkdirSync(screenshotDir, { recursive: true });
      const screenshotFile = path.join(
        screenshotDir,
        `failure-${testInfo.title.replace(/\W+/g, '_')}-${Date.now()}.png`
      );
      fs.writeFileSync(screenshotFile, screenshotBuffer);
      await testInfo.attach('screenshot-on-failure', { body: screenshotBuffer, contentType: 'image/png' });
    }
  }
});

/** Open the Communication method dropdown and return its visible option labels. */
async function readCommunicationOptions(page: Page): Promise<string[]> {
  const combobox = page.getByRole('combobox', { name: /communication method/i });
  await combobox.waitFor({ state: 'visible', timeout: 30_000 });
  await combobox.click();
  const listbox = page.getByRole('listbox', { name: /communication method/i });
  await listbox.waitFor({ state: 'visible', timeout: 10_000 });
  const options = (await listbox.getByRole('option').allInnerTexts())
    .map((t) => t.trim())
    .filter(Boolean);
  return options;
}

/** Select a Communication method option (assumes the dropdown is currently open). */
async function selectCommunicationOption(page: Page, label: string): Promise<void> {
  await page.getByRole('option', { name: label, exact: true }).click();
}

test('ALP-2066: Communication method dropdown on co-mortgagor and co-borrower pages', async ({ page, browser }) => {
  const _t0 = Date.now();
  const _logTime = (label: string) => console.log(`[${((Date.now() - _t0) / 1000).toFixed(0)}s] ${label}`);

  const validations = {
    comortgagorDropdownPresent: false,
    comortgagorOptionsMatch: false,
    comortgagorButtonGated: false,
    coborrowerDropdownPresent: false,
    coborrowerOptionsMatch: false,
  };
  const details: Record<string, unknown> = {};

  // --- Step 0: Obtain a fresh co-mortgagor invite (via PowerVP LO) unless one is supplied ---
  const coMortgagorEmail = generateCoMortgagorEmail();
  let inviteUrl = inviteUrlOverride;
  if (inviteUrl) {
    _logTime(`Using supplied invite URL`);
  } else {
    _logTime(`Generating fresh invite on loan ${LOAN_NUMBER} for ${coMortgagorEmail}`);
    inviteUrl = await generateInvite(browser, coMortgagorEmail);
    _logTime(`Invite generated`);
  }
  details.inviteUrl = inviteUrl;
  details.coMortgagorEmail = coMortgagorEmail;

  // Background keepalive: nudge the mouse periodically to avoid the app's idle-timeout
  // overlay ("Anyone Home?") which otherwise closes the session mid-test.
  let _keepAliveActive = true;
  (async () => {
    while (_keepAliveActive) {
      await new Promise((r) => setTimeout(r, 20_000));
      if (_keepAliveActive && !page.isClosed()) {
        await page.mouse
          .move(500 + Math.random() * 200, 300 + Math.random() * 100, { steps: 3 })
          .catch(() => {});
      }
    }
  })();

  await page.goto(inviteUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });

  // Auto-dismiss cookie consent banner whenever it appears.
  await page.addLocatorHandler(
    page.getByRole('button', { name: /accept cookies/i }),
    async () => {
      await page.getByRole('button', { name: /accept cookies/i }).click().catch(() => {});
    }
  );

  // Keep session alive: handle the "Anyone Home?" idle-timeout overlay.
  await page.addLocatorHandler(page.getByRole('heading', { name: /anyone home/i }), async () => {
    await page
      .getByRole('button', { name: /continue|yes|stay|i.m here/i })
      .first()
      .click({ timeout: 5000 })
      .catch(() => {});
  });

  // Keep session alive: handle the SSO session-expired overlay.
  await page.addLocatorHandler(
    page.getByText(/single sign-on session has expired|session.*expired/i).first(),
    async () => {
      await page
        .getByRole('button', { name: /ok|continue|refresh/i })
        .first()
        .click({ timeout: 5000 })
        .catch(() => {});
    }
  );

  // --- Step 1: Welcome page (if present) — detected by content, not URL ---
  const welcomeHeading = page.getByRole('heading', { name: /welcome,/i });
  if (await welcomeHeading.isVisible({ timeout: 15_000 }).catch(() => false)) {
    _logTime('Welcome page detected');
    await page.getByRole('button', { name: /^continue$|get started|next|begin/i }).first().click().catch(() => {});
    await page.waitForLoadState('domcontentloaded');
  }

  // --- Step 2: Create password (fresh invite only) ---
  const passwordField = page.getByRole('textbox', { name: /^password\*?$/i });
  if (await passwordField.isVisible({ timeout: 8000 }).catch(() => false)) {
    _logTime('Create-password page detected');
    await passwordField.fill(TEST_PASSWORD);
    await page.getByRole('textbox', { name: /confirm password/i }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /continue/i }).click();
    await page.waitForLoadState('domcontentloaded');
  }

  // --- Step 3: Co-mortgagor "Your Information" page ---
  await page.waitForURL(/\/apply\/personal-detail/i, { timeout: 60_000 });
  await expect(page.getByRole('heading', { name: /your information/i })).toBeVisible();
  _logTime('Reached co-mortgagor personal-detail page');

  // Fill the other required fields first so that the ONLY remaining required gap is the
  // Communication method — this lets us assert the dropdown gates "I agree and continue".
  await page.getByRole('textbox', { name: /number of dependents/i }).fill('0');
  await page.getByRole('combobox', { name: /marital status/i }).click();
  await page.getByRole('option', { name: 'Married', exact: true }).click();

  const agreeBtn = page.getByRole('button', { name: /i agree and continue/i });
  validations.comortgagorButtonGated = await agreeBtn.isDisabled().catch(() => false);
  details.comortgagorButtonDisabledBeforeSelection = validations.comortgagorButtonGated;

  // Verify the Communication method dropdown + its options.
  const comortgagorOptions = await readCommunicationOptions(page);
  details.comortgagorOptions = comortgagorOptions;
  validations.comortgagorDropdownPresent = comortgagorOptions.length > 0;
  validations.comortgagorOptionsMatch =
    JSON.stringify(comortgagorOptions) === JSON.stringify(EXPECTED_COMM_OPTIONS);

  expect(validations.comortgagorDropdownPresent, 'Co-mortgagor Communication method dropdown should be present').toBe(true);
  expect(comortgagorOptions, 'Co-mortgagor Communication method options should match the ticket screenshots')
    .toEqual(EXPECTED_COMM_OPTIONS);

  // Select Email and confirm the button becomes enabled.
  await selectCommunicationOption(page, 'Email');
  await expect(agreeBtn).toBeEnabled();
  expect
    .soft(validations.comortgagorButtonGated, '"I agree and continue" should be disabled until a Communication method is selected')
    .toBe(true);

  await agreeBtn.click();
  await page.waitForLoadState('domcontentloaded');

  // --- Step 4: VA / military status ---
  if (/\/apply\/va-status/i.test(page.url())) {
    _logTime('VA status page');
    await page.getByRole('radio', { name: 'No', exact: true }).first().click();
    await page.getByRole('button', { name: /continue/i }).click();
    await page.waitForLoadState('domcontentloaded');
  }

  // --- Step 5: Residence ---
  await page.waitForURL(/\/apply\/residence/i, { timeout: 60_000 });
  _logTime('Residence page');
  const addressField = page.getByRole('textbox', { name: 'Address' });
  await addressField.click();
  await addressField.fill('3901 Michigan Ave');
  await page.getByRole('option', { name: /3901 Michigan Avenue.*Detroit, MI/i }).click();
  // Zip auto-populates once the address resolves.
  await expect(page.getByRole('textbox', { name: /zip code/i })).toHaveValue(/\d{5}/, { timeout: 15_000 });
  await page.getByRole('textbox', { name: 'From*' }).fill('01/2022');
  await page.getByRole('button', { name: 'Own', exact: true }).click();

  // Two Yes/No groups appear: taxes & insurance included (Yes) and HOA dues (No).
  const yesNoGroups = page.getByRole('group').filter({ has: page.getByRole('radio') });
  await yesNoGroups.nth(0).getByRole('radio', { name: 'Yes', exact: true }).click();
  await yesNoGroups.nth(1).getByRole('radio', { name: 'No', exact: true }).click();
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForLoadState('domcontentloaded');

  // --- Step 6: Co-borrower exists question ---
  await page.waitForURL(/\/apply\/coborrower-exists/i, { timeout: 60_000 });
  _logTime('Co-borrower-exists page');
  await page.getByRole('radio', { name: 'Yes', exact: true }).first().click();
  await page.waitForLoadState('domcontentloaded');

  // --- Step 7: Co-borrower's information page ---
  await page.waitForURL(/\/apply\/coborrower-personal-detail/i, { timeout: 60_000 });
  await expect(page.getByRole('heading', { name: /co-borrower's information/i })).toBeVisible();
  _logTime('Reached co-borrower personal-detail page');

  const coborrowerOptions = await readCommunicationOptions(page);
  details.coborrowerOptions = coborrowerOptions;
  validations.coborrowerDropdownPresent = coborrowerOptions.length > 0;
  validations.coborrowerOptionsMatch =
    JSON.stringify(coborrowerOptions) === JSON.stringify(EXPECTED_COMM_OPTIONS);

  expect(validations.coborrowerDropdownPresent, 'Co-borrower Communication method dropdown should be present').toBe(true);
  expect(coborrowerOptions, 'Co-borrower Communication method options should match the ticket screenshots')
    .toEqual(EXPECTED_COMM_OPTIONS);

  // Confirm a selection registers on the co-borrower dropdown too.
  await selectCommunicationOption(page, 'Email');
  _logTime('Co-borrower Communication method selected');

  // --- Write validation report ---
  const report = {
    ticket: 'ALP-2066',
    title: 'AutoDM / Co-mortgagor Communication Method',
    timestamp: new Date().toISOString(),
    inviteUrl,
    finalUrl: page.url(),
    testDurationSeconds: ((Date.now() - _t0) / 1000).toFixed(1),
    expectedOptions: EXPECTED_COMM_OPTIONS,
    validations,
    details,
  };
  const reportDir = path.join(__dirname, '..', 'run-artifacts');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportFile = path.join(reportDir, 'alp-2066-validation-report.json');
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

  console.log('\n🔍 [ALP-2066] VALIDATION SUMMARY:');
  console.log(`   Co-mortgagor dropdown present:  ${validations.comortgagorDropdownPresent ? '✅' : '❌'}`);
  console.log(`   Co-mortgagor options match:     ${validations.comortgagorOptionsMatch ? '✅' : '❌'} ${JSON.stringify(details.comortgagorOptions)}`);
  console.log(`   "I agree" gated until selected: ${validations.comortgagorButtonGated ? '✅' : '⚠️ '}`);
  console.log(`   Co-borrower dropdown present:   ${validations.coborrowerDropdownPresent ? '✅' : '❌'}`);
  console.log(`   Co-borrower options match:      ${validations.coborrowerOptionsMatch ? '✅' : '❌'} ${JSON.stringify(details.coborrowerOptions)}`);
  console.log(`   Duration:                       ${report.testDurationSeconds}s`);
  console.log(`\n✅ Report saved: ${reportFile}\n`);

  _keepAliveActive = false;
});
