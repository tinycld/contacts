import { useApiSearch } from '@tinycld/core/lib/use-api-search'
import { useMemo } from 'react'

export interface ContactSearchResult {
    id: string
    first_name: string
    last_name: string
    email: string
    company: string
    phone: string
    favorite: boolean
    deleted_at: string
}

/** One row of core's federated search response. */
interface SearchRow {
    slug: string
    id: string
    title: string
    subtitle?: string
    meta?: string
    fields?: Record<string, unknown>
}

interface FederatedSearchResponse {
    rows: SearchRow[]
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

/**
 * Map a federated row back to the contact shape this screen sorts and renders.
 *
 * The list sorts by first_name/last_name/email/phone/company, which a display
 * row (title, subtitle, meta) cannot express — so contacts' search source puts
 * those columns in `fields`. Reading them here keeps the screen's behavior
 * identical while the request goes through one endpoint.
 */
const extractResults = (response: unknown): ContactSearchResult[] =>
    ((response as FederatedSearchResponse).rows ?? []).map(row => ({
        id: row.id,
        first_name: str(row.fields?.first_name),
        last_name: str(row.fields?.last_name),
        email: str(row.fields?.email),
        company: str(row.fields?.company),
        phone: str(row.fields?.phone),
        favorite: row.fields?.favorite === true,
        // Soft-deleted contacts are never returned by the federated source, so
        // a row that arrives here is live by construction. Searching the Trash
        // view was an unintended capability of the old per-package endpoint.
        deleted_at: '',
    }))

/**
 * Search contacts through core's federated endpoint, scoped to this package.
 *
 * Scoped rather than a contacts-only route: one search implementation serves the
 * palette, this screen, and the CLI, so a change to how a contact is matched or
 * ranked cannot apply to one of them and not the others.
 */
export function useContactSearch(query: string): UseContactSearchReturn {
    const options = useMemo(
        () => ({
            endpoint: '/api/search',
            extractResults,
            buildQueryParams: (q: string): Record<string, string> => ({
                q,
                pkg: 'contacts',
            }),
        }),
        []
    )

    const { results, isSearching } = useApiSearch<ContactSearchResult>(query, options)

    return { results, isSearching }
}

interface UseContactSearchReturn {
    results: ContactSearchResult[]
    isSearching: boolean
}
