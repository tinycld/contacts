import { expect, type Page, test } from '@playwright/test'
import { login, navigateToPackage } from '@tinycld/core/e2e-helpers'

// Proves contacts:add-contact closes the loop: a rule built in the real
// builder creates a contact that the contacts screen actually shows.
//
// The trigger here is core:manual, not mail's "a message arrives" — contacts'
// CI assembles only tinycld + contacts (see .github/workflows/ci.yml), so a
// cross-package rule would pass locally and fail there. The action is the same
// record-op either way; what mail adds is where the placeholder values come
// from, which mail's own suite covers.
async function navigateToRulesSettings(page: Page) {
    await page.getByTestId('nav-settings').click()
    await page.getByText('Rules', { exact: true }).first().click()
    await expect(page.getByText('My rules', { exact: true })).toBeVisible()
}

async function selectFromMenu(
    page: Page,
    trigger: import('@playwright/test').Locator,
    optionLabel: string
) {
    await trigger.click()
    await page.getByText(optionLabel, { exact: true }).click()
}

function ruleRow(page: Page, ruleName: string) {
    return page
        .locator('div')
        .filter({ has: page.getByText(ruleName, { exact: true }) })
        .filter({ has: page.getByLabel('More actions') })
        .last()
}

test('a rule adds a contact that shows up in the contacts list', async ({ page }) => {
    await login(page)

    const stamp = Date.now()
    const ruleName = `E2E add-contact ${stamp}`
    const firstName = `Rulesy${stamp}`

    await navigateToRulesSettings(page)

    await page.getByText('New rule', { exact: true }).first().click()
    await expect(page.getByText('New rule', { exact: true }).last()).toBeVisible()
    await page.getByPlaceholder('Rule name').fill(ruleName)

    await selectFromMenu(page, page.getByText('Select a trigger…', { exact: true }), 'Run manually')

    await page.getByText('add action', { exact: true }).click()
    await page.getByText('Add a contact', { exact: true }).click()

    // Each param renders a labeled row; fill the two that make the contact
    // identifiable in the list.
    await page.getByText('First name').locator('..').getByRole('textbox').first().fill(firstName)
    await page
        .getByText('Company')
        .locator('..')
        .getByRole('textbox')
        .first()
        .fill('Automation Test Co')

    await page.getByText('Save', { exact: true }).click()
    await expect(page.getByText(ruleName, { exact: true })).toBeVisible()

    await ruleRow(page, ruleName).getByLabel('More actions').click()
    await page.getByText('Run now', { exact: true }).click()

    // The visible effect: the contact exists in the contacts screen. Asserted
    // via toBeAttached, matching this package's other e2e — react-native-web
    // nests these as divs Playwright's visibility heuristic reports as hidden.
    await navigateToPackage(page, 'contacts')
    await expect(
        page.locator('[data-testid^="contact-row-"]').filter({ hasText: firstName }).first()
    ).toBeAttached({ timeout: 20_000 })
})

test('the contacts rules help topic is searchable and renders', async ({ page }) => {
    await login(page)

    await page.getByTestId('nav-help').click()
    await expect(page).toHaveURL(/\/help$/)

    await page.getByPlaceholder('Search help topics').fill('contact rules')
    await page.getByText('Contact rules', { exact: true }).click()

    await expect(page).toHaveURL(/\/help\/contacts\/rules$/)
    await expect(page.getByText('When a contact is added', { exact: true })).toBeVisible()
})
