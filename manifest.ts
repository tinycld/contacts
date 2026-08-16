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
    // Go server extension: CardDAV, the federated search source, the vCard
    // file endpoints (/api/contacts/export and /api/contacts/import, which back
    // the CLI's export/import), audit logging (via core's audit helper), and the
    // vcard_uid autogen hook all live in the package's own Go module
    // (server/register.go → Register(app)). There is deliberately no
    // /api/contacts/search: register.go calls fts.RegisterSync instead of
    // fts.Register so search is served only by core's federated /api/search.
    server: { package: 'server', module: 'tinycld.org/packages/contacts' },
    // Contributes the `tinycld contacts` command group. Both scopes are needed:
    // read for list/search/show/export, write for add/edit/rm/import.
    cli: {
        package: 'cli',
        module: 'tinycld.org/packages/contacts/cli',
        scopes: ['contacts:read', 'contacts:write'],
    },
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
