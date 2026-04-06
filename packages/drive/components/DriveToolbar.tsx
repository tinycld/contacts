import {
    ChevronRight,
    Download,
    FolderInput,
    Grid,
    Link,
    List,
    MoreVertical,
    Search,
    Share2,
    Trash2,
    X,
} from 'lucide-react-native'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useTheme } from 'tamagui'
import { ToolbarIconButton } from '~/components/ToolbarIconButton'
import { useDrive } from '../hooks/useDrive'
import type { ViewMode } from '../types'

export function DriveToolbar() {
    const theme = useTheme()
    const {
        selectedItem,
        breadcrumbs,
        viewMode,
        setViewMode,
        selectItem,
        navigateToFolder,
        searchQuery,
        setSearchQuery,
        isSearching,
    } = useDrive()

    if (selectedItem) {
        return (
            <SelectionToolbar
                itemName={selectedItem.name}
                viewMode={viewMode}
                onSetViewMode={setViewMode}
                onClearSelection={() => selectItem(null)}
                theme={theme}
            />
        )
    }

    const isSearchActive = searchQuery.length >= 2

    return (
        <View style={[styles.toolbar, { borderBottomColor: theme.borderColor.val }]}>
            {isSearchActive ? (
                <Text style={[styles.searchLabel, { color: theme.color8.val }]}>
                    Search results{isSearching ? '...' : ''}
                </Text>
            ) : (
                <View style={styles.breadcrumbs}>
                    <Pressable onPress={() => navigateToFolder('')}>
                        <Text style={[styles.breadcrumbText, { color: theme.accentColor.val }]}>
                            My Drive
                        </Text>
                    </Pressable>
                    {breadcrumbs.map(crumb => (
                        <View key={crumb.id} style={styles.breadcrumbSegment}>
                            <ChevronRight size={14} color={theme.color8.val} />
                            <Pressable onPress={() => navigateToFolder(crumb.id)}>
                                <Text
                                    style={[
                                        styles.breadcrumbText,
                                        { color: theme.accentColor.val },
                                    ]}
                                >
                                    {crumb.name}
                                </Text>
                            </Pressable>
                        </View>
                    ))}
                </View>
            )}
            <View style={styles.rightSection}>
                <SearchInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    theme={theme}
                />
                <ViewToggle viewMode={viewMode} onSetViewMode={setViewMode} theme={theme} />
            </View>
        </View>
    )
}

interface SearchInputProps {
    value: string
    onChangeText: (text: string) => void
    theme: ReturnType<typeof useTheme>
}

function SearchInput({ value, onChangeText, theme }: SearchInputProps) {
    return (
        <View style={[styles.searchContainer, { borderColor: theme.borderColor.val }]}>
            <Search size={14} color={theme.color8.val} />
            <TextInput
                style={[styles.searchInput, { color: theme.color.val }]}
                placeholder="Search in Drive"
                placeholderTextColor={theme.color8.val}
                value={value}
                onChangeText={onChangeText}
            />
            {value.length > 0 && (
                <Pressable onPress={() => onChangeText('')} hitSlop={8}>
                    <X size={14} color={theme.color8.val} />
                </Pressable>
            )}
        </View>
    )
}

interface SelectionToolbarProps {
    itemName: string
    viewMode: ViewMode
    onSetViewMode: (mode: ViewMode) => void
    onClearSelection: () => void
    theme: ReturnType<typeof useTheme>
}

function SelectionToolbar({
    itemName,
    viewMode,
    onSetViewMode,
    onClearSelection,
    theme,
}: SelectionToolbarProps) {
    const actionIcons = [
        { key: 'share', icon: Share2, label: 'Share' },
        { key: 'download', icon: Download, label: 'Download' },
        { key: 'move', icon: FolderInput, label: 'Move' },
        { key: 'trash', icon: Trash2, label: 'Trash' },
        { key: 'link', icon: Link, label: 'Copy link' },
        { key: 'more', icon: MoreVertical, label: 'More actions' },
    ]

    return (
        <View style={[styles.toolbar, { borderBottomColor: theme.borderColor.val }]}>
            <View style={styles.selectionLeft}>
                <Pressable onPress={onClearSelection} style={styles.closeButton}>
                    <X size={16} color={theme.color8.val} />
                </Pressable>
                <Text style={[styles.selectionText, { color: theme.color.val }]} numberOfLines={1}>
                    {itemName}
                </Text>
            </View>
            <View style={styles.actions}>
                {actionIcons.map(({ key, icon, label }) => (
                    <ToolbarIconButton key={key} icon={icon} label={label} onPress={() => {}} />
                ))}
                <View style={[styles.actionDivider, { backgroundColor: theme.borderColor.val }]} />
                <ViewToggle viewMode={viewMode} onSetViewMode={onSetViewMode} theme={theme} />
            </View>
        </View>
    )
}

interface ViewToggleProps {
    viewMode: ViewMode
    onSetViewMode: (mode: ViewMode) => void
    theme: ReturnType<typeof useTheme>
}

function ViewToggle({ viewMode, onSetViewMode, theme }: ViewToggleProps) {
    return (
        <View style={styles.viewToggle}>
            <Pressable
                onPress={() => onSetViewMode('list')}
                style={[
                    styles.viewButton,
                    viewMode === 'list' && {
                        backgroundColor: `${theme.activeIndicator.val}18`,
                    },
                ]}
            >
                <List
                    size={18}
                    color={viewMode === 'list' ? theme.activeIndicator.val : theme.color8.val}
                />
            </Pressable>
            <Pressable
                onPress={() => onSetViewMode('grid')}
                style={[
                    styles.viewButton,
                    viewMode === 'grid' && {
                        backgroundColor: `${theme.activeIndicator.val}18`,
                    },
                ]}
            >
                <Grid
                    size={18}
                    color={viewMode === 'grid' ? theme.activeIndicator.val : theme.color8.val}
                />
            </Pressable>
        </View>
    )
}

const styles = StyleSheet.create({
    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    breadcrumbs: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 2,
    },
    breadcrumbSegment: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    breadcrumbText: {
        fontSize: 14,
        fontWeight: '500',
    },
    rightSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        width: 240,
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        padding: 0,
    },
    searchLabel: {
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    viewToggle: {
        flexDirection: 'row',
        gap: 2,
    },
    viewButton: {
        padding: 6,
        borderRadius: 6,
    },
    selectionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    closeButton: {
        padding: 4,
    },
    selectionText: {
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    actionDivider: {
        width: 1,
        height: 20,
        marginHorizontal: 4,
    },
})
