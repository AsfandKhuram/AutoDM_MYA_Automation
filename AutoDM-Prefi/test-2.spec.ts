import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

test.afterEach(async ({ page }, testInfo) => {
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
});

test('test', async ({ page }) => {
  await page.goto('https://myapp.dev.rate.com/?invite-guid=40ab7d6e-4c19-4317-80e4-82bf211c0689');
  await page.getByRole('button', { name: 'Accept Cookies' }).click().catch(() => {});

  // The invite URL initially lands on myapp.dev.rate.com, then JS redirects to login.
  // Wait for a meaningful element to appear — login heading, password-set field, or app content.
  await Promise.race([
    page.getByRole('heading', { name: 'Log in to Rate' }).waitFor({ timeout: 25000 }),
    page.locator('[label*="Password" i]').first().waitFor({ timeout: 25000 }),
    page.getByText(/Number of dependents|will there be anyone else/i).waitFor({ timeout: 25000 }),
  ]).catch(() => {});

  // Set password screen (fresh invite) — shadow DOM fields
  const onSetPwPage = await page.locator('[label*="Password" i]').first()
    .isVisible().catch(() => false);

  if (onSetPwPage) {
    await page.locator('[label*="Password" i]').first().click({ force: true });
    await page.keyboard.type('Grtest123!', { delay: 50 });
    await page.locator('[label*="Confirm" i]').first().click({ force: true });
    await page.keyboard.type('Grtest123!', { delay: 50 });
    await page.getByRole('button', { name: 'Continue' }).click();
    // After setting password, app redirects to login
    await page.getByRole('heading', { name: 'Log in to Rate' }).waitFor({ timeout: 20000 });
  }

  // Login screen — identified by the "Log in to Rate" heading
  const isOnLogin = await page.getByRole('heading', { name: 'Log in to Rate' }).isVisible().catch(() => false);
  if (isOnLogin) {
    await page.getByRole('textbox', { name: 'Email' }).fill('myaccount-alp0615-26c@yopmail.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('Grtest123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    // networkidle waits for ALL redirect chains to settle (callback → app → possible re-login)
    await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
    console.log(`📍 Post-login URL: ${page.url()}`);

    // If the invite-guid was already used, the callback may bounce us back to login.
    // In that case navigate directly (without invite-guid) and sign in fresh.
    if (/login\.dev\.rate\.com/i.test(page.url())) {
      console.log('⚠️  Bounced back to login — navigating directly to app without invite-guid');
      await page.goto('https://myapp.dev.rate.com/');
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      if (await page.getByRole('heading', { name: 'Log in to Rate' }).isVisible().catch(() => false)) {
        await page.getByRole('textbox', { name: 'Email' }).fill('myaccount-alp0615-26c@yopmail.com');
        await page.getByRole('textbox', { name: 'Password' }).fill('Grtest123!');
        await page.getByRole('button', { name: 'Sign in' }).click();
        await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
        console.log(`📍 Post-direct-login URL: ${page.url()}`);
      }
    }
  }

  // After login, the app may show the coborrower question — click No
  await page.waitForLoadState('domcontentloaded');
  const coborrowerQ = page.getByText(/will there be anyone else/i);
  if (await coborrowerQ.isVisible({ timeout: 5000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'No' }).click();
    await page.waitForLoadState('domcontentloaded');
  }

  // Welcome screen may appear next — click through it
  if (/register\/welcome/i.test(page.url())) {
    const continueBtn = page.getByRole('button', { name: /continue|get started|next|begin/i }).first();
    const hasContinue = await continueBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasContinue) {
      await continueBtn.click();
    } else {
      // Try any primary button on the page
      await page.getByRole('button').first().click().catch(() => {});
    }
    await page.waitForLoadState('domcontentloaded');
  }


  const dependentsField = page.getByRole('textbox', { name: 'Number of dependents*' });
  await dependentsField.waitFor({ state: 'visible', timeout: 30000 });
  await dependentsField.click();
  await dependentsField.fill('0');
  await page.getByTestId('dropdown-label').click();
  await page.getByRole('option', { name: 'Married', exact: true }).click();
  await page.getByText('IdentityVerifyCreditYour').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.locator('[id="1"]').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('textbox', { name: 'Address' }).click();
  await page.getByRole('textbox', { name: 'Address' }).fill('7922 chestnut dr');
  await page.getByText('Chestnut Drive').click();
  await page.getByTestId('textInput').click();
  await page.getByTestId('textInput').fill('01/2022_');
  await page.getByRole('button', { name: 'Own' }).click();
  await page.getByText('No').nth(1).click();
  await page.getByRole('textbox', { name: 'Yearly Taxes*' }).click();
  await page.getByRole('textbox', { name: 'Yearly Taxes*' }).fill('$6000');
  await page.getByRole('textbox', { name: 'Yearly Insurance*' }).click();
  await page.getByRole('textbox', { name: 'Yearly Insurance*' }).fill('$1200');
  await page.getByText('Yes').nth(2).click();
  await page.getByRole('textbox', { name: 'HOA dues or assessments*' }).click();
  await page.getByRole('textbox', { name: 'HOA dues or assessments*' }).fill('$50');
  await page.getByTestId('dropdown-label').click();
  await page.getByRole('option', { name: 'Monthly' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.locator('[id="1"]').first().click();
  await page.getByRole('checkbox', { name: 'I, John Homeowner, certify to' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Add employment' }).click();
  await page.getByTestId('dropdown-label').click();
  await page.getByRole('option', { name: 'W2' }).click();
  await page.getByRole('textbox', { name: 'Employer name*' }).click();
  await page.getByRole('textbox', { name: 'Employer name*' }).fill('Test inc2');
  await page.getByRole('textbox', { name: 'Job title*' }).click();
  await page.getByRole('textbox', { name: 'Job title*' }).fill('Manager');
  await page.getByRole('textbox', { name: 'City*' }).click();
  await page.getByRole('textbox', { name: 'City*' }).fill('Westland ');
  await page.getByText('Westland, MI').click();
  await page.getByRole('checkbox', { name: 'This is my current job' }).click();
  await page.getByRole('textbox', { name: 'Start date*' }).click();
  await page.getByRole('textbox', { name: 'Start date*' }).fill('01/01/2021');
  await page.getByRole('textbox', { name: 'Annual base pay*' }).click();
  await page.getByRole('textbox', { name: 'Annual base pay*' }).fill('$10,0000');
  await page.locator('form').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('button', { name: 'Add asset' }).click();
  await page.getByTestId('dropdown-label').click();
  await page.getByRole('option', { name: 'Savings account' }).click();
  await page.getByRole('textbox', { name: 'Financial institution*' }).click();
  await page.getByRole('textbox', { name: 'Financial institution*' }).fill('PNC');
  await page.getByRole('textbox', { name: 'Last Four of Account Number' }).click();
  await page.getByRole('textbox', { name: 'Last Four of Account Number' }).fill('1234');
  await page.getByRole('textbox', { name: 'Balance*' }).click();
  await page.getByRole('textbox', { name: 'Balance*' }).fill('$5,0000');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('English', { exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('checkbox', { name: 'Male', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Not Hispanic or Latino' }).click();
  await page.getByRole('checkbox', { name: 'White' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('No').nth(1).click();
  await page.getByText('No').nth(2).click();
  await page.getByText('No').nth(4).click();
  await page.getByText('No', { exact: true }).nth(3).click();
  await page.getByText('No', { exact: true }).nth(4).click();
  await page.getByText('No', { exact: true }).nth(5).click();
  await page.locator('div:nth-child(7) > .flex > ._radioButtons_8u6j2_1 > .s1bi5cwu > div:nth-child(2) > [id="1"] > span').click();
  await page.locator('div:nth-child(8) > .flex > ._radioButtons_8u6j2_1 > .s1bi5cwu > div:nth-child(2) > [id="1"] > span').click();
  await page.locator('div:nth-child(9) > .flex > ._radioButtons_8u6j2_1 > .s1bi5cwu > div:nth-child(2) > [id="1"] > span').click();
  await page.locator('div:nth-child(10) > .flex > ._radioButtons_8u6j2_1 > .s1bi5cwu > div:nth-child(2) > [id="1"]').click();
  await page.locator('div:nth-child(11) > .flex > ._radioButtons_8u6j2_1 > .s1bi5cwu > div:nth-child(2) > [id="1"]').click();
  await page.locator('div:nth-child(12) > .flex > ._radioButtons_8u6j2_1 > .s1bi5cwu > div:nth-child(2) > [id="1"]').click();
  await page.locator('div:nth-child(13) > .flex > ._radioButtons_8u6j2_1 > .s1bi5cwu > div:nth-child(2) > [id="1"] > span').click();
  await page.locator('div:nth-child(14) > .flex > ._radioButtons_8u6j2_1 > .s1bi5cwu > div:nth-child(2) > [id="1"] > span').click();
  await page.locator('div:nth-child(15) > .flex > ._radioButtons_8u6j2_1 > .s1bi5cwu > div:nth-child(2) > [id="1"] > span').click();
  await page.locator('div:nth-child(16) > .flex > ._radioButtons_8u6j2_1 > .s1bi5cwu > div:nth-child(2) > [id="1"] > span').click();
  await page.getByTestId('dropdown').getByTestId('font-icon').click();
  await page.getByRole('option', { name: 'US CITIZEN' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('textbox', { name: 'Social Security Number*' }).click();
  await page.getByRole('textbox', { name: 'Social Security Number*' }).fill('999405000');
  await page.getByRole('textbox', { name: 'Social Security Number*' }).click();
  await page.locator('input[name="birthDate"]').click();
  await page.locator('input[name="birthDate"]').fill('01/01/1982');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('IdentityVerifyCreditYou did').click();
  await page.getByTestId('anchor').click();
  await page.goto('https://my.gr-dev.com/loan/8d13b349-262f-44a8-83ce-b672be16461d/overview');
  await page.locator('div').filter({ hasText: 'Purchase #265112809DEV|' }).nth(3).click();
  await page.locator('div').filter({ hasText: 'Purchase #265112809DEV|' }).nth(3).click();
});