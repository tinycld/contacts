/**
 * Pure contact-list filtering, extracted from useContactList so it can be unit
 * tested without the pbtsdb / org-scope hook surface. This is the logic that
 * decides which contacts are visible given the active scope (favorites / label),
 * the current search term, and whether the server-search path is active.
 *
 * Invariant the tests pin down: the favorites/label/deleted scope is applied to
 * BOTH the live list and the server-search results, so toggling search on/off
 * only ever changes the set by the search term — never drops in-scope contacts
 * and never leaks out-of-scope ones (e.g. live contacts into the Deleted view).
 */

export interface FilterableContact {
    id: string
    first_name: string
    last_name: string
    email: string
    company: string
    phone: string
    favorite: boolean
    deleted_at: string
}

export interface ContactFilterParams {
    /** The full live contact list (already org-scoped). */
    contacts: FilterableContact[] | undefined
    /** Ranked results from the server FTS search, when active. */
    serverSearchResults: FilterableContact[] | undefined
    /** True when the search term is long enough to use the server path. */
    useServerSearch: boolean
    /** Raw search box value. */
    searchQuery: string
    /** Active route filter, e.g. 'favorites' | 'deleted'. */
    filter?: string
    /** Contact ids assigned the active label, or null when no label scope. */
    contactIdsForLabel: Set<string> | null
}

export function filterContacts(params: ContactFilterParams): FilterableContact[] {
    const {
        contacts,
        serverSearchResults,
        useServerSearch,
        searchQuery,
        filter,
        contactIdsForLabel,
    } = params

    let list: FilterableContact[] = useServerSearch ? (serverSearchResults ?? []) : (contacts ?? [])

    if (filter === 'favorites') {
        list = list.filter(c => c.favorite)
    }

    // The Deleted view shows only soft-deleted contacts; every other view shows
    // only live ones. The server-search path is told which scope to query, but
    // enforce it here too so neither path can leak the wrong set.
    if (filter === 'deleted') {
        list = list.filter(c => c.deleted_at !== '')
    } else {
        list = list.filter(c => c.deleted_at === '')
    }

    if (contactIdsForLabel) {
        list = list.filter(c => contactIdsForLabel.has(c.id))
    }

    // The server path has already matched the term; only the live list needs a
    // client-side text filter (this also covers 1-char queries below the server
    // threshold).
    const q = searchQuery.trim().toLowerCase()
    if (!useServerSearch && q) {
        list = list.filter(c => {
            const fullName = `${c.first_name} ${c.last_name}`.toLowerCase()
            return (
                fullName.includes(q) ||
                c.email?.toLowerCase().includes(q) ||
                c.company?.toLowerCase().includes(q)
            )
        })
    }

    return list
}
