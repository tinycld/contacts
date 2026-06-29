const manifest = {
    name: 'Contacts',
    slug: 'contacts',
    version: '0.1.1',
    description: 'Shared contacts for your organization',
    routes: { directory: 'screens' },
    nav: { label: 'Contacts', icon: 'users', order: 10, shortcut: 'o' },
    migrations: { directory: 'pb-migrations' },
    collections: { register: 'collections', types: 'types' },
    sidebar: { component: 'sidebar' },
    help: { directory: 'help' },
    seed: { script: 'seed' },
    tests: { directory: 'tests' },
    server: { package: 'server', module: 'tinycld.org/packages/contacts' },
    repository: { url: 'https://github.com/tinycld/contacts' },
}

export default manifest
