const manifest = {
    name: 'Contacts',
    slug: 'contacts',
    version: '0.1.1',
    description: 'Your personal contacts, private to you',
    routes: { directory: 'screens' },
    nav: { label: 'Contacts', icon: 'users', order: 10, shortcut: 'o' },
    migrations: { directory: 'pb-migrations' },
    collections: { register: 'collections', types: 'types' },
    sidebar: { component: 'sidebar' },
    help: { directory: 'help' },
    seed: { script: 'seed' },
    tests: { directory: 'tests' },
    // Server-side TS hooks (vcard_uid autogen). All former Go server behavior is
    // now core-owned and declared as config below — contacts ships no Go module.
    hooks: { directory: 'pb-hooks' },
    // CardDAV: core serves the `contacts` collection as vCards, scoped per org.
    carddav: {
        collection: 'contacts',
        listFilter: "owner = {:ownerId} && deleted_at = ''",
        sort: '-updated',
        ownerField: 'owner',
        uidField: 'vcard_uid',
        softDeleteField: 'deleted_at',
        vcard: {
            version: '4.0',
            name: { given: 'first_name', family: 'last_name' },
            simple: {
                EMAIL: 'email',
                TEL: 'phone',
                ORG: 'company',
                TITLE: 'job_title',
                NOTE: 'notes',
            },
            revField: 'updated',
        },
    },
    // Full-text search: core registers index-sync hooks + GET /api/contacts/search.
    fts: {
        collection: 'contacts',
        table: 'fts_contacts',
        columns: [
            { fts: 'first_name', field: 'first_name' },
            { fts: 'last_name', field: 'last_name' },
            { fts: 'email', field: 'email' },
            { fts: 'company', field: 'company' },
            { fts: 'phone', field: 'phone' },
            { fts: 'notes', field: 'notes', strip: true },
        ],
        owner: { field: 'owner', via: 'user_org', userField: 'user' },
        output: [
            { column: 'first_name' },
            { column: 'last_name' },
            { column: 'email' },
            { column: 'company' },
            { column: 'phone' },
            { column: 'favorite', type: 'bool' },
            { column: 'deleted_at' },
        ],
        softDeleteField: 'deleted_at',
    },
    // Audit: core registers audit hooks for contacts from this config.
    audit: [
        {
            collection: 'contacts',
            resolveOrg: { field: 'owner', collection: 'user_org', orgField: 'org' },
            labelFields: ['first_name', 'last_name'],
        },
    ],
    repository: { url: 'https://github.com/tinycld/contacts' },
    peerVersions: { '@tinycld/core': '>=0.0.4 <0.1.0' },
}

export default manifest
