// Package contacts is the contacts feature's PocketBase server extension. It is
// linked into the app-shell binary by the generator (from the manifest's
// `server: { package, module }` field) and its Register(app) is called once at
// boot.
//
// It wires the contacts feature's server-side Go by driving core's reusable
// capability libraries with a contacts-shaped config, and adds the small pieces
// that are genuinely contacts-specific (the vcard_uid autogen hook and a
// $contacts JS binding). The heavy, generic Go — the CardDAV protocol server +
// vCard codec, and the FTS5 index sync + search — lives once in core
// (tinycld.org/core/{carddav,fts}); this package contributes only the field map.
//
// Extension points for package authors / customizers (no fork needed):
//   - TS record hooks: drop a *.pb.ts into pb-hooks/ and bind onRecordCreate/
//     Update/Delete('contacts'); it runs alongside this Go on the sobek jsvm.
//   - core/fts binds the standard PocketBase record events
//     (OnRecordAfter{Create,Update,Delete}Success('contacts')) for index sync; a
//     TS hook can bind those same events.
//   - The $contacts.* JS binding (bindings.go) exposes Go-backed search to TS.
package contacts

import (
	"strings"

	"github.com/google/uuid"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"

	"tinycld.org/core/audit"
	"tinycld.org/core/carddav"
	"tinycld.org/core/fts"
)

// ftsConfig is the contacts FTS index/search config, shared by Register (sync
// hooks + the /api/contacts/search route) and the $contacts.search binding
// (bindings.go). The fts_contacts virtual table is created by the package's
// pb-migration; this only reads/writes it.
var ftsConfig = fts.Config{
	Slug:       "contacts",
	Collection: "contacts",
	Table:      "fts_contacts",
	Columns: []fts.Column{
		{FTS: "first_name", Field: "first_name"},
		{FTS: "last_name", Field: "last_name"},
		{FTS: "email", Field: "email"},
		{FTS: "company", Field: "company"},
		{FTS: "phone", Field: "phone"},
		{FTS: "notes", Field: "notes", Strip: true},
	},
	Owner: fts.OwnerScope{Field: "owner"},
	Output: []fts.OutputColumn{
		{Name: "first_name"},
		{Name: "last_name"},
		{Name: "email"},
		{Name: "company"},
		{Name: "phone"},
		{Name: "favorite", Type: "bool"},
		{Name: "deleted_at"},
	},
	SoftDeleteField: "deleted_at",
}

// cardDAVSource maps the contacts collection to a vCard address book. Single-org:
// owner holds a users id directly, so the book is the caller's own contacts.
var cardDAVSource = carddav.Source{
	Slug:            "contacts",
	Collection:      "contacts",
	ListFilter:      "owner = {:ownerId} && deleted_at = ''",
	Sort:            "-updated",
	OwnerField:      "owner",
	UIDField:        "vcard_uid",
	SoftDeleteField: "deleted_at",
	VCard: carddav.VCardMap{
		Version: "4.0",
		Name:    carddav.NameMap{Given: "first_name", Family: "last_name"},
		Simple: map[string]string{
			"EMAIL": "email",
			"TEL":   "phone",
			"ORG":   "company",
			"TITLE": "job_title",
			"NOTE":  "notes",
		},
		RevField: "updated",
	},
}

// Register composes the contacts server for the SINGLE-ORG app: the shared set
// plus the host-only tail. The generator's package_extensions.go calls it.
func Register(app *pocketbase.PocketBase) {
	registerShared(app)

	// ---- Host-only ----
	// CardDAV mount. A multi-org tenant mounts /carddav itself, from the
	// materialized manifest `carddav` block (coreserver.RegisterTenant), so
	// mounting here too would double-bind the routes. The materialized lists
	// are authoritative for what a tenant serves; this call is the single-org
	// equivalent.
	carddav.Register(app, []carddav.Source{cardDAVSource})
}

// RegisterTenant composes the contacts server for a multi-org TENANT process:
// the shared set only. The router's pinned package menu calls it, gated by the
// org's resolved package set (multi-org/docs/SCOPE-tenant-feature-go.md).
//
// Do NOT hand-pick registrations here — add to registerShared so both
// compositions get them, or to Register's host-only tail with a reason. A
// hand-rolled subset is exactly the drift that produced
// multi-org/docs/FINDING-tenant-composition-gap.md.
func RegisterTenant(app *pocketbase.PocketBase) {
	registerShared(app)
}

// registerShared is the single source of truth for what BOTH compositions run.
func registerShared(app *pocketbase.PocketBase) {
	// Audit logging via core's reusable helper. Single-org: audit rows carry no
	// org, so only the display label (first + last name) is customized.
	audit.RegisterCollection(app, "contacts", &audit.CollectionConfig{
		ExtractLabel: func(record *core.Record) string {
			first := record.GetString("first_name")
			last := record.GetString("last_name")
			return strings.TrimSpace(first + " " + last)
		},
	})

	// FTS index-sync record hooks + GET /api/contacts/search, from core/fts.
	fts.Register(app, []fts.Config{ftsConfig})

	// Auto-generate a stable vcard_uid for contacts created via the web UI so
	// CardDAV clients get a consistent object path. (core/carddav also backfills
	// a UID on read for older rows; this covers the create path.)
	app.OnRecordCreate("contacts").BindFunc(func(e *core.RecordEvent) error {
		if e.Record.GetString("vcard_uid") == "" {
			e.Record.Set("vcard_uid", "urn:uuid:"+uuid.NewString())
		}
		return e.Next()
	})

	// $contacts.* JS binding for TS hooks that need Go-backed contacts logic.
	registerJSVMBinding(app)
}
