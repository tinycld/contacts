import { and, eq, gt } from '@tanstack/db'
import { mutation, useMutation } from '@tinycld/core/lib/mutations'
import { useStore } from '@tinycld/core/lib/pocketbase'
import { useMyLiveQuery } from '@tinycld/core/lib/use-my-live-query'
import { useMemo } from 'react'
import { type SortField, useContactsUIStore } from '../stores/contacts-ui-store'
import { filterContacts } from './filter-contacts'
import type { ContactSearchResult } from './useContactSearch'

function sortAccessor(contacts: Record<SortField, unknown>, field: SortField) {
    switch (field) {
        case 'first_name':
            return contacts.first_name
        case 'last_name':
            return contacts.last_name
        case 'email':
            return contacts.email
        case 'phone':
            return contacts.phone
        case 'company':
            return contacts.company
    }
}

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

    // Sort applies to the client list query. The server-search path returns
    // results in its own ranked order; we don't reorder those.
    const sortField = useContactsUIStore(s => s.sortField)
    const sortDirection = useContactsUIStore(s => s.sortDirection)

    const { data: contacts, isLoading } = useMyLiveQuery(
        (query, { userId }) =>
            query
                .from({ contacts: contactsCollection })
                .where(({ contacts }) =>
                    and(
                        eq(contacts.owner, userId),
                        // pbtsdb compiles `not(...)` to `!(...)`, which
                        // PocketBase rejects — so "deleted" is spelled
                        // positively. `deleted_at` is either '' (active) or
                        // an ISO timestamp (deleted); `isNull` wouldn't
                        // match the empty-string sentinel, but any
                        // non-empty date string sorts after '' lexically,
                        // so `> ''` selects exactly the deleted rows.
                        isDeleted ? gt(contacts.deleted_at, '') : eq(contacts.deleted_at, '')
                    )
                )
                .orderBy(({ contacts }) => sortAccessor(contacts, sortField), sortDirection),
        [isDeleted, sortField, sortDirection]
    )

    const { data: contactAssignments } = useMyLiveQuery((query, { userId }) =>
        query
            .from({ label_assignments: assignmentsCollection })
            .where(({ label_assignments }) =>
                and(
                    eq(label_assignments.collection, 'contacts'),
                    eq(label_assignments.user, userId)
                )
            )
    )

    const toggleFavorite = useMutation({
        mutationFn: mutation(function* ({
            id,
            currentFavorite,
        }: {
            id: string
            currentFavorite: boolean
        }) {
            yield contactsCollection.update(id, draft => {
                draft.favorite = !currentFavorite
            })
        }),
    })

    const deleteContact = useMutation({
        mutationFn: mutation(function* (id: string) {
            yield contactsCollection.update(id, draft => {
                draft.deleted_at = new Date().toISOString()
            })
        }),
    })

    const restoreContact = useMutation({
        mutationFn: mutation(function* (id: string) {
            yield contactsCollection.update(id, draft => {
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
    const filteredContacts = useMemo(
        () =>
            filterContacts({
                contacts,
                serverSearchResults,
                useServerSearch,
                searchQuery,
                filter,
                contactIdsForLabel,
            }),
        [useServerSearch, serverSearchResults, searchQuery, contacts, filter, contactIdsForLabel]
    )

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
