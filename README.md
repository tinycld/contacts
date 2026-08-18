# contacts

Personal address book per user, with a native CardDAV endpoint so any standards-compliant address book client (Apple Contacts, GNOME Contacts / Evolution, DAVx5, Thunderbird) can read and write the same records.

A feature package for the [tinycld](https://tinycld.org/) ecosystem. Lives as a standalone git repo alongside the [`tinycld`](https://tinycld.org/) app shell and other sibling feature packages (`drive`, `mail`, `calendar`, `calc`, `text`, `google-takeout-import`). `@tinycld/core` is the shared runtime/UI library, nested inside the `tinycld` shell repo at `tinycld/core/` and imported as `@tinycld/core`.

## What it does

Stores contacts in a single `contacts` PocketBase collection, owned by the user who created them. CardDAV exposes the same collection at `/carddav/` as a single address book per user.

User-facing features:

- **Per-user address book** — contacts are owned by a `users` record (the `owner` relation), and PocketBase access rules (`owner = @request.auth.id`) enforce that other users can't see them. CardDAV honors the same scope.
- **Rich contact fields** — `first_name` (required), `last_name`, `company`, `job_title`, `email` (one), `phone` (one), `notes` (rich-text / HTML), `favorite` flag. The web UI's avatar is `NameAvatar` (initials with a deterministic color); there is no avatar-image upload.
- **Favorites** — toggle a star; the **Favorites** sidebar view filters to starred contacts.
- **Soft delete with restore and permanent delete** — `deleted_at` is the source of truth; soft-deleted contacts move to a **Deleted** sidebar view; permanent delete removes the row, the FTS entry, and the vcard_uid.
- **Labels** — colored tags that live in `core`'s `labels` / `label_assignments` collections and work across packages. Contacts contributes nothing to the label system itself; it consumes core's `useLabels`, `useLabelMutations`, and `LabelManagerDialog`. A `label_assignments` row has `(record_id, collection, label, user)`, so a label's meaning is consistent across mail, contacts, etc.
- **Directory** — a separate sidebar view (`/contacts/directory`) listing the deployment's **users** (read from the local `users` collection — not PB `expand`, so a freshly-added user resolves from the optimistic store immediately), with role badges (owner / admin / member / guest). This is read-only and orthogonal to the contact list — there's no "save member to contacts" action.
- **Search** — SQLite FTS5 across `first_name`, `last_name`, `email`, `company`, `phone`, and `notes` (HTML-stripped). Porter stemmer for English, prefix matches (typing `joh` matches `john`, `johnson`) via `"term"*` syntax. **Not indexed**: `job_title`, `favorite`, labels, `deleted_at`. The server endpoint filters soft-deleted rows (`c.deleted_at = ''`) so search matches the sidebar's main-list view.
- **Stable vCard identity** — every contact has a `vcard_uid` (UUID v4 with `urn:uuid:` prefix), auto-generated on create via an `OnRecordCreate` hook if the client didn't set one. A partial unique index (`WHERE vcard_uid != ''`) guarantees uniqueness without breaking the empty-string fallback. This is how [Google Takeout import](https://tinycld.org/docs) and CardDAV re-syncs dedupe instead of creating duplicates.
- **CardDAV** — full read-write CardDAV server at `/carddav/`, served via `github.com/emersion/go-webdav/carddav` over HTTP Basic auth. A single address book is exposed per user, at `/carddav/u/ab/default/`. There's a `/.well-known/carddav` redirect for auto-discovery.
- **Keyboard shortcuts** — `t o` jumps to Contacts; `j` / `k` navigate the list; `Enter` opens the focused contact; `c` creates a new one.
- **Realtime updates** — edits made anywhere (web UI, mobile UI, CardDAV client) appear in other open sessions within seconds via PocketBase's built-in collection-realtime subscriptions, consumed through `pbtsdb`'s `useLiveQuery`.
- **Audit logging** — every contact mutation goes through `core/audit`, labeled with the contact's first + last name.

## Automation rules

Contacts publishes two triggers and one action to the automation-rules engine:

- **`contacts:contact-added`** — "A contact is added". A `contacts` create. Condition fields: `first_name`, `last_name`, `email`, `phone`, `company`, `job_title`, `favorite`.
- **`contacts:contact-updated`** — "A contact changes". An update watching exactly `first_name`, `last_name`, `email`, `phone`, `company`, `job_title`, `favorite`, and `notes`. It deliberately excludes `vcard_uid` and `deleted_at`, so a CardDAV sync assigning an internal identifier, or a soft delete, does not count as a change.
- **`contacts:add-contact`** — "Add a contact". A `kind: 'record-op'` action: a create with `first_name`, `last_name`, `email`, and `company` params. `owner` is set from the engine's `{ context: 'owner' }`.

Contacts ships **no** `server/automation.go` at all. Because `contacts.owner` is a direct relation to `users`, the engine's owner auto-detection resolves personal-rule scoping with no Go resolver needed — the simplest possible case for a package joining the rules system.

The add-contact action does not check for duplicates: a rule saving every sender will save the same person once per message.

Rules are declared with `automation: { definitions: 'automation' }` in `manifest.ts` plus a `"./automation"` entry in the `package.json` exports map; the catalog lives in `tinycld/contacts/automation.ts`. In-app help is `help/rules.md`. See [Automation rules](https://tinycld.org/docs/automation-rules) and [the automation anatomy reference](https://tinycld.org/docs/anatomy/automation).

## Theory of operations

The short version: contacts is a single `contacts` PocketBase collection plus a SQLite FTS5 virtual table that mirrors it. Access control is enforced via PocketBase's `owner = @request.auth.id` rule. The generic Go — the CardDAV protocol server + vCard codec and the FTS index sync + search — lives once in core (`tinycld.org/core/{carddav,fts}`); contacts' `server/register.go` drives it with a contacts-shaped config and adds the `vcard_uid` autogen hook. The CardDAV adapter authenticates via HTTP Basic, scopes everything to the authenticated user's id as the `owner`, and translates between vCards and `contacts` records.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Client (React Native / web)                                         │
│                                                                      │
│   Sidebar  ContactList  ContactDetail  ContactForm  LabelManagerDialog│
│                       │                                              │
│                       ▼                                              │
│   pbtsdb useLiveQuery  +  useLabels / useLabelMutations (core)       │
│                       │                                              │
│                       ▼                                              │
│   PocketBase REST + realtime subscriptions ──────┐                   │
└──────────────────────────────────────────────────┼───────────────────┘
                                                   │
┌──────────────────────────────────────────────────┼───────────────────┐
│  Server (Go, PocketBase + tinycld.org/core)      │                   │
│                                                  ▼                   │
│   Collections                                                        │
│     contacts            ── owner = @request.auth.id                  │
│     fts_contacts        ── FTS5 virtual table                        │
│                                                                      │
│   Hooks (register.go + core/fts)                                     │
│     OnRecordCreate(contacts):              auto-generate vcard_uid   │
│     OnRecordAfterCreate / Update / Delete:  sync fts_contacts row    │
│                                                                      │
│   API endpoints (register.go)                                        │
│     GET    /api/contacts/search    (auth, FTS5 with prefix matching) │
│                                                                      │
│   CardDAV                                                            │
│     ANY    /carddav  /  /carddav/{path...}                           │
│     GET    /.well-known/carddav → 301 /carddav/                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Ownership model

`contacts.owner` is a relation straight to `users`. The collection's PocketBase access rules are *all* `owner = @request.auth.id`:

- **list / view** — only your contacts come back.
- **create** — you can only insert rows whose `owner` is your own user id.
- **update / delete** — only on your own contacts.

This is a hard isolation: there is no admin / owner / superuser path through the regular API that returns someone else's contacts. CardDAV uses the same `owner` filter manually because its SDK calls bypass collection rules.

### CardDAV authorization (the manual filter)

`github.com/emersion/go-webdav/carddav` uses the `Backend` interface, which calls core's `carddav.Backend` methods directly — it doesn't speak PocketBase's REST API, so it doesn't pass through the collection rules. Every `Backend` method resolves the caller via `davauth.Authenticate` and re-applies the Source's `ListFilter` (`owner = {:ownerId} && deleted_at = ''`, with `ownerId` bound to the authenticated user's id) manually. The two enforcement paths converge on the same predicate (`owner == auth.id`) by construction.

The route handler in core's `carddav/register.go` does the HTTP-Basic challenge (sending `WWW-Authenticate: Basic realm="TinyCld CardDAV"` on missing or bad creds). Credentials are `bcrypt`-verified by the shared `davauth` package against the `users` collection, and `davauth.WithRequestCache` memoizes the result for the request's lifetime, so a PROPFIND that fans out into many backend calls runs bcrypt once, not once per call. Repeated failures from one source are refused before spending bcrypt.

### CardDAV paths

The path layout is hand-rolled rather than auto-derived from the carddav library, so client behavior is predictable:

- `/carddav/u/` — `CurrentUserPrincipal`. Returned to clients that ask "who am I?".
- `/carddav/u/ab/` — `AddressBookHomeSetPath`. The collection of address books.
- `/carddav/u/ab/default/` — the caller's single address book (`Name = "Contacts"`). Its objects are the contacts the authenticated user owns.
- `/carddav/u/ab/default/<vcard_uid>.vcf` — individual contact path. `vcard_uid` is the `urn:uuid:` value.

`CreateAddressBook` and `DeleteAddressBook` return errors — there is exactly one book per user and the set can't be mutated from a CardDAV client.

### vCard mapping

The translation is intentionally one-of-each-field, not full multi-value vCard:

| TinyCld field | vCard field | Notes |
|---|---|---|
| `first_name`, `last_name` | `N` (and `FN` for display) | `N` is `lastName;firstName;;;` |
| `email` | `EMAIL` | one only |
| `phone` | `TEL` | one only |
| `company` | `ORG` | |
| `job_title` | `TITLE` | |
| `notes` | `NOTE` | HTML in TinyCld, plain in vCard |
| `vcard_uid` | `UID` | stable across exports |
| `updated` (autodate) | `REV` | UTC, `20060102T150405Z` format |

`favorite`, `deleted_at`, and label assignments are TinyCld-side metadata and don't map to vCard. A contact starred in TinyCld will not be starred in Apple Contacts after a CardDAV sync — vCard has no native "favorite" concept.

When a vCard *with multiple* `EMAIL` / `TEL` entries is `PUT` from a client, only the first of each lands in TinyCld (the SDK call `card.Value(vcard.FieldEmail)` returns the first value of the multi-value field). This is a known asymmetry; if the user later edits the contact in TinyCld and the CardDAV client picks up the change, the additional values get dropped on the round-trip.

### vcard_uid generation and dedup

`OnRecordCreate("contacts")` runs before persistence and stamps `vcard_uid = "urn:uuid:" + uuid.NewString()` if the client didn't supply one. This guarantees:

- Every web-UI-created contact has a UID without the form needing to know about it.
- CardDAV `PUT`s that supply their own `UID` (the normal case) are honored verbatim.
- Google Takeout imports that carry their own UIDs round-trip cleanly: re-importing the same export looks up the existing row with a `vcard_uid = {:uid}` filter and updates it instead of creating a duplicate.

A backfill loop in the `_add_vcard_uid` migration assigns UIDs to pre-existing rows. The unique index is partial (`WHERE vcard_uid != ''`) so the migration's two-step backfill (column-add followed by row-update) doesn't violate uniqueness mid-flight.

### Soft delete

`deleted_at` is a nullable `Date` field. The migration that added it (`1712000004`) also indexed it. Three states matter:

- **Empty string** — live contact. The default for new rows.
- **A timestamp** — soft-deleted. Hidden from the main list, Favorites, and label views. Shown in the **Deleted** sidebar entry. Excluded from the FTS index by the OnRecordAfterDelete hook? — no, soft deletes still write to FTS (because the row isn't being deleted, just updated); the *client* filters them out by the same `deleted_at` predicate the sidebar count uses. CardDAV deletes a contact when the row hits `deleted_at`.
- **Hard delete (row gone)** — only from the "Delete permanently" action in the Deleted view. Removes the row, the FTS entry (via the OnRecordAfterDelete hook), and the `vcard_uid`. There's no recovery path from this state.

Audit-log entries are retained even after permanent delete.

### FTS5 index

`fts_contacts` is a SQLite FTS5 virtual table with columns `(record_id UNINDEXED, first_name, last_name, email, company, phone, notes)` and `tokenize='porter unicode61'`. The sync hooks come from `core/fts`, bound from the `fts.Config` in `register.go`:

- **After create / update** — `syncRecord` does a `DELETE WHERE record_id = ?` (idempotent upsert) followed by an `INSERT`. HTML in `notes` is stripped via a `<[^>]*>` regex before indexing.
- **After delete** — `syncRecord` drops the row.

The search endpoint (`GET /api/contacts/search`, registered by `core/fts` from the same config) takes a `q` query parameter (min length 2), runs it through `SanitizeQuery` (strips FTS5 special characters, splits on whitespace, wraps each term in double quotes and adds a `*` suffix for prefix matching), then queries `fts_contacts MATCH '"term1"* "term2"* ...'` joined back to `contacts`. Results are scoped to rows whose `owner` is the caller's user id. It deliberately does **not** select a `snippet()`/highlight column — that would wrap raw user-entered contact data in `<mark>` tags and hand an XSS vector to any client that rendered it — so the response carries no highlighted excerpt.

A 100-row hard cap (`limit` defaults to 25) and offset-based pagination are enforced server-side.

### Labels (consumed from core)

Labels live in core. The schema is:

- `labels` — `(id, name, color, user)`. Owned by a user.
- `label_assignments` — `(id, record_id, collection, label, user)`. Labels can be assigned to records in *any* collection by reference (untyped FK).

Contacts uses both:

- The sidebar queries `label_assignments` filtered by `collection='contacts'` to compute per-label contact counts.
- The contact detail screen renders core's `LabelManagerDialog` and uses `useLabelMutations()` to assign/unassign labels.
- The list view filters by `?label=<labelId>` via `useContactList`.

Labels are shared with any other package that uses core's label system (mail, for example). Deleting a label removes every assignment row referencing it, across all packages — there is no cascade scoped to a single collection.

### Realtime updates

Contacts has no custom WebSocket layer. PocketBase ships with a built-in realtime channel over server-sent events; `pbtsdb`'s `useLiveQuery` subscribes to the `contacts` collection for the user and replays changes. The effect is that:

- Editing a contact in tab A immediately updates tab B.
- A CardDAV client `PUT`ing a contact causes the web UI to pick it up on the next realtime tick (typically <1 s).
- An audit-log change doesn't propagate this way — audit lives in a separate viewer outside contacts' surface.

### Audit

`audit.RegisterCollection(app, "contacts", ...)` wires contacts into core's audit subsystem. The `ExtractLabel` callback builds each audit row's label from `first_name` + `last_name`; since `first_name` is required by the schema, every contact has a non-empty audit label.

## Platform support

| Feature                              | Web | iPad |
|--------------------------------------|-----|------|
| List / view contacts                 | ✅  | ✅   |
| Create / edit / delete               | ✅  | ✅   |
| Favorites                            | ✅  | ✅   |
| Labels                               | ✅  | ✅   |
| Soft delete + restore                | ✅  | ✅   |
| Permanent delete                     | ✅  | ✅   |
| Directory                            | ✅  | ✅   |
| FTS search                           | ✅  | ✅   |
| `j` / `k` / Enter / `c` shortcuts    | ✅  | external keyboard only |
| CardDAV mount                        | OS-native (Apple Contacts, DAVx5, Thunderbird, Evolution) | — |
| Realtime updates                     | ✅  | ✅   |

iPhone (small phone screens) isn't supported yet.

## Server package layout

```
server/
    register.go              Register / RegisterTenant — audit config, the core/fts
                             config (index sync + /api/contacts/search), the
                             core/carddav Source, and the vcard_uid autogen hook
    bindings.go              $contacts.* JS binding for server-side TS hooks
```

The heavy, generic Go lives once in core: the CardDAV protocol server + vCard codec at `tinycld/core/server/carddav/` and the FTS5 index sync + search at `tinycld/core/server/fts/`. This package contributes only the field maps.

Go module: `tinycld.org/packages/contacts`. Imports `tinycld.org/core/{audit,carddav,fts}` via the standard go.mod replace directive the app shell installs.

## Client package layout

```
tinycld/contacts/
    manifest.ts                 package manifest (slug, nav, sidebar, server, help)
    sidebar.tsx                 Contacts / Favorites / Directory / Deleted + Labels
    collections.ts              contacts pbtsdb registration (label_assignments is core-owned)
    types.ts                    ContactsSchema (merged into MergedSchema)
    seed.ts                     sample data
    screens/
        index.tsx               main list (filter / label / search aware)
        directory.tsx           directory view of the deployment's users, with role badges
        [id].tsx                contact detail editor
        new.tsx                 create form
    components/
        ContactForm             shared between new + detail screens
        contactSchema.ts        zod schema (single source of truth for validation)
        ContactRow              list row with star + actions
        ContactAvatar           re-exports core's NameAvatar
    hooks/
        useContactList          list + filters + mutations (favorite / delete / restore)
        useContactSearch        /api/contacts/search hook
        useContactsShortcuts    j / k / Enter / c
    stores/
        contacts-ui-store       zustand: sort field, sort direction
```

## Command line

This package contributes its own command group to the `tinycld` binary. The Go source lives in `cli/` and is declared by a `cli` block in `manifest.ts` naming the Go module and the OAuth scopes it needs (`contacts:read`, `contacts:write`). The server cross-compiles the binary; users download it from **Settings → Personal → About**.

Eight commands, under `tinycld contacts` (or the `contact` group alias):

```sh
tinycld contacts list       # --trashed lists soft-deleted contacts
tinycld contacts search
tinycld contacts show
tinycld contacts add
tinycld contacts edit       # --restore undoes a soft delete
tinycld contacts rm         # soft delete; --permanent is the only hard delete
tinycld contacts export     # vCard to stdout unless --out
tinycld contacts import     # upserts on the vCard UID
```

`rm` is a soft delete — the round trip is `list --trashed` then `edit --restore`; `--permanent` is the only hard delete. `import` upserts on the vCard UID, so re-importing updates rather than duplicating, and `export` writes vCard to stdout unless `--out` is given.

In-app help is `help/command-line.md`. See [the command line tool](https://tinycld.org/docs/command-line-tool) and the [CLI reference](https://tinycld.org/docs/reference/cli-reference).

## Development

This package is a member of the TinyCld npm workspace. Clone the workspace
members as siblings under one root, then install at the **workspace root** (never
inside a member — members carry no `node_modules` of their own):

```sh
# Clone the workspace members as siblings under one root
git clone <app-remote>      ~/code/tinycld/new/app       # the app shell (member "app")
git clone <core-remote>     ~/code/tinycld/new/core      # @tinycld/core
git clone <this-remote>     ~/code/tinycld/new/contacts  # @tinycld/contacts

# Install at the WORKSPACE ROOT — links members + runs the generator (postinstall)
cd ~/code/tinycld/new
pnpm install

# Run the full stack (Expo + PocketBase behind a proxy)
cd tinycld && pnpm run dev
```

## Standalone checks

Run checks from **inside this package** — they scope to this package only:

```sh
cd ~/code/tinycld/new/contacts
pnpm run typecheck   # tsc against this package's tsconfig (extends the shared base)
pnpm run test        # vitest, this package's tests/ only
pnpm run check       # typecheck + unit
pnpm run test:e2e    # Playwright against the app shell's live stack
```

These scripts delegate to `tinycld-pkg` (the `@tinycld/package-scripts` workspace
member): it locates the app shell, then runs the scoped command with the shell's
toolchain (so `@tinycld/core/*` imports, the `~/*` source alias, and the uniwind
type augmentation all resolve). No app-shell knowledge required.

To run checks across **every** member at once, from the app shell:

```sh
cd ~/code/tinycld/new/tinycld
pnpm run pkg:check      # typecheck + unit, every member, with a per-package summary
pnpm run pkg:test:unit  # unit only, every member
pnpm run pkg:test:e2e   # e2e, every member with a Playwright project
```

## CI

`.github/workflows/ci.yml` (in the workspace root) runs `pnpm install` then
`cd tinycld && pnpm run pkg:check` — typecheck + unit across every member, exactly
what you'd run locally. Go tests and live e2e run in separate lanes.

## Package anatomy

- `manifest.ts` — single source of truth for capabilities (routes, nav, sidebar, collections, migrations, server module, help)
- `package.json` — name, exports map, peer deps
- `tsconfig.json` — typecheck config (a thin extend of the app's `tsconfig.package-base.json`)
- `pb-migrations/` — PocketBase migrations (symlinked into the app shell's server on `packages:generate`)
- `server/` — Go server module, registered by the generator
- `cli/` — Go source for this package's `tinycld` command group
- `help/` — in-app help topics (markdown + frontmatter)
- `tests/` — vitest unit tests + Playwright e2e specs (run via `tinycld-pkg` from this dir)
- `vitest.config.ts` / `playwright.config.ts` — thin per-package configs inheriting the app shell's canonical config
- `tinycld/contacts/` — TypeScript source
- `tinycld/contacts/automation.ts` — the automation trigger + action catalog
