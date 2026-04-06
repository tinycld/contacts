import { eq } from '@tanstack/db'
import { useLiveQuery } from '@tanstack/react-db'
import { newRecordId } from 'pbtsdb'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useMutation } from '~/lib/mutations'
import { useStore } from '~/lib/pocketbase'
import { useCurrentUserOrg } from '~/lib/use-current-user-org'
import { useOrgInfo } from '~/lib/use-org-info'
import { mimeTypeToCategory } from '../components/file-icons'
import type { DriveItemView, FolderTreeNode, SidebarSection, ViewMode } from '../types'
import { useDriveSearch } from './useDriveSearch'
import { useFileUpload } from './useFileUpload'

interface DriveContextValue {
    currentFolderId: string
    activeSection: SidebarSection
    selectedItemId: string | null
    viewMode: ViewMode
    currentItems: DriveItemView[]
    breadcrumbs: DriveItemView[]
    selectedItem: DriveItemView | undefined
    folderTree: FolderTreeNode[]
    totalStorageUsed: number
    isLoading: boolean
    searchQuery: string
    setSearchQuery: (query: string) => void
    isSearching: boolean
    navigateToFolder: (folderId: string) => void
    navigateToSection: (section: SidebarSection) => void
    selectItem: (itemId: string | null) => void
    setViewMode: (mode: ViewMode) => void
    openItem: (item: DriveItemView) => void
    toggleStar: (itemId: string) => void
    moveToTrash: (itemId: string) => void
    restoreFromTrash: (itemId: string) => void
    uploadFiles: (files: File[]) => void
    isUploading: boolean
    uploadingFiles: { name: string; status: 'pending' | 'uploading' | 'done' | 'error' }[]
    triggerFilePicker: () => void
    uploadNewVersion: (itemId: string, file: File) => Promise<void>
}

export const DriveContext = createContext<DriveContextValue | null>(null)

export function useDrive(): DriveContextValue {
    const ctx = useContext(DriveContext)
    if (!ctx) throw new Error('useDrive must be used within DriveProvider')
    return ctx
}

