import { eq } from '@tanstack/db'
import { useLiveQuery } from '@tanstack/react-db'
import { useParams } from 'one'
import { useMemo } from 'react'
import { FlatList } from 'react-native'
import { SizableText, YStack } from 'tamagui'
import { useBreakpoint } from '~/components/workspace/useBreakpoint'
import { useMutation } from '~/lib/mutations'
import { useStore } from '~/lib/pocketbase'
import { useCurrentRole } from '~/lib/use-current-role'
import { ComposeFAB } from '../components/ComposeFAB'
import { EmailListToolbar } from '../components/EmailListToolbar'
import { EmailRow } from '../components/EmailRow'
import type { ThreadListItem } from '../components/thread-list-item'
import { toThreadListItem } from '../components/thread-list-item'
import { useMailBulkActions } from '../hooks/useMailBulkActions'
import { useMailSelection } from '../hooks/useMailSelection'

function useQueryParams() {
    const { folder, label } = useParams<{ folder?: string; label?: string }>()
    return { folder: folder ?? null, label: label ?? null }
}

function EmptyState({ folderTitle, isVisible }: { folderTitle: string; isVisible: boolean }) {
    if (!isVisible) return null
    return (
        <YStack flex={1} alignItems="center" justifyContent="center" padding="$8">
            <SizableText size="$4" color="$color8">
                No conversations in {folderTitle}
            </SizableText>
        </YStack>
    )
}

export default function MailListScreen() {
    const { folder, label } = useQueryParams()
    const breakpoint = useBreakpoint()
    const { userOrgId } = useCurrentRole()

    const [threadStateCollection, threadsCollection, labelsCollection] = useStore(
        'mail_thread_state',
        'mail_threads',
        'mail_labels'
    )

    const { data: threadStates } = useLiveQuery(
        query =>
            query
                .from({ mail_thread_state: threadStateCollection })
                .where(({ mail_thread_state }) => eq(mail_thread_state.user_org, userOrgId))
                .orderBy(({ mail_thread_state }) => mail_thread_state.updated, 'desc'),
        [userOrgId]
    )

    const { data: threads } = useLiveQuery(
        query => query.from({ mail_threads: threadsCollection }),
        []
    )

    const { data: allLabels } = useLiveQuery(
        query => query.from({ mail_labels: labelsCollection }),
        []
    )

    const threadMap = useMemo(() => {
        const map = new Map<string, (typeof threads)[number]>()
        for (const t of threads ?? []) {
            map.set(t.id, t)
        }
        return map
    }, [threads])

    const labelMap = useMemo(() => {
        const map = new Map<string, { id: string; name: string; color: string }>()
        for (const l of allLabels ?? []) {
            map.set(l.id, l)
        }
        return map
    }, [allLabels])

    const items: ThreadListItem[] = useMemo(() => {
        if (!threadStates) return []

        const mapped = threadStates.map(state => {
            const thread = threadMap.get(state.thread)
            const labelIds: string[] = state.labels ?? []
            const stateLabels = labelIds
                .map((lid: string) => labelMap.get(lid))
                .filter((l): l is { id: string; name: string; color: string } => l != null)
            return toThreadListItem(state, thread, stateLabels)
        })

        if (label) {
            return mapped.filter(item => item.labels.some(l => l.id === label))
        }

        const activeFolder = folder ?? 'inbox'
        if (activeFolder === 'starred') {
            return mapped.filter(item => item.isStarred)
        }

        return mapped.filter(item => item.folder === activeFolder)
    }, [threadStates, threadMap, labelMap, folder, label])

    const selection = useMailSelection(items, folder, label)
    const bulkActions = useMailBulkActions(
        threadStateCollection,
        selection.selectedItems,
        selection.clearSelection
    )

    const allLabelsList = useMemo(() => {
        return Array.from(labelMap.values())
    }, [labelMap])

    const selectedItemLabelIds = useMemo(() => {
        if (selection.selectedItems.length === 0) return new Set<string>()
        const sets = selection.selectedItems.map(item => new Set(item.labels.map(l => l.id)))
        const firstIds = Array.from(sets[0])
        const intersection = new Set<string>(firstIds.filter(id => sets.every(s => s.has(id))))
        return intersection
    }, [selection.selectedItems])

    const toggleStar = useMutation({
        mutationFn: function* ({
            stateId,
            currentStarred,
        }: {
            stateId: string
            currentStarred: boolean
        }) {
            yield threadStateCollection.update(stateId, draft => {
                draft.is_starred = !currentStarred
            })
        },
    })

    const folderTitle = label
        ? 'Label'
        : (folder ?? 'inbox').charAt(0).toUpperCase() + (folder ?? 'inbox').slice(1)

    const isEmpty = items.length === 0
    const isMobile = breakpoint === 'mobile'

    return (
        <YStack flex={1}>
            <EmailListToolbar
                emailCount={items.length}
                hasSelection={selection.hasSelection}
                selectedCount={selection.selectedCount}
                allSelected={selection.allSelected}
                someSelected={selection.someSelected}
                allSelectedRead={selection.allSelectedRead}
                allSelectedStarred={selection.allSelectedStarred}
                labels={allLabelsList}
                selectedItemLabelIds={selectedItemLabelIds}
                onToggleAll={selection.toggleAll}
                onArchive={() => bulkActions.archiveSelected.mutate()}
                onSpam={() => bulkActions.spamSelected.mutate()}
                onTrash={() => bulkActions.trashSelected.mutate()}
                onToggleRead={markAsRead => bulkActions.toggleReadSelected.mutate({ markAsRead })}
                onMove={folder => bulkActions.moveSelected.mutate(folder)}
                onToggleStar={star => bulkActions.toggleStarSelected.mutate({ star })}
                onUpdateLabel={(labelId, add) =>
                    bulkActions.updateLabelsSelected.mutate({ labelId, add })
                }
            />
            <EmptyState folderTitle={folderTitle} isVisible={isEmpty} />
            {isEmpty ? null : (
                <FlatList
                    data={items}
                    keyExtractor={item => item.stateId}
                    renderItem={({ item }) => (
                        <EmailRow
                            email={item}
                            isMobile={isMobile}
                            isSelected={selection.selectedIds.has(item.stateId)}
                            onToggleSelect={() => selection.toggle(item.stateId)}
                            onToggleStar={() =>
                                toggleStar.mutate({
                                    stateId: item.stateId,
                                    currentStarred: item.isStarred,
                                })
                            }
                        />
                    )}
                />
            )}
            <ComposeFAB isVisible={isMobile} />
        </YStack>
    )
}
