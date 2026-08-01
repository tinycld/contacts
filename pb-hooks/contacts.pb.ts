/// <reference path="../../tinycld/server/pb_data/types.d.ts" />

// Contacts server-side TS hooks (runs on the sobek jsvm in both the single-tenant
// app and multi-org tenants).
//
// This is the customization seam for package authors and downstream integrators:
// the contacts feature's core behavior (CardDAV, full-text search, audit, and
// vcard_uid autogen) lives in the package's Go server (server/register.go), and
// runs REGARDLESS of this file. Add TS here to layer extra behavior on top —
// it runs alongside the Go on the same record events, so you don't fork the Go.
//
// What you can do here:
//   - Bind onRecordCreate/onRecordUpdate/onRecordDelete('contacts') to react to
//     the same events the Go server does (e.g. derive a field, call a webhook).
//   - Call the Go-backed $contacts.* bindings the server exposes, e.g.
//       const { items, total } = $contacts.search(userId, { q: 'ada', limit: 10 })
//
// Note: the fork's TS→JS hook transpile wraps each callback so top-level module
// bindings (a `const` or `function` declared outside the callback) are not in
// scope at request time — keep everything a hook needs inside the callback body.
//
// Example: a no-op create hook, live so this file transpiles to real JS (an
// all-comment .pb.ts compiles to an empty module, which the loader rejects with
// "sourcemap: mappings are empty"). Replace the body to add real behavior — e.g.
// stamp a field, call a webhook, or read $contacts.search(...).
onRecordCreate((e) => {
    e.next()
}, 'contacts')
