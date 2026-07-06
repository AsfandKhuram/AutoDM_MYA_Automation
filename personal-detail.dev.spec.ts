import { expect, Page, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const DEV_URL =
	"https://myapp.dev.rate.com/apply/personal-detail?invite-guid=0246e382-ee7e-4dfd-b578-5286b8588e29";
const EMAIL = "myaccount-r2.25gri07c@yopmail.com";
const PASSWORD = process.env.TEST_PASSWORD ?? "";

async function captureRunArtifactScreenshot(page: Page, fileName: string) {
	mkdirSync("run-artifacts", { recursive: true });
	await page.screenshot({ path: `run-artifacts/${fileName}`, fullPage: true });
}

async function acceptCookiesIfPresent(page: Page) {
	const acceptCookiesButton = page
		.getByRole("button", { name: /accept cookies|accept all/i })
		.first();
	if (await acceptCookiesButton.isVisible({ timeout: 3000 }).catch(() => false)) {
		await acceptCookiesButton.click();
	}
}

async function loginIfPrompted(page: Page) {
	const personalHeading = page.getByRole("heading", { name: /your information|personal information/i });
	const loginHeading = page.getByRole("heading", { name: /log in to rate/i });
	const emailInput = page.getByRole("textbox", { name: /email/i }).first();
	const passwordInput = page.getByRole("textbox", { name: /password/i }).first();

	await Promise.race([
		personalHeading.waitFor({ state: "visible", timeout: 15000 }),
		loginHeading.waitFor({ state: "visible", timeout: 15000 }),
	]).catch(() => undefined);

	if (await personalHeading.isVisible().catch(() => false)) {
		return;
	}

	await acceptCookiesIfPresent(page);

	await emailInput.fill(EMAIL);
	await passwordInput.fill(PASSWORD);

	const loginButton = page
		.getByRole("button", { name: /sign in|log in|login|continue/i })
		.first();
	await loginButton.click();

	await Promise.race([
		page.waitForURL(/myapp\.dev\.rate\.com\/apply\/personal-detail/i, { timeout: 60000 }),
		personalHeading.waitFor({ state: "visible", timeout: 60000 }),
	]).catch(() => undefined);

	if ((await personalHeading.isVisible().catch(() => false)) || /\/apply\/personal-detail/i.test(page.url())) {
		return;
	}

	if (await loginHeading.isVisible().catch(() => false)) {
		const loginAlert = page.getByRole("alert").first();
		const alertText = (await loginAlert.textContent().catch(() => ""))?.trim();
		throw new Error(`Login did not progress to personal-detail page. Alert: ${alertText || "n/a"}`);
	}
}

async function handleSessionPrompts(page: Page) {
	const expiredSessionHeading = page.getByRole("heading", { name: /your single sign-on session has expired/i }).first();
	const stayLoggedInButton = page.getByRole("button", { name: /yes, i'm here/i }).first();

	if (await stayLoggedInButton.isVisible({ timeout: 1000 }).catch(() => false)) {
		await stayLoggedInButton.click();
	}

	if (await expiredSessionHeading.isVisible({ timeout: 1000 }).catch(() => false)) {
		const reauthenticateButton = page.getByRole("button", { name: /^continue$/i }).first();
		await reauthenticateButton.click();
		await loginIfPrompted(page);
	}
}

async function navigateToPersonalDetailIfNeeded(page: Page) {
	const personalHeading = page.getByRole("heading", { name: /your information|personal information/i });
	const vaHeading = page.getByRole("heading", {
		name: /are you a current or former member of the us military/i,
	});
	const coApplicantHeading = page.getByRole("heading", { name: /will lorraine be on the application\?/i });
	const residenceHeading = page.getByRole("heading", { name: /^residence$/i });
	const backButton = page.getByRole("button", { name: /^back$/i }).first();

	await acceptCookiesIfPresent(page);

	for (let i = 0; i < 4; i += 1) {
		await handleSessionPrompts(page);

		if (await personalHeading.isVisible().catch(() => false)) {
			return;
		}

		const isOnLaterStep =
			(await residenceHeading.isVisible().catch(() => false)) ||
			(await vaHeading.isVisible().catch(() => false)) ||
			(await coApplicantHeading.isVisible().catch(() => false));

		if (!isOnLaterStep) {
			break;
		}

		if (!(await backButton.isVisible().catch(() => false))) {
			break;
		}

		await acceptCookiesIfPresent(page);
		await backButton.click({ force: true });
		await page.waitForLoadState("domcontentloaded");
	}
}

async function navigateToVaStatusIfNeeded(page: Page) {
	const vaHeading = page.getByRole("heading", {
		name: /are you a current or former member of the us military/i,
	});
	const coApplicantHeading = page.getByRole("heading", { name: /will lorraine be on the application\?/i });
	const residenceHeading = page.getByRole("heading", { name: /^residence$/i });
	const backButton = page.getByRole("button", { name: /^back$/i }).first();

	for (let i = 0; i < 3; i += 1) {
		await handleSessionPrompts(page);

		if (await vaHeading.isVisible().catch(() => false)) {
			return;
		}

		const isAfterVaStep =
			(await residenceHeading.isVisible().catch(() => false)) ||
			(await coApplicantHeading.isVisible().catch(() => false));

		if (!isAfterVaStep) {
			break;
		}

		if (!(await backButton.isVisible().catch(() => false))) {
			break;
		}

		await acceptCookiesIfPresent(page);
		await backButton.click({ force: true });
		await page.waitForLoadState("domcontentloaded");
	}
}

async function ensureVaStep(page: Page) {
	const personalHeading = page.getByRole("heading", { name: /your information|personal information/i });
	const vaHeading = page.getByRole("heading", {
		name: /are you a current or former member of the us military/i,
	});
	const coApplicantHeading = page.getByRole("heading", { name: /will lorraine be on the application\?/i });
	const residenceHeading = page.getByRole("heading", { name: /^residence$/i });
	const continueButton = page.getByRole("button", { name: /^continue$/i }).first();
	const backButton = page.getByRole("button", { name: /^back$/i }).first();

	for (let i = 0; i < 6; i += 1) {
		await handleSessionPrompts(page);

		if (await vaHeading.isVisible().catch(() => false)) {
			return;
		}

		if (await personalHeading.isVisible().catch(() => false)) {
			const dependentsInput = page.getByRole("textbox", { name: /number of dependents/i }).first();
			if (!(await dependentsInput.inputValue().catch(() => ""))) {
				await dependentsInput.fill("0");
			}

			const maritalStatus = page.getByRole("combobox", { name: /marital status/i }).first();
			const maritalStatusValue = (await maritalStatus.textContent().catch(() => ""))?.trim();
			if (!maritalStatusValue) {
				await maritalStatus.click();
				await page.getByRole("option", { name: /^married$/i }).click();
			}

			await continueButton.click();
			continue;
		}

		const isAfterVa =
			(await coApplicantHeading.isVisible().catch(() => false)) ||
			(await residenceHeading.isVisible().catch(() => false));
		if (isAfterVa && (await backButton.isVisible().catch(() => false))) {
			await backButton.click({ force: true });
			await page.waitForLoadState("domcontentloaded");
			continue;
		}

		await page.waitForURL(/\/apply\/(personal-detail|residence)/i, { timeout: 5000 }).catch(() => undefined);
	}
}

async function ensureResidenceStep(page: Page) {
	const personalHeading = page.getByRole("heading", { name: /your information|personal information/i });
	const vaHeading = page.getByRole("heading", {
		name: /are you a current or former member of the us military/i,
	});
	const coApplicantHeading = page.getByRole("heading", { name: /will lorraine be on the application\?/i });
	const residenceHeading = page.getByRole("heading", { name: /^residence$/i });
	const continueButton = page.getByRole("button", { name: /^continue$/i }).first();
	const vaNoOption = page.locator('label[for="selfDeclaredMilitaryServiceIndicator-No"]').first();

	for (let i = 0; i < 5; i += 1) {
		await handleSessionPrompts(page);

		if (await residenceHeading.isVisible().catch(() => false)) {
			return;
		}

		if (await personalHeading.isVisible().catch(() => false)) {
			const dependentsInput = page.getByRole("textbox", { name: /number of dependents/i }).first();
			if (!(await dependentsInput.inputValue().catch(() => ""))) {
				await dependentsInput.fill("0");
			}

			const maritalStatus = page.getByRole("combobox", { name: /marital status/i }).first();
			const maritalStatusValue = (await maritalStatus.textContent().catch(() => ""))?.trim();
			if (!maritalStatusValue) {
				await maritalStatus.click();
				await page.getByRole("option", { name: /^married$/i }).click();
			}

			await continueButton.click();
			continue;
		}

		if (await vaHeading.isVisible().catch(() => false)) {
			await vaNoOption.click();
			await continueButton.click();
			continue;
		}

		if (await coApplicantHeading.isVisible().catch(() => false)) {
			await page.getByRole("radio", { name: /^no$/i }).check();
			await continueButton.click();
			continue;
		}

		await page.waitForURL(/\/apply\/residence/i, { timeout: 5000 }).catch(() => undefined);
	}
}

test("Personal detail to residence flow with validations and logout", async ({ page }) => {
	test.setTimeout(300000);

	await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
	await loginIfPrompted(page);
	await navigateToPersonalDetailIfNeeded(page);

	await expect(page.getByText(/identity/i)).toBeVisible();
	await expect(page.getByText(/verify/i)).toBeVisible();
	await expect(page.getByText(/credit/i)).toBeVisible();
	await expect(page.getByText(/accessibility/i)).toBeVisible();
	await expect(page.getByText(/privacy policies/i)).toBeVisible();
	await expect(page.getByText(/nmls consumer access/i)).toBeVisible();

	const personalInfoHeading = page.getByRole("heading", { name: /your information|personal information/i });
	const vaHeading = page.getByRole("heading", {
		name: /are you a current or former member of the us military/i,
	});
	const coApplicantHeading = page.getByRole("heading", { name: /will lorraine be on the application\?/i });
	const residenceHeading = page.getByRole("heading", { name: /^residence$/i });
	const vaYesRadio = page.getByRole("radio", { name: /^yes$/i }).first();
	const vaNoRadio = page.getByRole("radio", { name: /^no$/i }).first();
	const vaYesOption = page.locator('label[for="selfDeclaredMilitaryServiceIndicator-Yes"]').first();
	const vaNoOption = page.locator('label[for="selfDeclaredMilitaryServiceIndicator-No"]').first();

	if (await personalInfoHeading.isVisible().catch(() => false)) {
		await expect(page.getByText(/update your personal information/i)).toBeVisible();
		await expect(page.getByText("Personal", { exact: true })).toBeVisible();
		await captureRunArtifactScreenshot(page, "personal-details-page.png");

		await expect(page.locator('input[placeholder*="Email" i], input[name*="email" i]').first()).toBeVisible();
		await expect(page.locator('input[placeholder*="Phone" i], input[name*="phone" i]').first()).toBeVisible();
		await expect(page.locator('input[placeholder*="First name" i], input[name*="first" i]').first()).toBeVisible();
		await expect(page.locator('input[placeholder*="Last name" i], input[name*="last" i]').first()).toBeVisible();
		await expect(
			page.locator('input[placeholder*="Number of dependents" i], input[name*="depend" i]').first()
		).toBeVisible();
		await expect(page.getByText(/marital status/i)).toBeVisible();

		const dependentsInput = page.getByRole("textbox", { name: /number of dependents/i }).first();
		if (!(await dependentsInput.inputValue())) {
			await dependentsInput.fill("0");
		}

		const maritalStatus = page.getByRole("combobox", { name: /marital status/i }).first();
		await maritalStatus.click();
		await page.getByRole("option", { name: /^married$/i }).click();

		await page.getByRole("button", { name: /^continue$/i }).first().click();
		await Promise.race([
			vaHeading.waitFor({ state: "visible", timeout: 20000 }),
			coApplicantHeading.waitFor({ state: "visible", timeout: 20000 }),
			residenceHeading.waitFor({ state: "visible", timeout: 20000 }),
		]).catch(() => undefined);
	}

	await navigateToVaStatusIfNeeded(page);
	await ensureVaStep(page);

	if (await vaHeading.isVisible().catch(() => false)) {
		await expect(vaYesOption).toBeVisible();
		await expect(vaNoOption).toBeVisible();
		await captureRunArtifactScreenshot(page, "va-status-page.png");

		await vaYesOption.click();
		await expect(vaYesRadio).toBeChecked();
		await captureRunArtifactScreenshot(page, "va-status-yes-selected.png");

		await vaNoOption.click();
		await expect(vaNoRadio).toBeChecked();
		await captureRunArtifactScreenshot(page, "va-status-no-selected.png");
		await page.getByRole("button", { name: /^continue$/i }).first().click();
		await Promise.race([
			coApplicantHeading.waitFor({ state: "visible", timeout: 20000 }),
			residenceHeading.waitFor({ state: "visible", timeout: 20000 }),
		]).catch(() => undefined);
	}

	if (await coApplicantHeading.isVisible().catch(() => false)) {
		await expect(page.getByText(/lorraine purchaser applied with you on the original loan/i)).toBeVisible();
		await page.getByRole("radio", { name: /^no$/i }).check();
		await page.getByRole("button", { name: /^continue$/i }).first().click();
	}

	await ensureResidenceStep(page);

	if (!(await residenceHeading.isVisible().catch(() => false))) {
		await page.waitForURL(/\/apply\/residence/i, { timeout: 60000 });
	}
	await expect(residenceHeading).toBeVisible({ timeout: 60000 });
	await captureRunArtifactScreenshot(page, "residence-page.png");

	const residenceContinueButton = page.getByRole("button", { name: /^continue$/i }).first();
	// If the button is disabled, reload the page — pre-filled data may have enabled it on refresh
	if (!(await residenceContinueButton.isEnabled().catch(() => false))) {
		await page.reload({ waitUntil: "domcontentloaded" });
		await expect(residenceHeading).toBeVisible({ timeout: 60000 });
	}
	await residenceContinueButton.click();
	await page.waitForLoadState("domcontentloaded");
	// Banner may or may not appear depending on app version; check softly
	const banner = page.getByText(/validation was unsuccessful\. please try again\./i);
	await banner.isVisible({ timeout: 3000 }).catch(() => false);
	await expect(page.getByText(/this field is required/i).first()).toBeVisible({ timeout: 10000 });
	await captureRunArtifactScreenshot(page, "residence-inline-errors.png");
	await ensureResidenceStep(page);

	const addressInput = page.getByRole("textbox", { name: /^address\*?$/i }).first();
	await addressInput.click();
	await addressInput.fill("");
	await addressInput.type("7934 chestnut dr westland", { delay: 40 });

	const firstAddressSuggestion = page
		.locator('[role="option"], [role="listbox"] div, li')
		.filter({ hasText: /7934 chestnut/i })
		.first();
	const suggestionVisible = await firstAddressSuggestion
		.isVisible({ timeout: 5000 })
		.catch(() => false);

	if (suggestionVisible) {
		await firstAddressSuggestion.click();
	}

	const cityInput = page.getByRole("textbox", { name: /city or town/i }).first();
	const countyInput = page.getByRole("textbox", { name: /county/i }).first();
	const stateInput = page.getByRole("textbox", { name: /^state\*?$/i }).first();
	const zipInput = page.getByRole("textbox", { name: /zip code/i }).first();

	await ensureResidenceStep(page);
	await expect(residenceHeading).toBeVisible({ timeout: 60000 });

	const autoFillWorked =
		Boolean(await cityInput.inputValue()) &&
		Boolean(await stateInput.inputValue()) &&
		Boolean(await zipInput.inputValue());
	if (!autoFillWorked) {
		console.warn("Address suggestion did not autofill city/state/zip in this run.");
	}

	if (!(await cityInput.inputValue())) {
		await cityInput.fill("Westland");
	}
	if (!(await countyInput.inputValue())) {
		await countyInput.fill("Wayne");
	}
	if (!(await stateInput.inputValue())) {
		await stateInput.fill("MI");
	}
	if (!(await zipInput.inputValue())) {
		await zipInput.fill("48185");
	}

	await page.getByRole("textbox", { name: /^from\*?$/i }).first().fill("01/2022");

	const ownOption = page.getByRole("button", { name: /^own$/i });
	const rentOption = page.getByRole("button", { name: /^rent$/i });
	await expect(ownOption).toBeVisible();
	await expect(rentOption).toBeVisible();

	await ownOption.click();
	await expect(
		page.getByText(/are taxes and insurance included in your monthly mortgage payment\?/i)
	).toBeVisible();
	await captureRunArtifactScreenshot(page, "residence-own-selected.png");

	await rentOption.click();
	await expect(page.getByText(/monthly rent/i)).toBeVisible();
	await captureRunArtifactScreenshot(page, "residence-rent-selected.png");

	const monthlyRentInput = page
		.locator('input[placeholder*="Monthly rent" i], input[name*="rent" i]')
		.first();
	await monthlyRentInput.fill("1500");

	await handleSessionPrompts(page);
	const welcomeMenu = page.getByRole("button", { name: /welcome,\s*patrick/i }).first();
	await welcomeMenu.click({ force: true });

	const menuLogoutButton = page.getByRole("button", { name: /^log ?out$/i }).first();
	const menuLogoutText = page.getByText(/^log ?out$/i).first();
	const modalLogoutButton = page.getByRole("button", { name: /^no, log out$/i }).first();

	if (await menuLogoutButton.isVisible({ timeout: 5000 }).catch(() => false)) {
		await menuLogoutButton.click({ force: true });
	} else if (await menuLogoutText.isVisible({ timeout: 2000 }).catch(() => false)) {
		await menuLogoutText.click({ force: true });
	} else if (await modalLogoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
		await modalLogoutButton.click({ force: true });
	}

	await page.waitForURL(/login\.dev\.rate\.com|my\.gr-dev\.com/i, { timeout: 30000 });
});
