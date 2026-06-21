import { expect, test } from '@playwright/test'
import { login, navigateToPackage } from '@tinycld/core/e2e-helpers'

// The expo:test stack (Playwright's webServer) resets + seeds the test DB, so
// these seeded values exist. The contacts package seed inserts Alice/Bob/… into
// the PRIMARY org (test-org).
const A_SEEDED_CONTACT = 'Alice'

test('logs in and renders seeded contacts in the workspace', async ({ page }) => {
    await login(page)

    // After login the workspace redirects to its first nav package (Mail in a
    // full assembly), so SPA-navigate to contacts via the rail link rather than
    // relying on the redirect target.
    await navigateToPackage(page, 'contacts')

    // Assert via toBeAttached (DOM presence), not toBeVisible: react-native-web
    // renders these as nested divs that Playwright's visibility heuristic reports
    // as hidden even when on-screen (confirmed visually). DOM presence of the
    // "Contacts (N)" header + a seeded contact row proves login → workspace →
    // contacts-with-data worked.
    await expect(page.getByText(/Contacts \(\d+\)/).first()).toBeAttached()
    await expect(page.getByText(A_SEEDED_CONTACT, { exact: false }).first()).toBeAttached()
})
