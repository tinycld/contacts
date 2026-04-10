import { expect, test } from '@playwright/test'
import { login, ORG_SLUG } from '../../../tests/e2e/helpers'

test.describe('Contacts — Directory', () => {
    test.beforeEach(async ({ page }) => {
        await login(page)
    })

    test('directory page renders with org members', async ({ page }) => {
        await page.goto(`/a/${ORG_SLUG}/contacts/directory`)
        await expect(page.getByText(/Directory \(\d+\)/)).toBeVisible()
    })

    test('directory search filters members', async ({ page }) => {
        await page.goto(`/a/${ORG_SLUG}/contacts/directory`)
        await expect(page.getByText(/Directory \(\d+\)/)).toBeVisible()

        const searchInput = page.getByPlaceholder('Search members...')
        if (await searchInput.isVisible()) {
            await searchInput.fill('nonexistent-user-xyz')
            await expect(page.getByText('No members found.')).toBeVisible()
        }
    })
})
