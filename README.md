# @tinycld/contacts

Shared contact directory for your organization — with a native CardDAV endpoint so any standards-compliant address book (Apple Contacts, GNOME Contacts, DAVx5, Thunderbird) can read and write the same records.

Part of [TinyCld](https://tinycld.org/) — the open-source, self-hosted Google Workspace alternative.

## Features

- **Org-scoped directory.** Every contact is shared across members of an organization. Multi-org users get one directory per org.
- **Rich contact records.** First/last name, email, phone, company, job title, notes, favorites, and avatars.
- **Favorites & search.** Star the people you reach for every day; filter by any field.
- **CardDAV sync.** Native `/carddav/` endpoint served by the Go server. Point any CardDAV client at it and contacts stay in sync — no browser required.
- **vCard-based identity.** Contacts carry a stable `vcard_uid`, so re-imports from Google Takeout (`.vcf`) dedupe cleanly instead of creating duplicates.
- **Soft deletes.** `deleted_at` preserves records so trashed contacts can be restored.
- **Real-time updates.** Changes from any client (web, mobile, CardDAV) appear instantly across every other session via PocketBase's realtime stream.

## Protocol

| Protocol | RFC       | Port | Purpose                            |
|----------|-----------|------|------------------------------------|
| CardDAV  | RFC 6352  | 443  | Read/write contacts from any client |

## Relationship to the app shell

`@tinycld/contacts` is a feature package for the [TinyCld app shell](https://github.com/tinycld/tinycld), which bundles `@tinycld/core` (auth, routing, storage, UI primitives). The app shell ships with **no** feature packages; install this one to add a Contacts app.

This package contributes:

- **Screens** — org-scoped routes at `/a/<org>/contacts` (index, directory, new, detail).
- **Nav entry** — sidebar icon with keyboard shortcut `t c` / `o`.
- **Collections** — `contacts` table, registered with pbtsdb for live queries.
- **Migrations** — schema and indexes under `pb-migrations/`.
- **Go server module** — CardDAV endpoint, vCard parser, and search endpoints wired into the app shell's PocketBase binary.

The package depends on `@tinycld/core` at runtime (React, pbtsdb, `~/lib/*`). The app shell has no knowledge of this package at compile time — everything is discovered at generator time by scanning `tinycld/packages/`.

## Installation

From inside your app shell checkout (`tinycld/tinycld`):

```sh
bun run packages:install <this-repo-git-url>
```

That clones the repo next to the app shell, symlinks it into `tinycld/packages/@tinycld/contacts`, and runs the generator to wire up routes, collections, migrations, and Go server extensions.

To remove:

```sh
bun run packages:unlink @tinycld/contacts
```

## Development

This package is not run standalone — it only makes sense inside an app shell checkout.

```sh
cd ../tinycld
bun run dev              # expo + pocketbase with contacts linked
bun run test:unit        # includes this package's tests
bun run checks           # biome + tsc across the app shell + linked packages
```

**Do not** run `bun install` inside this directory. Peer dependencies resolve through the app shell's `node_modules/`; installing here creates duplicate copies of `react`, `react-native`, etc. and breaks TypeScript.

## License

See the root TinyCld repository for licensing.
