import {
    Archive,
    ChevronLeft,
    ChevronRight,
    CircleAlert,
    FolderInput,
    Mail,
    MailOpen,
    MoreVertical,
    RefreshCw,
    Square,
    SquareCheck,
    SquareMinus,
    Star,
    Tag,
    Trash2,
} from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from 'tamagui'
import { useBreakpoint } from '~/components/workspace/useBreakpoint'
import type { MailThreadState } from '../types'
import { DropdownMenu, DropdownMenuItem } from './DropdownMenu'
import { ToolbarIconButton } from './ToolbarIconButton'

interface LabelInfo {
    id: string
    name: string
    color: string
}

interface EmailListToolbarProps {
    emailCount: number
    hasSelection: boolean
    selectedCount: number
    allSelected: boolean
    someSelected: boolean
    allSelectedRead: boolean
    allSelectedStarred: boolean
    labels: LabelInfo[]
    selectedItemLabelIds: Set<string>
    onToggleAll: () => void
    onArchive: () => void
    onSpam: () => void
    onTrash: () => void
    onToggleRead: (markAsRead: boolean) => void
    onMove: (folder: MailThreadState['folder']) => void
    onToggleStar: (star: boolean) => void
    onUpdateLabel: (labelId: string, add: boolean) => void
}

export function EmailListToolbar(props: EmailListToolbarProps) {
    const breakpoint = useBreakpoint()

    if (breakpoint === 'mobile') return null

    if (props.hasSelection) return <BulkActionsToolbar {...props} />
    return <DefaultToolbar {...props} />
}

function DefaultToolbar({ emailCount, onToggleAll }: EmailListToolbarProps) {
    const theme = useTheme()

    const paginationText =
        emailCount > 0 ? `1\u2013${emailCount} of ${emailCount}` : 'No conversations'

    return (
        <View style={[styles.toolbar, { borderBottomColor: theme.borderColor.val }]}>
            <View style={styles.left}>
                <Pressable style={styles.checkbox} onPress={onToggleAll}>
                    <Square size={18} color={theme.color8.val} />
                </Pressable>
                <ToolbarIconButton icon={RefreshCw} label="Refresh" onPress={() => {}} />
                <ToolbarIconButton icon={MoreVertical} label="More" onPress={() => {}} />
            </View>
            <View style={styles.right}>
                <Text style={[styles.paginationText, { color: theme.color8.val }]}>
                    {paginationText}
                </Text>
                <ToolbarIconButton icon={ChevronLeft} label="Newer" onPress={() => {}} />
                <ToolbarIconButton icon={ChevronRight} label="Older" onPress={() => {}} />
            </View>
        </View>
    )
}

function BulkActionsToolbar({
    emailCount,
    selectedCount,
    allSelected,
    someSelected,
    allSelectedRead,
    allSelectedStarred,
    labels,
    selectedItemLabelIds,
    onToggleAll,
    onArchive,
    onSpam,
    onTrash,
    onToggleRead,
    onMove,
    onToggleStar,
    onUpdateLabel,
}: EmailListToolbarProps) {
    const theme = useTheme()
    const [openMenu, setOpenMenu] = useState<'move' | 'labels' | 'more' | null>(null)

    const SelectIcon = allSelected ? SquareCheck : someSelected ? SquareMinus : Square

    const paginationText =
        emailCount > 0 ? `1\u2013${emailCount} of ${emailCount}` : 'No conversations'

    const ReadIcon = allSelectedRead ? MailOpen : Mail
    const readLabel = allSelectedRead ? 'Mark as unread' : 'Mark as read'

    return (
        <View style={[styles.toolbar, { borderBottomColor: theme.borderColor.val }]}>
            <View style={styles.left}>
                <Pressable style={styles.checkbox} onPress={onToggleAll}>
                    <SelectIcon size={18} color={theme.accentBackground.val} />
                </Pressable>
                <Text style={[styles.selectedText, { color: theme.color.val }]}>
                    {selectedCount} selected
                </Text>
                <ToolbarIconButton icon={Archive} label="Archive" onPress={onArchive} />
                <ToolbarIconButton icon={CircleAlert} label="Report spam" onPress={onSpam} />
                <ToolbarIconButton icon={Trash2} label="Delete" onPress={onTrash} />
                <Text style={[styles.separator, { color: theme.color8.val }]}>|</Text>
                <ToolbarIconButton
                    icon={ReadIcon}
                    label={readLabel}
                    onPress={() => onToggleRead(!allSelectedRead)}
                />
                <View style={styles.menuAnchor}>
                    <ToolbarIconButton
                        icon={FolderInput}
                        label="Move to"
                        onPress={() => setOpenMenu(openMenu === 'move' ? null : 'move')}
                    />
                    <MoveToDropdown
                        isVisible={openMenu === 'move'}
                        onClose={() => setOpenMenu(null)}
                        onMove={folder => {
                            onMove(folder)
                            setOpenMenu(null)
                        }}
                    />
                </View>
                <View style={styles.menuAnchor}>
                    <ToolbarIconButton
                        icon={Tag}
                        label="Labels"
                        onPress={() => setOpenMenu(openMenu === 'labels' ? null : 'labels')}
                    />
                    <LabelsDropdown
                        isVisible={openMenu === 'labels'}
                        onClose={() => setOpenMenu(null)}
                        labels={labels}
                        selectedItemLabelIds={selectedItemLabelIds}
                        onUpdateLabel={(labelId, add) => {
                            onUpdateLabel(labelId, add)
                            setOpenMenu(null)
                        }}
                    />
                </View>
                <View style={styles.menuAnchor}>
                    <ToolbarIconButton
                        icon={MoreVertical}
                        label="More"
                        onPress={() => setOpenMenu(openMenu === 'more' ? null : 'more')}
                    />
                    <MoreDropdown
                        isVisible={openMenu === 'more'}
                        onClose={() => setOpenMenu(null)}
                        allSelectedRead={allSelectedRead}
                        allSelectedStarred={allSelectedStarred}
                        onToggleRead={() => {
                            onToggleRead(!allSelectedRead)
                            setOpenMenu(null)
                        }}
                        onToggleStar={() => {
                            onToggleStar(!allSelectedStarred)
                            setOpenMenu(null)
                        }}
                    />
                </View>
            </View>
            <View style={styles.right}>
                <Text style={[styles.paginationText, { color: theme.color8.val }]}>
                    {paginationText}
                </Text>
                <ToolbarIconButton icon={ChevronLeft} label="Newer" onPress={() => {}} />
                <ToolbarIconButton icon={ChevronRight} label="Older" onPress={() => {}} />
            </View>
        </View>
    )
}

