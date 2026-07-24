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
onRecordCreate((e) => {
    if (!e.record.getString('vcard_uid')) {
        e.record.set('vcard_uid', 'urn:uuid:' + uuidv4())
    }
    e.next()
}, 'contacts')

// uuidv4 builds an RFC-4122 v4 UUID from crypto-strong random hex. The sobek
// runtime exposes no native UUID, so compose one from $security random hex and
// set the version/variant nibbles.
function uuidv4(): string {
    const hex = $security.randomStringWithAlphabet(32, '0123456789abcdef').split('')
    hex[12] = '4' // version 4
    hex[16] = $security.randomStringWithAlphabet(1, '89ab') // variant 10xx
    const s = hex.join('')
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`
}
