import { expect, test } from '@playwright/test'
import { login, navigateToPackage } from '../../../../tests/e2e/helpers'

test.describe('Contacts', () => {
    test.beforeEach(async ({ page }) => {
        await login(page)
    })

    test('list screen renders with seed data', async ({ page }) => {
        await navigateToPackage(page, 'contacts')
        await expect(page.getByText(/Contacts \(\d+\)/)).toBeVisible()
        await expect(page.getByText('Alice Johnson')).toBeVisible()
        await expect(page.getByText('Bob Smith')).toBeVisible()
    })

    test('create a new contact and verify it appears', async ({ page }) => {
        await navigateToPackage(page, 'contacts')
        await page.getByText('+ Create contact').click()
        await page.waitForURL(/\/contacts\/new/)

        await page.getByTestId('first_name').fill('Tester')
        await page.getByTestId('last_name').fill('McTest')
        await page.getByTestId('email').fill('tester@example.com')
        await page.getByTestId('phone').fill('555-000-1234')
        await page.getByRole('button', { name: 'Create' }).click()

        await page.waitForURL((url) => !url.pathname.includes('/new'), { timeout: 10_000 })
        await expect(page.getByText('Tester McTest')).toBeVisible({
            timeout: 10_000,
        })
    })

    test('click a contact, edit fields, save, verify changes persist', async ({ page }) => {
        await navigateToPackage(page, 'contacts')
        await page.getByText('Alice Johnson').click()
        await page.waitForURL(/\/contacts\//)

        const firstNameInput = page.getByTestId('first_name')
        await firstNameInput.clear()
        await firstNameInput.fill('Alicia')

        await page.getByRole('button', { name: /save/i }).click()
        await page.goBack()

        await expect(page.getByText('Alicia')).toBeVisible()
    })

    test('toggle favorite from detail view', async ({ page }) => {
        await navigateToPackage(page, 'contacts')
        await page.getByText('Bob Smith').click()
        await page.waitForURL(/\/contacts\//)

        const favoriteButton = page
            .locator('[data-testid="favorite-toggle"]')
            .or(page.locator('svg').filter({ hasText: '' }).first())
        await favoriteButton.click({ timeout: 10_000 })
    })

    test('search filters contacts', async ({ page }) => {
        await navigateToPackage(page, 'contacts')

        const searchInput = page.getByPlaceholder('Search contacts...')
        await searchInput.fill('carol')

        await expect(page.getByText('Carol Williams')).toBeVisible()
        await expect(page.getByText('Bob Smith')).not.toBeVisible()
    })
})
