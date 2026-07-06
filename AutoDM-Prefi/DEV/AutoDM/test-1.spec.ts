import { test, expect } from '@playwright/test';

const INVITE_GUID = process.env.ALP_INVITE_GUID || 'c504b733-c057-47c4-b90c-ad08209ce369';
const INVITE_URL = `https://myapp.dev.rate.com/?invite-guid=${INVITE_GUID}`;
const EMPLOYMENT_URL = `https://myapp.dev.rate.com/apply/employment?invite-guid=${INVITE_GUID}`;

test('test', async ({ page }) => {
  // Helper: dismiss session dialogs — fast check (800ms) to avoid wasting time
  async function dismissDialogs() {
    if (await page.getByText('Anyone Home?').isVisible({ timeout: 800 }).catch(() => false)) {
      await page.locator('button').filter({ hasText: /yes.*here/i }).click({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
    }
    if (await page.getByText('Your single sign-on session has expired').isVisible({ timeout: 800 }).catch(() => false)) {
      await page.locator('button').filter({ hasText: /^Continue$/ }).first().click({ force: true }).catch(() => {});
      await page.waitForLoadState('domcontentloaded');
    }
  }

  // Step 1: Go to invite URL → lands on register/welcome page (unauthenticated)
  await page.goto(INVITE_URL);
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 15000 });
  console.log(`Welcome page: ${page.url()}`);

  // Step 2: Click Continue → triggers OAuth, eventually shows the Okta login form
  await page.getByRole('button', { name: 'Continue' }).click();
  // Okta may JS-redirect to login form — wait up to 30s for it to render
  await page.getByRole('heading', { name: 'Log in to Rate' }).waitFor({ timeout: 30000 });
  console.log(`Login page: ${page.url()}`);

  // Step 3: Login
  await page.getByRole('textbox', { name: 'Email' }).fill('myaccount-alp0615-28c@yopmail.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('Grtest123!');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Wait for the full OAuth chain to settle on a stable myapp page (not just the /auth/callback hop)
  await page.waitForURL(
    url => url.hostname === 'myapp.dev.rate.com' && !url.pathname.startsWith('/auth/'),
    { timeout: 60000 }
  );
  console.log(`After OAuth settled: ${page.url()}`);

  // Step 5: Navigate directly to employment step (personal-detail already completed)
  await page.goto(EMPLOYMENT_URL);
  await page.getByRole('heading', { name: 'Employment information' }).waitFor({ timeout: 30000 });
  await dismissDialogs();
  console.log(`📍 Landed on: ${page.url()}`);

  // Only add employment if not already added
  const addEmploymentVisible = await page.getByRole('button', { name: 'Add employment' }).isVisible({ timeout: 5000 }).catch(() => false);
  if (addEmploymentVisible) {
    await page.getByRole('button', { name: 'Add employment' }).click();
    await page.getByTestId('dropdown-label').click();
    await page.getByRole('option', { name: 'W2' }).click();
    await page.getByRole('textbox', { name: 'Employer name*' }).click();
    await page.getByRole('textbox', { name: 'Employer name*' }).fill('Test inc3');
    await page.getByRole('textbox', { name: 'Job title*' }).click();
    await page.getByRole('textbox', { name: 'Job title*' }).fill('manager');
    await page.getByRole('textbox', { name: 'City*' }).click();
    await page.getByRole('textbox', { name: 'City*' }).fill('Westland, MI');
    await page.getByRole('textbox', { name: 'City*' }).click();
    await page.getByRole('textbox', { name: 'City*' }).fill('Westland,');
    await page.getByText('Westland, MI').click();
    await page.getByRole('heading', { name: 'Employment information' }).click();
    await page.getByText('This is my current job').click();
    await page.getByRole('textbox', { name: 'Start date*' }).click();
    await page.getByRole('textbox', { name: 'Start date*' }).fill('01/01/2021');
    await page.getByRole('textbox', { name: 'Annual base pay*' }).click();
    await page.getByRole('textbox', { name: 'Annual base pay*' }).fill('$10,0000');
    await page.getByRole('heading', { name: 'Employment information' }).click();
  }
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('button', { name: 'Add asset' }).click();
  await page.getByTestId('dropdown-label').click();
  await page.getByRole('option', { name: 'Checking account' }).click();
  await page.getByRole('textbox', { name: 'Financial institution*' }).click();
  await page.getByRole('textbox', { name: 'Financial institution*' }).fill('PNC');
  await page.getByRole('textbox', { name: 'Last Four of Account Number' }).click();
  await page.getByRole('textbox', { name: 'Last Four of Account Number' }).fill('1234');
  await page.getByRole('textbox', { name: 'Balance*' }).click();
  await page.getByRole('textbox', { name: 'Balance*' }).fill('$3,0000');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: 'English' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('checkbox', { name: 'Male', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Female' }).click();
  await page.getByText('DemographicYour').click();
  await page.locator('label').filter({ hasText: /^Male$/ }).click();
  await page.getByRole('checkbox', { name: 'Not Hispanic or Latino' }).click();
  await page.getByRole('checkbox', { name: 'White' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.locator('[id="1"]').first().click();
  await page.getByText('No').nth(2).click();
  await page.locator('[id="1"]').nth(2).click();
  await page.getByText('No', { exact: true }).nth(3).click();
  await page.getByText('No', { exact: true }).nth(4).click();
  await page.locator('#newCredit-No').press('ArrowDown');
  await page.locator('#newCredit-Yes').press('ArrowDown');
  await page.locator('#newCredit-No').press('ArrowDown');
  await page.locator('#newCredit-Yes').press('ArrowDown');
  await page.locator('#newCredit-No').press('ArrowDown');
  await page.locator('#newCredit-Yes').press('ArrowDown');
  await page.locator('#newCredit-No').press('ArrowDown');
  await page.locator('#newCredit-Yes').press('ArrowDown');
  await page.getByText('No', { exact: true }).nth(5).click();
  await page.locator('div:nth-child(7) > .flex > ._radioButtons_8u6j2_1 > .s1bi5cwu > div:nth-child(2)').click();
  await page.locator('div:nth-child(8) > .flex > ._radioButtons_8u6j2_1 > .s1bi5cwu > div:nth-child(2) > [id="1"] > span').click();
  await page.locator('div:nth-child(9) > .flex > ._radioButtons_8u6j2_1 > .s1bi5cwu > div:nth-child(2) > [id="1"]').click();
  await page.locator('div:nth-child(10) > .flex > ._radioButtons_8u6j2_1 > .s1bi5cwu > div:nth-child(2) > [id="1"] > span').click();
  await page.locator('div:nth-child(11) > .flex > ._radioButtons_8u6j2_1 > .s1bi5cwu > div:nth-child(2) > [id="1"] > span').click();
  await page.locator('div:nth-child(12) > .flex > ._radioButtons_8u6j2_1 > .s1bi5cwu > div:nth-child(2) > [id="1"] > span').click();
  await page.locator('div:nth-child(13) > .flex > ._radioButtons_8u6j2_1 > .s1bi5cwu > div:nth-child(2) > [id="1"]').click();
  await page.locator('div:nth-child(14) > .flex > ._radioButtons_8u6j2_1 > .s1bi5cwu > div:nth-child(2) > [id="1"] > span').click();
  await page.locator('div:nth-child(15) > .flex > ._radioButtons_8u6j2_1 > .s1bi5cwu > div:nth-child(2) > [id="1"] > span').click();
  await page.locator('div:nth-child(16) > .flex > ._radioButtons_8u6j2_1 > .s1bi5cwu > div:nth-child(2) > [id="1"]').click();
  await page.locator('.icon-container').click();
  await page.getByRole('option', { name: 'US CITIZEN' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('textbox', { name: 'Social Security Number*' }).click();
  await page.getByRole('textbox', { name: 'Social Security Number*' }).fill('500222000');
  await page.getByRole('button').nth(1).click();
  await page.locator('input[name="birthDate"]').click();
  await page.locator('input[name="birthDate"]').fill('01/01/1983');
  await page.getByText('IdentityVerifyCreditWe\'ll be').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByTestId('anchor').click();
  await page.getByText('Purchase #265116517DEV').click();
});