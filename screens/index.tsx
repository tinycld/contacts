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
import { useContactsShortcuts } from '../hooks/useContactsShortcuts'

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

    const { focusedId } = useContactsShortcuts({
        items: filteredContacts ?? [],
        isEnabled: true,
        listKey: `${filter ?? ''}:${activeLabelId ?? ''}:${useServerSearch ? 'search' : 'all'}`,
    })

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
                    isFocused={contact.id === focusedId}
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
            focusedId,
        ]
    )

    if (isLoading) {
        return (
            <View className="flex-1 p-5" style={{ backgroundColor: bgColor }}>
                <Text className="text-base" style={{ color: mutedColor }}>
                    Loading contacts...
                </Text>
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
        <View className="flex-1" style={{ backgroundColor: bgColor }}>
            <View className={`pb-0 ${isCompact ? 'p-3' : 'p-5'}`}>
                <View
                    className={`flex-row justify-between items-center ${isCompact ? 'mb-2 flex-wrap gap-2' : 'mb-4 flex-nowrap'}`}
                >
                    <Text
                        className="font-bold"
                        style={{
                            fontSize: isCompact ? 20 : 24,
                            color: fgColor,
                        }}
                    >
                        {title} ({count})
                    </Text>
                    <TextInput
                        placeholder="Search contacts..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        className="border rounded-lg px-3 py-2 text-sm"
                        style={{
                            width: isCompact ? '100%' : 250,
                            backgroundColor: bgColor,
                            borderColor: borderColor,
                            color: fgColor,
                        }}
                        placeholderTextColor={placeholderColor}
                    />
                </View>

                {isCompact ? null : <DataTableHeader columns={CONTACT_COLUMNS} />}
            </View>

            {count === 0 && (filter || activeLabelId) ? (
                <View className="flex-1 items-center justify-center p-10">
                    <Text className="text-base" style={{ color: mutedColor }}>
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
                        className="flex-1"
                    />
                </SwipeableRowProvider>
            )}
        </View>
    )
}
