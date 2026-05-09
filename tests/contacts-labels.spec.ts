import { expect, test } from '@playwright/test'
import { login, navigateToPackage } from '../../../../tests/e2e/helpers'

test.describe('Contacts — Labels & Actions', () => {
    test.beforeEach(async ({ page }) => {
        await login(page)
        await navigateToPackage(page, 'contacts')
        // Settle on a sidebar-scoped element so subsequent assertions
        // don't race the package sidebar's Suspense hydration.
        await expect(page.getByText('+ Create contact')).toBeVisible({ timeout: 15_000 })
    })

    test('filter by label via sidebar navigates to label-scoped URL', async ({ page }) => {
        await page.getByText('Work').click()
        await expect(page).toHaveURL(/label=/)
    })

    test('filter by favorites shows favorited contact', async ({ page }) => {
        // Create a uniquely-named favorite, then assert it appears in the
        // favorites view. Don't assert on the count — other parallel specs
        // create + favorite contacts and the number drifts.
        const stamp = Date.now().toString(36)
        const firstName = `FavFilter-${stamp}`
        const fullName = `${firstName} Subject`

        await page.getByText('+ Create contact').click()
        await page.waitForURL(/\/contacts\/new/)
        await page.getByTestId('first_name').fill(firstName)
        await page.getByTestId('last_name').fill('Subject')
        await page.getByTestId('email').fill(`favfilter-${stamp}@example.com`)
        await page.getByRole('button', { name: 'Create' }).click()
        await page.waitForURL(url => !url.pathname.includes('/new'), { timeout: 10_000 })

        // Star from the list via the search-scoped row.
        await page.locator('input[placeholder="Search contacts..."]:visible').first().fill(firstName)
        await page.getByText(fullName).first().click()
        await page.waitForURL(/\/contacts\//)
        const favoriteButton = page
            .locator('[data-testid="favorite-toggle"]')
            .or(page.locator('svg').filter({ hasText: '' }).first())
        await favoriteButton.click({ timeout: 10_000 })
        await page.goBack()

        await page.getByText('Favorites').click()
        await expect(page).toHaveURL(/filter=favorites/)
        await page.locator('input[placeholder="Search contacts..."]:visible').first().fill(firstName)
        // Scope to visible — FrozenSlideStack keeps the prior contact-detail
        // and list screens mounted, so the same name text exists in hidden
        // sibling DOMs and `.first()` can pick a hidden match.
        await expect(
            page.getByText(fullName).filter({ visible: true }).first()
        ).toBeVisible({ timeout: 10_000 })
    })
})
