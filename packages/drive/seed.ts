import type PocketBase from 'pocketbase'

function log(...args: unknown[]) {
    process.stdout.write(`[seed:drive] ${args.join(' ')}\n`)
}

interface SeedContext {
    user: { id: string; email: string; name: string }
    org: { id: string }
    userOrg: { id: string }
}

// Folder structure: root folders and nested subfolders
const FOLDERS = [
    { key: 'projects', name: 'Projects', parent: null },
    { key: 'shared-docs', name: 'Shared Documents', parent: null },
    { key: 'personal', name: 'Personal', parent: null },
    { key: 'archive', name: 'Archive', parent: null },
    { key: 'q1-planning', name: 'Q1 Planning', parent: 'projects' },
    { key: 'marketing', name: 'Marketing', parent: 'projects' },
    { key: 'engineering', name: 'Engineering', parent: 'projects' },
    { key: 'api-docs', name: 'API Documentation', parent: 'engineering' },
] as const

const FILES = [
    // Q1 Planning
    {
        name: 'Product Roadmap 2026',
        mime_type: 'application/vnd.google-apps.document',
        size: 245_000,
        folder: 'q1-planning',
        shared: true,
        starred: true,
        description: 'Full product roadmap for 2026',
    },
    {
        name: 'Q1 Budget',
        mime_type: 'application/vnd.google-apps.spreadsheet',
        size: 512_000,
        folder: 'q1-planning',
        shared: true,
        starred: false,
        description: 'Quarterly budget breakdown',
    },
    {
        name: 'Strategy Deck',
        mime_type: 'application/vnd.google-apps.presentation',
        size: 3_200_000,
        folder: 'q1-planning',
        shared: true,
        starred: false,
        description: '',
    },

    // Marketing
    {
        name: 'Brand Guidelines',
        mime_type: 'application/pdf',
        size: 8_500_000,
        folder: 'marketing',
        shared: true,
        starred: false,
        description: 'Official brand guide v3',
    },
    {
        name: 'Logo Variants',
        mime_type: 'image/png',
        size: 2_400_000,
        folder: 'marketing',
        shared: false,
        starred: false,
        description: '',
    },
    {
        name: 'Social Media Plan',
        mime_type: 'application/vnd.google-apps.document',
        size: 180_000,
        folder: 'marketing',
        shared: true,
        starred: false,
        description: 'Q2 social media strategy',
    },

    // Engineering
    {
        name: 'Architecture Overview',
        mime_type: 'application/vnd.google-apps.document',
        size: 320_000,
        folder: 'engineering',
        shared: true,
        starred: false,
        description: 'System architecture and design decisions',
    },
    {
        name: 'System Diagram',
        mime_type: 'application/vnd.google-apps.drawing',
        size: 150_000,
        folder: 'engineering',
        shared: false,
        starred: true,
        description: '',
    },

    // API Documentation
    {
        name: 'API v2 Reference',
        mime_type: 'application/vnd.google-apps.document',
        size: 420_000,
        folder: 'api-docs',
        shared: true,
        starred: false,
        description: 'Complete API v2 documentation',
    },
    {
        name: 'API Usage Metrics',
        mime_type: 'application/vnd.google-apps.spreadsheet',
        size: 890_000,
        folder: 'api-docs',
        shared: true,
        starred: false,
        description: '',
    },

    // Shared Documents
    {
        name: 'Team Meeting Notes',
        mime_type: 'application/vnd.google-apps.document',
        size: 95_000,
        folder: 'shared-docs',
        shared: true,
        starred: false,
        description: 'Weekly meeting notes',
    },
    {
        name: 'Team Roster',
        mime_type: 'application/vnd.google-apps.spreadsheet',
        size: 128_000,
        folder: 'shared-docs',
        shared: true,
        starred: false,
        description: '',
    },
    {
        name: 'Onboarding Slides',
        mime_type: 'application/vnd.google-apps.presentation',
        size: 5_600_000,
        folder: 'shared-docs',
        shared: true,
        starred: true,
        description: 'New hire onboarding deck',
    },

    // Personal
    {
        name: 'Resume 2026',
        mime_type: 'application/vnd.google-apps.document',
        size: 65_000,
        folder: 'personal',
        shared: false,
        starred: false,
        description: '',
    },
    {
        name: 'Profile Photo',
        mime_type: 'image/jpeg',
        size: 1_800_000,
        folder: 'personal',
        shared: false,
        starred: false,
        description: '',
    },
    {
        name: 'Tax Documents 2025',
        mime_type: 'application/pdf',
        size: 4_200_000,
        folder: 'personal',
        shared: false,
        starred: false,
        description: '',
    },

    // Archive
    {
        name: 'Client Proposal (Old)',
        mime_type: 'application/vnd.google-apps.document',
        size: 210_000,
        folder: 'archive',
        shared: false,
        starred: false,
        description: '',
    },
    {
        name: '2025 Financials',
        mime_type: 'application/vnd.google-apps.spreadsheet',
        size: 1_100_000,
        folder: 'archive',
        shared: true,
        starred: false,
        description: 'Annual financial summary',
    },
] as const

