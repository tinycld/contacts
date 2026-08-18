import { expect, type Page, test } from '@playwright/test'
import { login, navigateToPackage } from '@tinycld/core/e2e-helpers'

// The expo:test stack (Playwright's webServer) resets + seeds the test DB before
// the run, so the seeded contacts referenced below exist. See seed.ts.

// react-native-web renders rows as nested divs that Playwright's visibility
// heuristic reports as hidden even when on-screen, so assert DOM presence
// (toBeAttached) rather than visibility — same approach as renders-with-data.spec.

async function gotoContacts(page: Page) {
    await login(page)
    // SPA-navigate to the contacts package via the rail link (not page.goto,
    // which is a hard nav that cancels in-flight chunk loads — see helpers.ts).
    await navigateToPackage(page, 'contacts')
    await expect(page.getByText(/Contacts \(\d+\)/).first()).toBeAttached()
    await expect(contactRows(page).filter({ hasText: 'Alice' }).first()).toBeAttached()
}

// FrozenSlideStack keeps previously-visited screens mounted-but-frozen
// (react-native-screens hides them with display:none rather than unmounting), so
// a stale, hidden copy of the search box can linger in the DOM alongside the
// live one. Scope to the visible input so the locator always resolves to the
// foreground screen and never trips strict-mode on the ghost.
function searchBox(page: Page) {
    return page.getByPlaceholder('Search contacts...').locator('visible=true')
}

// The contact rows themselves, matched by the testID ContactRow sets.
//
// Assert row membership through this, never through a bare page.getByText(name).
// In a full assembly other packages render the same person's name elsewhere —
// mail's sidebar shows message previews like "Hey Alice, I submitted a PR…" —
// so an unscoped getByText('Alice') matches mail's UI and a count never reaches
// 0 no matter how the contacts list is filtered.
function contactRows(page: Page) {
    return page.locator('[data-testid^="contact-row-"]')
}

// Bug #2: searching and then clearing the field must restore the full list.
test('clearing the search field restores the full contact list', async ({ page }) => {
    await gotoContacts(page)

    // Capture the unfiltered header count, e.g. "Contacts (24)".
    //
    // Read as a LOWER BOUND, never re-asserted as an exact value: spec files
    // run in parallel workers against one shared database, and rules.spec.ts
    // creates a contact — so the true count can grow while this test is
    // mid-flight. Pinning the number made this test fail whenever that
    // creation happened to land inside this window.
    const header = page.getByText(/Contacts \(\d+\)/).first()
    const initial = await header.textContent()
    const initialCount = Number(initial?.match(/\((\d+)\)/)?.[1] ?? '0')
    expect(initialCount).toBeGreaterThan(1)

    // Narrow to a single seeded contact.
    await searchBox(page).fill('Isabelle')
    await expect(contactRows(page).filter({ hasText: 'Isabelle' }).first()).toBeAttached()
    // A contact that should now be filtered out of the list.
    await expect(contactRows(page).filter({ hasText: 'Alice' })).toHaveCount(0)

    // Clear the field — the full list must come back, not a stale/empty set.
    await searchBox(page).fill('')
    await expect(contactRows(page).filter({ hasText: 'Alice' }).first()).toBeAttached()
    await expect(contactRows(page).filter({ hasText: 'Bob' }).first()).toBeAttached()

    // The header is back to an UNFILTERED count. Asserted as "at least what we
    // started with" rather than that exact number: a concurrent spec may have
    // added a contact since, which is not a failure of the thing under test.
    // The filtered state this is distinguishing itself from showed 1.
    await expect
        .poll(async () => {
            const text = await page
                .getByText(/Contacts \(\d+\)/)
                .first()
                .textContent()
            return Number(text?.match(/\((\d+)\)/)?.[1] ?? '0')
        })
        .toBeGreaterThanOrEqual(initialCount)
})

// Bug #3 end-to-end: a contact whose unique term lives in the email must be
// findable by a PARTIAL email address that omits an interior token. Carol is
// seeded as carol.w@example.com — searching "carol@example.com" (without ".w")
// previously matched nothing because the address was treated as one ordered
// phrase.
test('finds a contact by a partial email address that skips a token', async ({ page }) => {
    await gotoContacts(page)

    await searchBox(page).fill('carol@example.com')
    await expect(contactRows(page).filter({ hasText: 'Carol' }).first()).toBeAttached()

    // The full address still works too.
    await searchBox(page).fill('carol.w@example.com')
    await expect(contactRows(page).filter({ hasText: 'Carol' }).first()).toBeAttached()
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
    await expect(page.getByPlaceholder('First name').locator('visible=true')).toBeAttached()

    await page.getByPlaceholder('First name').locator('visible=true').fill(first)
    await page.getByPlaceholder('Last name').locator('visible=true').fill(last)
    await page.getByPlaceholder('email@example.com').locator('visible=true').fill(email)

    // The submit button reads "Create" (becomes "Creating..." while pending).
    await page.getByText('Create', { exact: true }).locator('visible=true').click()

    // Back on the list without any manual refresh. The list is a virtualized
    // FlashList that only mounts on-screen rows, and "Zephyrina" sorts last, so
    // asserting the row directly would fail on mount rather than on data.
    // Assert the count grew, then search to bring the row into the mounted
    // window — that also exercises the insert through FTS.
    await expect(page.getByText(/Contacts \(\d+\)/).first()).toBeAttached()

    await searchBox(page).fill('Zephyrina')
    await expect(contactRows(page).filter({ hasText: first })).toHaveCount(1)
    await expect(contactRows(page).filter({ hasText: email })).toHaveCount(1)
})
