import { expect, type Page, test } from '@playwright/test'
import { login, navigateToPackage } from '../../../tinycld/tests/e2e/helpers'

// The expo:test stack (Playwright's webServer) resets + seeds the test DB before
// the run, so the seeded contacts referenced below exist. See seed.ts.

// react-native-web renders rows as nested divs that Playwright's visibility
// heuristic reports as hidden even when on-screen, so assert DOM presence
// (toBeAttached) rather than visibility — same approach as renders-with-data.spec.
const ATTACH = { timeout: 30_000 } as const

async function gotoContacts(page: Page) {
    await login(page)
    // SPA-navigate to the contacts package via the rail link (not page.goto,
    // which is a hard nav that cancels in-flight chunk loads — see helpers.ts).
    await navigateToPackage(page, 'contacts')
    await expect(page.getByText(/Contacts \(\d+\)/).first()).toBeAttached(ATTACH)
    await expect(page.getByText('Alice', { exact: false }).first()).toBeAttached(ATTACH)
}

// FrozenSlideStack keeps previously-visited contacts screens mounted-but-frozen
// (react-native-screens hides them with display:none rather than unmounting), so
// in a full assembly a stale, hidden copy of the search box can linger in the
// DOM alongside the live one. Scope to the visible input so the locator always
// resolves to the foreground screen and never trips strict-mode on the ghost.
function searchBox(page: Page) {
    return page.getByPlaceholder('Search contacts...').locator('visible=true')
}

// Bug #2: searching and then clearing the field must restore the full list.
test('clearing the search field restores the full contact list', async ({ page }) => {
    await gotoContacts(page)

    // Capture the unfiltered header count, e.g. "Contacts (24)".
    const header = page.getByText(/Contacts \(\d+\)/).first()
    const initial = await header.textContent()
    const initialCount = Number(initial?.match(/\((\d+)\)/)?.[1] ?? '0')
    expect(initialCount).toBeGreaterThan(1)

    // Narrow to a single seeded contact.
    await searchBox(page).fill('Isabelle')
    await expect(page.getByText('Isabelle', { exact: false }).first()).toBeAttached(ATTACH)
    // A contact that should now be filtered out of the visible list. Scope to
    // visible: a frozen (hidden) prior screen keeps an unfiltered "Alice" in the
    // DOM, so an unscoped count never reaches 0.
    await expect(page.getByText('Alice', { exact: false }).locator('visible=true')).toHaveCount(
        0,
        ATTACH
    )

    // Clear the field — the full list must come back, not a stale/empty set.
    await searchBox(page).fill('')
    await expect(page.getByText('Alice', { exact: false }).first()).toBeAttached(ATTACH)
    await expect(page.getByText('Bob', { exact: false }).first()).toBeAttached(ATTACH)
    await expect(page.getByText(`Contacts (${initialCount})`).first()).toBeAttached(ATTACH)
})

// Bug #3 end-to-end: a contact whose unique term lives in the email must be
// findable by a PARTIAL email address that omits an interior token. Carol is
// seeded as carol.w@example.com — searching "carol@example.com" (without ".w")
// previously matched nothing because the address was treated as one ordered
// phrase.
test('finds a contact by a partial email address that skips a token', async ({ page }) => {
    await gotoContacts(page)

    await searchBox(page).fill('carol@example.com')
    await expect(page.getByText('Carol', { exact: false }).first()).toBeAttached(ATTACH)

    // The full address still works too.
    await searchBox(page).fill('carol.w@example.com')
    await expect(page.getByText('Carol', { exact: false }).first()).toBeAttached(ATTACH)
})

// Bug #1: a newly created contact must appear in the list immediately.
test('a newly created contact shows up in the list', async ({ page }) => {
    await gotoContacts(page)

    // Unique name so we never collide with seeded data.
    const first = 'Zephyrina'
    const last = 'Testcase'
    const email = 'zephyrina.testcase@example.com'

    // Open the create form via the sidebar action (SPA nav), not page.goto.
    // visible=true scopes past any frozen (hidden) screen the stack keeps mounted.
    await page.getByText('+ Create contact', { exact: true }).locator('visible=true').click()
    await expect(page.getByPlaceholder('First name').locator('visible=true')).toBeAttached(ATTACH)

    await page.getByPlaceholder('First name').locator('visible=true').fill(first)
    await page.getByPlaceholder('Last name').locator('visible=true').fill(last)
    await page.getByPlaceholder('email@example.com').locator('visible=true').fill(email)

    // The submit button reads "Create" (becomes "Creating..." while pending).
    await page.getByText('Create', { exact: true }).locator('visible=true').click()

    // Back on the list, the new contact must be present without any manual
    // refresh.
    await expect(page.getByText(/Contacts \(\d+\)/).first()).toBeAttached(ATTACH)
    await expect(page.getByText(first, { exact: false }).first()).toBeAttached(ATTACH)

    // And it's findable via search (exercises the same insert through FTS).
    await searchBox(page).fill('Zephyrina')
    await expect(page.getByText(first, { exact: false }).first()).toBeAttached(ATTACH)
})
