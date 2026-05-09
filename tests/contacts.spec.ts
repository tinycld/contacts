import { expect, test } from '@playwright/test'
import { login, navigateToPackage } from '../../../../tests/e2e/helpers'

// Each test creates its own uniquely-stamped contact and asserts only on
// that fixture. Reading seeded names ("Alice Johnson", "Bob Smith")
// races against parallel specs that rename, favorite, or delete the seed.

test.describe('Contacts', () => {
    test.beforeEach(async ({ page }) => {
        await login(page)
        await navigateToPackage(page, 'contacts')
    })

    test('create a contact and see it in the list', async ({ page }) => {
        const stamp = Date.now().toString(36)
        const firstName = `Create-${stamp}`

        await page.getByText('+ Create contact').click()
        await page.waitForURL(/\/contacts\/new/)
        await page.getByTestId('first_name').fill(firstName)
        await page.getByTestId('last_name').fill('Subject')
        await page.getByTestId('email').fill(`create-${stamp}@example.com`)
        await page.getByRole('button', { name: 'Create' }).click()

        await page.waitForURL(url => !url.pathname.includes('/new'), { timeout: 10_000 })
        await page.locator('input[placeholder="Search contacts..."]:visible').first().fill(firstName)
        await expect(page.getByText(`${firstName} Subject`).first()).toBeVisible({
            timeout: 10_000,
        })
    })

    test('edit a contact and verify changes persist', async ({ page }) => {
        const stamp = Date.now().toString(36)
        const startingName = `EditTest-${stamp}`
        const renamedName = `EditedTest-${stamp}`

        await page.getByText('+ Create contact').click()
        await page.waitForURL(/\/contacts\/new/)
        await page.getByTestId('first_name').fill(startingName)
        await page.getByTestId('last_name').fill('Subject')
        await page.getByTestId('email').fill(`edit-${stamp}@example.com`)
        await page.getByRole('button', { name: 'Create' }).click()
        await page.waitForURL(url => !url.pathname.includes('/new'), { timeout: 10_000 })

        const search = page.locator('input[placeholder="Search contacts..."]:visible').first()
        await search.fill(startingName)
        await page.getByText(`${startingName} Subject`).first().click()
        await page.waitForURL(/\/contacts\//)

        const firstNameInput = page.getByTestId('first_name')
        await firstNameInput.clear()
        await firstNameInput.fill(renamedName)
        await page.getByRole('button', { name: /save/i }).click()
        await page.goBack()

        await search.clear()
        await search.fill(renamedName)
        await expect(page.getByText(`${renamedName} Subject`).first()).toBeVisible()
    })

    test('toggle favorite from detail view', async ({ page }) => {
        const stamp = Date.now().toString(36)
        const firstName = `FavToggle-${stamp}`
        const fullName = `${firstName} Subject`

        await page.getByText('+ Create contact').click()
        await page.waitForURL(/\/contacts\/new/)
        await page.getByTestId('first_name').fill(firstName)
        await page.getByTestId('last_name').fill('Subject')
        await page.getByTestId('email').fill(`fav-${stamp}@example.com`)
        await page.getByRole('button', { name: 'Create' }).click()
        await page.waitForURL(url => !url.pathname.includes('/new'), { timeout: 10_000 })

        await page.locator('input[placeholder="Search contacts..."]:visible').first().fill(firstName)
        await page.getByText(fullName).first().click()
        await page.waitForURL(/\/contacts\//)

        const favoriteButton = page
            .locator('[data-testid="favorite-toggle"]')
            .or(page.locator('svg').filter({ hasText: '' }).first())
        await favoriteButton.click({ timeout: 10_000 })
    })

    test('search filters contacts', async ({ page }) => {
        const stamp = Date.now().toString(36)
        const firstName = `SearchTest-${stamp}`

        await page.getByText('+ Create contact').click()
        await page.waitForURL(/\/contacts\/new/)
        await page.getByTestId('first_name').fill(firstName)
        await page.getByTestId('last_name').fill('Subject')
        await page.getByTestId('email').fill(`search-${stamp}@example.com`)
        await page.getByRole('button', { name: 'Create' }).click()
        await page.waitForURL(url => !url.pathname.includes('/new'), { timeout: 10_000 })

        const searchInput = page.locator('input[placeholder="Search contacts..."]:visible').first()
        await searchInput.fill(firstName)

        await expect(page.getByText(`${firstName} Subject`).first()).toBeVisible()

        await searchInput.fill('zzz-no-such-contact-zzz')
        await expect(page.getByText(`${firstName} Subject`)).not.toBeVisible()
    })
})
