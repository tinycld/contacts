import { useOrgHref } from '@tinycld/core/lib/org-routes'
import type { SearchRow } from '@tinycld/core/lib/search/types'
import { useRouter } from 'expo-router'

interface ContactSearchHit {
    id: string
    first_name: string
    last_name: string
    email: string
    company: string
}

export function toRow(hit: unknown): Omit<SearchRow, 'slug'> | null {
    const c = hit as ContactSearchHit
    const name = [c.first_name, c.last_name].filter(Boolean).join(' ')
    return {
        id: c.id,
        title: name || c.email || 'Unnamed contact',
        subtitle: c.email || undefined,
        meta: c.company || undefined,
    }
}

export function useSearchActions() {
    const router = useRouter()
    const orgHref = useOrgHref()
    return {
        onSelect: (row: SearchRow) => {
            router.push(orgHref('contacts/[id]', { id: row.id }))
        },
    }
}
