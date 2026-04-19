import { and, eq, not } from '@tanstack/db'
import { useMemo } from 'react'
import { mutation, useMutation } from '~/lib/mutations'
import { useStore } from '~/lib/pocketbase'
import { useOrgLiveQuery } from '~/lib/use-org-live-query'
import type { ContactSearchResult } from './useContactSearch'

export function useContactList(params: {
    filter?: string
    activeLabelId?: string
    searchQuery: string
    serverSearchResults?: ContactSearchResult[]
}) {
    const { filter, activeLabelId, searchQuery, serverSearchResults } = params
    const [contactsCollection] = useStore('contacts')
    const [assignmentsCollection] = useStore('label_assignments')

    const isDeleted = filter === 'deleted'

    const { data: contacts, isLoading } = useOrgLiveQuery(
        (query, { userOrgId }) =>
            query
                .from({ contacts: contactsCollection })
                .where(({ contacts }) =>
                    and(
                        eq(contacts.owner, userOrgId),
                        isDeleted ? not(eq(contacts.deleted_at, '')) : eq(contacts.deleted_at, '')
                    )
                )
                .orderBy(({ contacts }) => contacts.first_name, 'asc'),
        [isDeleted]
    )

    const { data: contactAssignments } = useOrgLiveQuery((query, { userOrgId }) =>
        query
            .from({ label_assignments: assignmentsCollection })
            .where(({ label_assignments }) =>
                and(eq(label_assignments.collection, 'contacts'), eq(label_assignments.user_org, userOrgId))
            )
    )

    const toggleFavorite = useMutation({
        mutationFn: mutation(function* ({ id, currentFavorite }: { id: string; currentFavorite: boolean }) {
            yield contactsCollection.update(id, (draft) => {
                draft.favorite = !currentFavorite
            })
        }),
    })

    const deleteContact = useMutation({
        mutationFn: mutation(function* (id: string) {
            yield contactsCollection.update(id, (draft) => {
                draft.deleted_at = new Date().toISOString()
            })
        }),
    })

    const restoreContact = useMutation({
        mutationFn: mutation(function* (id: string) {
            yield contactsCollection.update(id, (draft) => {
                draft.deleted_at = ''
            })
        }),
    })

    const permanentlyDeleteContact = useMutation({
        mutationFn: mutation(function* (id: string) {
            yield contactsCollection.delete(id)
        }),
    })

    const assignmentsByContact = useMemo(() => {
        const map = new Map<string, Set<string>>()
        for (const a of contactAssignments ?? []) {
            const existing = map.get(a.record_id)
            if (existing) {
                existing.add(a.label)
            } else {
                map.set(a.record_id, new Set([a.label]))
            }
        }
        return map
    }, [contactAssignments])

    const contactIdsForLabel = useMemo(() => {
        if (!activeLabelId) return null
        const ids = new Set<string>()
        for (const a of contactAssignments ?? []) {
            if (a.label === activeLabelId) ids.add(a.record_id)
        }
        return ids
    }, [activeLabelId, contactAssignments])

    const useServerSearch = searchQuery.length >= 2
    const filteredContacts = useMemo(() => {
        if (useServerSearch) return serverSearchResults

        let list = contacts ?? []

        if (filter === 'favorites') {
            list = list.filter((c) => c.favorite)
        }

        if (contactIdsForLabel) {
            list = list.filter((c) => contactIdsForLabel.has(c.id))
        }

        const q = searchQuery.toLowerCase()
        if (q) {
            list = list.filter((c) => {
                const fullName = `${c.first_name} ${c.last_name}`.toLowerCase()
                return (
                    fullName.includes(q) || c.email?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q)
                )
            })
        }

        return list
    }, [useServerSearch, serverSearchResults, searchQuery, contacts, filter, contactIdsForLabel])

    return {
        contacts,
        filteredContacts,
        isLoading,
        isDeleted,
        assignmentsByContact,
        toggleFavorite,
        deleteContact,
        restoreContact,
        permanentlyDeleteContact,
    }
}