const MOVE_FOLDERS: { label: string; folder: MailThreadState['folder'] }[] = [
    { label: 'Inbox', folder: 'inbox' },
    { label: 'Sent', folder: 'sent' },
    { label: 'Drafts', folder: 'drafts' },
    { label: 'Spam', folder: 'spam' },
    { label: 'Trash', folder: 'trash' },
    { label: 'Archive', folder: 'archive' },
]

function MoveToDropdown({
    isVisible,
    onClose,
    onMove,
}: {
    isVisible: boolean
    onClose: () => void
    onMove: (folder: MailThreadState['folder']) => void
}) {
    return (
        <DropdownMenu isVisible={isVisible} onClose={onClose}>
            {MOVE_FOLDERS.map(({ label, folder }) => (
                <DropdownMenuItem key={folder} label={label} onPress={() => onMove(folder)} />
            ))}
        </DropdownMenu>
    )
}

function LabelsDropdown({
    isVisible,
    onClose,
    labels,
    selectedItemLabelIds,
    onUpdateLabel,
}: {
    isVisible: boolean
    onClose: () => void
    labels: LabelInfo[]
    selectedItemLabelIds: Set<string>
    onUpdateLabel: (labelId: string, add: boolean) => void
}) {
    return (
        <DropdownMenu isVisible={isVisible} onClose={onClose}>
            {labels.map(label => {
                const isActive = selectedItemLabelIds.has(label.id)
                return (
                    <DropdownMenuItem
                        key={label.id}
                        label={label.name}
                        colorDot={label.color}
                        isActive={isActive}
                        onPress={() => onUpdateLabel(label.id, !isActive)}
                    />
                )
            })}
        </DropdownMenu>
    )
}

function MoreDropdown({
    isVisible,
    onClose,
    allSelectedRead,
    allSelectedStarred,
    onToggleRead,
    onToggleStar,
}: {
    isVisible: boolean
    onClose: () => void
    allSelectedRead: boolean
    allSelectedStarred: boolean
    onToggleRead: () => void
    onToggleStar: () => void
}) {
    return (
        <DropdownMenu isVisible={isVisible} onClose={onClose}>
            <DropdownMenuItem
                label={allSelectedRead ? 'Mark as unread' : 'Mark as read'}
                icon={allSelectedRead ? MailOpen : Mail}
                onPress={onToggleRead}
            />
            <DropdownMenuItem
                label={allSelectedStarred ? 'Remove star' : 'Add star'}
                icon={Star}
                onPress={onToggleStar}
            />
        </DropdownMenu>
    )
}

const styles = StyleSheet.create({
    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 44,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        overflow: 'visible',
        zIndex: 1,
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        overflow: 'visible',
    },
    right: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    checkbox: {
        padding: 8,
    },
    selectedText: {
        fontSize: 13,
        marginHorizontal: 4,
    },
    separator: {
        fontSize: 18,
        marginHorizontal: 4,
    },
    paginationText: {
        fontSize: 12,
        marginRight: 4,
    },
    menuAnchor: {
        position: 'relative',
        overflow: 'visible',
        zIndex: 100,
    },
})
