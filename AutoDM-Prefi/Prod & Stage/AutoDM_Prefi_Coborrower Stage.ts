import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

test.afterEach(async ({ page, context }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    const screenshotBuffer = await page.screenshot({ fullPage: true }).catch(() => null);
    if (screenshotBuffer) {
      const screenshotDir = path.resolve('screenshots');
      fs.mkdirSync(screenshotDir, { recursive: true });
      const screenshotFile = path.join(screenshotDir, `failure-${testInfo.title.replace(/\W+/g, '_')}-${Date.now()}.png`);
      fs.writeFileSync(screenshotFile, screenshotBuffer);
      await testInfo.attach('screenshot-on-failure', { body: screenshotBuffer, contentType: 'image/png' });
    }
  }
  await context.close().catch(() => {});
});

test('test', async ({ page, context }) => {
  const dismissBlockingPrompts = async () => {
    await page.getByRole('button', { name: /yes,?\s*i'?m\s*here/i }).first().click({ timeout: 1500 }).catch(() => {});
    await page.getByRole('button', { name: /^continue$/i }).first().click({ timeout: 1500 }).catch(() => {});
    await page.getByRole('button', { name: /close|dismiss/i }).first().click({ timeout: 1000 }).catch(() => {});
  };

  // Clear browser cache and cookies before test
  await context.clearCookies();
  try {
    await (context as any).clearCache?.();
  } catch (e) {
    // clearCache may not be available in all versions
  }

  await page.goto('https://login.rate.com/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Close' }).click().catch(() => {});
  
  await page.getByRole('textbox', { name: 'Email' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill('myaccount-0714alp02a--a@yopmail.com');
  // login.rate.com uses a two-step flow: Email → Next → Password → Log In
  await page.getByRole('button', { name: /^next$/i }).click();
  await page.getByRole('textbox', { name: 'Password' }).waitFor({ state: 'visible', timeout: 15000 });
  await page.getByRole('textbox', { name: 'Password' }).fill(process.env.TEST_PASSWORD ?? '');
  await page.getByRole('button', { name: /log.?in|sign.?in|verify/i }).click();
  
  // Wait for redirect to my.rate.com
  await page.waitForURL(/my\.rate\.com\/(okta\/oauth\/cb|loans?|loan\/)/i, { timeout: 15000 }).catch(() => {});
  
  // Navigate to loans page if not already there
  if (!/my\.rate\.com\/loans/i.test(page.url())) {
    await page.goto('https://my.rate.com/loans', { waitUntil: 'domcontentloaded' });
  }
  
  await page.waitForLoadState('domcontentloaded');
  
  // Close any overlays
  await page.getByRole('button', { name: /close|dismiss/i }).first().click({ timeout: 2000 }).catch(() => {});

  // The loans shell can render before loan cards are available; refresh once if needed.
  const ensureLoansContentReady = async () => {
    const loanRow = page.getByText(/(?:purchase|refinance)\s+#?\d+/i).first();
    await loanRow.waitFor({ state: 'visible', timeout: 7000 }).catch(() => {});
    let hasLoanRow = await loanRow.isVisible().catch(() => false);
    if (hasLoanRow) return;

    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await dismissBlockingPrompts();

    await loanRow.waitFor({ state: 'visible', timeout: 7000 }).catch(() => {});
    hasLoanRow = await loanRow.isVisible().catch(() => false);
    if (hasLoanRow) return;
  };
  await ensureLoansContentReady();
  
  // Capture the latest loan number visible on the loans page.
  // Use page text parsing to avoid brittle assumptions about list/card markup.
  let loanNumber: string | null = null;
  let latestLoanNumeric = -1;
  const bodyText = ((await page.locator('body').textContent()) ?? '').replace(/\s+/g, ' ');
  const purchaseRefiMatches = [...bodyText.matchAll(/(?:purchase|refinance)\s+#?(\d+)/ig)];

  for (const match of purchaseRefiMatches) {
    const loanDigits = match[1];
    if (!loanDigits) continue;
    const loanNumeric = Number(loanDigits);
    if (Number.isNaN(loanNumeric)) continue;
    if (loanNumeric > latestLoanNumeric) {
      latestLoanNumeric = loanNumeric;
      loanNumber = `${loanDigits}`;
    }
  }

  // Fallback when card text is split unexpectedly: capture any visible 9+ digit loan numbers.
  if (!loanNumber) {
    const devTokenMatches = [...bodyText.matchAll(/\b(\d{9,})\b/g)];
    for (const match of devTokenMatches) {
      const loanDigits = match[1];
      if (!loanDigits) continue;
      const loanNumeric = Number(loanDigits);
      if (Number.isNaN(loanNumeric)) continue;
      if (loanNumeric > latestLoanNumeric) {
        latestLoanNumeric = loanNumeric;
        loanNumber = `${loanDigits}`;
      }
    }
  }

  expect(loanNumber, 'Could not detect a completed loan number on the loans page').toBeTruthy();
  const selectedLoanNumber = loanNumber as string;
  console.log(`Selected latest loan number: ${selectedLoanNumber}`);
  
  // Navigate directly to confirm-identity with the dynamic loan number
  await page.goto(`https://myapp-stage.rate.com/apply/confirm-identity?oldLoanNumber=${selectedLoanNumber}`);
  await page.waitForURL(/confirm-identity/i, { timeout: 15000 }).catch(() => {});
  // Use single, shorter load state - skip networkidle for faster interaction
  await page.waitForLoadState('domcontentloaded');
  await dismissBlockingPrompts();
  
  // Confirm-identity may be skipped for resumed loans; fill fields only if present.
  if (!/coborrower-exists/i.test(page.url())) {
    const confirmIdentityHeading = page.getByRole('heading', { name: /please\s+confirm\s+your\s+identity/i });
    const onConfirmIdentity = await confirmIdentityHeading.isVisible().catch(() => false);

    if (onConfirmIdentity) {

    const ssnCandidates = [
      page.getByRole('textbox', { name: /last\s*four\s*of\s*ssn/i }),
      page.locator('input[name*="ssn" i], input[id*="ssn" i]')
    ];
    let ssnFilled = false;
    for (const candidate of ssnCandidates) {
      const field = candidate.first();
      const isVisible = await field.isVisible().catch(() => false);
      if (!isVisible) continue;
      await field.fill('3333').catch(() => {});
      ssnFilled = true;
      break;
    }

    // Fallback: confirm-identity usually exposes SSN and DOB as first two textboxes.
    if (!ssnFilled) {
      const allTextboxes = page.getByRole('textbox');
      const textboxCount = await allTextboxes.count();
      if (textboxCount > 0) {
        await allTextboxes.nth(0).fill('3333').catch(() => {});
      }
    }

    await page.getByRole('button', { name: 'Close' }).click().catch(() => {});

    const dobCandidates = [
      page.locator('input[name="birthDate"]'),
      page.getByRole('textbox', { name: /date of birth|dob|birth/i }),
      page.getByLabel(/date of birth|dob|birth/i),
      page.getByPlaceholder(/mm\/?dd\/?yyyy/i),
      page.locator('input[name*="birth" i], input[id*="birth" i], input[placeholder*="MM" i]'),
      page.getByRole('textbox').nth(1)
    ];
    let dobFilled = false;
    for (const candidate of dobCandidates) {
      const field = candidate.first();
      const isVisible = await field.isVisible().catch(() => false);
      if (!isVisible) continue;
      await field.click({ timeout: 2500 }).catch(() => {});
      await field.fill('01/01/1980').catch(() => {});
      dobFilled = true;
      break;
    }

    if (!dobFilled) {
      const allTextboxes = page.getByRole('textbox');
      const textboxCount = await allTextboxes.count();
      if (textboxCount > 1) {
        await allTextboxes.nth(1).click({ timeout: 2500 }).catch(() => {});
        await allTextboxes.nth(1).fill('01/01/1980').catch(() => {});
        dobFilled = true;
      }
    }

    expect(dobFilled, 'Could not fill DOB on confirm-identity').toBeTruthy();

    const confirmContinue = page.getByRole('button', { name: /^continue$/i }).first();
    await confirmContinue.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    await confirmContinue.click({ timeout: 5000 }).catch(() => {});
    await page.waitForURL(/coborrower-exists/i, { timeout: 12000 }).catch(() => {});
    }
  }

  if (!/coborrower-exists/i.test(page.url())) {
    await page.goto(`https://myapp-stage.rate.com/apply/coborrower-exists?old-loan-number=${selectedLoanNumber}`);
    await page.waitForURL(/coborrower-exists/i, { timeout: 30000 }).catch(() => {});
  }
  await page.waitForLoadState('domcontentloaded');
  await dismissBlockingPrompts();
  // Click visible "Yes" across possible control types.
  const coborrowerYesCandidates = [
    page.getByRole('button', { name: /^yes$/i }),
    page.getByRole('radio', { name: /^yes$/i }),
    page.locator('label:has-text("Yes")'),
    page.locator('button:has-text("Yes"), [role="button"]:has-text("Yes")'),
    page.getByText(/^yes$/i)
  ];
  let clickedYes = false;
  for (const candidate of coborrowerYesCandidates) {
    const target = candidate.first();
    const isVisible = await target.isVisible().catch(() => false);
    if (!isVisible) continue;
    try {
      await target.click({ timeout: 2000, force: true });
      clickedYes = true;
      break;
    } catch (e) {
      continue;
    }
  }
  expect(clickedYes, 'Could not find a visible Yes option on coborrower-exists').toBeTruthy();
  
  // Fill coborrower SSN with fallback selectors
  const cobSSNCandidates = [
    page.locator('input[name*="ssn" i], input[id*="ssn" i], input[aria-label*="ssn" i], input[placeholder*="ssn" i]'),
    page.getByRole('textbox', { name: /social\s*security\s*number|ssn/i }),
    page.locator('input:not([type="hidden"]):not([type="email"]):not([disabled])').nth(0)
  ];
  for (const candidate of cobSSNCandidates) {
    const field = candidate.first();
    const isVisible = await field.isVisible().catch(() => false);
    const isEnabled = await field.isEnabled().catch(() => false);
    if (!isVisible || !isEnabled) continue;
    await field.fill('500602222');
    break;
  }

  // Fill coborrower DOB with fallback selectors
  const cobDOBCandidates = [
    page.locator('input[name*="birth" i], input[id*="birth" i], input[aria-label*="birth" i], input[placeholder*="birth" i]'),
    page.getByRole('textbox', { name: /date of birth|dob|birth/i }),
    page.getByPlaceholder(/mm\/?dd\/?yyyy/i),
    page.locator('input:not([type="hidden"]):not([type="email"]):not([disabled])').nth(1)
  ];
  for (const candidate of cobDOBCandidates) {
    const field = candidate.first();
    const isVisible = await field.isVisible().catch(() => false);
    const isEnabled = await field.isEnabled().catch(() => false);
    if (!isVisible || !isEnabled) continue;
    await field.fill('01/02/1980');
    break;
  }
  
  // Clicking Continue here may open a new tab; capture it if so
  const [newPageOrSame] = await Promise.all([
    page.context().waitForEvent('page', { timeout: 5000 }).catch(() => null),
    page.getByRole('button', { name: 'Continue' }).click({ timeout: 10000 }).catch(() => {}),
  ]);
  const activePage = newPageOrSame ?? page;
  await activePage.waitForLoadState('domcontentloaded').catch(() => {});

  // Keep the prod session alive during the long co-borrower flow: auto-dismiss the
  // "Anyone Home?" idle warning (before it expires) and the SSO-expired dialog.
  await activePage.addLocatorHandler(
    activePage.getByRole('heading', { name: /anyone home/i }),
    async () => {
      await activePage.getByRole('button', { name: /yes,?\s*i'?m\s*here/i }).first()
        .click({ timeout: 3000 }).catch(() => {});
    },
  ).catch(() => {});
  await activePage.addLocatorHandler(
    activePage.getByRole('heading', { name: /single sign-on session has expired/i }),
    async () => {
      await activePage.getByRole('heading', { name: /single sign-on session has expired/i })
        .locator('xpath=ancestor-or-self::*[.//button][1]')
        .getByRole('button').first()
        .click({ timeout: 3000 }).catch(() => {});
    },
  ).catch(() => {});

  await activePage.getByRole('button', { name: /yes,?\s*i'?m\s*here/i }).first().click({ timeout: 1500 }).catch(() => {});
  await activePage.getByRole('button', { name: /^continue$/i }).first().click({ timeout: 1500 }).catch(() => {});
  await activePage.getByRole('button', { name: /close|dismiss/i }).first().click({ timeout: 1000 }).catch(() => {});

  // Certification labels can vary by borrower names; click visible certify checkboxes generically.
  const onCertificationStep = await activePage.getByText(/certify to/i).first().isVisible().catch(() => false);
  if (onCertificationStep) {
    const certCandidates = [
      activePage.getByRole('checkbox', { name: /certify to/i }),
      activePage.locator('label:has-text("certify") input[type="checkbox"]'),
      activePage.locator('label:has-text("certify") [role="checkbox"]'),
      activePage.locator('input[type="checkbox"]')
    ];

    let certChecked = 0;
    for (const candidate of certCandidates) {
      const total = await candidate.count();
      for (let i = 0; i < total && certChecked < 2; i++) {
        const box = candidate.nth(i);
        const isVisible = await box.isVisible().catch(() => false);
        const isEnabled = await box.isEnabled().catch(() => false);
        if (!isVisible || !isEnabled) continue;

        const isChecked = await box.isChecked().catch(() => false);
        if (isChecked) {
          certChecked++;
          continue;
        }

        try {
          await box.click({ timeout: 2500, force: true });
          certChecked++;
        } catch (e) {
          continue;
        }
      }
      if (certChecked >= 2) break;
    }

    expect(certChecked, 'Could not check certification checkbox(es)').toBeGreaterThan(0);
  }

  await activePage.getByRole('button', { name: 'Continue' }).click();
  await activePage.getByRole('button', { name: 'Continue' }).click();
  const dependentsField = activePage.getByRole('textbox', { name: 'Number of dependents*' }).first();
  const onDependentsStep = await dependentsField.isVisible().catch(() => false);
  if (onDependentsStep) {
    await dependentsField.click();
    await dependentsField.fill('0');
    await activePage.locator('form').click().catch(() => {});
    await activePage.getByRole('option', { name: 'Primary residence' }).click().catch(() => {});
    await activePage.getByRole('button', { name: 'Continue' }).click();
    await activePage.locator('[id="1"]').click().catch(() => {});
  } else {
    // Some resumed flows land on Declarations directly; answer with safe defaults.
    const noOptions = activePage.locator('label:has-text("No"), [role="button"]:has-text("No")');
    const noCount = await noOptions.count();
    const answersToSet = Math.min(noCount, 8);
    for (let i = 0; i < answersToSet; i++) {
      await noOptions.nth(i).click().catch(() => {});
    }
    await activePage.getByRole('button', { name: 'Continue' }).click().catch(() => {});
  }
  await activePage.getByRole('button', { name: 'Continue' }).click();

  // Resumed loans can land/stay on declarations pages; clear those first.
  const answerDeclarationsIfPresent = async () => {
    for (let pass = 0; pass < 3; pass++) {
      const propertyTypeIcon = activePage
        .getByRole('combobox', { name: /what type of property do you/i })
        .getByTestId('font-icon')
        .first();
      const onPropertyStep = await propertyTypeIcon.isVisible().catch(() => false);
      if (onPropertyStep) return;

      const onDeclarationsUrl = /\/apply\/declarations/i.test(activePage.url());
      const noOptions = activePage.locator('label:has-text("No"), [role="button"]:has-text("No")');
      const noCount = await noOptions.count();
      if (!onDeclarationsUrl && noCount === 0) return;

      const answersToSet = Math.min(noCount, 12);
      for (let i = 0; i < answersToSet; i++) {
        await noOptions.nth(i).click().catch(() => {});
      }

      await activePage.getByRole('button', { name: 'Continue' }).click({ timeout: 3000 }).catch(() => {});
      await activePage.waitForLoadState('domcontentloaded', { timeout: 2500 }).catch(() => {});
      await dismissBlockingPrompts();
    }
  };
  await answerDeclarationsIfPresent();

  const propertyTypeIcon = activePage
    .getByRole('combobox', { name: /what type of property do you/i })
    .getByTestId('font-icon')
    .first();
  const hasPropertyStep = await propertyTypeIcon.isVisible().catch(() => false);
  if (hasPropertyStep) {
    await propertyTypeIcon.click();
    await activePage.getByRole('option', { name: 'Primary Residence' }).click().catch(() => {});
    await activePage.getByRole('combobox', { name: /how do you hold title to the/i }).getByTestId('font-icon').click().catch(() => {});
    await activePage.getByRole('option', { name: 'Sole Ownership' }).click().catch(() => {});
  }
  const clickContinueIfVisible = async () => {
    const continueBtn = activePage.getByRole('button', { name: /^continue$/i }).first();
    const isVisible = await continueBtn.isVisible().catch(() => false);
    if (!isVisible) return false;
    await continueBtn.click({ timeout: 3000 }).catch(() => {});
    await activePage.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => {});
    await dismissBlockingPrompts();
    return true;
  };

  const identityIntro = activePage.getByText(/just a|confirm credit/i).first();
  const hasIdentityIntro = await identityIntro.isVisible().catch(() => false);
  if (hasIdentityIntro) {
    await identityIntro.click().catch(() => {});
  }
  await clickContinueIfVisible();

  const dependents = activePage.getByRole('textbox', { name: /number of dependents/i }).first();
  if (await dependents.isVisible().catch(() => false)) {
    await dependents.click().catch(() => {});
    await dependents.fill('0').catch(() => {});
    await clickContinueIfVisible();
    await activePage.locator('[id="1"]').click().catch(() => {});
    await clickContinueIfVisible();
  }

  await clickContinueIfVisible();

  const lastFour = activePage.getByRole('textbox', { name: /last four of account number/i }).first();
  if (await lastFour.isVisible().catch(() => false)) {
    await lastFour.click().catch(() => {});
    await lastFour.fill('1234').catch(() => {});

    const balance = activePage.getByRole('textbox', { name: /balance/i }).first();
    if (await balance.isVisible().catch(() => false)) {
      await balance.click().catch(() => {});
      await balance.fill('$3,000').catch(() => {});
    }
    await clickContinueIfVisible();
  }

  await activePage.waitForLoadState('domcontentloaded', { timeout: 2500 }).catch(() => {});
  await activePage.getByRole('button', { name: 'Skip' }).click({ timeout: 4000 }).catch(() => {});
  await activePage.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => {});
  await activePage.getByRole('button', { name: 'Skip' }).click({ timeout: 4000 }).catch(() => {});
  await activePage.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => {});
  await activePage.goto('https://my.rate.com/loans');
  await activePage.waitForLoadState('domcontentloaded');
  await activePage.getByRole('button', { name: /yes,?\s*i'?m\s*here/i }).first().click({ timeout: 1500 }).catch(() => {});
  await activePage.getByRole('button', { name: /^continue$/i }).first().click({ timeout: 1500 }).catch(() => {});
  await activePage.getByRole('button', { name: /close|dismiss/i }).first().click({ timeout: 1000 }).catch(() => {});
  // Open the same dynamic loan from the loans list.
  const finalLoanClick = activePage
    .getByText(new RegExp(`(?:purchase|refinance)\\s+#?${selectedLoanNumber}`, 'i'))
    .first();
  await finalLoanClick.waitFor({ state: 'visible', timeout: 10000 });
  await finalLoanClick.click({ timeout: 5000 });
});