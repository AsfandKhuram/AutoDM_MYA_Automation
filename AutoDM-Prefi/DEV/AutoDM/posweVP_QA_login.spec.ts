import { test, expect } from '@playwright/test';

test('posweVP_QA_login', async ({ page }) => {
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
});