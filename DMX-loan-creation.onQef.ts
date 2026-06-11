import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const WORKSPACE_ROOT = process.cwd();
const TEST_PASSWORD = 'Grtest123!';
const CURRENT_ADDRESS = '7922 Chestnut Dr';
const CURRENT_CITY = 'Westland';
const CURRENT_COUNTY = 'Wayne';
const CURRENT_STATE = 'MI';
const CURRENT_ZIP = '48185';

function generateEmail(): string {
  const now = new Date();
  const mmddyy = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getFullYear()).slice(-2)}`;
  const stateFile = path.join(WORKSPACE_ROOT, 'run-artifacts', 'email-counter.json');

  let state: { date: string; counter: number } = { date: '', counter: 0 };
  if (fs.existsSync(stateFile)) {
    try { state = JSON.parse(fs.readFileSync(stateFile, 'utf-8')); } catch { /* use default */ }
  }

  if (state.date !== mmddyy) {
    state.counter = 0;
  }

  state.date = mmddyy;
  state.counter += 1;

  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

  return `${mmddyy}ak${state.counter}--ra@yopmail.com`;
}

test('test', async ({ page }) => {
  test.setTimeout(300000);
  const email = generateEmail();
  const coEmail = email.replace(/a@yopmail\.com$/, 'b@yopmail.com');
  console.log(`Running with email: ${email}`);
  const _t0 = Date.now();
  const _logTime = (label: string) => console.log(`[${((Date.now() - _t0) / 1000).toFixed(0)}s] ${label}`);
  const _digitsOnly = (value: string) => value.replace(/\D/g, '');
  let capturedLoanNumber = '';
  let summaryPrinted = false;

  const extractLoanNumberFromCurrentPage = async () => {
    if (page.isClosed()) {
      return capturedLoanNumber;
    }

    const loanNumberFromUrl = page.url().match(/\/loan\/([^/?#]+)/i)?.[1] ?? '';
    const bannerText = await page.getByText(/purchase\s+\w+/i).first().textContent().catch(() => '');
    const loanNumberFromBanner = bannerText?.match(/purchase\s+(\w+)/i)?.[1] ?? '';
    return loanNumberFromBanner || loanNumberFromUrl || capturedLoanNumber;
  };

  const printRunSummary = async (reason: string) => {
    if (summaryPrinted) {
      return;
    }

    capturedLoanNumber = await extractLoanNumberFromCurrentPage().catch(() => capturedLoanNumber);
    const safeLoanNumber = capturedLoanNumber || 'N/A';

    console.log('==========================================');
    console.log(`Borrower Email:    ${email}`);
    console.log(`Co-Borrower Email: ${coEmail}`);
    console.log(`Loan Number:       ${safeLoanNumber}`);
    console.log('==========================================');
    _logTime(`final summary printed (${reason})`);
    summaryPrinted = true;
  };

  const fillTestIdInputStable = async (testId: string, value: string) => {
    const expectedDigits = _digitsOnly(value);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const input = page.getByTestId(testId).first();
      await input.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      await input.scrollIntoViewIfNeeded().catch(() => {});
      await input.click({ timeout: 3000 }).catch(() => {});
      await input.fill(value, { timeout: 5000 }).catch(() => {});
      const currentValue = await input.inputValue().catch(() => '');
      if (currentValue === value) {
        return;
      }
      if (expectedDigits && _digitsOnly(currentValue) === expectedDigits) {
        return;
      }
      await page.waitForTimeout(250).catch(() => {});
    }

    throw new Error(`Could not stably fill ${testId}`);
  };

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

  const dismissCookieBanner = async () => {
    await page.getByRole('button', { name: /accept cookies/i }).first()
      .click({ timeout: 1500 })
      .catch(() => {});
    await page.locator('#onetrust-accept-btn-handler').click({ timeout: 1000 }).catch(() => {});
  };

  const completePasswordStep = async () => {
    const getVisibleAppPasswordFields = async () => {
      const passwordCandidates = [
        page.getByTestId('user-password-input').first(),
        page.getByRole('textbox', { name: /^password\*?$/i }).first(),
        page.getByLabel(/^password\*?$/i).first(),
        page.locator('input[type="password"]').first(),
      ];

      const confirmCandidates = [
        page.getByTestId('user-confirm-password-input').first(),
        page.getByRole('textbox', { name: /confirm\s*password\*?/i }).first(),
        page.getByLabel(/confirm\s*password\*?/i).first(),
        page.locator('input[type="password"]').nth(1),
      ];

      let passwordInput: ReturnType<typeof page.locator> | null = null;
      for (const candidate of passwordCandidates) {
        if (await candidate.isVisible({ timeout: 800 }).catch(() => false)) {
          passwordInput = candidate;
          break;
        }
      }

      let confirmInput: ReturnType<typeof page.locator> | null = null;
      for (const candidate of confirmCandidates) {
        if (await candidate.isVisible({ timeout: 800 }).catch(() => false)) {
          confirmInput = candidate;
          break;
        }
      }

      return { passwordInput, confirmInput };
    };

    const completeOnqLoginIfPresent = async () => {
      const onLoginHost = page.url().includes('login.onqhomeloans.com');
      const hasAuthForm = await page.locator('input[type="email"], input[type="password"], #okta-signin-username')
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      if (!onLoginHost && !hasAuthForm) {
        return;
      }

      const emailCandidates = [
        page.locator('#okta-signin-username').first(),
        page.locator('input[type="email"]').first(),
        page.locator('input[name*="user" i], input[name*="email" i], input[id*="user" i], input[id*="email" i]').first(),
        page.getByRole('textbox', { name: /email|username/i }).first(),
      ];

      for (const emailInput of emailCandidates) {
        if (!await emailInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          continue;
        }
        await emailInput.click().catch(() => {});
        await emailInput.fill(email).catch(() => {});
        break;
      }

      const passwordCandidates = [
        page.locator('input[type="password"]').first(),
        page.locator('input[name*="pass" i], input[id*="pass" i]').first(),
        page.getByRole('textbox', { name: /password/i }).first(),
      ];

      for (const passwordInput of passwordCandidates) {
        if (!await passwordInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          continue;
        }
        await passwordInput.click().catch(() => {});
        await passwordInput.fill(TEST_PASSWORD).catch(() => {});
        break;
      }

      const submitCandidates = [
        page.getByRole('button', { name: /next|log.?in|sign.?in|verify|continue/i }).first(),
        page.locator('input[type="submit"], button[type="submit"]').first(),
      ];

      for (const submit of submitCandidates) {
        if (!await submit.isVisible({ timeout: 800 }).catch(() => false)) {
          continue;
        }
        await submit.click({ timeout: 5000 }).catch(() => {});
        break;
      }

      await page.waitForURL(url => !url.hostname.includes('login.onqhomeloans.com'), { timeout: 90000 }).catch(() => {});
      await dismissCookieBanner();
    };

    // Normal DMX flow: in-app password fields are visible.
    const initialFields = await getVisibleAppPasswordFields();
    if (initialFields.passwordInput && initialFields.confirmInput) {
      await initialFields.passwordInput.fill(TEST_PASSWORD).catch(() => {});
      await initialFields.confirmInput.fill(TEST_PASSWORD).catch(() => {});
      await page.getByRole('button', { name: /^continue$/i }).first().click().catch(() => {});
      return;
    }

    await completeOnqLoginIfPresent();

    const afterSsoFields = await (async () => {
      for (let i = 0; i < 15; i += 1) {
        const fields = await getVisibleAppPasswordFields();
        if (fields.passwordInput && fields.confirmInput) {
          return fields;
        }
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await page.waitForTimeout(500).catch(() => {});
      }
      return { passwordInput: null, confirmInput: null };
    })();

    if (afterSsoFields.passwordInput && afterSsoFields.confirmInput) {
      await afterSsoFields.passwordInput.fill(TEST_PASSWORD).catch(() => {});
      await afterSsoFields.confirmInput.fill(TEST_PASSWORD).catch(() => {});
      await page.getByRole('button', { name: /^continue$/i }).first().click().catch(() => {});
      return;
    }

    // Some sessions skip this screen entirely and continue to referral/questions.
    await page.waitForURL(/welcome-referral|welcome-journey|home-buying|how soon/i, { timeout: 15000 }).catch(() => {});
  };

  try {
  await page.goto('https://stage-qhl.dmx.saas.rate.com/?emp-id=36704');
  await dismissCookieBanner();

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

  await page.getByTestId('user-first-name-input').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500).catch(() => {});
  await page.getByTestId('radio-button-0-I\'m Purchasing').click();
  await fillTestIdInputStable('user-first-name-input', 'Andy');
  await fillTestIdInputStable('user-last-name-input', 'America');
  await fillTestIdInputStable('user-home-phone-input', '2482253648');
  await fillTestIdInputStable('user-email-input', email);
  await dismissCookieBanner();
  // Select Email as communication method and agree
  await page.getByRole('combobox').filter({ has: page.locator('option', { hasText: 'Email' }) }).selectOption({ label: 'Email' });
  await page.getByRole('button', { name: /i agree.*continue|agree & continue/i }).click();

  // 1. Password
  await dismissCookieBanner();
  await completePasswordStep();

  // 2. How did you hear about me? - select Google when shown, otherwise continue
  const accountSetupHeading = page.getByRole('heading', { name: /we.?re setting up your account/i });
  if (await accountSetupHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
    await accountSetupHeading.waitFor({ state: 'hidden', timeout: 90000 }).catch(() => {});
  }

  const completeReferralIfPresent = async () => {
    const step3Option = page.getByRole('radio', { name: /i.m looking at homes and listings/i }).first();

    for (let tries = 0; tries < 12; tries += 1) {
      if (await step3Option.isVisible({ timeout: 700 }).catch(() => false)) {
        return;
      }

      const referralCombobox = page.getByRole('combobox').first();
      if (await referralCombobox.isVisible({ timeout: 700 }).catch(() => false)) {
        await referralCombobox.selectOption({ label: 'Google' }).catch(() => {});
        await page.getByRole('button', { name: /^continue$/i }).first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        continue;
      }

      const continueButton = page.getByRole('button', { name: /^continue$/i }).first();
      if (await continueButton.isVisible({ timeout: 700 }).catch(() => false)) {
        await continueButton.click({ timeout: 5000 }).catch(() => {});
      }

      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(400).catch(() => {});
    }
  };

  await page.waitForURL(/welcome-referral|welcome-journey|home-buying|how-soon/i, { timeout: 60000 }).catch(() => {});
  await completeReferralIfPresent();

  const settlePreLocationFlow = async () => {
    const step3Radio = page.getByRole('radio', { name: /i.m looking at homes and listings/i }).first();
    const step4Radio = page.getByRole('radio', { name: /within the next few months/i }).first();
    const locationHeading = page.getByRole('heading', { name: /where would you like to buy a home/i }).first();
    const locationTextbox = page.getByRole('textbox', { name: /city or town/i }).first();

    for (let i = 0; i < 14; i += 1) {
      if (await locationHeading.isVisible({ timeout: 700 }).catch(() => false)
        || await locationTextbox.isVisible({ timeout: 700 }).catch(() => false)) {
        return;
      }

      if (await step3Radio.isVisible({ timeout: 700 }).catch(() => false)) {
        await step3Radio.click({ timeout: 5000 }).catch(() => {});
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        continue;
      }

      if (await step4Radio.isVisible({ timeout: 700 }).catch(() => false)) {
        await step4Radio.click({ timeout: 5000 }).catch(() => {});
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        continue;
      }

      const referralCombobox = page.getByRole('combobox').first();
      if (await referralCombobox.isVisible({ timeout: 700 }).catch(() => false)) {
        await referralCombobox.selectOption({ label: 'Google' }).catch(() => {});
      }

      const continueButton = page.getByRole('button', { name: /^continue$/i }).first();
      if (await continueButton.isVisible({ timeout: 700 }).catch(() => false)) {
        await continueButton.click({ timeout: 4000 }).catch(() => {});
      }

      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(350).catch(() => {});
    }
  };

  // 3/4. Step flow can vary by session; settle until location step is visible.
  await settlePreLocationFlow();

  // If these are still visible after settling, complete them explicitly.
  const step3RadioFinal = page.getByRole('radio', { name: /i.m looking at homes and listings/i }).first();
  if (await step3RadioFinal.isVisible({ timeout: 1500 }).catch(() => false)) {
    await step3RadioFinal.click({ timeout: 5000 }).catch(() => {});
  }

  const step4RadioFinal = page.getByRole('radio', { name: /within the next few months/i }).first();
  if (await step4RadioFinal.isVisible({ timeout: 1500 }).catch(() => false)) {
    await step4RadioFinal.click({ timeout: 5000 }).catch(() => {});
  }

  // 5. Where would you like to buy a home? - type, pick autocomplete, continue
  const locationInputCandidates = [
    page.getByRole('textbox', { name: /city or town/i }).first(),
    page.getByTestId('property-city-input').first(),
    page.locator('#property-city-input').first(),
    page.getByRole('textbox', { name: /city/i }).first(),
    page.locator('input[name*="city" i], input[id*="city" i]').first(),
  ];

  const resolveVisibleLocationInput = async () => {
    for (const candidate of locationInputCandidates) {
      if (await candidate.isVisible({ timeout: 600 }).catch(() => false)) {
        return candidate;
      }
    }
    return null;
  };

  const stateCombobox = page.getByRole('combobox', { name: /state/i }).first();
  const zipInput = page.getByRole('textbox', { name: /zip code/i }).first();

  await page.getByRole('heading', { name: /where would you like to buy a home/i }).waitFor({ timeout: 30000 }).catch(() => {});

  let locationInput = await resolveVisibleLocationInput();
  const locationHeading = page.getByRole('heading', { name: /where would you like to buy a home/i }).first();
  for (let i = 0; i < 10; i += 1) {
    if (locationInput && await locationInput.isVisible({ timeout: 700 }).catch(() => false)) {
      break;
    }
    if (!await locationHeading.isVisible({ timeout: 700 }).catch(() => false)) {
      break;
    }
    const continueButton = page.getByRole('button', { name: /^continue$/i }).first();
    if (await continueButton.isVisible({ timeout: 700 }).catch(() => false)) {
      await continueButton.click({ timeout: 3000 }).catch(() => {});
    }
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(300).catch(() => {});
    locationInput = await resolveVisibleLocationInput();
  }

  const onLocationStep = await locationHeading.isVisible({ timeout: 1200 }).catch(() => false)
    || (locationInput ? await locationInput.isVisible({ timeout: 1200 }).catch(() => false) : false);

  const commitCityFromAutocomplete = async (cityQuery: string) => {
    if (!locationInput) {
      return;
    }
    await locationInput.click().catch(() => {});
    await locationInput.fill('').catch(() => {});
    await locationInput.type(`${cityQuery},`, { delay: 80 }).catch(() => {});
    await page.waitForTimeout(300).catch(() => {});

    let selectedFromList = false;
    const inputBox = await locationInput.boundingBox().catch(() => null);
    if (inputBox) {
      await page.mouse
        .click(inputBox.x + 40, inputBox.y + inputBox.height + 40)
        .then(() => { selectedFromList = true; })
        .catch(() => {});
    }

    if (!selectedFromList) {
      selectedFromList = await page.evaluate(() => {
      const cityInput = document.querySelector('#property-city-input') as HTMLInputElement | null;
      if (!cityInput) return false;

      const inputRect = cityInput.getBoundingClientRect();
      const candidates = Array.from(document.querySelectorAll('li, [role="option"], [role="menuitem"], div'))
        .filter((element) => {
          const text = (element.textContent || '').trim();
          if (!/,\s*[A-Z]{2}$/.test(text)) return false;
          const rect = (element as HTMLElement).getBoundingClientRect();
          const style = window.getComputedStyle(element as HTMLElement);
          const visible = rect.width > 50 && rect.height > 20 && style.visibility !== 'hidden' && style.display !== 'none';
          if (!visible) return false;
          const belowInput = rect.top >= inputRect.bottom - 5;
          const nearInput = rect.top <= inputRect.bottom + 500;
          const overlapsX = rect.left <= inputRect.right && rect.right >= inputRect.left;
          return belowInput && nearInput && overlapsX;
        });

      const first = candidates[0] as HTMLElement | undefined;
      if (!first) return false;
      first.click();
      return true;
      }).catch(() => false);
    }

    if (!selectedFromList) {
      await locationInput.press('ArrowDown').catch(() => {});
      await locationInput.press('Enter').catch(() => {});
    }

    await locationInput.press('Tab').catch(() => {});
  };

  if (onLocationStep && locationInput) {
    await locationInput.scrollIntoViewIfNeeded().catch(() => {});
    await dismissCookieBanner();
    await commitCityFromAutocomplete('Asheville');
    await page.getByRole('button', { name: /^continue$/i }).click();
  } else {
    _logTime('step5 skipped: location input not shown in this session flow');
  }

  const clickContinue = async () => {
    const continueButton = page.getByRole('button', { name: /^continue$/i }).first();
    if (await continueButton.isVisible({ timeout: 1500 }).catch(() => false)) {
      await continueButton.click({ timeout: 7000 }).catch(async () => {
        await continueButton.click({ timeout: 7000, force: true });
      });
      return true;
    }
    return false;
  };

  const detectPropertyLoanStep = async () => {
    if (page.isClosed()) {
      return 'closed';
    }

    return page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      if (text.includes('where would you like to buy a home')) return 'location';
      if (text.includes('what type of home are you looking to buy')) return 'home-type';
      if (text.includes('how do you plan to use this home')) return 'home-use';
      if (text.includes('how much would you like to spend on your total monthly housing payment')) return 'monthly-budget';
      if (text.includes('target price') || text.includes('purchase price') || text.includes('down payment') || text.includes('price range')) return 'price-range';
      return 'unknown';
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (/target page, context or browser has been closed/i.test(message)) {
        return 'closed';
      }
      return 'unknown';
    });
  };

  const advanceToPriceStepByScreenshots = async () => {
    for (let attempt = 0; attempt < 14; attempt += 1) {
      if (page.isClosed()) {
        _logTime('property flow ended early: page closed before price-range step');
        return;
      }

      await dismissCookieBanner();
      const step = await detectPropertyLoanStep();
      if (step === 'closed') {
        _logTime('property flow ended early: page closed during step detection');
        return;
      }
      if (step === 'price-range') {
        return;
      }

      if (step === 'home-type') {
        const singleFamilyCandidates = [
          page.getByRole('radio', { name: /single\s*family/i }).first(),
          page.getByRole('button', { name: /single\s*family/i }).first(),
          page.getByText(/^single\s*family$/i).first(),
        ];
        for (const candidate of singleFamilyCandidates) {
          if (!await candidate.isVisible({ timeout: 1200 }).catch(() => false)) {
            continue;
          }
          await candidate.click({ timeout: 5000 }).catch(() => {});
          await candidate.click({ timeout: 2500, force: true }).catch(() => {});
          break;
        }
        await clickContinue();
      } else if (step === 'home-use') {
        const primaryResidenceCandidates = [
          page.getByRole('radio', { name: /as a primary residence/i }).first(),
          page.getByText(/^as a primary residence$/i).first(),
        ];
        for (const candidate of primaryResidenceCandidates) {
          if (!await candidate.isVisible({ timeout: 1200 }).catch(() => false)) {
            continue;
          }
          await candidate.click({ timeout: 5000 }).catch(() => {});
          await candidate.click({ timeout: 2500, force: true }).catch(() => {});
          break;
        }
        await clickContinue();
      } else if (step === 'monthly-budget') {
        const monthlyDontKnowCheckbox = page.getByRole('checkbox', { name: /i don't know what my monthly budget is yet/i }).first();
        if (await monthlyDontKnowCheckbox.isVisible({ timeout: 1500 }).catch(() => false)) {
          await monthlyDontKnowCheckbox.check({ timeout: 5000 }).catch(async () => {
            await monthlyDontKnowCheckbox.click({ timeout: 5000 });
          });
        } else {
          await page.getByText(/i don't know what my monthly budget is yet/i).first().click({ timeout: 5000 }).catch(() => {});
        }
        await clickContinue();
      } else if (step === 'location') {
        await commitCityFromAutocomplete('Asheville');
        await page.waitForTimeout(700);
        await clickContinue();
      } else {
        const firstVisibleRadio = page.getByRole('radio').first();
        if (await firstVisibleRadio.isVisible({ timeout: 1200 }).catch(() => false)) {
          await firstVisibleRadio.click({ timeout: 5000 }).catch(() => {});
        }

        const firstVisibleCheckbox = page.getByRole('checkbox').first();
        if (await firstVisibleCheckbox.isVisible({ timeout: 1200 }).catch(() => false)) {
          await firstVisibleCheckbox.click({ timeout: 5000 }).catch(() => {});
        }

        await clickContinue();
      }

      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(800);
    }

    if (page.isClosed()) {
      _logTime('property flow ended early: page closed after property-step attempts');
      return;
    }

    _logTime(`property flow did not classify a price-range screen after retries; detected=${await detectPropertyLoanStep()}`);
  };

  // 6-9. Follow the screenshot sequence until we reach the price-range screen.
  await advanceToPriceStepByScreenshots();
  if (page.isClosed()) {
    _logTime('run ended: page closed before continuing to price-range fields');
    return;
  }

  const fillFirstVisible = async (candidates: Array<ReturnType<typeof page.locator> | ReturnType<typeof page.getByRole>>, value: string) => {
    for (const candidate of candidates) {
      if (!await candidate.isVisible({ timeout: 1200 }).catch(() => false)) {
        continue;
      }
      await candidate.click({ timeout: 3000 }).catch(() => {});
      await candidate.fill(value).catch(() => {});
      const currentValue = await candidate.inputValue().catch(() => '');
      if (currentValue.replace(/[^\d]/g, '') === value) {
        return true;
      }
    }
    return false;
  };

  const filledTargetPrice = await fillFirstVisible([
    page.getByRole('textbox', { name: /target.*price|purchase.*price|home.*price/i }).first(),
    page.locator('input[name*="target" i], input[id*="target" i], input[name*="purchase" i], input[id*="purchase" i]').first(),
    page.locator('input:not([type="hidden"])').nth(0),
    page.getByRole('textbox').nth(0),
  ], '300000');

  const filledMaxPrice = await fillFirstVisible([
    page.getByRole('textbox', { name: /maximum.*price|max.*price|max price/i }).first(),
    page.locator('input[name*="max" i], input[id*="max" i], input[name*="maximum" i], input[id*="maximum" i]').first(),
    page.locator('input:not([type="hidden"])').nth(1),
    page.getByRole('textbox').nth(1),
  ], '400000');

  const filledDownPayment = await fillFirstVisible([
    page.getByRole('textbox', { name: /down payment/i }).first(),
    page.locator('input[name*="down" i], input[id*="down" i]').first(),
    page.locator('input:not([type="hidden"])').nth(2),
    page.getByRole('textbox').nth(2),
  ], '60000');

  const fillFirstThreeVisibleInputs = async () => {
    const values = ['300000', '400000', '60000'];
    const inputs = page.locator('input:not([type="hidden"])');
    const count = Math.min(await inputs.count(), 10);
    let filledCount = 0;

    for (let index = 0; index < count && filledCount < values.length; index += 1) {
      const input = inputs.nth(index);
      if (!await input.isVisible({ timeout: 500 }).catch(() => false)) {
        continue;
      }
      if (!await input.isEditable().catch(() => false)) {
        continue;
      }

      await input.click({ timeout: 2000 }).catch(() => {});
      await input.fill(values[filledCount]).catch(() => {});
      const currentValue = await input.inputValue().catch(() => '');
      if (currentValue.replace(/[^\d]/g, '') === values[filledCount]) {
        filledCount += 1;
      }
    }

    return filledCount === values.length;
  };

  const filledByGenericFallback = (!filledTargetPrice || !filledMaxPrice || !filledDownPayment)
    ? await fillFirstThreeVisibleInputs()
    : false;

  const onLikelyPriceScreen = await page.getByText(/target price|purchase price|down payment|price range/i)
    .first()
    .isVisible({ timeout: 1200 })
    .catch(() => false);

  if ((!filledTargetPrice || !filledMaxPrice || !filledDownPayment) && !filledByGenericFallback) {
    if (onLikelyPriceScreen) {
      throw new Error('Price range fields were not all filled before continuing');
    }
    _logTime('price step appears skipped/variant; continuing without explicit price field fill');
  }

  await page.getByRole('button', { name: /^continue$/i }).first().click().catch(() => {});

  // 10-15. Borrower personal details can be skipped in some resumed/session-variant flows.
  const firstRadio = page.getByRole('radio').first();
  if (await firstRadio.isVisible({ timeout: 5000 }).catch(() => false)) {
    // 10. Marital status - first option
    await firstRadio.check().catch(async () => {
      await firstRadio.click({ timeout: 5000 }).catch(() => {});
    });

    // 11. Spouse on loan - Yes, enter name Amy America
    const spouseSection = page.locator('section, fieldset, div').filter({ hasText: /would you like your spouse to be on this loan/i }).last();
    if (await spouseSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await spouseSection.getByText(/^yes$/i).click().catch(() => {});
      // Wait for spouse name inputs to be visible, then click+fill each one
      await page.getByRole('textbox', { name: /first.*name/i }).first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      await page.getByRole('textbox', { name: /first.*name/i }).first().click().catch(() => {});
      await page.getByRole('textbox', { name: /first.*name/i }).first().fill('Amy').catch(() => {});
      await page.getByRole('textbox', { name: /last.*name/i }).first().click().catch(() => {});
      await page.getByRole('textbox', { name: /last.*name/i }).first().fill('America').catch(() => {});
    }

    // 12. Owned home last 3 years - No, dependents - No, continue
    const ownedHomeNo = page.getByRole('radiogroup', { name: /have you owned a home in the last 3 years/i })
      .getByRole('radio', { name: /^no$/i })
      .first();
    if (await ownedHomeNo.isVisible({ timeout: 5000 }).catch(() => false)) {
      await ownedHomeNo.click().catch(() => {});
    }

    const dependentsNo = page.locator('div')
      .filter({ hasText: /Do you have any dependents\?/, hasNotText: /Have you owned a home/ })
      .filter({ has: page.getByRole('radio') })
      .last()
      .getByRole('radio')
      .nth(1);
    if (await dependentsNo.isVisible({ timeout: 5000 }).catch(() => false)) {
      await dependentsNo.click().catch(() => {});
    }
    await page.getByRole('button', { name: /^continue$/i }).first().click().catch(() => {});

    // 13. Current address - same approach as step 5 (type + wait for li + mouse click)
    const addrInput = page.getByRole('textbox', { name: /^address/i });
    if (await addrInput.isVisible({ timeout: 7000 }).catch(() => false)) {
      _logTime(`step13 address target: ${CURRENT_ADDRESS}, ${CURRENT_CITY}, ${CURRENT_STATE} ${CURRENT_ZIP} (${CURRENT_COUNTY})`);
      await addrInput.click().catch(() => {});
      await addrInput.type(`${CURRENT_ADDRESS}, ${CURRENT_CITY}, ${CURRENT_STATE} ${CURRENT_ZIP}`, { delay: 50 }).catch(() => {});
      const addrItem = page.locator('li').filter({ hasText: /Chestnut|Westland/i }).first();
      await addrItem.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      const addrBox = await addrItem.boundingBox().catch(() => null);
      if (addrBox) {
        await page.mouse.move(addrBox.x + addrBox.width / 2, addrBox.y + addrBox.height / 2).catch(() => {});
        await page.mouse.click(addrBox.x + addrBox.width / 2, addrBox.y + addrBox.height / 2).catch(() => {});
      }
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll('input')).some(i => /^\d{5}$/.test(i.value))
      , { timeout: 10000 }).catch(() => {});

      // County dropdown auto-populates after autocomplete — select requested county
      const countyLocator = page.getByRole('combobox', { name: /county/i });
      if (await countyLocator.isVisible({ timeout: 3000 }).catch(() => false)) {
        await countyLocator.locator('option:not([disabled])').first().waitFor({ state: 'attached', timeout: 8000 }).catch(() => {});
        await countyLocator.selectOption({ label: CURRENT_COUNTY }).catch(async () => {
          await countyLocator.selectOption({ index: 1 }).catch(() => {});
        });
      }

      const currentCityInput = page.getByRole('textbox', { name: /city/i }).first();
      if (await currentCityInput.isVisible({ timeout: 1500 }).catch(() => false)) {
        await currentCityInput.fill(CURRENT_CITY).catch(() => {});
      }

      const currentStateCombo = page.getByRole('combobox', { name: /state/i }).first();
      if (await currentStateCombo.isVisible({ timeout: 1500 }).catch(() => false)) {
        await currentStateCombo.selectOption({ label: 'Michigan' }).catch(async () => {
          await currentStateCombo.selectOption({ value: CURRENT_STATE }).catch(() => {});
        });
      }

      const currentZipInput = page.getByRole('textbox', { name: /zip|postal/i }).first();
      if (await currentZipInput.isVisible({ timeout: 1500 }).catch(() => false)) {
        await currentZipInput.fill(CURRENT_ZIP).catch(() => {});
      }

      const addressSummary = {
        address: await addrInput.inputValue().catch(() => ''),
        city: await currentCityInput.inputValue().catch(() => ''),
        county: await countyLocator.inputValue().catch(() => ''),
        state: await currentStateCombo.inputValue().catch(() => ''),
        zip: await currentZipInput.inputValue().catch(() => ''),
      };

      _logTime(`step13 populated values: ${JSON.stringify(addressSummary)}`);

      const addressVerified = addressSummary.address.toLowerCase().includes('chestnut');
      const cityVerified = addressSummary.city.toLowerCase().includes(CURRENT_CITY.toLowerCase());
      const countyVerified = addressSummary.county.toLowerCase().includes(CURRENT_COUNTY.toLowerCase());
      const stateVerified = addressSummary.state.toUpperCase().includes(CURRENT_STATE);
      const zipVerified = _digitsOnly(addressSummary.zip).includes(CURRENT_ZIP);
      _logTime(`step13 verify address=${addressVerified} city=${cityVerified} county=${countyVerified} state=${stateVerified} zip=${zipVerified}`);

      // 14. Move in date 01/2022
      await page.getByRole('textbox', { name: /from\*?|move.?in|when did you start/i }).fill('01/2022').catch(() => {});

      // 15. Own or Rent - select Rent radio, add $1500 monthly rent, then continue
      await page.getByRole('radio', { name: /^rent$/i }).click().catch(() => {});
      await page.getByRole('textbox', { name: /monthly rent|rent amount/i }).fill('1500').catch(() => {});
      await page.getByRole('button', { name: /^continue$/i }).first().click().catch(() => {});
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      _logTime('step15 done');
    } else {
      _logTime('step13-15 skipped: address form not shown in this session flow');
    }
  } else {
    _logTime('step10-12 skipped: marital/dependents radios not shown in this session flow');
  }

  // 15b. If the app looped back to address (intermittent validation failure), re-select county
  // then re-fill move-in date + own/rent and continue again
  if (await page.getByRole('heading', { name: /what is your current address/i })
    .waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
    _logTime('15b: address loop-back — re-selecting county and resubmitting');

    const addressRetry = page.getByRole('textbox', { name: /^address/i }).first();
    if (await addressRetry.isVisible({ timeout: 1500 }).catch(() => false)) {
      await addressRetry.fill(`${CURRENT_ADDRESS}, ${CURRENT_CITY}, ${CURRENT_STATE} ${CURRENT_ZIP}`).catch(() => {});
    }

    const cityRetry = page.getByRole('textbox', { name: /city/i }).first();
    if (await cityRetry.isVisible({ timeout: 1500 }).catch(() => false)) {
      await cityRetry.fill(CURRENT_CITY).catch(() => {});
    }

    const stateRetry = page.getByRole('combobox', { name: /state/i }).first();
    if (await stateRetry.isVisible({ timeout: 1500 }).catch(() => false)) {
      await stateRetry.selectOption({ label: 'Michigan' }).catch(async () => {
        await stateRetry.selectOption({ value: CURRENT_STATE }).catch(() => {});
      });
    }

    const zipRetry = page.getByRole('textbox', { name: /zip|postal/i }).first();
    if (await zipRetry.isVisible({ timeout: 1500 }).catch(() => false)) {
      await zipRetry.fill(CURRENT_ZIP).catch(() => {});
    }

    const countyRetry = page.getByRole('combobox', { name: /county/i });
    await countyRetry.locator('option:not([disabled])').first().waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});
    await countyRetry.selectOption({ label: CURRENT_COUNTY }).catch(async () => {
      await countyRetry.selectOption({ index: 1 });
    });

    _logTime(`15b values set: city=${CURRENT_CITY} state=${CURRENT_STATE} zip=${CURRENT_ZIP} county=${CURRENT_COUNTY}`);

    await page.getByRole('textbox', { name: /from\*?|move.?in|when did you start/i }).fill('01/2022');
    await page.getByRole('radio', { name: /^rent$/i }).click();
    await page.getByRole('textbox', { name: /monthly rent|rent amount/i }).fill('1500');
    await page.getByRole('button', { name: /^continue$/i }).click();
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    _logTime('15b: resubmitted');
  }

  // 16. Do you or Amy own additional real estate? - No (auto-advances)
  const ownMoreHeading = page.getByRole('heading', { name: /do you or amy own additional real estate/i }).first();
  if (await ownMoreHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
    await page.getByRole('radio', { name: /^no$/i }).first().click().catch(() => {});
  } else {
    _logTime('step16 skipped: additional real estate heading not shown in this session flow');
  }

  // 17. Are you a current or former member of the US Military? - No (auto-advances)
  const militaryHeading = page.getByRole('heading', { name: /current or former member/i }).first();
  if (await militaryHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
    await page.getByRole('radio', { name: /^no$/i }).first().click().catch(() => {});
  } else {
    _logTime('step17 skipped: military heading not shown in this session flow');
  }

  // Amy's info screen (may be skipped in resumed flows)
  const amyOwnedGroup = page.getByRole('radiogroup', { name: /has amy owned a property in the last 3 years/i }).first();
  const amyInfoPresent = await amyOwnedGroup.isVisible({ timeout: 5000 }).catch(() => false);
  if (amyInfoPresent) {
    // 16 (new 3). Amy's email - same as main borrower but 'a' → 'b' before @yopmail.com
    await page.getByRole('textbox', { name: /email/i }).first().fill(coEmail).catch(() => {});

    // 16 (new 4). Amy's phone number
    await page.getByRole('textbox', { name: /phone/i }).first().fill('2486546956').catch(() => {});

    // 16 (new 5). Has Amy owned a property in the last 3 years? - No
    await amyOwnedGroup.getByRole('radio', { name: /^no$/i }).first().click().catch(() => {});

    // 16 (new 6). Amy's marital status - Married
    await page.getByRole('radio', { name: /^married$/i }).first().click().catch(() => {});

    // 16 (new 7). Is Amy's address the same as yours? - Yes
    await page.locator('div')
      .filter({ hasText: /is amy.{0,4}s address the same as yours/i, has: page.getByRole('radio') })
      .last()
      .getByRole('radio', { name: /^yes$/i })
      .click()
      .catch(() => {});
    await page.getByRole('textbox', { name: /from\*?|move.?in|when did you start/i }).first().fill('01/2022').catch(() => {});

    // 16 (new 8). Does Amy have any additional dependents? - No, continue
    await page.getByRole('radiogroup', { name: /does amy have any additional dependents/i })
      .first()
      .getByRole('radio', { name: /^no$/i })
      .first()
      .click()
      .catch(() => {});
    await page.getByRole('button', { name: /^continue$/i }).first().click().catch(() => {});

    // 16 (new 9). Is Amy America a current or former member of the US Military? - No
    if (await militaryHeading.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.getByRole('radio', { name: /^no$/i }).first().click().catch(() => {});
    }
  } else {
    _logTime('amy info skipped: co-borrower personal screen not shown in this session flow');
  }

  const checkAllVisibleCheckboxes = async () => {
    for (const checkbox of await page.getByRole('checkbox').all()) {
      if (await checkbox.isVisible().catch(() => false) && !(await checkbox.isChecked().catch(() => false))) {
        await checkbox.check().catch(async () => {
          await checkbox.click({ timeout: 2000 }).catch(() => {});
        });
      }
    }
  };

  // 16 (new 10). Consent page (Andy + Amy combined): check all boxes, continue
  const consentHeading = page.getByRole('heading', { name: /in order to continue.*please agree/i }).first();
  if (await consentHeading.isVisible({ timeout: 20000 }).catch(() => false)) {
    await checkAllVisibleCheckboxes();
    await page.getByRole('button', { name: /^continue$/i }).first().click().catch(() => {});
  } else {
    _logTime('consent page skipped: heading not shown in this session flow');
  }

  // 16 (new 11). Andy credit check: check all consent boxes, fill SSN/DOB, continue
  const andyCreditHeading = page.getByText(/Andy America.*Borrower/i).first();
  if (await andyCreditHeading.isVisible({ timeout: 20000 }).catch(() => false)) {
    await checkAllVisibleCheckboxes();
    await page.getByRole('textbox', { name: /ssn|social security/i }).first().fill('999-60-3333').catch(() => {});
    await page.getByRole('textbox', { name: /dob|date of birth|birth/i }).first().fill('01/01/1980').catch(() => {});
    await page.getByRole('button', { name: /^continue$/i }).first().click().catch(() => {});
  } else {
    _logTime('Andy credit page skipped: borrower heading not shown');
  }

  // 16 (new 12). Amy credit check: check all consent boxes, fill SSN/DOB, continue
  const amyCreditHeading = page.getByText(/Amy America.*Co-borrower/i).first();
  if (await amyCreditHeading.isVisible({ timeout: 20000 }).catch(() => false)) {
    await checkAllVisibleCheckboxes();
    await page.getByRole('textbox', { name: /ssn|social security/i }).first().fill('500-60-2222').catch(() => {});
    await page.getByRole('textbox', { name: /dob|date of birth|birth/i }).first().fill('01/02/1980').catch(() => {});
    await page.getByRole('button', { name: /^continue$/i }).first().click().catch(() => {});
    _logTime('amy-credit done');
  } else {
    _logTime('Amy credit page skipped: co-borrower heading not shown');
  }

  // 16 (new 13). Continue through any remaining credit screens
  _logTime('waiting for post-credit Continue');
  const postCreditContinue = page.getByRole('button', { name: /^continue$/i }).first();
  if (await postCreditContinue.isVisible({ timeout: 90_000 }).catch(() => false)) {
    await postCreditContinue.click({ timeout: 5000 }).catch(() => {});
    _logTime('post-credit Continue clicked');
  } else {
    _logTime('post-credit Continue not shown in this session flow');
  }

  // 16 (new 14). Do you have additional income? - No
  let amyIncludeIncomeNoClicked = false;
  for (let retry = 0; retry < 5 && !amyIncludeIncomeNoClicked; retry += 1) {
    const section = page.locator('div')
      .filter({ hasText: /do you have additional income you would like to include/i, has: page.getByRole('radio') })
      .last();

    const noCandidates = [
      section.getByRole('radio', { name: /^no$/i }).first(),
      section.getByRole('button', { name: /^no$/i }).first(),
      page.getByRole('radio', { name: /^no$/i }).last(),
    ];

    for (const candidate of noCandidates) {
      if (!await candidate.isVisible({ timeout: 1000 }).catch(() => false)) {
        continue;
      }
      await candidate.scrollIntoViewIfNeeded().catch(() => {});
      const clicked = await candidate.click({ timeout: 3000 }).then(() => true).catch(() => false);
      if (clicked) {
        amyIncludeIncomeNoClicked = true;
        break;
      }
      await candidate.click({ timeout: 2000, force: true }).catch(() => {});
      amyIncludeIncomeNoClicked = await candidate.isVisible({ timeout: 200 }).then(() => false).catch(() => true);
      if (amyIncludeIncomeNoClicked) {
        break;
      }
    }

    if (!amyIncludeIncomeNoClicked) {
      await page.waitForTimeout(300).catch(() => {});
    }
  }

  if (!amyIncludeIncomeNoClicked) {
    _logTime('amy additional income question not shown or No not required in this flow');
  }

  const amyEmploymentEntry = page.getByText(/they are employed/i).first();
  if (await amyEmploymentEntry.isVisible({ timeout: 3000 }).catch(() => false)) {
    // 16 (new 15). Amy's employment - They are employed (wait for saving spinner to clear)
    await amyEmploymentEntry.click().catch(() => {});
    await page.waitForLoadState('domcontentloaded').catch(() => {});

    // 16 (new 16). Amy's employment history (W-2 Employee already selected in combobox)
    await page.getByRole('textbox', { name: /employer name/i }).fill('Test inc').catch(() => {});
    await page.getByRole('textbox', { name: /job title/i }).fill('manager').catch(() => {});
    await page.getByRole('textbox', { name: /city or town/i }).fill('Greensboro').catch(() => {});
    await page.getByRole('textbox', { name: /employer phone/i }).fill('2483547241').catch(() => {});
    await page.getByRole('combobox', { name: /^state/i }).selectOption({ label: 'North Carolina' }).catch(() => {});
    await page.getByRole('checkbox', { name: /current.*job/i }).check().catch(() => {});
    await page.getByRole('textbox', { name: /start date/i }).fill('01/01/2021').catch(() => {});

    // 16 (new 17). Does Amy earn an annual base salary? - Yes, $100,000
    await page.getByRole('radiogroup', { name: /does amy earn an annual base salary/i })
      .getByRole('radio', { name: /^yes$/i }).click().catch(() => {});
    await page.getByRole('textbox', { name: /annual.*salary|base.*salary|annual.*pay/i }).fill('100000').catch(() => {});

    // 16 (new 18). Additional income at this employer? - No, continue
    await page.locator('div')
      .filter({ hasText: /would you like to add any additional income you earn/i, has: page.getByRole('radio') })
      .last()
      .getByRole('radio', { name: /^no$/i }).click().catch(() => {});
    await page.getByRole('button', { name: /^continue$/i }).click().catch(() => {});

    _logTime('amy-employment done');
    // Does Amy have additional income? - No
    let amyIncomeNoClicked = false;
    for (let retry = 0; retry < 5 && !amyIncomeNoClicked; retry += 1) {
      const section = page.locator('div')
        .filter({ hasText: /does amy have additional income/i, has: page.getByRole('radio') })
        .last();

      const noCandidates = [
        section.getByRole('radio', { name: /^no$/i }).first(),
        section.getByRole('button', { name: /^no$/i }).first(),
        page.getByRole('radio', { name: /^no$/i }).last(),
      ];

      for (const candidate of noCandidates) {
        if (!await candidate.isVisible({ timeout: 1000 }).catch(() => false)) {
          continue;
        }
        await candidate.scrollIntoViewIfNeeded().catch(() => {});
        const clicked = await candidate.click({ timeout: 3000 }).then(() => true).catch(() => false);
        if (clicked) {
          amyIncomeNoClicked = true;
          break;
        }
        await candidate.click({ timeout: 2000, force: true }).catch(() => {});
        amyIncomeNoClicked = await candidate.isVisible({ timeout: 200 }).then(() => false).catch(() => true);
        if (amyIncomeNoClicked) {
          break;
        }
      }

      if (!amyIncomeNoClicked) {
        await page.waitForTimeout(300).catch(() => {});
      }
    }

    if (!amyIncomeNoClicked) {
      _logTime('amy additional income question not shown in this flow');
    } else {
      _logTime('amy-income-No clicked');
    }
  } else {
    _logTime('amy employment screen skipped/not shown in this flow');
  }

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
  const assetsHeading = page.getByRole('heading', { name: /enter accounts manually|confirm your own and any joint assets/i }).first();
  const assetsVisible = await assetsHeading.isVisible({ timeout: 30000 }).catch(() => false);
  if (!assetsVisible) {
    _logTime('assets section not shown in this flow variant; continuing to redirect flow');
  } else {
    await page.getByRole('textbox', { name: /financial institution/i }).first().fill('BOA');
    await page.getByRole('combobox', { name: /account type/i }).first().selectOption('Savings account');
    await page.getByRole('textbox', { name: /balance/i }).first().fill('30000');
    await page.getByRole('combobox', { name: /owner/i }).first().selectOption('Both');
    // "Add account?" controls can be radios or Yes/No buttons.
    const addAccountSection = page.locator('div')
      .filter({ hasText: /add account|another account to add/i })
      .last();
    if (await addAccountSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      const addAccountNoCandidates = [
        addAccountSection.getByRole('button', { name: /^no$/i }).first(),
        addAccountSection.getByRole('radio', { name: /^no$/i }).first(),
        addAccountSection.getByText(/^no$/i).first(),
      ];
      for (const candidate of addAccountNoCandidates) {
        if (!await candidate.isVisible({ timeout: 1000 }).catch(() => false)) {
          continue;
        }
        await candidate.click({ timeout: 4000 }).catch(() => {});
        break;
      }
    }

    // After entering the first asset, click Continue if the button is available
    if (await page.getByRole('button', { name: /^continue$/i }).first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.getByRole('button', { name: /^continue$/i }).first().click();
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }
  }

  // 20a. Asset summary/confirm page — choose No on "Do you have another account to add?"
  if (await page.getByText(/confirm your own and any joint assets|do you have another account to add/i).first()
    .isVisible({ timeout: 4000 }).catch(() => false)) {
    const noCandidates = [
      page.getByRole('button', { name: /^no$/i }).first(),
      page.getByRole('radio', { name: /^no$/i }).first(),
      page.getByText(/^no$/i).first(),
    ];
    for (const candidate of noCandidates) {
      if (!await candidate.isVisible({ timeout: 1000 }).catch(() => false)) {
        continue;
      }
      await candidate.click({ timeout: 5000 }).catch(() => {});
      break;
    }
    await page.getByRole('button', { name: /^continue$/i }).first().click({ timeout: 5000 }).catch(() => {});
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

  const clickChoice = async (labelPattern: RegExp) => {
    const radio = page.getByRole('radio', { name: labelPattern }).first();
    if (await radio.isVisible({ timeout: 2500 }).catch(() => false)) {
      await radio.click({ timeout: 5000 }).catch(() => {});
      return true;
    }

    const checkbox = page.getByRole('checkbox', { name: labelPattern }).first();
    if (await checkbox.isVisible({ timeout: 2500 }).catch(() => false)) {
      await checkbox.click({ timeout: 5000 }).catch(() => {});
      return true;
    }

    const labeled = page.getByLabel(labelPattern).first();
    if (await labeled.isVisible({ timeout: 2500 }).catch(() => false)) {
      await labeled.check({ timeout: 5000 }).catch(async () => {
        await labeled.click({ timeout: 5000 }).catch(() => {});
      });
      return true;
    }

    return false;
  };

  const clickChoiceRobust = async (labelPattern: RegExp, sectionHints: RegExp[] = []) => {
    if (await clickChoice(labelPattern)) {
      return true;
    }

    const scopes: Array<ReturnType<typeof page.locator>> = [];
    for (const hint of sectionHints) {
      scopes.push(
        page.locator('section, form, div').filter({ has: page.getByText(hint).first() }).first(),
      );
    }
    scopes.push(page.locator('main, body').first());

    for (const scope of scopes) {
      const labelCandidate = scope.locator('label').filter({ hasText: labelPattern }).first();
      if (await labelCandidate.isVisible({ timeout: 600 }).catch(() => false)) {
        await labelCandidate.scrollIntoViewIfNeeded().catch(() => {});
        await labelCandidate.click({ timeout: 3000 }).catch(async () => {
          await labelCandidate.click({ timeout: 2000, force: true }).catch(() => {});
        });
      }

      if (await clickChoice(labelPattern)) {
        return true;
      }

      const textCandidate = scope.getByText(labelPattern).first();
      if (await textCandidate.isVisible({ timeout: 600 }).catch(() => false)) {
        await textCandidate.scrollIntoViewIfNeeded().catch(() => {});
        await textCandidate.click({ timeout: 3000 }).catch(async () => {
          await textCandidate.click({ timeout: 2000, force: true }).catch(() => {});
        });
      }

      if (await clickChoice(labelPattern)) {
        return true;
      }
    }

    return false;
  };

  const clickChoiceWithLeftBoxFallback = async (labelPattern: RegExp, sectionHints: RegExp[] = []) => {
    if (await clickChoiceRobust(labelPattern, sectionHints)) {
      return true;
    }

    const scopes: Array<ReturnType<typeof page.locator>> = [];
    for (const hint of sectionHints) {
      scopes.push(
        page.locator('section, form, div').filter({ has: page.getByText(hint).first() }).first(),
      );
    }
    scopes.push(page.locator('main, body').first());

    for (const scope of scopes) {
      const optionText = scope.getByText(labelPattern).first();
      if (!await optionText.isVisible({ timeout: 600 }).catch(() => false)) {
        continue;
      }

      await optionText.scrollIntoViewIfNeeded().catch(() => {});
      const box = await optionText.boundingBox().catch(() => null);
      if (box) {
        await page.mouse.click(Math.max(4, box.x - 26), box.y + (box.height / 2)).catch(() => {});
      }
      await optionText.click({ timeout: 2000 }).catch(() => {});

      if (await clickChoiceRobust(labelPattern, sectionHints)) {
        return true;
      }
    }

    return false;
  };

  const settleUntilGovOption = async (targetOption: RegExp, tag: string) => {
    for (let loop = 0; loop < 12; loop += 1) {
      const targetReady = await page.getByRole('radio', { name: targetOption }).first()
        .isVisible({ timeout: 1000 }).catch(() => false)
        || await page.getByRole('checkbox', { name: targetOption }).first().isVisible({ timeout: 1000 }).catch(() => false)
        || await page.getByLabel(targetOption).first().isVisible({ timeout: 1000 }).catch(() => false);
      if (targetReady) {
        return;
      }

      const savingLoanDetails = page.getByRole('heading', { name: /we.?re saving your loan details/i });
      if (await savingLoanDetails.isVisible({ timeout: 1000 }).catch(() => false)) {
        await savingLoanDetails.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
        await page.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => {});
        _logTime(`${tag}: saving screen cleared ${loop}`);
        continue;
      }

      const lateUpload = await page.getByRole('heading', { name: /significantly increase.*likelihood.*offer/i })
        .isVisible({ timeout: 1000 }).catch(() => false);
      if (lateUpload) {
        const ulBtnLate = page.getByRole('button', { name: /upload later/i }).first();
        if (await ulBtnLate.isVisible({ timeout: 1500 }).catch(() => false)) {
          await ulBtnLate.click({ timeout: 3000 }).catch(() => {});
        } else {
          await page.getByRole('button', { name: /^continue$/i }).first().click({ timeout: 3000 }).catch(() => {});
        }
        await page.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => {});
        _logTime(`${tag}: late upload dismissed ${loop}`);
        continue;
      }

      const lateAssetNo = page.locator('div')
        .filter({ hasText: /do you have another account to add/i })
        .last()
        .getByRole('button', { name: /^no$/i });
      if (await lateAssetNo.isVisible({ timeout: 1000 }).catch(() => false)) {
        await lateAssetNo.click({ timeout: 3000 }).catch(() => {});
        await page.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => {});
        _logTime(`${tag}: late asset prompt dismissed ${loop}`);
        continue;
      }

      break;
    }
  };

  const ensureGovernmentChoiceVisible = async (firstChoicePattern: RegExp) => {
    for (let tries = 0; tries < 4; tries += 1) {
      const uploadLaterButton = page.getByRole('button', { name: /upload later/i }).first();
      if (await uploadLaterButton.isVisible({ timeout: 600 }).catch(() => false)) {
        await uploadLaterButton.click({ timeout: 3000 }).catch(() => {});
        await page.waitForLoadState('domcontentloaded').catch(() => {});
      }

      const governmentFormVisible = await page.getByText(/the us government requires us to ask these questions for you|your sex|your ethnicity|your race/i)
        .first()
        .isVisible({ timeout: 800 })
        .catch(() => false);
      if (governmentFormVisible) {
        return true;
      }

      const targetReady = await page.getByRole('radio', { name: firstChoicePattern }).first().isVisible({ timeout: 1000 }).catch(() => false)
        || await page.getByRole('checkbox', { name: firstChoicePattern }).first().isVisible({ timeout: 1000 }).catch(() => false)
        || await page.getByLabel(firstChoicePattern).first().isVisible({ timeout: 1000 }).catch(() => false)
        || await page.getByText(firstChoicePattern).first().isVisible({ timeout: 1000 }).catch(() => false)
        || await page.getByText(/the us government requires us to ask these questions about|co-borrower.?s sex|co-borrower.?s ethnicity|co-borrower.?s race|amy america/i)
          .first()
          .isVisible({ timeout: 1000 })
          .catch(() => false);
      if (targetReady) {
        return true;
      }
      if (await page.getByRole('combobox', { name: /citizenship/i }).first().isVisible({ timeout: 1000 }).catch(() => false)) {
        return false;
      }
      const continueButton = page.getByRole('button', { name: /^continue$/i }).first();
      if (await continueButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await continueButton.click({ timeout: 5000 }).catch(() => {});
      }
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(300).catch(() => {});
    }

    return false;
  };

  const settleAssetSummaryBeforeGovernment = async () => {
    for (let tries = 0; tries < 6; tries += 1) {
      const onAssetSummary = await page.getByText(/confirm your own and any joint assets|do you have another account to add/i)
        .first()
        .isVisible({ timeout: 1200 })
        .catch(() => false);

      if (!onAssetSummary) {
        return;
      }

      const noCandidates = [
        page.getByRole('button', { name: /^no$/i }).first(),
        page.getByRole('radio', { name: /^no$/i }).first(),
        page.getByText(/^no$/i).first(),
      ];

      for (const candidate of noCandidates) {
        if (!await candidate.isVisible({ timeout: 1000 }).catch(() => false)) {
          continue;
        }
        await candidate.click({ timeout: 5000 }).catch(() => {});
        break;
      }

      await page.getByRole('button', { name: /^continue$/i }).first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(800);
    }
  };

  const settlePostFinancialFlow = async () => {
    for (let tries = 0; tries < 4; tries += 1) {
      if (page.isClosed()) {
        return;
      }
      const pageText = await page.locator('body').innerText().catch(() => '');
      const lower = pageText.toLowerCase();

      if (lower.includes('significantly increase the likelihood of offer acceptance')) {
        const uploadLaterButton = page.getByRole('button', { name: /upload later/i }).first();
        if (await uploadLaterButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await uploadLaterButton.click({ timeout: 4000 }).catch(() => {});
          await page.waitForLoadState('domcontentloaded').catch(() => {});
          await page.waitForTimeout(300).catch(() => {});
          continue;
        }
      }

      if (
        lower.includes('citizenship')
        || lower.includes('english')
        || lower.includes('language preference')
        || lower.includes('loan options')
        || lower.includes('male')
        || lower.includes('female')
      ) {
        return;
      }

      const onAssetSummary = /confirm your own and any joint assets|do you have another account to add/i.test(lower);
      if (onAssetSummary) {
        const noCandidates = [
          page.getByRole('button', { name: /^no$/i }).first(),
          page.getByRole('radio', { name: /^no$/i }).first(),
          page.getByText(/^no$/i).first(),
        ];
        for (const candidate of noCandidates) {
          if (!await candidate.isVisible({ timeout: 600 }).catch(() => false)) {
            continue;
          }
          await candidate.click({ timeout: 3000 }).catch(() => {});
          break;
        }
      }

      const continueButton = page.getByRole('button', { name: /^continue$/i }).first();
      if (await continueButton.isVisible({ timeout: 800 }).catch(() => false)) {
        await continueButton.click({ timeout: 3000 }).catch(() => {});
      }

      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(300).catch(() => {});
    }
  };

  const completeGovernmentAdditionalIfPresent = async (tag: string) => {
    const citizenshipCandidates = [
      page.getByRole('combobox', { name: /citizenship|citizen/i }).first(),
      page.locator('select[name*="citizen" i], select[id*="citizen" i]').first(),
      page.locator('[aria-label*="citizenship" i]').first(),
    ];

    let citizenshipControl: ReturnType<typeof page.locator> | null = null;
    for (const candidate of citizenshipCandidates) {
      if (await candidate.isVisible({ timeout: 1200 }).catch(() => false)) {
        citizenshipControl = candidate;
        break;
      }
    }

    if (!citizenshipControl) {
      _logTime(`${tag} skipped: citizenship screen not shown`);
      return;
    }

    const yesNoGroups = page.getByRole('radiogroup');
    const count = await yesNoGroups.count().catch(() => 0);
    if (count > 0) {
      await yesNoGroups.first().getByRole('radio', { name: /^yes$/i }).click().catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
      for (let i = 1; i < count; i++) {
        await yesNoGroups.nth(i).getByRole('radio', { name: /^no$/i }).click({ timeout: 2000 }).catch(() => {});
      }
    } else {
      await clickChoice(/^yes$/i).catch(() => {});
      await clickChoice(/^no$/i).catch(() => {});
    }

    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
    await citizenshipControl.selectOption({ index: 1 }).catch(() => {});
    await page.getByRole('button', { name: /^continue$/i }).first().click().catch(() => {});
    _logTime(`${tag} done`);
  };

  const borrowerGovernmentProfile = {
    sex: /^male$/i,
    ethnicity: /not hispanic or latino/i,
    race: /^white$/i,
  };

  const coBorrowerGovernmentProfile = {
    sex: /^female$/i,
    ethnicity: borrowerGovernmentProfile.ethnicity,
    race: borrowerGovernmentProfile.race,
  };

  const openGovernmentSidebarSection = async (sectionPattern: RegExp) => {
    const candidates = [
      page.locator('nav, aside, [role="navigation"]').getByText(sectionPattern).first(),
      page.locator('nav, aside, [role="navigation"]').getByRole('button', { name: sectionPattern }).first(),
      page.locator('nav, aside, [role="navigation"]').getByRole('link', { name: sectionPattern }).first(),
      page.locator('div, span, button, a').filter({ hasText: sectionPattern }).first(),
      page.getByText(sectionPattern).first(),
    ];

    for (const candidate of candidates) {
      if (!await candidate.isVisible({ timeout: 1000 }).catch(() => false)) {
        continue;
      }
      await candidate.scrollIntoViewIfNeeded().catch(() => {});
      const clicked = await candidate.click({ timeout: 3000 }).then(() => true).catch(async () => {
        await candidate.click({ timeout: 2000, force: true }).catch(() => {});
        return true;
      });
      if (clicked) {
        return true;
      }
    }

    return false;
  };

  const completeGovernmentDemographics = async (
    tag: string,
    sidebarSection: RegExp,
    profile: { sex: RegExp; ethnicity: RegExp; race: RegExp },
    options?: { required?: boolean },
  ) => {
    const sectionHints = /co.?borrower/i.test(sidebarSection.source)
      ? [
          /the us government requires us to ask these questions about/i,
          /co-borrower.?s sex|co-borrower.?s ethnicity|co-borrower.?s race|amy america/i,
        ]
      : [
          /the us government requires us to ask these questions for you/i,
          /your sex|your ethnicity|your race|andy america/i,
        ];

    await settleUntilGovOption(profile.sex, `${tag} settle`);
    let visible = await ensureGovernmentChoiceVisible(profile.sex);
    if (!visible) {
      await openGovernmentSidebarSection(/^government$/i);
      await openGovernmentSidebarSection(sidebarSection);
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await settleUntilGovOption(profile.sex, `${tag} sidebar settle`);
      visible = await ensureGovernmentChoiceVisible(profile.sex);
    }

    if (!visible) {
      const onGovernmentAdditional = /government-questions-additional/i.test(page.url())
        || await page.getByText(/just a few yes or no questions for you|will you occupy the property as your primary residence/i)
          .first()
          .isVisible({ timeout: 1000 })
          .catch(() => false);

      if (options?.required && onGovernmentAdditional) {
        _logTime(`${tag} skipped by app: already on government additional questions`);
        return;
      }

      if (options?.required) {
        throw new Error(`${tag} could not be opened`);
      }
      _logTime(`${tag} skipped: demographic choices not shown`);
      return;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await clickChoiceWithLeftBoxFallback(profile.sex, sectionHints);
      await clickChoiceWithLeftBoxFallback(profile.ethnicity, sectionHints);
      await page.getByText(/your race/i).first().scrollIntoViewIfNeeded().catch(() => {});
      await page.mouse.wheel(0, 450).catch(() => {});
      await clickChoiceWithLeftBoxFallback(profile.race, sectionHints);
      await page.getByRole('button', { name: /^continue$/i }).first().click().catch(() => {});

      const genderErrorVisible = await page.getByText(/please select at least one gender option/i).first()
        .isVisible({ timeout: 800 })
        .catch(() => false);
      const ethnicityErrorVisible = await page.getByText(/please select at least one ethnicity option/i).first()
        .isVisible({ timeout: 800 })
        .catch(() => false);
      const raceErrorVisible = await page.getByText(/please select at least one race option/i).first()
        .isVisible({ timeout: 800 })
        .catch(() => false);

      if (!genderErrorVisible && !ethnicityErrorVisible && !raceErrorVisible) {
        _logTime(`${tag} done`);
        return;
      }

      await page.waitForTimeout(250).catch(() => {});
    }

    if (options?.required) {
      throw new Error(`${tag} did not clear HMDA validation errors after retries`);
    }
    _logTime(`${tag} warning: HMDA validation errors remained after retries`);
  };

  _logTime('entering step22 (govt questions)');
  await settleAssetSummaryBeforeGovernment();
  await settlePostFinancialFlow();
  // 22. Borrower government questions: Male + Not Hispanic or Latino + White
  await completeGovernmentDemographics('step22 (Borrower demographics)', /^borrower$/i, borrowerGovernmentProfile);

  // 23. Government additional (borrower)
  await completeGovernmentAdditionalIfPresent('step23 (Andy govt additional)');

  // 24. Language preference (if shown)
  if (await page.getByText(/^english$/i).first().isVisible({ timeout: 4000 }).catch(() => false)) {
    await page.getByText(/^english$/i).first().click();
    await page.getByRole('button', { name: /^continue$/i }).first().click().catch(() => {});
  }

  // 25. Co-borrower government questions: Female + Not Hispanic or Latino + White
  await openGovernmentSidebarSection(/^government$/i);
  await openGovernmentSidebarSection(/^co-borrower$/i);
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await completeGovernmentDemographics(
    'step25 (Co-borrower demographics)',
    /co.?borrower/i,
    coBorrowerGovernmentProfile,
  );

  // 26. Co-government additional
  await completeGovernmentAdditionalIfPresent('step26 (Amy govt additional)');

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

  // 27. Language preference for Amy America (if shown)
  if (await page.getByText(/^english$/i).first().isVisible({ timeout: 4000 }).catch(() => false)) {
    await page.getByText(/^english$/i).first().click();
    await page.getByRole('button', { name: /^continue$/i }).first().click().catch(() => {});
  }

  // 28. Continue from Loan options comparison
  _logTime('before loan-options Continue');
  await page.getByRole('button', { name: /^continue$/i }).first().click().catch(() => {});
  _logTime('after loan-options Continue');

  const postAUSUrlPattern = /login\.(dev\.)?rate\.com|my\.(gr-dev|rate)\.com\/(loan\/|loans)|login\.onqhomeloans\.com|my\.onqhomeloans\.com\/(loan\/|loans)/i;

  const reachedPostAUSRedirect = async () => {
    for (let tries = 0; tries < 8; tries += 1) {
      const currentUrl = page.url();
      if (/login\.(dev\.)?rate\.com|my\.(gr-dev|rate)\.com\/(loan\/|loans)|login\.onqhomeloans\.com|my\.onqhomeloans\.com\/(loan\/|loans)/i.test(currentUrl)) {
        return true;
      }

      const pageText = await page.locator('body').innerText().catch(() => '');
      const lower = pageText.toLowerCase();

      if (lower.includes('significantly increase the likelihood of offer acceptance')) {
        await page.getByRole('button', { name: /upload later/i }).first().click({ timeout: 3000 }).catch(() => {});
      }

      if (/application-summary/i.test(currentUrl) || lower.includes('thank you')) {
        const contLink = page.getByRole('link', { name: /^continue$/i }).first();
        if (await contLink.isVisible({ timeout: 1000 }).catch(() => false)) {
          await contLink.click({ timeout: 5000 }).catch(() => {});
        }
      }

      const contButton = page.getByRole('button', { name: /^continue$/i }).first();
      if (await contButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await contButton.click({ timeout: 4000 }).catch(() => {});
      }

      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(500).catch(() => {});
    }

    return postAUSUrlPattern.test(page.url());
  };

  await reachedPostAUSRedirect();

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

  // 29. After AUS redirect, wait for OAuth login or MYA loan page.
  const reachedPostAUS = await page.waitForURL(postAUSUrlPattern, { timeout: 60000 })
    .then(() => true)
    .catch(() => false);

  if (!reachedPostAUS) {
    throw new Error('step29: redirect to post-AUS login/loan page was not received in time');
  }

  _logTime('step29 done (OAuth redirect received)');

  // 30. Handle OAuth login redirect (rate.com or onqhomeloans.com) then capture MYA loan number
  await page.waitForURL(postAUSUrlPattern, { timeout: 5000 }).catch(() => {});
  if (/login\.(dev\.)?rate\.com|login\.onqhomeloans\.com/i.test(page.url())) {
    // Two-step login: Email → Next → Password → Log In
    await page.getByRole('textbox', { name: /email/i }).fill(email);
    await page.getByRole('button', { name: /^next$/i }).click();
    await page.getByRole('textbox', { name: /password/i }).waitFor({ state: 'visible', timeout: 15000 });
    await page.getByRole('textbox', { name: /password/i }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /log.?in|sign.?in/i }).click();
    await page.waitForURL(/my\.(gr-dev|rate)\.com\/(loan\/|loans)|my\.onqhomeloans\.com\/(loan\/|loans)/i, { timeout: 60000 });
    await page.waitForLoadState('networkidle').catch(() => {});
  }
  _logTime(`post-login URL: ${page.url()}`);
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  capturedLoanNumber = await extractLoanNumberFromCurrentPage();
  if (!capturedLoanNumber) {
    throw new Error('Loan number was not captured after post-AUS redirect/login');
  }
  await printRunSummary('post-login capture');

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
    loanNumber: capturedLoanNumber?.trim() ?? '',
  });
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`Results saved → ${resultsFile}`);

  // Close the browser now that data is captured
  await page.close();
  } finally {
    _keepAliveActive = false;
    await printRunSummary('test finished').catch(() => {});
    if (!page.isClosed()) {
      await page.close().catch(() => {});
    }
  }
});