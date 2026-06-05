import { describe, expect, it } from 'vitest'
import { type FilterableContact, filterContacts } from '../tinycld/contacts/hooks/filter-contacts'

function contact(over: Partial<FilterableContact> & { id: string }): FilterableContact {
    return {
        first_name: '',
        last_name: '',
        email: '',
        company: '',
        phone: '',
        favorite: false,
        ...over,
    }
}

const alice = contact({
    id: 'alice',
    first_name: 'Alice',
    last_name: 'Smith',
    email: 'alice@example.com',
    favorite: true,
})
const bob = contact({
    id: 'bob',
    first_name: 'Bob',
    last_name: 'Jones',
    email: 'bob@globex.io',
    company: 'Globex',
})
const carol = contact({
    id: 'carol',
    first_name: 'Carol',
    last_name: 'Nguyen',
    email: 'carol@initech.dev',
    favorite: true,
})

const everyone = [alice, bob, carol]

function ids(list: FilterableContact[]) {
    return list.map(c => c.id)
}

describe('filterContacts — browsing (no search)', () => {
    it('returns the full live list when no scope or query', () => {
        const out = filterContacts({
            contacts: everyone,
            serverSearchResults: undefined,
            useServerSearch: false,
            searchQuery: '',
            contactIdsForLabel: null,
        })
        expect(ids(out)).toEqual(['alice', 'bob', 'carol'])
    })

    it('returns [] (not crash) when the live list is still loading', () => {
        const out = filterContacts({
            contacts: undefined,
            serverSearchResults: undefined,
            useServerSearch: false,
            searchQuery: '',
            contactIdsForLabel: null,
        })
        expect(out).toEqual([])
    })

    it('scopes to favorites', () => {
        const out = filterContacts({
            contacts: everyone,
            serverSearchResults: undefined,
            useServerSearch: false,
            searchQuery: '',
            filter: 'favorites',
            contactIdsForLabel: null,
        })
        expect(ids(out)).toEqual(['alice', 'carol'])
    })

    it('scopes to a label', () => {
        const out = filterContacts({
            contacts: everyone,
            serverSearchResults: undefined,
            useServerSearch: false,
            searchQuery: '',
            contactIdsForLabel: new Set(['bob']),
        })
        expect(ids(out)).toEqual(['bob'])
    })
})

describe('filterContacts — client-side text filter (1-char / below server threshold)', () => {
    it('matches across name, email, and company', () => {
        const byName = filterContacts({
            contacts: everyone,
            serverSearchResults: undefined,
            useServerSearch: false,
            searchQuery: 'a', // 1 char → client path
            contactIdsForLabel: null,
        })
        // "a" appears in Alice, Carol (names), and bob@... no. Alice/Carol.
        expect(ids(byName).sort()).toEqual(['alice', 'carol'])

        const byCompany = filterContacts({
            contacts: everyone,
            serverSearchResults: undefined,
            useServerSearch: false,
            searchQuery: 'globex', // company name, unique to Bob
            contactIdsForLabel: null,
        })
        expect(ids(byCompany)).toEqual(['bob'])
    })

    it('trims whitespace-only queries to a no-op', () => {
        const out = filterContacts({
            contacts: everyone,
            serverSearchResults: undefined,
            useServerSearch: false,
            searchQuery: '   ',
            contactIdsForLabel: null,
        })
        expect(ids(out)).toEqual(['alice', 'bob', 'carol'])
    })
})

describe('filterContacts — server search path', () => {
    it('uses the server results, not the live list, when active', () => {
        const out = filterContacts({
            contacts: everyone,
            serverSearchResults: [bob],
            useServerSearch: true,
            searchQuery: 'globex',
            contactIdsForLabel: null,
        })
        expect(ids(out)).toEqual(['bob'])
    })

    it('returns [] (not the live list) while server results are loading', () => {
        const out = filterContacts({
            contacts: everyone,
            serverSearchResults: undefined,
            useServerSearch: true,
            searchQuery: 'globex',
            contactIdsForLabel: null,
        })
        expect(out).toEqual([])
    })

    // The reported bug: searching while scoped to Favorites / a label must still
    // honor that scope, instead of surfacing out-of-scope server matches.
    it('still applies the favorites scope to server results', () => {
        const out = filterContacts({
            contacts: everyone,
            // Server FTS matched both bob (not a favorite) and alice (favorite).
            serverSearchResults: [alice, bob],
            useServerSearch: true,
            searchQuery: 'example',
            filter: 'favorites',
            contactIdsForLabel: null,
        })
        expect(ids(out)).toEqual(['alice'])
    })

    it('still applies the label scope to server results', () => {
        const out = filterContacts({
            contacts: everyone,
            serverSearchResults: [alice, bob, carol],
            useServerSearch: true,
            searchQuery: 'e',
            contactIdsForLabel: new Set(['carol']),
        })
        expect(ids(out)).toEqual(['carol'])
    })
})

// Regression for "search then reset makes records disappear". We simulate the
// exact state transition the screen goes through and assert the visible set
// returns to the full in-scope list — never a smaller/stale set.
describe('filterContacts — search → reset transition restores the list', () => {
    const transitions: {
        name: string
        filter?: string
        label?: Set<string>
        expected: string[]
    }[] = [
        { name: 'unscoped', expected: ['alice', 'bob', 'carol'] },
        { name: 'favorites', filter: 'favorites', expected: ['alice', 'carol'] },
        { name: 'label', label: new Set(['bob']), expected: ['bob'] },
    ]

    for (const t of transitions) {
        it(`restores the full ${t.name} list after clearing the query`, () => {
            // 1. Active server search narrows to a single record.
            const searching = filterContacts({
                contacts: everyone,
                serverSearchResults: [bob],
                useServerSearch: true,
                searchQuery: 'globex',
                filter: t.filter,
                contactIdsForLabel: t.label ?? null,
            })
            expect(searching.length).toBeLessThanOrEqual(t.expected.length)

            // 2. User clears the field: searchQuery '', useServerSearch false,
            //    server results cleared by useApiSearch. The live list returns.
            const afterReset = filterContacts({
                contacts: everyone,
                serverSearchResults: [],
                useServerSearch: false,
                searchQuery: '',
                filter: t.filter,
                contactIdsForLabel: t.label ?? null,
            })
            expect(ids(afterReset)).toEqual(t.expected)
        })
    }
})
