/// <reference path="../../tinycld/server/pb_data/types.d.ts" />

// Contacts server-side hooks (TypeScript, runs on the sobek jsvm in both the
// single-tenant app and multi-org tenants).
//
// This is the ONLY imperative server logic contacts contributes as code; every
// other former Go behavior is now core-owned and driven by manifest config:
//   - CardDAV        → core `carddav` capability, `carddav` manifest block
//   - FTS index+search → core `fts` capability, `fts` manifest block
//   - audit          → core audit registration, `audit` manifest block
//
// Auto-generate a stable vCard UID for contacts created through the web UI so
// CardDAV clients get a consistent object path. (The CardDAV backend also
// backfills a UID on read for older rows; this covers the create path.)
//
// The UUID logic is INLINED in the callback rather than factored into a
// top-level helper on purpose: the fork's TS→JS hook transpile wraps each hook
// so that top-level module bindings in a .pb.ts (a `function` OR a `const`
// arrow, declared before or after) are not in scope when the callback runs at
// request time — referencing one throws "X is not defined". Until that transpile
// seam is fixed, keep everything a hook needs inside the callback body.
onRecordCreate((e) => {
    if (!e.record.getString('vcard_uid')) {
        // RFC-4122 v4 UUID from crypto-strong random hex (sobek has no native
        // UUID): compose from $security random hex and set version/variant nibbles.
        const hex = $security.randomStringWithAlphabet(32, '0123456789abcdef').split('')
        hex[12] = '4' // version 4
        hex[16] = $security.randomStringWithAlphabet(1, '89ab') // variant 10xx
        const s = hex.join('')
        const uid = `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`
        e.record.set('vcard_uid', `urn:uuid:${uid}`)
    }
    e.next()
}, 'contacts')
