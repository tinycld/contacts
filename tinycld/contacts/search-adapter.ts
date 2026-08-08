import { useOrgHref } from '@tinycld/core/lib/org-routes'
import type { SearchRow } from '@tinycld/core/lib/search/types'
import { useRouter } from 'expo-router'

// Row shaping (title, subtitle, meta) is the server's job — see contacts'
// search source in contacts/server. Normalizing there rather than here means
// the palette and the CLI render identical rows from one implementation; a
// TypeScript version could only ever serve the browser.
//
// What remains client-side is selection, which needs the router.

export function useSearchActions() {
    const router = useRouter()
    const orgHref = useOrgHref()
    return {
        onSelect: (row: SearchRow) => {
            router.push(orgHref('contacts/[id]', { id: row.id }))
        },
    }
}
