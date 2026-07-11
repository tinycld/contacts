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
    highlight: string
}

interface ContactSearchResponse {
    items: ContactSearchResult[]
    total: number
}

interface UseContactSearchReturn {
    results: ContactSearchResult[]
    isSearching: boolean
}

const extractResults = (response: unknown) => (response as ContactSearchResponse).items

export function useContactSearch(query: string, deleted = false): UseContactSearchReturn {
    const options = useMemo(
        () => ({
            endpoint: '/api/contacts/search',
            extractResults,
            // On the Deleted view search within soft-deleted contacts; otherwise
            // the server scopes results to live contacts. Keep this in sync with
            // useContactList's isDeleted branch.
            buildQueryParams: (q: string): Record<string, string> => {
                const params: Record<string, string> = { q }
                if (deleted) params.deleted = 'true'
                return params
            },
        }),
        [deleted]
    )

    const { results, isSearching } = useApiSearch<ContactSearchResult>(query, options)

    return { results, isSearching }
}
