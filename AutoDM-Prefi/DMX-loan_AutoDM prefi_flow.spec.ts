import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const TEST_PASSWORD = 'Grtest123!';

const loanApplicationUrls = {
  dev: 'https://apply-gri.dev.saas.rate.com/apply/loan-purpose?emp-id=12657',
  prod: 'https://apply.guaranteedrate.com/apply/loan-purpose?emp-id=18580',
} as const;

const loanApplicationEnvironment =
  process.env.LOAN_APPLICATION_ENV?.toLowerCase() === 'prod' ? 'prod' : 'dev';

const loanApplicationUrl =
  process.env.LOAN_APPLICATION_URL ?? loanApplicationUrls[loanApplicationEnvironment];

function generateEmail(): string {
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

  return `myaccount-alp${mmdd}-${String(state.counter).padStart(2, '0')}a@yopmail.com`;
}

await page.goto('https://login.dev.rate.com/oauth2/aus1lsk5st100GteN1d7/v1/authorize?client_id=0oa1lsiuimcqJDqfh1d7&nonce=b8126937-7f14-43e6-a344-0880d6cb5a95&state=6f623373-3130-4b85-b891-643566aa0641&scope=openid%20profile%20email%20offline_access&response_type=code&redirect_uri=https%3A%2F%2Fmy.gr-dev.com%2Fokta%2Foauth%2Fcb');
await page.getByRole('textbox', { name: 'Email' }).click();
await page.getByRole('textbox', { name: 'Email' }).fill('myaccount-alp0529-01a@yopmail.com');
await page.getByRole('button', { name: 'Next' }).click();
await page.getByRole('textbox', { name: 'Password' }).click();
await page.getByRole('textbox', { name: 'Password' }).fill(TEST_PASSWORD);
await page.getByRole('textbox', { name: 'Password' }).press('Enter');
await page.getByRole('button', { name: 'Verify' }).click();
await page.getByText('Purchase 265103917DEV').click();
await page.getByText('Purchase #265103917DEV|').click();
await page.getByText('Purchase #265103917DEV').click({
    button: 'right'
  });
await page1.goto('https://myapp.dev.rate.com/apply/confirm-identity?oldLoanNumber=265103917DEV');
await page1.getByRole('textbox', { name: 'Last four of SSN*' }).click();
await page1.getByRole('textbox', { name: 'Last four of SSN*' }).fill('3333');
await page1.locator('input[name="birthDate"]').click();
await page1.getByRole('button', { name: 'Close' }).click();
await page1.locator('input[name="birthDate"]').click();
await page1.locator('input[name="birthDate"]').fill('01/01/1980');
await page1.locator('input[name="birthDate"]').press('Enter');
await page1.getByRole('button', { name: 'Continue' }).click();
await page1.goto('https://myapp.dev.rate.com/apply/coborrower-exists?old-loan-number=265103917DEV');
await page1.locator('[id="0"]').click();
await page1.goto('https://myapp.dev.rate.com/apply/coborrower-identity?old-loan-number=265103917DEV');
await page1.getByRole('textbox', { name: 'Social Security Number*' }).click();
await page1.getByRole('textbox', { name: 'Social Security Number*' }).fill('500602222');
await page1.locator('input[name="birthDate"]').click();
await page1.locator('input[name="birthDate"]').fill('01/02');
await page.goto('https://login.dev.rate.com/oauth2/aus1lsk5st100GteN1d7/v1/authorize?client_id=0oa1lsiuimcqJDqfh1d7&nonce=515810af-79c6-4c74-853f-b40bf4f33526&state=54ab84ed-cf61-4f41-a57b-d2180f1c98c8&scope=openid%20profile%20email%20offline_access&response_type=code&redirect_uri=https%3A%2F%2Fmy.gr-dev.com%2Fokta%2Foauth%2Fcb');
await page1.goto('https://login.dev.rate.com/oauth2/aus1lsk5st100GteN1d7/v1/authorize?client_id=0oa1lsiuimcqJDqfh1d7&nonce=eb4cac8f-e632-4aee-abdb-d8ba7503e987&state=8ee7294f-887d-4693-bad1-8fb3c0aa7039&scope=openid%20profile%20email%20offline_access&response_type=code&redirect_uri=https%3A%2F%2Fmy.gr-dev.com%2Fokta%2Foauth%2Fcb');
await page1.locator('div').nth(3).click();