async function seedFolders(pb: PocketBase, orgId: string, userOrgId: string) {
    const folderIds: Record<string, string> = {}

    for (const folder of FOLDERS) {
        log(`Creating folder: ${folder.name}`)
        const record = await pb.collection('drive_items').create({
            org: orgId,
            name: folder.name,
            is_folder: true,
            mime_type: '',
            parent: folder.parent ? folderIds[folder.parent] : '',
            created_by: userOrgId,
            size: 0,
            description: '',
        })
        folderIds[folder.key] = record.id
    }

    return folderIds
}

async function seedFiles(
    pb: PocketBase,
    orgId: string,
    userOrgId: string,
    folderIds: Record<string, string>,
    otherMembers: { id: string }[]
) {
    for (const file of FILES) {
        log(`Creating file: ${file.name}`)
        const record = await pb.collection('drive_items').create({
            org: orgId,
            name: file.name,
            is_folder: false,
            mime_type: file.mime_type,
            parent: folderIds[file.folder],
            created_by: userOrgId,
            size: file.size,
            description: file.description,
        })

        // Create owner share
        await pb.collection('drive_shares').create({
            item: record.id,
            user_org: userOrgId,
            role: 'owner',
            created_by: userOrgId,
        })

        // Share with a team member if marked as shared
        if (file.shared && otherMembers.length > 0) {
            const sharedWith = otherMembers[Math.floor(Math.random() * otherMembers.length)]
            await pb.collection('drive_shares').create({
                item: record.id,
                user_org: sharedWith.id,
                role: 'editor',
                created_by: userOrgId,
            })
        }

        // Create item state for starred items
        if (file.starred) {
            await pb.collection('drive_item_state').create({
                item: record.id,
                user_org: userOrgId,
                is_starred: true,
                trashed_at: '',
                last_viewed_at: new Date().toISOString(),
            })
        }
    }
}

async function seedFolderStars(
    pb: PocketBase,
    userOrgId: string,
    folderIds: Record<string, string>
) {
    // Star the Projects and Engineering folders
    const starredFolders = ['projects', 'engineering']
    for (const key of starredFolders) {
        if (folderIds[key]) {
            await pb.collection('drive_item_state').create({
                item: folderIds[key],
                user_org: userOrgId,
                is_starred: true,
                trashed_at: '',
                last_viewed_at: new Date().toISOString(),
            })
        }
    }
}

export default async function seed(pb: PocketBase, { org, userOrg }: SeedContext) {
    const existingItems = await pb.collection('drive_items').getList(1, 1, {
        filter: `org = "${org.id}"`,
    })
    if (existingItems.totalItems > 0) {
        log(`Skipping (${existingItems.totalItems} items already exist)`)
        return
    }

    const otherMembers = await pb.collection('user_org').getFullList({
        filter: `org = "${org.id}" && id != "${userOrg.id}"`,
    })

    const folderIds = await seedFolders(pb, org.id, userOrg.id)

    log(`Creating ${FILES.length} files...`)
    await seedFiles(pb, org.id, userOrg.id, folderIds, otherMembers)

    await seedFolderStars(pb, userOrg.id, folderIds)

    log(`Created ${FOLDERS.length} folders and ${FILES.length} files`)
}
