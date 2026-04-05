const manifest = {
    name: 'Calendar',
    slug: 'calendar',
    version: '0.1.0',
    description: 'Shared calendar for your organization',
    routes: { directory: 'screens' },
    nav: { label: 'Calendar', icon: 'calendar', order: 8 },
    sidebar: { component: 'sidebar' },
    collections: { register: 'collections', types: 'types' },
}

export default manifest
