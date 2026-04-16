import { useRouter } from 'expo-router'
import { useMemo, useRef } from 'react'
import { useOrgHref } from '~/lib/org-routes'
import { type Shortcut, useRegisterShortcuts, useShortcutScope } from '~/lib/shortcuts'
import { useContactsUIStore } from '../stores/contacts-ui-store'

interface ContactItem {
    id: string
}

interface UseContactsShortcutsArgs {
    items: ContactItem[]
    isEnabled: boolean
    /** Identifier for the current listing — resets focus when it changes. */
    listKey: string
}

export function useContactsShortcuts({ items, isEnabled, listKey }: UseContactsShortcutsArgs) {
    const storedIndex = useContactsUIStore(s => s.focusedIndex)
    const setFocusedIndex = useContactsUIStore(s => s.setFocusedIndex)
    const router = useRouter()
    const orgHref = useOrgHref()

    useShortcutScope('list')

    const prevListKeyRef = useRef(listKey)
    if (listKey !== prevListKeyRef.current) {
        prevListKeyRef.current = listKey
        if (storedIndex !== 0) setFocusedIndex(0)
    }

    const focusedIndex = items.length === 0 ? 0 : Math.min(storedIndex, items.length - 1)
    const focusedId = items[focusedIndex]?.id ?? null

    const shortcuts = useMemo<Shortcut[]>(() => {
        if (!isEnabled) return []
        return [
            {
                id: 'contacts.list.next',
                keys: 'j',
                scope: 'list',
                group: 'Contacts',
                description: 'Next contact',
                run: () => setFocusedIndex(i => Math.min(i + 1, Math.max(items.length - 1, 0))),
            },
            {
                id: 'contacts.list.prev',
                keys: 'k',
                scope: 'list',
                group: 'Contacts',
                description: 'Previous contact',
                run: () => setFocusedIndex(i => Math.max(i - 1, 0)),
            },
            {
                id: 'contacts.list.open',
                keys: 'Enter',
                scope: 'list',
                group: 'Contacts',
                description: 'Open contact',
                run: () => {
                    if (!focusedId) return
                    router.push(orgHref('contacts/[id]', { id: focusedId }))
                },
            },
            {
                id: 'contacts.list.new',
                keys: 'c',
                scope: 'list',
                group: 'Contacts',
                description: 'New contact',
                run: () => router.push(orgHref('contacts/new')),
            },
        ]
    }, [isEnabled, items.length, focusedId, orgHref, router, setFocusedIndex])

    useRegisterShortcuts(shortcuts)

    return { focusedIndex, focusedId }
}
