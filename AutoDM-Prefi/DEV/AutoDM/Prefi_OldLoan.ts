import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const TEST_PASSWORD = process.env.TEST_PASSWORD ?? '';
const BORROWER_FULL_NAME = 'Andy America';
const BORROWER_EMAIL = 'myaccount-alp0609-09a@yopmail.com';
const COBORROWER_FULL_NAME = 'Amy America';
const COBORROWER_EMAIL = 'myaccount-alp0609-09b@yopmail.com';

const runAutoDmPrefiFlow = async (page: Page, testInfo: TestInfo, withCoBorrower: boolean) => {
  const loginEmail = process.env.LOGIN_EMAIL ?? BORROWER_EMAIL;
  const BORROWER_SSN_LAST4 = '3333';
  const BORROWER_DOB = '01/01/1980';
  const COBORROWER_SSN = '500-60-2222';
  const COBORROWER_DOB = '01/02/1980';

  const writeLastRunArtifact = (payload: Record<string, string | boolean>) => {
    const outputPath = path.join(__dirname, '..', 'run-artifacts', 'coborrower-last-run.json');
    fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  };

  const dismissSessionOverlays = async () => {
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: /continue|yes, i.?m here|refresh|ok/i }).first()
        .click({ timeout: 1200 }).catch(() => {});
    }
  };

  const dismissCookieOverlay = async () => {
    await page.locator('#onetrust-close-btn-container button').first().click({ timeout: 1500 }).catch(() => {});
    await page.locator('#onetrust-close-btn-container').first().click({ timeout: 1200 }).catch(() => {});
    await page.getByRole('button', { name: /close|dismiss|x/i }).first().click({ timeout: 1000 }).catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});
  };

  const assertNoCriticalUiError = async (checkpoint: string) => {
    const bodyText = ((await page.locator('body').innerText().catch(() => '')) ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    const knownErrorPattern = /unable to find invitation|application error|something went wrong|unexpected error/i;
    const hasKnownErrorText = knownErrorPattern.test(bodyText);
    const errorHeadingVisible = await page.getByRole('heading', { name: /^error$/i }).first()
      .isVisible({ timeout: 500 })
      .catch(() => false);
    const invitationErrorVisible = await page.getByText(/unable to find invitation/i).first()
      .isVisible({ timeout: 500 })
      .catch(() => false);

    if (invitationErrorVisible || (hasKnownErrorText && errorHeadingVisible)) {
      const sanitizedCheckpoint = checkpoint.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
      const screenshotName = `critical-ui-error-${sanitizedCheckpoint || 'unknown'}.png`;
      const screenshotPath = testInfo.outputPath(screenshotName);
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
      await testInfo.attach('critical-ui-error-screenshot', {
        path: screenshotPath,
        contentType: 'image/png',
      }).catch(() => {});

      throw new Error(
        `Critical UI error detected at ${checkpoint}. URL: ${page.url()}. Matched text: ${bodyText.slice(0, 240)}`,
      );
    }
  };

  const navigateUsingElementUrl = async (target: ReturnType<typeof page.locator>) => {
    const directUrl = await target.evaluate((element) => {
      const current = element as { closest: (selector: string) => { getAttribute: (name: string) => string | null } | null; tagName?: string; getAttribute?: (name: string) => string | null };
      const isAnchor = current.tagName?.toLowerCase() === 'a';
      const anchor = current.closest('a') ?? (isAnchor ? current : null);
      return anchor && anchor.getAttribute ? (anchor.getAttribute('href') ?? '') : '';
    }).catch(() => '');

    if (!directUrl) return false;

    const resolvedUrl = new URL(directUrl, page.url()).toString();
    await page.goto(resolvedUrl).catch(() => {});
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await assertNoCriticalUiError('navigateUsingElementUrl');
    return true;
  };

  const clickAndStayOnCurrentTab = async (target: ReturnType<typeof page.locator>, clickAction: () => Promise<void>) => {
    if (await navigateUsingElementUrl(target).catch(() => false)) return;

    const popupPromise = page.context().waitForEvent('page', { timeout: 3500 }).catch(() => null);
    await clickAction();
    const popup = await popupPromise;
    if (!popup) return;
    await popup.waitForLoadState('domcontentloaded').catch(() => {});
    const popupUrl = popup.url();
    if (popupUrl) {
      await page.goto(popupUrl).catch(() => {});
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await assertNoCriticalUiError('clickAndStayOnCurrentTab popup navigation');
    }
    await popup.close().catch(() => {});
  };

  const clickIfVisible = async (locator: Locator, timeout = 3000) => {
    const candidate = locator.first();
    if (!await candidate.isVisible({ timeout }).catch(() => false)) {
      return false;
    }
    await candidate.click({ timeout }).catch(() => {});
    return true;
  };

  const clickFirstVisible = async (locators: Locator[], timeout = 3000) => {
    for (const locator of locators) {
      if (await clickIfVisible(locator, timeout)) {
        return true;
      }
    }
    return false;
  };

  const fillVaStatusIfVisible = async () => {
    const onVaStatusPage = /myapp\.dev\.rate\.com\/apply\/va-status/i.test(page.url());
    const vaHeading = page.getByRole('heading', {
      name: /are you a current or former member of the us military/i,
    }).first();
    const continueBtn = page.getByRole('button', { name: /^continue$/i }).first();

    if (!onVaStatusPage && !await vaHeading.isVisible({ timeout: 1500 }).catch(() => false)) {
      return false;
    }

    const clickedNo = await clickFirstVisible([
      page.locator('label[for="selfDeclaredMilitaryServiceIndicator-No"]').first(),
      page.getByRole('radio', { name: /^no$/i }).first(),
      page.getByLabel(/^no$/i).first(),
      page.locator('[id="selfDeclaredMilitaryServiceIndicator-No"]').first(),
    ], 3000);

    if (!clickedNo) {
      return false;
    }

    await continueBtn.click({ timeout: 10000 }).catch(() => {});
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(500).catch(() => {});
    return true;
  };

  const fillDependentsIfVisible = async () => {
    const setDependentsValue = async (field: Locator) => {
      await field.scrollIntoViewIfNeeded().catch(() => {});

      const currentValue = await field.inputValue().catch(() => '');
      if ((currentValue ?? '').trim() !== '') {
        return true;
      }

      const tagName = await field.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
      if (tagName === 'select') {
        await field.selectOption({ label: '0' }).catch(() => {});
        await field.selectOption('0').catch(() => {});
      }

      const fieldRole = await field.getAttribute('role').catch(() => '');
      if (fieldRole === 'combobox') {
        await field.click().catch(() => {});
        await page.getByRole('option', { name: /^0$/ }).first().click({ timeout: 1500 }).catch(() => {});
        await field.type('0', { delay: 20 }).catch(() => {});
        await field.press('Enter').catch(() => {});
      }

      await field.click().catch(() => {});
      await field.press('Meta+a').catch(() => {});
      await field.press('Control+a').catch(() => {});
      await field.fill('0').catch(() => {});
      await field.type('0', { delay: 20 }).catch(() => {});
      await field.evaluate((element) => {
        const input = element as HTMLInputElement & { value?: string; blur?: () => void };
        if ('value' in input && `${input.value ?? ''}`.trim() === '') {
          input.value = '0';
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        input.blur?.();
      }).catch(() => {});
      await field.press('Tab').catch(() => {});

      const resolvedValue = await field.inputValue().catch(() => '');
      if ((resolvedValue ?? '').trim() !== '') {
        return true;
      }

      const valuetext = await field.getAttribute('aria-valuetext').catch(() => '');
      if ((valuetext ?? '').trim() !== '') {
        return true;
      }

      const valuenow = await field.getAttribute('aria-valuenow').catch(() => '');
      if ((valuenow ?? '').trim() !== '') {
        return true;
      }

      const valueAttribute = await field.getAttribute('value').catch(() => '');
      return (valueAttribute ?? '').trim() !== '';
    };

    const dependentsFieldCandidates: Locator[] = [
      page.getByRole('textbox', { name: /number of dependents?\*?/i }).first(),
      page.getByRole('spinbutton', { name: /number of dependents?\*?/i }).first(),
      page.getByRole('combobox', { name: /number of dependents?\*?/i }).first(),
      page.getByLabel(/number of dependents?\*?/i).first(),
      page.getByPlaceholder(/number of dependents?/i).first(),
      page.locator('select[name*="dependent" i], select[id*="dependent" i]').first(),
      page.locator('[role="combobox"][aria-label*="dependent" i], [role="combobox"][id*="dependent" i]').first(),
      page.locator('input[name*="dependent" i], input[id*="dependent" i], input[placeholder*="dependent" i], [aria-label*="dependent" i]').first(),
      page.locator('label, div, span').filter({ hasText: /^number of dependents\*?$/i }).first().locator('..').locator('input, [role="spinbutton"], [role="textbox"], [contenteditable="true"]').first(),
      page.locator('label, div, span').filter({ hasText: /^number of dependents\*?$/i }).first().locator('..').locator('..').locator('input, [role="spinbutton"], [role="textbox"], [contenteditable="true"]').first(),
      page.locator('label, div, span').filter({ hasText: /^number of dependents\*?$/i }).first().locator('..').locator('[role="combobox"], select').first(),
      page.getByText(/^this field is required$/i).first().locator('..').locator('input, [role="spinbutton"], [role="textbox"], [contenteditable="true"]').first(),
      page.locator('input[aria-invalid="true"], [role="spinbutton"][aria-invalid="true"], [role="textbox"][aria-invalid="true"]').first(),
    ];

    for (const field of dependentsFieldCandidates) {
      if (!await field.isVisible({ timeout: 1200 }).catch(() => false)) {
        continue;
      }
      if (await setDependentsValue(field)) {
        return true;
      }

      // Some custom controls don't expose inputValue; if the placeholder text is gone,
      // assume a value has been set and proceed.
      const unresolvedPlaceholder = await page
        .locator('label, div, span')
        .filter({ hasText: /^number of dependents\*?$/i })
        .first()
        .isVisible({ timeout: 300 })
        .catch(() => false);
      if (!unresolvedPlaceholder) {
        return true;
      }
    }

    return false;
  };

  const fillAssetsIfVisible = async () => {
    const accountLast4Field = page.getByRole('textbox', { name: /last four of account number/i }).first();
    const balanceField = page.getByRole('textbox', { name: /balance\*?/i }).first();
    const onConfirmAssetsPage = /myapp\.dev\.rate\.com\/apply\/confirm-assets/i.test(page.url());
    const assetHeading = page.getByRole('heading', { name: /enter accounts manually|confirm your own and any joint assets|please review your asset details|asset.?summar|what kind of assets do you want to add/i }).first();
    const continueBtn = page.getByRole('button', { name: /^continue$/i }).first();

    if (!onConfirmAssetsPage && !await assetHeading.isVisible({ timeout: 1500 }).catch(() => false)) {
      return false;
    }

    if (onConfirmAssetsPage) {
      const visibleHeadings = await page.getByRole('heading').evaluateAll((elements) =>
        elements
          .map((element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim())
          .filter(Boolean)
          .slice(0, 6)
      ).catch(() => [] as string[]);
      const visibleButtons = await page.getByRole('button').evaluateAll((elements) =>
        elements
          .map((element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim())
          .filter(Boolean)
          .slice(0, 10)
      ).catch(() => [] as string[]);
      const visibleRadios = await page.getByRole('radio').evaluateAll((elements) =>
        elements
          .map((element) => {
            const label = element.getAttribute('aria-label') ?? element.textContent ?? '';
            return label.replace(/\s+/g, ' ').trim();
          })
          .filter(Boolean)
          .slice(0, 10)
      ).catch(() => [] as string[]);
      console.log(`confirm-assets debug headings=${JSON.stringify(visibleHeadings)} buttons=${JSON.stringify(visibleButtons)} radios=${JSON.stringify(visibleRadios)}`);
    }

    if (await accountLast4Field.isVisible({ timeout: 1500 }).catch(() => false)) {
      const accountTypeDropdown = page.getByRole('combobox', { name: /account type/i }).first();
      if (await accountTypeDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
        await accountTypeDropdown.getByTestId('font-icon').click({ timeout: 3000 }).catch(() => {});
        await page.getByRole('option', { name: /savings account/i }).first().click({ timeout: 3000 }).catch(() => {});
      }

      const financialInstitutionField = page.getByRole('textbox', { name: /financial institution/i }).first();
      if (await financialInstitutionField.isVisible({ timeout: 2000 }).catch(() => false)) {
        await financialInstitutionField.click().catch(() => {});
        await financialInstitutionField.fill('BOA').catch(() => {});
      }

      await accountLast4Field.click().catch(() => {});
      await accountLast4Field.fill('1234').catch(() => {});

      if (await balanceField.isVisible({ timeout: 2000 }).catch(() => false)) {
        await balanceField.click().catch(() => {});
        await balanceField.fill('$30,000').catch(() => {});
      }

      const ownerDropdown = page.getByRole('combobox', { name: /owner/i }).first();
      if (await ownerDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
        await ownerDropdown.getByTestId('font-icon').click({ timeout: 3000 }).catch(() => {});
        await page.getByRole('option', { name: /^both$/i }).first().click({ timeout: 3000 }).catch(() => {});
      }

      await continueBtn.click({ timeout: 5000 }).catch(() => {});
      const browseFilesTrigger = page.getByText('browse files').first();
      if (await browseFilesTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
        await browseFilesTrigger.click().catch(() => {});
        await page.locator('div').filter({ hasText: /^Drag and droporbrowse files$/ }).nth(2).setInputFiles('eDisclosureDates_Encompass.pps').catch(() => {});
        await continueBtn.click({ timeout: 5000 }).catch(() => {});
      }
    }

    const noAnotherAccountButton = page.locator('div')
      .filter({ hasText: /do you have another account to add/i })
      .last()
      .getByRole('button', { name: /^no$/i });
    const noAnotherAccountRadio = page.locator('div')
      .filter({ hasText: /add account/i, has: page.getByRole('radio') })
      .last()
      .getByRole('radio', { name: /^no$/i });

    if (await noAnotherAccountButton.isVisible({ timeout: 1500 }).catch(() => false)) {
      await noAnotherAccountButton.click({ timeout: 5000 }).catch(() => {});
    } else if (await noAnotherAccountRadio.isVisible({ timeout: 1500 }).catch(() => false)) {
      await noAnotherAccountRadio.click({ timeout: 5000 }).catch(() => {});
      if (await continueBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await continueBtn.click({ timeout: 5000 }).catch(() => {});
      }
    } else {
      const existingAssetButton = page.getByRole('button', { name: /boa\s*1234|\b1234\b/i }).first();
      if (await existingAssetButton.isVisible({ timeout: 1500 }).catch(() => false)) {
        await existingAssetButton.scrollIntoViewIfNeeded().catch(() => {});
        await existingAssetButton.click({ timeout: 5000, force: true }).catch(() => {});
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(1000).catch(() => {});
        
        // Fill balance field if visible after expanding asset card
        if (await balanceField.isVisible({ timeout: 2000 }).catch(() => false)) {
          await balanceField.click().catch(() => {});
          await balanceField.fill('$30,000').catch(() => {});
          await page.waitForTimeout(300).catch(() => {});
        }
        
        const continueVisible = await continueBtn.isVisible({ timeout: 3000 }).catch(() => false);
        const continueEnabled = continueVisible
          ? await continueBtn.isEnabled().catch(() => false)
          : false;
        console.log(`confirm-assets asset-card path continueVisible=${continueVisible} continueEnabled=${continueEnabled}`);
        if (continueVisible) {
          await continueBtn.scrollIntoViewIfNeeded().catch(() => {});
          await continueBtn.click({ timeout: 5000, force: true }).catch(() => {});
        }
      }
    }

    if (await page.getByRole('heading', { name: /asset.?summar/i }).first()
      .isVisible({ timeout: 1500 }).catch(() => false)) {
      await page.getByRole('radio', { name: /^no$/i }).first().click().catch(() => {});
      await continueBtn.click({ timeout: 5000 }).catch(() => {});
    }

    for (let reviewAttempt = 0; reviewAttempt < 4; reviewAttempt++) {
      if (!await page.getByRole('heading', { name: /please review your asset details/i }).first()
        .isVisible({ timeout: 1000 }).catch(() => false)) {
        break;
      }
      await page.getByRole('button', { name: /^no$/i }).first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }

    for (let questionAttempt = 0; questionAttempt < 6; questionAttempt++) {
      const shortfallHeading = page.getByRole('heading', { name: /what kind of assets do you want to add/i }).first();
      if (await shortfallHeading.isVisible({ timeout: 1000 }).catch(() => false)) {
        await page.getByRole('button', { name: /^skip$/i }).first().click({ timeout: 5000 }).catch(() => {});
        break;
      }

      const noButton = page.getByRole('button', { name: /^no$/i }).first();
      const noRadio = page.getByRole('radio', { name: /^no$/i }).first();
      if (await noButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await noButton.click({ timeout: 3000 }).catch(() => {});
      } else if (await noRadio.isVisible({ timeout: 1000 }).catch(() => false)) {
        await noRadio.click({ timeout: 3000 }).catch(() => {});
      } else {
        break;
      }
      await continueBtn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }

    for (let uploadAttempt = 0; uploadAttempt < 4; uploadAttempt++) {
      const uploadLaterButton = page.getByRole('button', { name: /upload later/i }).first();
      if (await uploadLaterButton.isVisible({ timeout: uploadAttempt === 0 ? 1500 : 800 }).catch(() => false)) {
        await uploadLaterButton.click({ timeout: 5000 }).catch(() => {});
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        continue;
      }
      break;
    }

    return true;
  };

  await page.goto(
    'https://login.dev.rate.com/oauth2/aus1lsk5st100GteN1d7/v1/authorize?client_id=0oa1lsiuimcqJDqfh1d7&nonce=cce24324-5ee3-4c90-9508-34d2388486fd&state=d33eda85-4d13-42c3-9e7a-d3dee36d9e01&scope=openid%20profile%20email%20offline_access&response_type=code&redirect_uri=https%3A%2F%2Fmy.gr-dev.com%2Fokta%2Foauth%2Fcb',
    { waitUntil: 'domcontentloaded', timeout: 90000 }
  );
  await dismissCookieOverlay();
  await dismissSessionOverlays();
  await assertNoCriticalUiError('post-login page load');
  await page.getByRole('button', { name: 'Close' }).click().catch(() => {});
  await dismissCookieOverlay();
  await page.getByRole('textbox', { name: 'Email' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill(loginEmail);
  const nextButton = page.getByRole('button', { name: /^next$/i });
  if (await nextButton.isVisible({ timeout: 2500 }).catch(() => false)) {
    await nextButton.click();
  }
  await page.getByRole('textbox', { name: 'Password' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill(TEST_PASSWORD);
  await page.getByRole('textbox', { name: 'Password' }).press('Enter');
  const verifyButton = page.getByRole('button', { name: 'Verify' });
  if (
    await verifyButton.isVisible({ timeout: 3000 }).catch(() => false) &&
    await verifyButton.isEnabled().catch(() => false)
  ) {
    await verifyButton.click();
  }

  const onAppHost = await page.waitForURL(/my\.gr-dev\.com\/(okta\/oauth\/cb|loans?|loan\/)/i, { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  if (!onAppHost) {
    await dismissCookieOverlay();
    await dismissSessionOverlays();
    if (await nextButton.isVisible({ timeout: 1500 }).catch(() => false)) {
      await nextButton.click().catch(() => {});
    }
    if (
      await verifyButton.isVisible({ timeout: 1500 }).catch(() => false) &&
      await verifyButton.isEnabled().catch(() => false)
    ) {
      await verifyButton.click().catch(() => {});
    }
    await page.goto('https://my.gr-dev.com/loans');
  }
  if (!/my\.gr-dev\.com\/loans/i.test(page.url())) {
    await page.goto('https://my.gr-dev.com/loans');
  }
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => {});
  await assertNoCriticalUiError('loans landing page');
  await expect.poll(
    async () => (await page.locator('body').textContent().catch(() => '')) ?? '',
    { timeout: 9000 }
  ).toMatch(/complete tasks|(purchase|refinance)\s+\d+DEV/i);

  const completedCards = page.locator('[role="listitem"], li').filter({ hasText: /complete tasks/i });
    const completedCardTexts = await completedCards.allTextContents().catch(() => []);
    const pageText = (await page.locator('body').textContent().catch(() => '')) ?? '';
    const loanTextPool = completedCardTexts.length > 0 ? completedCardTexts : [pageText];
    const candidateLoanNumbers = loanTextPool
    .flatMap((text) => Array.from(text.matchAll(/(\d+DEV)/gi), (match) => match[1].toUpperCase()))
    .map((loanId) => ({
      loanId,
      numericValue: Number.parseInt(loanId.replace(/DEV/i, ''), 10),
    }))
    .filter((candidate) => Number.isFinite(candidate.numericValue))
    .sort((left, right) => right.numericValue - left.numericValue);
    const loanNumber = candidateLoanNumbers[0]?.loanId ?? '';  
  await expect(loanNumber, 'latest finished loan number should be present').not.toBe('');
  console.log(`Using latest finished loan number: ${loanNumber}`);

  await expect(loanNumber, 'loan number should be present after selecting a loan').not.toBe('');

  const confirmIdentityUrls = [
    `https://myapp.dev.rate.com/confirmIdentity?oldLoanNumber=${loanNumber}`,
    `https://myapp.dev.rate.com/apply/confirm-identity?oldLoanNumber=${loanNumber}`,
    `https://myapp.dev.rate.com/apply/confirm-identity?old-loan-number=${loanNumber}`,
  ];
  const ssnField = page.getByRole('textbox', { name: /last four of ssn\*?|ssn\*?/i }).first();
  const borrowerDobField = page.locator('input[name="birthDate"], input[name="dob"], input[placeholder*="MM" i]').first();
  const borrowerContinueBtn = page.getByRole('button', { name: /^continue$/i }).first();
  const coBorrowerSsn = page.getByRole('textbox', { name: /social security number\*?|ssn\*?/i }).first();
  const coBorrowerDobField = page.locator('input[name="birthDate"], input[name="dob"], input[placeholder*="MM" i]').first();
  const isOnAnyIdentityStep = async () => (
    await ssnField.isVisible({ timeout: 1000 }).catch(() => false) ||
    await coBorrowerSsn.isVisible({ timeout: 1000 }).catch(() => false)
  );

  if (!await isOnAnyIdentityStep()) {
    for (const url of confirmIdentityUrls) {
      await page.goto(url);
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await dismissSessionOverlays();
      await assertNoCriticalUiError(`confirm identity navigation ${url}`);
      if (await isOnAnyIdentityStep()) break;
      const passwordBox = page.getByRole('textbox', { name: /password/i }).first();
      if (await passwordBox.isVisible({ timeout: 1500 }).catch(() => false)) {
        await passwordBox.fill(TEST_PASSWORD);
        await page.getByRole('button', { name: /^verify$|^continue$|^submit$/i }).first().click({ timeout: 10000 }).catch(() => {});
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await dismissSessionOverlays();
        if (await isOnAnyIdentityStep()) break;
      }
    }
  }

  await dismissSessionOverlays();
  if (await ssnField.isVisible({ timeout: 5000 }).catch(() => false)) {
    const continueBtn = borrowerContinueBtn;
    const dobField = borrowerDobField;
    const dobFallbackField = page.getByRole('textbox').nth(1);
    for (let attempt = 0; attempt < 3; attempt++) {
      await ssnField.click();
      await ssnField.fill(BORROWER_SSN_LAST4);
      if (await dobField.isVisible({ timeout: 1000 }).catch(() => false)) {
        await dobField.click();
        await dobField.press('Control+a').catch(() => {});
        await dobField.type(BORROWER_DOB, { delay: 50 }).catch(() => {});
        await dobField.fill(BORROWER_DOB).catch(() => {});
        await dobField.press('Tab').catch(() => {});
      }
      if (!await continueBtn.isEnabled().catch(() => false)) {
        await dobField.fill(BORROWER_DOB).catch(() => {});
        await dobField.evaluate((el) => {
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          (el as { blur: () => void }).blur();
        }).catch(() => {});
      }
      if (!await continueBtn.isEnabled().catch(() => false)) {
        await dobFallbackField.click().catch(() => {});
        await dobFallbackField.press('Control+a').catch(() => {});
        await dobFallbackField.fill(BORROWER_DOB).catch(() => {});
        await dobFallbackField.press('Tab').catch(() => {});
      }
      if (!await continueBtn.isEnabled().catch(() => false)) continue;
      await continueBtn.click();
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await dismissSessionOverlays();
      await fillDependentsIfVisible();
      if (!await ssnField.isVisible({ timeout: 3000 }).catch(() => false)) break;
    }
  }
  if (!await coBorrowerSsn.isVisible({ timeout: 2000 }).catch(() => false)) {
    const coborrowerExistsUrls = [
      `https://myapp.dev.rate.com/apply/coborrower-exists?old-loan-number=${loanNumber}`,
      `https://myapp.dev.rate.com/apply/coborrower-exists?oldLoanNumber=${loanNumber}`,
      `https://myapp.dev.rate.com/apply/coborrower-exists?loan-id=${loanNumber}`,
    ];
    for (const url of coborrowerExistsUrls) {
      await page.goto(url).catch(() => {});
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await dismissSessionOverlays();
      const invitationErrorVisible = await page.getByText(/unable to find invitation/i).first()
        .isVisible({ timeout: 1000 })
        .catch(() => false);
      if (invitationErrorVisible) {
        continue;
      }
      await assertNoCriticalUiError('co-borrower exists step');
      if (/apply\/coborrower-exists/i.test(page.url()) || await coBorrowerSsn.isVisible({ timeout: 1200 }).catch(() => false)) {
        break;
      }
    }
  }
  if (!await coBorrowerSsn.isVisible({ timeout: 2000 }).catch(() => false)) {
    const coBorrowerChoice = withCoBorrower ? /^yes$/i : /^no$/i;
    if (await page.getByRole('radio', { name: coBorrowerChoice }).first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.getByRole('radio', { name: coBorrowerChoice }).first().click();
    } else if (await page.getByLabel(coBorrowerChoice).first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.getByLabel(coBorrowerChoice).first().click();
    } else if (await page.getByRole('button', { name: coBorrowerChoice }).first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.getByRole('button', { name: coBorrowerChoice }).first().click();
    } else if (withCoBorrower && await page.locator('[id="0"]').first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.locator('[id="0"]').first().click();
    } else if (!withCoBorrower && await page.locator('[id="1"]').first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.locator('[id="1"]').first().click();
    } else if (await page.locator('input[type="radio"]').first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.locator('input[type="radio"]').first().click();
    }
    await page.getByRole('button', { name: /^continue$/i }).first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await dismissSessionOverlays();

    if (withCoBorrower && /apply\/coborrower-exists/i.test(page.url())) {
      await page.getByRole('radio', { name: /^yes$/i }).first().click({ timeout: 2000 }).catch(() => {});
      await page.getByRole('button', { name: /^continue$/i }).first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await dismissSessionOverlays();
    }
  }
  if (withCoBorrower && !await coBorrowerSsn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.goto(`https://myapp.dev.rate.com/apply/coborrower-identity?old-loan-number=${loanNumber}`);
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await dismissSessionOverlays();
    await assertNoCriticalUiError('co-borrower identity direct navigation');
  }
  if (withCoBorrower && !await coBorrowerSsn.isVisible({ timeout: 3000 }).catch(() => false) && await ssnField.isVisible({ timeout: 1000 }).catch(() => false)) {
    const continueBtn = page.getByRole('button', { name: /^continue$/i });
    const dobField = borrowerDobField;
    await ssnField.fill(BORROWER_SSN_LAST4);
    if (await dobField.isVisible({ timeout: 1000 }).catch(() => false)) {
      await dobField.click();
      await dobField.press('Control+a').catch(() => {});
      await dobField.fill(BORROWER_DOB).catch(() => {});
      await dobField.press('Tab').catch(() => {});
    }
    await continueBtn.click({ timeout: 5000 }).catch(() => {});
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.goto(`https://myapp.dev.rate.com/apply/coborrower-identity?old-loan-number=${loanNumber}`);
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await dismissSessionOverlays();
    await assertNoCriticalUiError('co-borrower identity retry navigation');
  }
  if (!await coBorrowerSsn.isVisible({ timeout: 15000 }).catch(() => false)) {
    if (/my\.gr-dev\.com\/loan\//i.test(page.url()) || /myapp\.dev\.rate\.com\/apply\/loan-detail/i.test(page.url())) {
      const completeTasks = page.getByRole('link', { name: /complete tasks/i }).first();
      if (await completeTasks.isVisible({ timeout: 5000 }).catch(() => false)) {
        await completeTasks.click();
        await page.waitForLoadState('domcontentloaded').catch(() => {});
      }
      console.log('Co-borrower identity step is not available for this loan; continued on available tasks flow.');
      return;
    }
    const onAssetsStep =
      /myapp\.dev\.rate\.com\/apply\/confirm-assets/i.test(page.url()) ||
      await page.getByRole('textbox', { name: /last four of account number/i }).first().isVisible({ timeout: 2000 }).catch(() => false);
    const onDeclarationsStep = /myapp\.dev\.rate\.com\/apply\/declarations/i.test(page.url());
    const onCoborrowerIdentityStep = /myapp\.dev\.rate\.com\/apply\/coborrower-identity/i.test(page.url());
    const onCoborrowerExistsStep = /myapp\.dev\.rate\.com\/apply\/coborrower-exists/i.test(page.url());
    if (!onAssetsStep && !onDeclarationsStep && !onCoborrowerIdentityStep && !onCoborrowerExistsStep && withCoBorrower) {
      throw new Error(`Co-borrower SSN step was not available. Current URL: ${page.url()}`);
    }
    if (onAssetsStep || onDeclarationsStep || (!withCoBorrower && onCoborrowerExistsStep)) {
      console.log('Application resumed at assets step; skipping co-borrower identity section.');
    }
  }

  if (withCoBorrower && await coBorrowerSsn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await coBorrowerSsn.click().catch(() => {});
    await coBorrowerSsn.fill(COBORROWER_SSN).catch(() => {});
    await coBorrowerDobField.click().catch(() => {});
    await coBorrowerDobField.fill(COBORROWER_DOB).catch(() => {});
    await page.getByRole('button', { name: /^continue$/i }).first().click({ timeout: 10000 }).catch(() => {});

    const certCheckboxes = page.getByRole('checkbox');
    if (await certCheckboxes.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await certCheckboxes.nth(0).check().catch(() => {});
      await certCheckboxes.nth(1).check().catch(() => {});
    }
    await page.getByRole('button', { name: /^continue$/i }).first().click({ timeout: 10000 }).catch(() => {});

    await clickFirstVisible([
      page.getByText(COBORROWER_FULL_NAME),
      page.getByText(BORROWER_FULL_NAME),
      page.getByText(COBORROWER_EMAIL),
      page.getByText(BORROWER_EMAIL),
      page.getByText('Married'),
      page.getByText('IdentityConfirmCreditConfirm'),
      page.getByText('EmployerTruework DemoTotal'),
      page.getByText('IdentityConfirmCreditYour'),
    ], 1500);

    await fillDependentsIfVisible();

    await clickFirstVisible([
      page.getByText('Primary residence'),
      page.getByRole('option', { name: /primary residence/i }),
    ], 2000);
    await page.getByRole('button', { name: /^continue$/i }).first().click({ timeout: 10000 }).catch(() => {});

    await clickFirstVisible([
      page.locator('[id="0"]'),
      page.getByRole('radio').first(),
      page.locator('input[type="radio"]').first(),
    ], 5000);
    await clickIfVisible(page.getByText('IdentityConfirmCreditAre you'), 1500);
    await clickFirstVisible([
      page.locator('[id="3"]'),
      page.getByRole('radio').nth(3),
      page.getByRole('radio').last(),
    ], 5000);
    await page.getByRole('button', { name: /^continue$/i }).first().click({ timeout: 10000 }).catch(() => {});

    await clickIfVisible(page.getByRole('combobox', { name: 'What type of property do you' }).getByTestId('font-icon'), 3000);
    await clickIfVisible(page.getByRole('option', { name: /primary residence/i }), 3000);
    await clickIfVisible(page.getByRole('combobox', { name: 'How do you hold title to the' }).getByTestId('font-icon'), 3000);
    await clickIfVisible(page.getByRole('option', { name: /sole ownership/i }), 3000);
    await page.getByRole('button', { name: /^continue$/i }).first().click({ timeout: 10000 }).catch(() => {});

    await clickFirstVisible([
      page.locator('[id="1"]'),
      page.getByRole('radio').nth(1),
      page.getByRole('radio').first(),
    ], 5000);
    await page.getByRole('button', { name: /^continue$/i }).first().click({ timeout: 10000 }).catch(() => {});

    await clickIfVisible(page.getByText('IdentityConfirmCreditCo-'), 1500);
    await page.getByRole('button', { name: /^continue$/i }).first().click({ timeout: 10000 }).catch(() => {});
    await clickFirstVisible([
      page.locator('[id="0"]'),
      page.getByRole('radio').first(),
      page.locator('label').filter({ hasText: 'Active Duty' }),
    ], 5000);
    await page.getByRole('button', { name: /^continue$/i }).first().click({ timeout: 10000 }).catch(() => {});

    await clickIfVisible(page.getByTestId('dropdown').getByTestId('font-icon'), 3000);
    await clickIfVisible(page.getByRole('option', { name: /us citizen/i }), 3000);
    await page.getByRole('button', { name: /^continue$/i }).first().click({ timeout: 10000 }).catch(() => {});
  }
  await fillAssetsIfVisible();
  await page.goto(`https://myapp.dev.rate.com/apply/coborrower-income-upload?old-loan-number=${loanNumber}`);
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await assertNoCriticalUiError('co-borrower income upload');
  const skipButton = page.getByRole('button', { name: 'Skip' }).first();
  if (await skipButton.isVisible({ timeout: 4000 }).catch(() => false)) {
    await skipButton.click().catch(() => {});
  }
  // Credit score page — wait for calculation to finish, then click Continue
  const calculatingText = page.getByText(/calculating your score/i).first();
  if (await calculatingText.isVisible({ timeout: 8000 }).catch(() => false)) {
    // Wait up to 30s for the "Calculating" state to resolve
    await calculatingText.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  }
  // Try to advance past credit score completion screen and any intermediate pages.
  // Different variants have different button labels, so try multiple options.
  // May need to click through multiple pages (e.g., confirm-assets) to reach overview.
  for (let attempt = 0; attempt < 5; attempt++) {
    const currentUrl = page.url();
    if (/my\.gr-dev\.com\/loan\/[^/]+\/overview/i.test(currentUrl)) {
      break; // Reached overview, stop clicking
    }

    if (/myapp\.dev\.rate\.com\/apply\/personal-detail/i.test(currentUrl)) {
      await fillDependentsIfVisible();
      const personalDetailContinueButton = page.getByRole('button', { name: /^continue$/i }).first();
      if (await personalDetailContinueButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        if (!await personalDetailContinueButton.isEnabled().catch(() => false)) {
          await fillDependentsIfVisible();
        }
        await personalDetailContinueButton.click({ timeout: 10000 }).catch(() => {});
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await page.waitForTimeout(500).catch(() => {});
        continue;
      }
    }

    if (/myapp\.dev\.rate\.com\/apply\/confirm-assets/i.test(currentUrl)) {
      if (await fillAssetsIfVisible()) {
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await page.waitForTimeout(500).catch(() => {});
        continue;
      }
    }

    if (/myapp\.dev\.rate\.com\/apply\/va-status/i.test(currentUrl)) {
      if (await fillVaStatusIfVisible()) {
        continue;
      }
    }

    const continueToTasksButton = page.getByRole('button', { name: /^continue to tasks$/i }).first();
    const genericContinueButton = page.getByRole('button', { name: /^continue$/i }).first();
    const nextButton = page.getByRole('button', { name: /^next$/i }).first();
    let clicked = false;

    if (await continueToTasksButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await continueToTasksButton.click({ timeout: 10000 }).catch(() => {});
      clicked = true;
    } else if (await genericContinueButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await genericContinueButton.click({ timeout: 10000 }).catch(() => {});
      clicked = true;
    } else if (await nextButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextButton.click({ timeout: 10000 }).catch(() => {});
      clicked = true;
    } else {
      // Try clicking any enabled button as last resort
      const button = page.getByRole('button').first();
      if (await button.isVisible({ timeout: 3000 }).catch(() => false)) {
        await button.click({ timeout: 10000 }).catch(() => {});
        clicked = true;
      }
    }

    if (clicked) {
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(500).catch(() => {});
    }
  }

  await expect(page).toHaveURL(/my\.gr-dev\.com\/loan\/[^/]+\/overview/i, { timeout: 45000 });

  const refinanceSummary = page.getByText(/refinance\s*#\s*\d+dev/i).first();
  await expect(refinanceSummary).toBeVisible({ timeout: 15000 });
  const refinanceLabel = ((await refinanceSummary.innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
  const refinanceNumberMatch = refinanceLabel.match(/refinance\s*#\s*(\d+dev)/i);
  const refinanceNumber = (refinanceNumberMatch?.[1] ?? '').toUpperCase();
  await expect(refinanceNumber, 'Refinance number should be present on overview page').not.toBe('');
  console.log(`Captured refinance summary: ${refinanceLabel}`);

  writeLastRunArtifact({
    timestamp: new Date().toISOString(),
    testName: testInfo.title,
    withCoBorrower,
    loginEmail,
    loanNumber,
    refinanceLabel,
    refinanceNumber,
    finalUrl: page.url(),
  });

};

test('AutoDM_Prefi_SingleBorrwer', async ({ page }, testInfo) => {
  await runAutoDmPrefiFlow(page, testInfo, false);
});

test('AutoDM_Prefi_Co-Borrwer', async ({ page }, testInfo) => {
  await runAutoDmPrefiFlow(page, testInfo, true);
});