await page.locator('div').nth(3).click();await page.locator('div').nth(3).click();test('test', async ({ page }) => {
  const email = generateEmail();
  const coEmail = email.replace(/a@yopmail\.com$/, 'b@yopmail.com');
  console.log(`Running with email: ${email}`);
  const _t0 = Date.now();
  const _logTime = (label: string) => console.log(`[${((Date.now() - _t0) / 1000).toFixed(0)}s] ${label}`);

  // Background keepalive: move mouse every 20s to prevent the app's idle-timeout
  // from showing "Anyone Home?" and eventually closing the browser.
  let _keepAliveActive = true;
  (async () => {
    while (_keepAliveActive) {
      await new Promise(r => setTimeout(r, 20000));
      if (_keepAliveActive && !page.isClosed()) {
        await page.mouse.move(
          500 + Math.random() * 200,
          300 + Math.random() * 100,
          { steps: 3 }
        ).catch(() => {});
      }
    }
  })();

  await page.goto(loanApplicationUrl);

  // Auto-dismiss cookie consent banner whenever it appears
  await page.addLocatorHandler(
    page.getByRole('button', { name: /accept cookies/i }),
    async () => { await page.getByRole('button', { name: /accept cookies/i }).click(); }
  );

  // Keep session alive: handle "Anyone Home?" idle timeout overlay
  await page.addLocatorHandler(
    page.getByRole('heading', { name: /anyone home/i }),
    async () => {
      await page.getByRole('button', { name: /continue|yes|stay|i.m here/i }).first()
        .click({ timeout: 5000 }).catch(() => {});
    }
  );

  // Keep session alive: handle SSO session-expired overlay
  await page.addLocatorHandler(
    page.getByText(/single sign-on session has expired|session.*expired/i).first(),
    async () => {
      await page.getByRole('button', { name: /ok|continue|refresh/i }).first()
        .click({ timeout: 5000 }).catch(() => {});
    }
  );

  await page.getByTestId('radio-button-0-I\'m Purchasing').click();
  await page.getByTestId('user-first-name-input').click();
  await page.getByTestId('user-first-name-input').fill('Andy');
  await page.getByTestId('user-last-name-input').click();
  await page.getByTestId('user-last-name-input').fill('America');
  await page.getByTestId('user-home-phone-input').fill('2482253648');
  await page.getByTestId('user-email-input').fill(email);
  // Select Email as communication method and agree
  await page.getByRole('combobox').filter({ has: page.locator('option', { hasText: 'Email' }) }).selectOption({ label: 'Email' });
  await page.getByRole('button', { name: /i agree.*continue|agree & continue/i }).click();

  // 1. Password
  await page.getByTestId('user-password-input').fill(TEST_PASSWORD);
  await page.getByTestId('user-confirm-password-input').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /^continue$/i }).click();

  // 2. How did you hear about me? - select Google, then continue
  await page.waitForURL(/welcome-referral/i, { timeout: 30000 });
  await page.getByRole('combobox').first().selectOption({ label: 'Google' });
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.waitForLoadState('domcontentloaded');

  // 3. Where in the home buying process? - auto-advances after selection
  await page.getByRole('radio', { name: /i.m looking at homes and listings/i }).click();

  // 4. How soon are you looking to buy? - auto-advances after selection
  await page.getByRole('radio', { name: /within the next few months/i }).click();

  // 5. Where would you like to buy a home? - type, pick autocomplete, continue
  const locationInput = page.getByRole('textbox', { name: /city or town/i });
  await locationInput.click();
  await locationInput.type('Westland', { delay: 50 });
  const wmiItem = page.locator('li:has-text("Westland, MI")').first();
  await wmiItem.waitFor({ state: 'visible', timeout: 10000 });
  // Use real mouse coordinates — most reliable way to trigger React's synthetic click handler
  const box = await wmiItem.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
  // ZIP Code is auto-filled by autocomplete; wait for it (5 digits) to confirm full commit
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll('input')).some(i => /^\d{5}$/.test(i.value))
  , { timeout: 10000 });
  await page.getByRole('button', { name: /^continue$/i }).click();

  // 6. What type of home? - Single family
  await page.getByText(/single family/i).click();

  // 7. How do you plan to use this home? - Primary Residence radio, then Continue
  await page.getByRole('radio', { name: /as a primary residence/i }).click();
  await page.getByRole('button', { name: /^continue$/i }).click({ timeout: 5000 }).catch(() => {});

  // 8. Monthly housing budget - check "I don't know" and continue
  await page.getByLabel(/i don't know what my monthly budget is yet/i).check();
  await page.getByRole('button', { name: /^continue$/i }).click();

  // 9. Price range - target $300,000, max $400,000, down payment $60,000, then continue
  await page.getByRole('textbox', { name: /target.*price|purchase.*price/i }).first().fill('300000');
  await page.getByRole('textbox', { name: /maximum.*price|max.*price/i }).first().fill('400000');
  await page.getByRole('textbox', { name: /down payment/i }).first().fill('60000');
  await page.getByRole('button', { name: /^continue$/i }).click();

  // 10. Marital status - first option
  await page.getByRole('radio').first().check();

  // 11. Spouse on loan - Yes, enter name Amy America
  const spouseSection = page.locator('section, fieldset, div').filter({ hasText: /would you like your spouse to be on this loan/i }).last();
  await spouseSection.getByText(/^yes$/i).click();
  // Wait for spouse name inputs to be visible, then click+fill each one
  await page.getByRole('textbox', { name: /first.*name/i }).first().waitFor({ state: 'visible', timeout: 10000 });
  await page.getByRole('textbox', { name: /first.*name/i }).first().click();
  await page.getByRole('textbox', { name: /first.*name/i }).first().fill('Amy');
  await page.getByRole('textbox', { name: /last.*name/i }).first().click();
  await page.getByRole('textbox', { name: /last.*name/i }).first().fill('America');

  // 12. Owned home last 3 years - No, dependents - No, continue
  // Owned home No: first No radio inside the outer radiogroup
  await page.getByRole('radiogroup', { name: /have you owned a home in the last 3 years/i }).getByRole('radio', { name: /^no$/i }).first().click();
  // Dependents No: radios are role="radio" custom elements (not input[type="radio"])
  await page.locator('div')
    .filter({ hasText: /Do you have any dependents\?/, hasNotText: /Have you owned a home/ })
    .filter({ has: page.getByRole('radio') })
    .last()
    .getByRole('radio').nth(1).click();
  await page.getByRole('button', { name: /^continue$/i }).click();

  // 13. Current address - same approach as step 5 (type + wait for li + mouse click)
  const addrInput = page.getByRole('textbox', { name: /^address/i });
  await addrInput.click();
  await addrInput.type('3901 Michigan Ave', { delay: 50 });
  const addrItem = page.locator('li').filter({ hasText: /Michigan Ave/i }).first();
  await addrItem.waitFor({ state: 'visible', timeout: 10000 });
  const addrBox = await addrItem.boundingBox();
  if (addrBox) {
    await page.mouse.move(addrBox.x + addrBox.width / 2, addrBox.y + addrBox.height / 2);
    await page.mouse.click(addrBox.x + addrBox.width / 2, addrBox.y + addrBox.height / 2);
  }
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll('input')).some(i => /^\d{5}$/.test(i.value))
  , { timeout: 10000 });
  // County dropdown auto-populates after autocomplete — wait for options then select first
  const countyLocator = page.getByRole('combobox', { name: /county/i });
  await countyLocator.locator('option:not([disabled])').first().waitFor({ state: 'attached', timeout: 8000 });
  await countyLocator.selectOption({ index: 1 });

  // 14. Move in date 01/2022
  await page.getByRole('textbox', { name: /from\*?|move.?in|when did you start/i }).fill('01/2022');

  // 15. Own or Rent - select Rent radio, add $1500 monthly rent, then continue
  await page.getByRole('radio', { name: /^rent$/i }).click();
  await page.getByRole('textbox', { name: /monthly rent|rent amount/i }).fill('1500');
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.waitForLoadState('domcontentloaded');
  _logTime('step15 done');

  // 15b. If the app looped back to address (intermittent validation failure), re-select county
  // then re-fill move-in date + own/rent and continue again
  if (await page.getByRole('heading', { name: /what is your current address/i })
    .waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
    _logTime('15b: address loop-back — re-selecting county and resubmitting');
    const countyRetry = page.getByRole('combobox', { name: /county/i });
    await countyRetry.locator('option:not([disabled])').first().waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});
    await countyRetry.selectOption({ index: 1 }).catch(() => {});
    await page.getByRole('textbox', { name: /from\*?|move.?in|when did you start/i }).fill('01/2022');
    await page.getByRole('radio', { name: /^rent$/i }).click();
    await page.getByRole('textbox', { name: /monthly rent|rent amount/i }).fill('1500');
    await page.getByRole('button', { name: /^continue$/i }).click();
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    _logTime('15b: resubmitted');
  }

  // 16. Do you or Amy own additional real estate? - No (auto-advances)
  await page.getByRole('heading', { name: /do you or amy own additional real estate/i }).waitFor({ timeout: 30000 });
  await page.getByRole('radio', { name: /^no$/i }).click();

  // 17. Are you a current or former member of the US Military? - No (auto-advances)
  await page.getByRole('heading', { name: /current or former member/i }).waitFor({ timeout: 20000 });
  await page.getByRole('radio', { name: /^no$/i }).click();

  // Amy's info screen
  // 16 (new 3). Amy's email - same as main borrower but 'a' → 'b' before @yopmail.com
  await page.getByRole('textbox', { name: /email/i }).fill(coEmail);

  // 16 (new 4). Amy's phone number
  await page.getByRole('textbox', { name: /phone/i }).fill('2486546956');

  // 16 (new 5). Has Amy owned a property in the last 3 years? - No
  await page.getByRole('radiogroup', { name: /has amy owned a property in the last 3 years/i })
    .getByRole('radio', { name: /^no$/i }).click();

  // 16 (new 6). Amy's marital status - Married (only "Married" radio on this page)
  await page.getByRole('radio', { name: /^married$/i }).click();

  // 16 (new 7). Is Amy's address the same as yours? - Yes (radiogroup has no name; use div+has filter)
  await page.locator('div')
    .filter({ hasText: /is amy.{0,4}s address the same as yours/i, has: page.getByRole('radio') })
    .last()
    .getByRole('radio', { name: /^yes$/i }).click();
  await page.getByRole('textbox', { name: /from\*?|move.?in|when did you start/i }).fill('01/2022');

  // 16 (new 8). Does Amy have any additional dependents? - No, continue
  await page.getByRole('radiogroup', { name: /does amy have any additional dependents/i })
    .getByRole('radio', { name: /^no$/i }).click();
  await page.getByRole('button', { name: /^continue$/i }).click();

  // 16 (new 9). Is Amy America a current or former member of the US Military? - No
  await page.getByRole('heading', { name: /current or former member/i }).waitFor({ timeout: 20000 });
  await page.getByRole('radio', { name: /^no$/i }).click();

  // 16 (new 10). Consent page (Andy + Amy combined): check all boxes, continue
  await page.getByRole('heading', { name: /in order to continue.*please agree/i }).waitFor({ timeout: 20000 });
  for (const checkbox of await page.getByRole('checkbox').all()) {
    if (await checkbox.isVisible() && !(await checkbox.isChecked())) await checkbox.check();
  }
  await page.getByRole('button', { name: /^continue$/i }).click();

  // 16 (new 11). Andy credit check: check all consent boxes, fill SSN/DOB, continue
  await page.getByText(/Andy America.*Borrower/i).waitFor({ timeout: 20000 });
  for (const checkbox of await page.getByRole('checkbox').all()) {
    if (await checkbox.isVisible() && !(await checkbox.isChecked())) await checkbox.check();
  }
  await page.getByRole('textbox', { name: /ssn|social security/i }).fill('999-60-3333');
  await page.getByRole('textbox', { name: /dob|date of birth|birth/i }).fill('01/01/1980');
  await page.getByRole('button', { name: /^continue$/i }).click();

  // 16 (new 12). Amy credit check: check all consent boxes, fill SSN/DOB, continue
  await page.getByText(/Amy America.*Co-borrower/i).waitFor({ timeout: 20000 });
  for (const checkbox of await page.getByRole('checkbox').all()) {
    if (await checkbox.isVisible() && !(await checkbox.isChecked())) await checkbox.check();
  }
  await page.getByRole('textbox', { name: /ssn|social security/i }).fill('500-60-2222');
  await page.getByRole('textbox', { name: /dob|date of birth|birth/i }).fill('01/02/1980');
  await page.getByRole('button', { name: /^continue$/i }).click();
  _logTime('amy-credit done');

  // 16 (new 13). Continue through any remaining credit screens
  // Credit processing can take variable time — give it up to 90s before failing
  _logTime('waiting for post-credit Continue');
  await page.getByRole('button', { name: /^continue$/i }).click({ timeout: 90_000 });
  _logTime('post-credit Continue clicked');

  // 16 (new 14). Do you have additional income? - No
  await page.locator('div')
    .filter({ hasText: /do you have additional income you would like to include/i, has: page.getByRole('radio') })
    .last()
    .getByRole('radio', { name: /^no$/i }).click();

  // 16 (new 15). Amy's employment - They are employed (wait for saving spinner to clear)
  await page.getByText(/they are employed/i).waitFor({ state: 'visible', timeout: 60000 });
  await page.getByText(/they are employed/i).click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});

  // 16 (new 16). Amy's employment history (W-2 Employee already selected in combobox)
  await page.getByRole('textbox', { name: /employer name/i }).fill('Test inc');
  await page.getByRole('textbox', { name: /job title/i }).fill('manager');
  await page.getByRole('textbox', { name: /city or town/i }).fill('Westland');
  await page.getByRole('textbox', { name: /employer phone/i }).fill('2483547241');
  await page.getByRole('combobox', { name: /^state/i }).selectOption({ label: 'Michigan' });
  await page.getByRole('checkbox', { name: /current.*job/i }).check();
  await page.getByRole('textbox', { name: /start date/i }).fill('01/01/2021');

  // 16 (new 17). Does Amy earn an annual base salary? - Yes, $100,000
  await page.getByRole('radiogroup', { name: /does amy earn an annual base salary/i })
    .getByRole('radio', { name: /^yes$/i }).click();
  await page.getByRole('textbox', { name: /annual.*salary|base.*salary|annual.*pay/i }).fill('100000');

  // 16 (new 18). Additional income at this employer? - No, continue
  await page.locator('div')
    .filter({ hasText: /would you like to add any additional income you earn/i, has: page.getByRole('radio') })
    .last()
    .getByRole('radio', { name: /^no$/i }).click();
  await page.getByRole('button', { name: /^continue$/i }).click();

  _logTime('amy-employment done');
  // Does Amy have additional income? - No
  await page.locator('div')
    .filter({ hasText: /does amy have additional income/i, has: page.getByRole('radio') })
    .last()
    .getByRole('radio', { name: /^no$/i }).click();
  _logTime('amy-income-No clicked');

  // Down payment: Mastercard Data Connect may appear first (or app goes straight to assets)
  // Race both headings; handle MC if it wins, then wait for the assets heading either way
  let _mcFound = false;
  const _assetHeadingPat = /enter accounts manually|confirm your own and any joint assets/i;
  await Promise.race([
    page.getByRole('heading', { name: /confirm your down payment/i })
      .waitFor({ timeout: 30000 })
      .then(() => { _mcFound = true; })
      .catch(() => {}),
    page.getByRole('heading', { name: _assetHeadingPat })
      .waitFor({ timeout: 30000 })
      .catch(() => {}),
  ]);
  _logTime(`MC race done mcFound=${_mcFound}`);

  if (_mcFound) {
    // frameLocator() can throw immediately for cross-origin iframes that are still
    // loading (frame navigation resets the locator). Use the Frame API instead:
    // poll page.mainFrame().childFrames() until the Exit button appears.
    _logTime('waiting for MC iframe Exit button (frame API)');
    let mcExitClicked = false;
    const mcDeadline = Date.now() + 20000;
    while (!mcExitClicked && Date.now() < mcDeadline) {
      for (const frame of page.mainFrame().childFrames()) {
        try {
          const btn = frame.getByRole('button', { name: /^exit$/i });
          if (await btn.isVisible().catch(() => false)) {
            _logTime('clicking MC Exit via frame API');
            await btn.click().catch(() => {});
            mcExitClicked = true;
            break;
          }
        } catch { /* frame may not be ready yet */ }
      }
      if (!mcExitClicked) await new Promise(r => setTimeout(r, 800));
    }

    if (mcExitClicked) {
      // After clicking Exit a confirmation dialog may appear (in frame or on page)
      const confirmPatterns = [/yes.*exit|exit.*yes/i, /^yes$/i, /confirm/i];
      let confirmed = false;
      outer: for (const frame of [page.mainFrame(), ...page.mainFrame().childFrames()]) {
        for (const pat of confirmPatterns) {
          try {
            const btn = frame.getByRole('button', { name: pat });
            if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await btn.click().catch(() => {});
              confirmed = true;
              break outer;
            }
          } catch { /* ignore */ }
        }
      }
      if (!confirmed) await page.keyboard.press('Escape').catch(() => {});
    } else {
      _logTime('MC Exit not found after 55s');
      await page.keyboard.press('Escape').catch(() => {});
    }
    await page.getByRole('heading', { name: /confirm your down payment/i })
      .waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
    await page.waitForLoadState('domcontentloaded').catch(() => {});
  }

  // 20. Assets - BOA savings account, balance $30,000, owner Both
  // Heading may be "Enter accounts manually" (after Mastercard) or "Confirm your own and any joint assets" (direct path)
  await page.getByRole('heading', { name: /enter accounts manually|confirm your own and any joint assets/i }).waitFor({ timeout: 30000 });
  await page.getByRole('textbox', { name: /financial institution/i }).fill('BOA');
  await page.getByRole('combobox', { name: /account type/i }).selectOption('Savings account');
  await page.getByRole('textbox', { name: /balance/i }).fill('30000');
  await page.getByRole('combobox', { name: /owner/i }).selectOption('Both');
  // "Add account?" Yes/No radios follow the account form
  await page.locator('div')
    .filter({ hasText: /add account/i, has: page.getByRole('radio') })
    .last()
    .getByRole('radio', { name: /^no$/i }).click();

  // 20a. Asset summary page — if it appears, click No radio and continue
  if (await page.getByRole('heading', { name: /asset.?summar/i })
    .waitFor({ state: 'visible', timeout: 2000 }).then(() => true).catch(() => false)) {
    await page.getByRole('radio', { name: /^no$/i }).first().click();
    await page.getByRole('button', { name: /^continue$/i }).click();
    await page.waitForLoadState('domcontentloaded').catch(() => {});
  }

  // 21. Dismiss all "Please review your asset details" review screens (one per asset type)
  // Each time we see the review screen, click No on "Do you have more accounts to add?"
  while (await page.getByRole('heading', { name: /please review your asset details/i })
    .isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.getByRole('button', { name: /^no$/i }).click();
    await page.waitForLoadState('domcontentloaded').catch(() => {});
  }

  // 21a. Dismiss all asset-gap Yes/No questions (gift? future assets? seller concessions? etc.)
  // Loop until we reach "what kind of assets to add?" — answer No on each one
  for (let _aq = 0; _aq < 8; _aq++) {
    if (await page.getByRole('heading', { name: /what kind of assets do you want to add/i })
      .isVisible({ timeout: 1000 }).catch(() => false)) break;
    const noRadio = page.getByRole('radio', { name: /^no$/i }).first();
    if (!await noRadio.isVisible({ timeout: 2000 }).catch(() => false)) break;
    await noRadio.click();
    await page.getByRole('button', { name: /^continue$/i }).click({ timeout: 3000 }).catch(() => {});
    await page.waitForLoadState('domcontentloaded').catch(() => {});
  }

  // 21b. Asset shortfall screen — "What kind of assets do you want to add?" — click Skip if present
  // May not appear on the MC path if down-payment gap is resolved via Mastercard
  if (await page.getByRole('heading', { name: /what kind of assets do you want to add/i })
    .waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
    await page.getByRole('button', { name: /^skip$/i }).click();
    _logTime('shortfall skipped');
  }

  // 21c. Handle all upload interstitials (Borrower + Co-borrower) before government section
  // Each click dismisses one screen; loop up to 8 times; stop when no more appear within 3s
  for (let _i = 0; _i < 8; _i++) {
    const checkTimeout = _i === 0 ? 3000 : 1000;
    const found = await page.getByRole('heading', { name: /significantly increase.*likelihood.*offer/i })
      .waitFor({ state: 'visible', timeout: checkTimeout }).then(() => true).catch(() => false);
    if (!found) break;
    _logTime(`21c iter ${_i}`);
    const ulBtn = page.getByRole('button', { name: /upload later/i });
    if (await ulBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ulBtn.click({ timeout: 5000 }).catch(() => {});
    } else {
      await page.getByRole('button', { name: /^continue$/i }).click({ timeout: 5000 }).catch(() => {});
    }
    // Brief domcontentloaded wait for SPA transition; next iteration detects next interstitial
    await page.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => {});
  }
  _logTime('21c done');

  // 21d. "Please review your asset details" may reappear after upload interstitials — dismiss with No button
  while (await page.getByRole('heading', { name: /please review your asset details/i })
    .isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.getByRole('button', { name: /^no$/i }).click();
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    _logTime('21d: asset review dismissed');
  }

  // 21e. "What kind of assets do you want to add?" may reappear after 21d — Skip if present
  if (await page.getByRole('heading', { name: /what kind of assets do you want to add/i })
    .waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
    await page.getByRole('button', { name: /^skip$/i }).click();
    _logTime('21e: shortfall skipped (post-21d)');
    await page.waitForLoadState('domcontentloaded').catch(() => {});
  }

  // 21f. Upload interstitials may reappear after 21e (after skipping the shortfall)
  for (let _k = 0; _k < 4; _k++) {
    const found3 = await page.getByRole('heading', { name: /significantly increase.*likelihood.*offer/i })
      .waitFor({ state: 'visible', timeout: _k === 0 ? 3000 : 1000 }).then(() => true).catch(() => false);
    if (!found3) break;
    _logTime(`21f iter ${_k}`);
    const ulBtn3 = page.getByRole('button', { name: /upload later/i });
    if (await ulBtn3.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ulBtn3.click({ timeout: 5000 }).catch(() => {});
    } else {
      await page.getByRole('button', { name: /^continue$/i }).click({ timeout: 5000 }).catch(() => {});
    }
    await page.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => {});
  }
  _logTime('21f done');

  // 21g. Catch any remaining Financial-section Yes/No questions that appear after upload
  // interstitials (e.g. "Are you expecting any assets in the near future?", gifts, etc.)
  // Stop as soon as we hit the Government section or run out of No+Continue pages.
  for (let _fg = 0; _fg < 10; _fg++) {
    await page.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => {});
    // If we've already reached a government-question page, stop
    const onGovt = await page.getByLabel(/^male$|^female$|^i prefer not to answer$/i)
      .first().isVisible({ timeout: 1000 }).catch(() => false);
    if (onGovt) break;
    const noRadio = page.getByRole('radio', { name: /^no$/i }).first();
    if (!await noRadio.isVisible({ timeout: 2000 }).catch(() => false)) break;
    await noRadio.click();
    const contBtn = page.getByRole('button', { name: /^continue$/i });
    if (!await contBtn.isVisible({ timeout: 2000 }).catch(() => false)) break;
    await contBtn.click({ timeout: 5000 }).catch(() => {});
    _logTime(`21g iter ${_fg} — No+Continue clicked`);
  }
  _logTime('21g done');

  _logTime('entering step22 (govt questions)');
  // 22. Government questions - main borrower: Male, Not Hispanic or Latino, White, continue
  await page.getByLabel(/^male$/i).check();
  await page.getByLabel(/not hispanic or latino/i).check();
  await page.getByLabel(/^white$/i).check();
  await page.getByRole('button', { name: /^continue$/i }).click();

  // 23. Government additional: Yes on primary residence FIRST → wait for API re-render → then No on all others
  await page.getByRole('combobox', { name: /citizenship/i }).waitFor({ timeout: 20000 });
  await page.getByRole('radiogroup').first().getByRole('radio', { name: /^yes$/i }).click();
  await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  const count23 = await page.getByRole('radiogroup').count();
  for (let i = 1; i < count23; i++) {
    await page.getByRole('radiogroup').nth(i).getByRole('radio', { name: /^no$/i }).click({ timeout: 2000 }).catch(() => {});
  }
  await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  await page.getByRole('combobox', { name: /citizenship/i }).selectOption({ index: 1 });
  await page.getByRole('button', { name: /^continue$/i }).click();
  _logTime('step23 done (Andy govt additional)');

  // 24. Language preference - English, continue
  await page.getByText(/^english$/i).click();
  await page.getByRole('button', { name: /^continue$/i }).click();

  // 25. Co-government questions (Amy) - Female, Not Hispanic or Latino, White, continue
  await page.getByLabel(/^female$/i).check();
  await page.getByLabel(/not hispanic or latino/i).check();
  await page.getByLabel(/^white$/i).check();
  await page.getByRole('button', { name: /^continue$/i }).click();

  // 26. Co-government additional (Amy): Yes on primary residence FIRST → wait for API re-render → then No on all others
  await page.getByRole('combobox', { name: /citizenship/i }).waitFor({ timeout: 20000 });
  await page.getByRole('radiogroup').first().getByRole('radio', { name: /^yes$/i }).click();
  await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  const count26 = await page.getByRole('radiogroup').count();
  for (let i = 1; i < count26; i++) {
    await page.getByRole('radiogroup').nth(i).getByRole('radio', { name: /^no$/i }).click({ timeout: 2000 }).catch(() => {});
  }
  await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  await page.getByRole('combobox', { name: /citizenship/i }).selectOption({ index: 1 });
  await page.getByRole('button', { name: /^continue$/i }).click();
  _logTime('step26 done (Amy govt additional)');

  // 26b. Handle any upload interstitial between Amy's government and language
  for (let _j = 0; _j < 5; _j++) {
    const found2 = await page.getByRole('heading', { name: /significantly increase.*likelihood.*offer/i })
      .waitFor({ state: 'visible', timeout: _j === 0 ? 5000 : 2000 }).then(() => true).catch(() => false);
    if (!found2) break;
    _logTime(`26b iter ${_j}`);
    const ulBtn2 = page.getByRole('button', { name: /upload later/i });
    if (await ulBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ulBtn2.click({ timeout: 5000 }).catch(() => {});
    } else {
      await page.getByRole('button', { name: /^continue$/i }).click({ timeout: 5000 }).catch(() => {});
    }
    await page.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => {});
  }
  _logTime('26b done');

  // 27. Language preference for Amy America - English, continue
  await page.getByText(/^english$/i).click();
  await page.getByRole('button', { name: /^continue$/i }).click();

  // 28. Continue from Loan options comparison
  _logTime('before loan-options Continue');
  await page.getByRole('button', { name: /^continue$/i }).click();
  _logTime('after loan-options Continue');

  // 28b. "Thank you!" / application-summary page appears after AUS submission.
  // It auto-redirects after 13s, but we click the Continue link immediately to save time.
  if (!/application-summary/i.test(page.url())) {
    await page.waitForURL(/application-summary/i, { timeout: 5000 }).catch(() => {});
  }
  if (/application-summary/i.test(page.url())) {
    _logTime('application-summary — clicking Continue link immediately');
    const contLink = page.getByRole('link', { name: /^continue$/i });
    if (await contLink.isVisible({ timeout: 8000 }).catch(() => false)) {
      await contLink.click({ timeout: 10000 }).catch(() => {});
    }
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    _logTime('application-summary Continue clicked');
  }

  // 29. After AUS redirect, wait for OAuth login or MYA loan page
  await page.waitForURL(/login\.dev\.rate\.com|my\.gr-dev\.com\/loan\//i);
  _logTime('step29 done (OAuth redirect received)');

  // 30. Handle OAuth login redirect (login.dev.rate.com) then capture MYA loan number
  await page.waitForURL(/login\.dev\.rate\.com|my\.gr-dev\.com\/loan\//i, { timeout: 5000 }).catch(() => {});
  if (/login\.dev\.rate\.com/.test(page.url())) {
    // Two-step login: Email → Next → Password → Log In
    await page.getByRole('textbox', { name: /email/i }).fill(email);
    await page.getByRole('button', { name: /^next$/i }).click();
    await page.getByRole('textbox', { name: /password/i }).waitFor({ state: 'visible', timeout: 15000 });
    await page.getByRole('textbox', { name: /password/i }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /log.?in|sign.?in/i }).click();
    await page.waitForURL(/my\.gr-dev\.com\/loan\//i);
    await page.waitForLoadState('networkidle').catch(() => {});
  }
  _logTime(`post-login URL: ${page.url()}`);
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  // Loan number paragraph shows e.g. "Purchase 265098865DEV" — extract just the number part
  const loanNumberEl = page.getByText(/purchase\s+\w+/i).first();
  await expect(loanNumberEl).toBeVisible({ timeout: 30000 });
  const fullBannerText = await loanNumberEl.textContent();
  const loanNumber = fullBannerText?.match(/purchase\s+(\w+)/i)?.[1] ?? fullBannerText?.trim();

  // ── Captured data ──────────────────────────────────────────────
  console.log('══════════════════════════════════════════');
  console.log(`Email:       ${email}`);
  console.log(`Co-Email:    ${coEmail}`);
  console.log(`Loan Number: ${loanNumber}`);
  console.log('══════════════════════════════════════════');
  _logTime('loan number captured');

  // Save run results (email + loan number) to run-artifacts/test-results-log.json
  const resultsFile = path.join(__dirname, '..', 'run-artifacts', 'test-results-log.json');
  let results: Array<{ timestamp: string; email: string; coEmail: string; loanNumber: string }> = [];
  if (fs.existsSync(resultsFile)) {
    try { results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8')); } catch { /* start fresh */ }
  }
  results.push({
    timestamp: new Date().toISOString(),
    email,
    coEmail,
    loanNumber: loanNumber?.trim() ?? '',
  });
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`Results saved → ${resultsFile}`);

  // ── AutoDM Prefi Flow ──────────────────────────────────────────
  // Reuse the same browser tab/session for AutoDM so SSO stays in one session.
  const autoDMPage = page;
  _logTime(`Opening AutoDM prefi flow → loan: ${loanNumber}`);

  await autoDMPage.goto(`https://myapp.dev.rate.com/confirmIdentity?oldLoanNumber=${loanNumber}`);
  await autoDMPage.waitForLoadState('domcontentloaded');
  _logTime('AutoDM confirmIdentity page loaded');

  // Same-session flow may require password verification first.
  const passwordBox = autoDMPage.getByRole('textbox', { name: /password/i }).first();
  if (await passwordBox.isVisible({ timeout: 5000 }).catch(() => false)) {
    await passwordBox.fill(TEST_PASSWORD);
    await autoDMPage.getByRole('button', { name: /^verify$|^continue$|^submit$/i }).first()
      .click({ timeout: 10000 }).catch(() => {});
    await autoDMPage.waitForLoadState('domcontentloaded').catch(() => {});
    _logTime('AutoDM password verification done');
  }

  // Identity verification — SSN last 4: 3333, DOB: 01/01/1980 (when presented)
  const ssnBox = autoDMPage.getByRole('textbox', { name: /last.{0,8}ssn|social security|ssn/i }).first();
  if (await ssnBox.isVisible({ timeout: 15000 }).catch(() => false)) {
    await ssnBox.fill('3333');
    await autoDMPage.getByRole('textbox', { name: /dob|date of birth|birth/i }).first().fill('01/01/1980');
    await autoDMPage.getByRole('button', { name: /^continue$|^verify$|^submit$/i }).first().click();
    await autoDMPage.waitForLoadState('domcontentloaded').catch(() => {});
    _logTime('Identity verified — prefi flow continuing');
  } else {
    _logTime('Identity SSN step not shown; continuing in authenticated session');
  }

  // Continue through any remaining prefi screens
  // (click Continue / Next on each step until the flow completes)
  for (let _pf = 0; _pf < 30; _pf++) {
    await autoDMPage.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});

    // Detect a terminal / confirmation page and stop
    const isDone = await autoDMPage.getByRole('heading', {
      name: /congratulations|your refinance|you.re all set|application submitted|thank you/i,
    }).isVisible({ timeout: 2000 }).catch(() => false);
    if (isDone) {
      _logTime(`prefi flow complete at step ${_pf}`);
      break;
    }

    const continueBtn = autoDMPage.getByRole('button', { name: /^continue$|^next$|^submit$/i }).first();
    if (!await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) break;
    await continueBtn.click({ timeout: 10000 }).catch(() => {});
    _logTime(`prefi step ${_pf} — Continue clicked`);
  }

  _logTime('AutoDM prefi flow done');
  _keepAliveActive = false;
});