export function useDriveState(): DriveContextValue {
    const { orgSlug, orgId } = useOrgInfo()
    const userOrg = useCurrentUserOrg(orgSlug)
    const userOrgId = userOrg?.id ?? ''

    const [itemsCollection] = useStore('drive_items')
    const [sharesCollection] = useStore('drive_shares')
    const [stateCollection] = useStore('drive_item_state')
    const [userOrgCollection] = useStore('user_org')

    const [currentFolderId, setCurrentFolderId] = useState('')
    const [activeSection, setActiveSection] = useState<SidebarSection>('my-drive')
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
    const [viewMode, setViewMode] = useState<ViewMode>('list')
    const [searchQuery, setSearchQuery] = useState('')

    const isSearchActive = searchQuery.length >= 2
    const { results: searchResults, isSearching } = useDriveSearch(
        isSearchActive ? searchQuery : '',
        orgId
    )

    const { data: rawItems } = useLiveQuery(
        query => query.from({ item: itemsCollection }).where(({ item }) => eq(item.org, orgId)),
        [orgId]
    )

    const { data: rawShares } = useLiveQuery(query => query.from({ share: sharesCollection }), [])

    const { data: rawStates } = useLiveQuery(
        query =>
            query
                .from({ state: stateCollection })
                .where(({ state }) => eq(state.user_org, userOrgId)),
        [userOrgId]
    )

    const { data: orgUserOrgs } = useLiveQuery(
        query => query.from({ uo: userOrgCollection }).where(({ uo }) => eq(uo.org, orgId)),
        [orgId]
    )

    const userOrgNames = useMemo(
        () =>
            new Map(
                (orgUserOrgs ?? []).map(uo => [
                    uo.id,
                    uo.expand?.user?.name || uo.expand?.user?.email || '',
                ])
            ),
        [orgUserOrgs]
    )

    const sharesByItem = useMemo(() => {
        const map = new Map<string, typeof rawShares>()
        for (const share of rawShares ?? []) {
            const list = map.get(share.item) ?? []
            list.push(share)
            map.set(share.item, list)
        }
        return map
    }, [rawShares])

    const stateByItem = useMemo(() => new Map((rawStates ?? []).map(s => [s.item, s])), [rawStates])

    const allItems = useMemo<DriveItemView[]>(
        () =>
            (rawItems ?? []).map(item => {
                const state = stateByItem.get(item.id)
                const shares = sharesByItem.get(item.id) ?? []
                const hasNonOwnerShares = shares.some(s => s.role !== 'owner')
                const ownerName = userOrgNames.get(item.created_by) ?? ''

                return {
                    id: item.id,
                    name: item.name,
                    isFolder: item.is_folder,
                    mimeType: item.mime_type,
                    parentId: item.parent ?? '',
                    owner: item.created_by === userOrgId ? 'me' : ownerName,
                    ownerUserOrgId: item.created_by,
                    updated: item.updated,
                    size: item.size,
                    shared: hasNonOwnerShares,
                    starred: state?.is_starred ?? false,
                    trashedAt: state?.trashed_at ?? '',
                    file: item.file,
                    description: item.description,
                    category: mimeTypeToCategory(item.mime_type, item.is_folder),
                }
            }),
        [rawItems, stateByItem, sharesByItem, userOrgId, userOrgNames]
    )

    const itemsById = useMemo(() => new Map(allItems.map(i => [i.id, i])), [allItems])

    const searchItemViews = useMemo<DriveItemView[]>(() => {
        if (!isSearchActive) return []
        return searchResults.map(sr => {
            const existing = itemsById.get(sr.id)
            if (existing) return existing
            return {
                id: sr.id,
                name: sr.name,
                isFolder: sr.is_folder,
                mimeType: sr.mime_type,
                parentId: '',
                owner: '',
                ownerUserOrgId: '',
                updated: '',
                size: sr.size,
                shared: false,
                starred: false,
                trashedAt: '',
                file: '',
                description: sr.description,
                category: mimeTypeToCategory(sr.mime_type, sr.is_folder),
            }
        })
    }, [isSearchActive, searchResults, itemsById])

    const currentItems = useMemo(() => {
        if (isSearchActive) return searchItemViews

        switch (activeSection) {
            case 'my-drive':
                return allItems.filter(
                    i =>
                        i.ownerUserOrgId === userOrgId &&
                        i.parentId === currentFolderId &&
                        !i.trashedAt
                )
            case 'shared-with-me':
                return allItems.filter(i => i.ownerUserOrgId !== userOrgId && !i.trashedAt)
            case 'recent':
                return allItems
                    .filter(i => !i.isFolder && !i.trashedAt)
                    .sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime())
                    .slice(0, 20)
            case 'starred':
                return allItems.filter(i => i.starred && !i.trashedAt)
            case 'trash':
                return allItems.filter(i => !!i.trashedAt)
            default:
                return []
        }
    }, [isSearchActive, searchItemViews, activeSection, allItems, currentFolderId, userOrgId])

    const breadcrumbs = useMemo(() => {
        const crumbs: DriveItemView[] = []
        let id = currentFolderId
        while (id) {
            const item = itemsById.get(id)
            if (!item) break
            crumbs.unshift(item)
            id = item.parentId
        }
        return crumbs
    }, [currentFolderId, itemsById])

    const selectedItem = useMemo(
        () => (selectedItemId ? itemsById.get(selectedItemId) : undefined),
        [selectedItemId, itemsById]
    )

    const folderTree = useMemo(() => {
        const folders = allItems.filter(
            i => i.isFolder && i.ownerUserOrgId === userOrgId && !i.trashedAt
        )

        function buildTree(parentId: string): FolderTreeNode[] {
            return folders
                .filter(f => f.parentId === parentId)
                .map(folder => ({
                    item: folder,
                    children: buildTree(folder.id),
                }))
        }

        return buildTree('')
    }, [allItems, userOrgId])

    const totalStorageUsed = useMemo(() => allItems.reduce((sum, i) => sum + i.size, 0), [allItems])

    const isLoading = !rawItems || !rawShares || !rawStates || !orgUserOrgs

    const toggleStarMutation = useMutation({
        mutationFn: function* ({ itemId, starred }: { itemId: string; starred: boolean }) {
            const existing = stateByItem.get(itemId)
            if (existing) {
                yield stateCollection.update(existing.id, draft => {
                    draft.is_starred = !starred
                })
            } else {
                yield stateCollection.insert({
                    id: newRecordId(),
                    item: itemId,
                    user_org: userOrgId,
                    is_starred: true,
                    trashed_at: '',
                    last_viewed_at: '',
                })
            }
        },
    })

    const trashMutation = useMutation({
        mutationFn: function* ({ itemId, restore }: { itemId: string; restore: boolean }) {
            const existing = stateByItem.get(itemId)
            if (existing) {
                yield stateCollection.update(existing.id, draft => {
                    draft.trashed_at = restore ? '' : new Date().toISOString()
                })
            } else if (!restore) {
                yield stateCollection.insert({
                    id: newRecordId(),
                    item: itemId,
                    user_org: userOrgId,
                    is_starred: false,
                    trashed_at: new Date().toISOString(),
                    last_viewed_at: '',
                })
            }
        },
    })

    const toggleStar = useCallback(
        (itemId: string) => {
            const item = itemsById.get(itemId)
            toggleStarMutation.mutate({ itemId, starred: item?.starred ?? false })
        },
        [itemsById, toggleStarMutation]
    )

    const moveToTrash = useCallback(
        (itemId: string) => trashMutation.mutate({ itemId, restore: false }),
        [trashMutation]
    )

    const restoreFromTrash = useCallback(
        (itemId: string) => trashMutation.mutate({ itemId, restore: true }),
        [trashMutation]
    )

    const { uploadFiles, isUploading, uploadingFiles, triggerFilePicker, uploadNewVersion } =
        useFileUpload({
            orgId,
            userOrgId,
            currentFolderId,
        })

    const navigateToFolder = useCallback((folderId: string) => {
        setCurrentFolderId(folderId)
        setActiveSection('my-drive')
        setSelectedItemId(null)
        setSearchQuery('')
    }, [])

    const navigateToSection = useCallback((section: SidebarSection) => {
        setActiveSection(section)
        if (section !== 'my-drive') {
            setCurrentFolderId('')
        }
        setSelectedItemId(null)
        setSearchQuery('')
    }, [])

    const selectItem = useCallback((itemId: string | null) => {
        setSelectedItemId(itemId)
    }, [])

    const openItem = useCallback(
        (item: DriveItemView) => {
            if (item.isFolder) {
                navigateToFolder(item.id)
            } else {
                setSelectedItemId(item.id)
            }
        },
        [navigateToFolder]
    )

    return useMemo(
        () => ({
            currentFolderId,
            activeSection,
            selectedItemId,
            viewMode,
            currentItems,
            breadcrumbs,
            selectedItem,
            folderTree,
            totalStorageUsed,
            isLoading,
            searchQuery,
            setSearchQuery,
            isSearching,
            navigateToFolder,
            navigateToSection,
            selectItem,
            setViewMode,
            openItem,
            toggleStar,
            moveToTrash,
            restoreFromTrash,
            uploadFiles,
            isUploading,
            uploadingFiles,
            triggerFilePicker,
            uploadNewVersion,
        }),
        [
            currentFolderId,
            activeSection,
            selectedItemId,
            viewMode,
            currentItems,
            breadcrumbs,
            selectedItem,
            folderTree,
            totalStorageUsed,
            isLoading,
            searchQuery,
            isSearching,
            navigateToFolder,
            navigateToSection,
            selectItem,
            openItem,
            toggleStar,
            moveToTrash,
            restoreFromTrash,
            uploadFiles,
            isUploading,
            uploadingFiles,
            triggerFilePicker,
            uploadNewVersion,
        ]
    )
}
