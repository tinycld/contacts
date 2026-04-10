import { expect, test } from '@playwright/test'
import { login, navigateToAddon } from '../../../tests/e2e/helpers'

test.describe('Contacts — Labels & Actions', () => {
    test.beforeEach(async ({ page }) => {
        await login(page)
        await navigateToAddon(page, 'contacts')
    })

    test('sidebar shows labels section', async ({ page }) => {
        await expect(page.getByText('Labels')).toBeVisible()
    })

    test('filter by label via sidebar', async ({ page }) => {
        await page.getByText('Work').click()
        await expect(page).toHaveURL(/label=/)
    })

    test('filter by favorites', async ({ page }) => {
        await page.getByText('Favorites').click()
        await expect(page).toHaveURL(/filter=favorites/)

        await expect(page.getByText('Alice Johnson')).toBeVisible()
        await expect(page.getByText('Carol Williams')).toBeVisible()
        await expect(page.getByText('Frank Lee')).toBeVisible()
    })

    test('contact row shows hover actions', async ({ page }) => {
        // Hovering a contact row should reveal action icons (Star, Edit, More)
        await page.getByText('Grace Kim').hover()

        // Check that at least the Edit or Star button appears
        const editButton = page.getByLabel('Edit')
        const starButton = page.getByLabel('Star').or(page.getByLabel('Unstar'))
        const anyAction = editButton.or(starButton)
        await expect(anyAction.first()).toBeVisible({ timeout: 5_000 })
    })

    test('navigate to contact detail', async ({ page }) => {
        await page.getByText('Bob Smith').click()
        await page.waitForURL(/\/contacts\//)

        await expect(page.getByTestId('first_name')).toBeVisible()
    })
})
