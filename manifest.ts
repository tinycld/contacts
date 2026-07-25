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
    // Go server extension: CardDAV, full-text search + /api/contacts/search, audit
    // logging (via core's audit helper), and the vcard_uid autogen hook all live
    // in the package's own Go module (server/register.go → Register(app)).
    server: { package: 'server', module: 'tinycld.org/packages/contacts' },
    // Server-side TS hooks: package authors / customizers can drop a *.pb.ts into
    // pb-hooks/ to extend contacts behavior alongside the Go (see pb-hooks/README
    // and the $contacts.* JS binding the Go server exposes).
    hooks: { directory: 'pb-hooks' },
    repository: { url: 'https://github.com/tinycld/contacts' },
    peerVersions: { '@tinycld/core': '>=0.0.4 <0.1.0' },
}

export default manifest
