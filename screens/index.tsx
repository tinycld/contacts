import { eq, not } from '@tanstack/db'
import { useLiveQuery } from '@tanstack/react-db'
import { useActiveParams } from 'one'
import { useCallback, useMemo, useState } from 'react'
import { FlatList } from 'react-native'
import { Input, SizableText, XStack, YStack } from 'tamagui'
import { DataTableHeader } from '~/components/DataTableHeader'
import { EmptyState } from '~/components/EmptyState'
import { useMutation } from '~/lib/mutations'
import { useOrgHref } from '~/lib/org-routes'
import { useStore } from '~/lib/pocketbase'
import { useLabels } from '~/ui/hooks/useLabels'
import { ContactRow } from '../components/ContactRow'
import { useContactSearch } from '../hooks/useContactSearch'

const CONTACT_COLUMNS = [
    { label: 'Name', flex: 2 },
    { label: 'Email', flex: 2 },
    { label: 'Phone', flex: 1 },
]

export default function ContactListScreen() {
    const [contactsCollection] = useStore('contacts')
    const [assignmentsCollection] = useStore('label_assignments')
    const [searchQuery, setSearchQuery] = useState('')
    const orgHref = useOrgHref()
    const newContactHref = orgHref('contacts/new')
    const { filter, label: activeLabelId } = useActiveParams<{
        filter?: string
        label?: string
    }>()

    const { labelMap } = useLabels()

    const isDeleted = filter === 'deleted'

    const { data: contacts, isLoading } = useLiveQuery(query =>
        query
            .from({ contacts: contactsCollection })
            .where(({ contacts }) =>
                isDeleted ? not(eq(contacts.deleted_at, '')) : eq(contacts.deleted_at, '')
            )
            .orderBy(({ contacts }) => contacts.first_name, 'asc')
    )

    const { data: contactAssignments } = useLiveQuery(query =>
        query
            .from({ label_assignments: assignmentsCollection })
            .where(({ label_assignments }) => eq(label_assignments.collection, 'contacts'))
    )

    const toggleFavorite = useMutation({
        mutationFn: function* ({ id, currentFavorite }: { id: string; currentFavorite: boolean }) {
            yield contactsCollection.update(id, draft => {
                draft.favorite = !currentFavorite
            })
        },
    })

    const deleteContact = useMutation({
        mutationFn: function* (id: string) {
            yield contactsCollection.update(id, draft => {
                draft.deleted_at = new Date().toISOString()
            })
        },
    })

    const restoreContact = useMutation({
        mutationFn: function* (id: string) {
            yield contactsCollection.update(id, draft => {
                draft.deleted_at = ''
            })
        },
    })

    const permanentlyDeleteContact = useMutation({
        mutationFn: function* (id: string) {
            yield contactsCollection.delete(id)
        },
    })

    const useServerSearch = searchQuery.length >= 2
    const { results: serverResults } = useContactSearch(useServerSearch ? searchQuery : '')

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

    const filteredContacts = useMemo(() => {
        if (useServerSearch) return serverResults

        let list = contacts ?? []

        if (filter === 'favorites') {
            list = list.filter(c => c.favorite)
        }

        if (contactIdsForLabel) {
            list = list.filter(c => contactIdsForLabel.has(c.id))
        }

        const q = searchQuery.toLowerCase()
        if (q) {
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
    }, [useServerSearch, serverResults, searchQuery, contacts, filter, contactIdsForLabel])

    const count = filteredContacts?.length ?? 0

    const activeLabel = activeLabelId ? labelMap.get(activeLabelId) : null
    const title = activeLabel
        ? activeLabel.name
        : isDeleted
          ? 'Deleted'
          : filter === 'favorites'
            ? 'Favorites'
            : 'Contacts'

    const renderContact = useCallback(
        ({
            item: contact,
            index,
        }: {
            item: NonNullable<typeof filteredContacts>[number]
            index: number
        }) => {
            const labelIds = assignmentsByContact.get(contact.id)
            const contactLabels = labelIds
                ? Array.from(labelIds)
                      .map(id => labelMap.get(id))
                      .filter((l): l is { id: string; name: string; color: string } => l != null)
                : []

            return (
                <ContactRow
                    contact={contact}
                    labels={contactLabels}
                    onToggleFavorite={() =>
                        toggleFavorite.mutate({
                            id: contact.id,
                            currentFavorite: contact.favorite,
                        })
                    }
                    onDelete={() => deleteContact.mutate(contact.id)}
                    onRestore={isDeleted ? () => restoreContact.mutate(contact.id) : undefined}
                    onPermanentDelete={
                        isDeleted ? () => permanentlyDeleteContact.mutate(contact.id) : undefined
                    }
                    index={index}
                />
            )
        },
        [
            assignmentsByContact,
            labelMap,
            toggleFavorite,
            deleteContact,
            restoreContact,
            permanentlyDeleteContact,
            isDeleted,
        ]
    )

    if (isLoading) {
        return (
            <YStack flex={1} padding="$5" backgroundColor="$background">
                <SizableText size="$4" color="$color8">
                    Loading contacts...
                </SizableText>
            </YStack>
        )
    }

    const isEmpty = !contacts || contacts.length === 0

    if (isEmpty && !filter && !activeLabelId) {
        return (
            <EmptyState
                message="No contacts yet."
                action={{ label: '+ Add Contact', href: newContactHref }}
            />
        )
    }

    return (
        <YStack flex={1} backgroundColor="$background">
            <YStack padding="$5" paddingBottom={0}>
                <XStack justifyContent="space-between" alignItems="center" marginBottom="$4">
                    <SizableText size="$7" fontWeight="bold" color="$color">
                        {title} ({count})
                    </SizableText>
                    <Input
                        size="$3"
                        placeholder="Search contacts..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        width={250}
                        backgroundColor="$background"
                        borderColor="$borderColor"
                        placeholderTextColor="$placeholderColor"
                        color="$color"
                    />
                </XStack>

                <DataTableHeader columns={CONTACT_COLUMNS} />
            </YStack>

            {count === 0 && (filter || activeLabelId) ? (
                <YStack flex={1} alignItems="center" justifyContent="center" padding="$10">
                    <SizableText size="$4" color="$color8">
                        No {filter === 'favorites' ? 'favorite ' : ''}contacts
                        {activeLabel ? ` with label "${activeLabel.name}"` : ''}.
                    </SizableText>
                </YStack>
            ) : (
                <FlatList
                    data={filteredContacts ?? []}
                    keyExtractor={item => item.id}
                    renderItem={renderContact}
                    contentContainerStyle={{ paddingHorizontal: 24 }}
                    style={{ flex: 1 }}
                />
            )}
        </YStack>
    )
}
