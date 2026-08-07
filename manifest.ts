const manifest = {
    name: 'Contacts',
    slug: 'contacts',
    version: '0.1.2',
    description: 'Your personal contacts, private to you',
    routes: { directory: 'screens' },
    nav: { label: 'Contacts', icon: 'users', order: 10, shortcut: 'o' },
    migrations: { directory: 'pb-migrations' },
    collections: { register: 'collections', types: 'types' },
    sidebar: { component: 'sidebar' },
    help: { directory: 'help' },
    seed: { script: 'seed' },
    tests: { directory: 'tests' },
    // Contacts is searchable through core's federated /api/search, which reads
    // the Go source registered in server/. The contacts screen's own search box
    // reads the same endpoint scoped to this package.
    search: { adapter: 'search-adapter' },
    // Go server extension: CardDAV, full-text search + /api/contacts/search, audit
    // logging (via core's audit helper), and the vcard_uid autogen hook all live
    // in the package's own Go module (server/register.go → Register(app)).
    server: { package: 'server', module: 'tinycld.org/packages/contacts' },
    // Server-side TS hooks: package authors / customizers can drop a *.pb.ts into
    // pb-hooks/ to extend contacts behavior alongside the Go (see pb-hooks/README
    // and the $contacts.* JS binding the Go server exposes).
    hooks: { directory: 'pb-hooks' },
    // CardDAV over /carddav, served by core (tinycld.org/core/carddav). This
    // mirrors the cardDAVSource literal in server/register.go, which is what the
    // single-tenant app registers. A multi-org tenant serves CardDAV from this
    // block (the router materializes it into the tenant's runtime config) —
    // that is why the Go-side mount is host-only even though contacts' other
    // Go links into tenants via RegisterTenant.
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
    repository: { url: 'https://github.com/tinycld/contacts' },
    peerVersions: { '@tinycld/core': '>=0.0.6 <0.1.0' },
}

export default manifest
