import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

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

test('PowerVP_QA_CoMortgagor_invite', async ({ page }) => {
  const coMortgagorEmail = generateCoMortgagorEmail();
  console.log(`Co-mortgagor email: ${coMortgagorEmail}`);

  // Set a wide viewport so the right-side Add application drawer is fully visible
  await page.setViewportSize({ width: 1440, height: 900 });
  // Navigate to the app — it will redirect to Okta with a fresh state/nonce
  await page.goto('https://pos-qa.dev.saas.rate.com');
  await page.waitForURL(/oktapreview\.com/, { timeout: 15000 });

  await page.getByRole('textbox', { name: 'Username' }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('Testlo@rate.com');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('textbox', { name: 'Password' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill('2th3P0in+Of$@l3');
  await page.getByRole('button', { name: 'Verify' }).click();

  // Wait for redirect to PowerVP dashboard
  await page.waitForURL(/pos-qa\.dev\.saas\.rate\.com/, { timeout: 30000 });
  await page.waitForLoadState('domcontentloaded');

  // Verify Test Loanofficer dashboard is visible
  await expect(page.getByText('Hi, Test')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Dashboard').first()).toBeVisible({ timeout: 10000 });

  // Wait for full page/app to settle
  await page.waitForLoadState('networkidle', { timeout: 20000 });

  // Step 1: Click the search icon in the top-right header to open and focus the search input
  await page.locator('[aria-label*="Search" i], [title*="Search" i], button[class*="search" i]').first().click({ timeout: 15000 });
  await page.waitForTimeout(500);
  // Type directly — the search field should be focused after clicking the icon
  await page.keyboard.type('265122608DEV', { delay: 80 });
  await page.waitForSelector('text=265122608DEV', { timeout: 15000 });

  // Step 2: Click the loan from the search results list
  await page.locator('text=265122608DEV').first().click();

  // Step 3: Verify the loan dashboard is displayed
  await page.waitForURL(/\/loan\//, { timeout: 15000 });
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByText('265122608DEV')).toBeVisible({ timeout: 10000 });

  // Step 4: Click on the Credit tab from the navigation list
  await page.getByText('Credit', { exact: true }).first().click({ timeout: 15000 });
  await page.waitForURL(/\/credit/, { timeout: 15000 });
  await page.waitForLoadState('domcontentloaded');

  // Step 5: Click on the 'Add' button to add a co-mortgagor application
  await page.locator('button', { hasText: /^Add$/ }).or(page.getByRole('button', { name: /^\+?\s*Add$/i })).first().click({ timeout: 15000 });
  await expect(page.getByText('Add application')).toBeVisible({ timeout: 10000 });

  // Step 6: Fill the Add application form — use click + pressSequentially for web component reactivity
  const addAppDrawer = page.getByTestId('Drawer');

  await addAppDrawer.getByRole('textbox', { name: 'First name*' }).click({ force: true });
  await page.keyboard.type('Mary', { delay: 50 });

  await addAppDrawer.getByRole('textbox', { name: 'Last name*' }).click({ force: true });
  await page.keyboard.type('Homeowner', { delay: 50 });

  await addAppDrawer.getByRole('textbox', { name: 'Email*' }).click({ force: true });
  await page.keyboard.type(coMortgagorEmail, { delay: 50 });

  await addAppDrawer.getByRole('textbox', { name: 'Phone*' }).click({ force: true });
  await page.keyboard.type('2482525525', { delay: 50 });

  await page.screenshot({ path: 'screenshots/before_add_and_send.png' });

  // Step 7: Click 'Add & send' — scroll into view first
  const addAndSendBtn = addAppDrawer.getByRole('button', { name: 'Add & send' });
  await addAndSendBtn.scrollIntoViewIfNeeded();
  await addAndSendBtn.click({ timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/after_add_and_send.png' });

  // Wait for the Send invite panel — look for the Send invite button itself
  await page.waitForSelector('button:has-text("Send invite"), [role="button"]:has-text("Send invite")', { timeout: 20000 });

  // Step 8: Set up API interceptor BEFORE clicking 'Send invite', then click it
  const createInviteResponsePromise = page.waitForResponse(
    response => response.url().includes('create-invite') && response.request().method() === 'POST',
    { timeout: 30000 }
  );

  await page.getByRole('button', { name: /send invite/i }).click({ timeout: 15000 });

  // Step 9: Capture inviteLinkUrl from the create-invite API response
  const createInviteResponse = await createInviteResponsePromise;
  const responseBody = await createInviteResponse.json();
  const inviteLinkUrl = responseBody.inviteLinkUrl;
  console.log(`✅ inviteLinkUrl: ${inviteLinkUrl}`);
  expect(inviteLinkUrl).toBeTruthy();

  // Screenshot of final result
  await page.screenshot({ path: 'screenshots/PowerVP_QA_CoMortgagor_invite_result.png', fullPage: false });
});
