import { useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import { FlatList, Text, TextInput, View } from 'react-native'
import { DataTableHeader } from '~/components/DataTableHeader'
import { EmptyState } from '~/components/EmptyState'
import { SwipeableRowProvider } from '~/components/SwipeableRow'
import { useBreakpoint } from '~/components/workspace/useBreakpoint'
import { useOrgHref } from '~/lib/org-routes'
import { useThemeColor } from '~/lib/use-app-theme'
import { useLabels } from '~/ui/hooks/useLabels'
import { ContactRow } from '../components/ContactRow'
import { useContactList } from '../hooks/useContactList'
import { useContactSearch } from '../hooks/useContactSearch'

const CONTACT_COLUMNS = [
    { label: 'Name', flex: 2 },
    { label: 'Email', flex: 2 },
    { label: 'Phone', flex: 1 },
]

export default function ContactListScreen() {
    const [searchQuery, setSearchQuery] = useState('')
    const orgHref = useOrgHref()
    const newContactHref = orgHref('contacts/new')
    const { filter, label: activeLabelId } = useLocalSearchParams<{
        filter?: string
        label?: string
    }>()

    const { labelMap } = useLabels()
    const isCompact = useBreakpoint() === 'mobile'
    const fgColor = useThemeColor('foreground')
    const mutedColor = useThemeColor('muted-foreground')
    const bgColor = useThemeColor('background')
    const borderColor = useThemeColor('border')
    const placeholderColor = useThemeColor('field-placeholder')

    const useServerSearch = searchQuery.length >= 2
    const { results: serverResults } = useContactSearch(useServerSearch ? searchQuery : '')

    const {
        contacts,
        filteredContacts,
        isLoading,
        isDeleted,
        assignmentsByContact,
        toggleFavorite,
        deleteContact,
        restoreContact,
        permanentlyDeleteContact,
    } = useContactList({
        filter,
        activeLabelId,
        searchQuery,
        serverSearchResults: serverResults,
    })

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
            <View style={{ flex: 1, padding: 20, backgroundColor: bgColor }}>
                <Text style={{ fontSize: 16, color: mutedColor }}>Loading contacts...</Text>
            </View>
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
        <View style={{ flex: 1, backgroundColor: bgColor }}>
            <View style={{ padding: isCompact ? 12 : 20, paddingBottom: 0 }}>
                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: isCompact ? 8 : 16,
                        flexWrap: isCompact ? 'wrap' : 'nowrap',
                        gap: isCompact ? 8 : 0,
                    }}
                >
                    <Text
                        style={{
                            fontSize: isCompact ? 20 : 24,
                            fontWeight: 'bold',
                            color: fgColor,
                        }}
                    >
                        {title} ({count})
                    </Text>
                    <TextInput
                        placeholder="Search contacts..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        style={{
                            width: isCompact ? '100%' : 250,
                            backgroundColor: bgColor,
                            borderColor: borderColor,
                            borderWidth: 1,
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            fontSize: 14,
                            color: fgColor,
                        }}
                        placeholderTextColor={placeholderColor}
                    />
                </View>

                {isCompact ? null : <DataTableHeader columns={CONTACT_COLUMNS} />}
            </View>

            {count === 0 && (filter || activeLabelId) ? (
                <View
                    style={{
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 40,
                    }}
                >
                    <Text style={{ fontSize: 16, color: mutedColor }}>
                        No {filter === 'favorites' ? 'favorite ' : ''}contacts
                        {activeLabel ? ` with label "${activeLabel.name}"` : ''}.
                    </Text>
                </View>
            ) : (
                <SwipeableRowProvider>
                    <FlatList
                        data={filteredContacts ?? []}
                        keyExtractor={item => item.id}
                        renderItem={renderContact}
                        contentContainerStyle={{ paddingHorizontal: isCompact ? 12 : 24 }}
                        style={{ flex: 1 }}
                    />
                </SwipeableRowProvider>
            )}
        </View>
    )
}
