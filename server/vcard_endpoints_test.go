package contacts

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
	"github.com/pocketbase/pocketbase/tools/types"

	"tinycld.org/core/rlstest"
)

// vcard_endpoints_test.go covers GET /api/contacts/export and
// POST /api/contacts/import.
//
// These are RAW routes: PocketBase evaluates collection rules for
// /api/collections/... but not for anything bound on e.Router, so the rules
// proven by disabled_rls_test.go do not apply here at all. Every access
// decision on these two endpoints is made by the Go in vcard_endpoints.go, and
// these tests are the only thing holding it. That is why the suite covers the
// cross-user and suspended-account cases as carefully as the happy path — a
// handler that forgot the owner filter would serve the whole org's address book
// and still pass a naive round-trip test.
//
// The app is built from the SHIPPED pb-migrations (rlstest) rather than a
// hand-declared schema, so a later migration that renames a field or adds a
// required one turns these red instead of leaving them green against a stale
// local copy.

type vcardEnv struct {
	app    *tests.TestApp
	owner  *core.Record
	other  *core.Record
	token  string
	router http.Handler
}

func setupVCardApp(t *testing.T) *vcardEnv {
	t.Helper()
	app := rlstest.NewApp(t)

	// `disabled` and `role` belong to core's users schema, which this module
	// does not carry; the shipped contacts rules and the endpoints read them.
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatal(err)
	}
	users.Fields.Add(&core.BoolField{Name: "disabled"})
	if err := app.Save(users); err != nil {
		t.Fatalf("add users fields: %v", err)
	}

	rlstest.Apply(t, app, rlstest.MigrationsDir(t, "../pb-migrations"))

	env := &vcardEnv{app: app}
	env.owner = vcardTestUser(t, app, "owner@test.local")
	env.other = vcardTestUser(t, app, "other@test.local")

	token, err := env.owner.NewAuthToken()
	if err != nil {
		t.Fatal(err)
	}
	env.token = token

	// The vcard_uid create hook is the reason a UI-created contact has a UID at
	// all, and the export/import identity depends on it. Bind the real one
	// rather than stamping UIDs by hand in seedContact, so a change to the hook
	// shows up here instead of being masked by the fixture.
	bindVCardUIDHook(app)

	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		bindVCardEndpoints(app, e)
		return e.Next()
	})

	return env
}

func vcardTestUser(t *testing.T, app core.App, email string) *core.Record {
	t.Helper()
	col, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatal(err)
	}
	r := core.NewRecord(col)
	r.SetEmail(email)
	r.Set("name", strings.Split(email, "@")[0])
	r.SetVerified(true)
	r.SetPassword("Password123!")
	if err := app.Save(r); err != nil {
		t.Fatalf("save user %s: %v", email, err)
	}
	return r
}

// seedContact writes a contacts row directly. Saving through the app runs the
// vcard_uid create hook from registerShared, so seeded rows get a UID exactly
// as a UI-created contact does.
func seedContact(t *testing.T, env *vcardEnv, owner *core.Record, first, last string) *core.Record {
	t.Helper()
	col, err := env.app.FindCollectionByNameOrId("contacts")
	if err != nil {
		t.Fatal(err)
	}
	r := core.NewRecord(col)
	r.Set("first_name", first)
	r.Set("last_name", last)
	r.Set("email", strings.ToLower(first)+"@example.com")
	r.Set("owner", owner.Id)
	if err := env.app.Save(r); err != nil {
		t.Fatalf("seed contact %s %s: %v", first, last, err)
	}
	return r
}

// do performs an HTTP roundtrip against the test app's router, bypassing
// tests.ApiScenario because these assertions need the full response body in
// every branch (the vCard payload, the import counts) rather than a
// short-circuiting status/content match.
//
// The router is built lazily and cached, mirroring the production lifecycle:
// the handler is built once, after every OnServe binder has registered.
func (env *vcardEnv) do(t *testing.T, req *http.Request) *httptest.ResponseRecorder {
	t.Helper()
	if env.router == nil {
		router, err := apis.NewRouter(env.app)
		if err != nil {
			t.Fatalf("apis.NewRouter: %v", err)
		}
		serveEvent := new(core.ServeEvent)
		serveEvent.App = env.app
		serveEvent.Router = router
		if err := env.app.OnServe().Trigger(serveEvent); err != nil {
			t.Fatalf("OnServe.Trigger: %v", err)
		}
		mux, err := router.BuildMux()
		if err != nil {
			t.Fatalf("BuildMux: %v", err)
		}
		env.router = mux
	}
	rec := httptest.NewRecorder()
	env.router.ServeHTTP(rec, req)
	return rec
}

func (env *vcardEnv) exportReq(t *testing.T, token string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/contacts/export", nil)
	if token != "" {
		req.Header.Set("Authorization", token)
	}
	return env.do(t, req)
}

func (env *vcardEnv) importReq(t *testing.T, token, body string) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	part, err := mw.CreateFormFile("file", "contacts.vcf")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write([]byte(body)); err != nil {
		t.Fatal(err)
	}
	if err := mw.Close(); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/contacts/import", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	if token != "" {
		req.Header.Set("Authorization", token)
	}
	return env.do(t, req)
}

func decodeImportResult(t *testing.T, rec *httptest.ResponseRecorder) importResult {
	t.Helper()
	var out importResult
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode import response %q: %v", rec.Body.String(), err)
	}
	return out
}

func TestVCardExport_ReturnsOneBlockPerContact(t *testing.T) {
	env := setupVCardApp(t)
	seedContact(t, env, env.owner, "Ada", "Lovelace")
	seedContact(t, env, env.owner, "Alan", "Turing")

	rec := env.exportReq(t, env.token)
	if rec.Code != http.StatusOK {
		t.Fatalf("export status %d, want 200 (body %q)", rec.Code, rec.Body.String())
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/vcard") {
		t.Fatalf("export Content-Type %q, want text/vcard", ct)
	}

	body := rec.Body.String()
	if got := strings.Count(body, "BEGIN:VCARD"); got != 2 {
		t.Fatalf("export has %d VCARD blocks, want 2\n%s", got, body)
	}
	for _, want := range []string{"Ada", "Lovelace", "Alan", "Turing"} {
		if !strings.Contains(body, want) {
			t.Fatalf("export missing %q\n%s", want, body)
		}
	}
}

// A vCard file has no URL path, so UID in the body is the only identity an
// import can match on. Without it a user's own export re-imports as duplicates.
func TestVCardExport_EmitsUID(t *testing.T) {
	env := setupVCardApp(t)
	contact := seedContact(t, env, env.owner, "Ada", "Lovelace")

	uid := contact.GetString("vcard_uid")
	if uid == "" {
		t.Fatal("seeded contact has no vcard_uid — the create hook did not run")
	}

	body := env.exportReq(t, env.token).Body.String()
	if !strings.Contains(body, uid) {
		t.Fatalf("export omits UID %q — a re-import cannot match it\n%s", uid, body)
	}
}

// The security case: these routes never run collection rules, so the owner
// filter in the handler is the ONLY thing separating two users' address books.
func TestVCardExport_ExcludesOtherUsersContacts(t *testing.T) {
	env := setupVCardApp(t)
	seedContact(t, env, env.owner, "Ada", "Lovelace")
	seedContact(t, env, env.other, "Grace", "Hopper")

	body := env.exportReq(t, env.token).Body.String()
	if strings.Contains(body, "Grace") || strings.Contains(body, "Hopper") {
		t.Fatalf("export leaked another user's contact\n%s", body)
	}
	if got := strings.Count(body, "BEGIN:VCARD"); got != 1 {
		t.Fatalf("export has %d VCARD blocks, want 1\n%s", got, body)
	}
}

func TestVCardExport_ExcludesSoftDeletedContacts(t *testing.T) {
	env := setupVCardApp(t)
	seedContact(t, env, env.owner, "Ada", "Lovelace")
	gone := seedContact(t, env, env.owner, "Deleted", "Person")
	gone.Set("deleted_at", types.NowDateTime())
	if err := env.app.Save(gone); err != nil {
		t.Fatal(err)
	}

	body := env.exportReq(t, env.token).Body.String()
	if strings.Contains(body, "Deleted") {
		t.Fatalf("export included a soft-deleted contact\n%s", body)
	}
}

func TestVCardExport_RequiresAuth(t *testing.T) {
	env := setupVCardApp(t)
	seedContact(t, env, env.owner, "Ada", "Lovelace")

	rec := env.exportReq(t, "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous export status %d, want 401 (body %q)", rec.Code, rec.Body.String())
	}
}

// coreserver's disabled guard blocks token ISSUANCE, not use, so a token minted
// before suspension stays live. The collection rules close that for REST; a raw
// route has to close it itself.
func TestVCardExport_DisabledUserGetsNothing(t *testing.T) {
	env := setupVCardApp(t)
	seedContact(t, env, env.owner, "Ada", "Lovelace")
	disableVCardUser(t, env, env.owner)

	rec := env.exportReq(t, env.token)
	if rec.Code == http.StatusOK && strings.Contains(rec.Body.String(), "Ada") {
		t.Fatalf("suspended user exported their address book (status %d)\n%s",
			rec.Code, rec.Body.String())
	}
	if rec.Code != http.StatusForbidden {
		t.Fatalf("suspended export status %d, want 403 (body %q)", rec.Code, rec.Body.String())
	}
}

func disableVCardUser(t *testing.T, env *vcardEnv, user *core.Record) {
	t.Helper()
	fresh, err := env.app.FindRecordById("users", user.Id)
	if err != nil {
		t.Fatal(err)
	}
	fresh.Set("disabled", true)
	if err := env.app.Save(fresh); err != nil {
		t.Fatal(err)
	}
}

const vcardAda = `BEGIN:VCARD
VERSION:4.0
UID:urn:uuid:11111111-1111-1111-1111-111111111111
FN:Ada Lovelace
N:Lovelace;Ada;;;
EMAIL:ada@example.com
ORG:Analytical Engines
END:VCARD
`

func TestVCardImport_CreatesContact(t *testing.T) {
	env := setupVCardApp(t)

	rec := env.importReq(t, env.token, vcardAda)
	if rec.Code != http.StatusOK {
		t.Fatalf("import status %d, want 200 (body %q)", rec.Code, rec.Body.String())
	}
	got := decodeImportResult(t, rec)
	if got.Created != 1 || got.Updated != 0 {
		t.Fatalf("import reported created=%d updated=%d, want 1/0", got.Created, got.Updated)
	}

	records, err := env.app.FindRecordsByFilter("contacts", "owner = {:o}", "", 0, 0,
		map[string]any{"o": env.owner.Id})
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 {
		t.Fatalf("after import found %d contacts, want 1", len(records))
	}
	if got := records[0].GetString("first_name"); got != "Ada" {
		t.Fatalf("imported first_name %q, want Ada", got)
	}
	if got := records[0].GetString("company"); got != "Analytical Engines" {
		t.Fatalf("imported company %q, want Analytical Engines", got)
	}
	if got := records[0].GetString("owner"); got != env.owner.Id {
		t.Fatalf("imported contact owner %q, want the caller %q", got, env.owner.Id)
	}
}

// Re-importing your own export must not duplicate every contact — the whole
// reason UID is emitted on export.
func TestVCardImport_UpsertsOnKnownUID(t *testing.T) {
	env := setupVCardApp(t)
	existing := seedContact(t, env, env.owner, "Ada", "Lovelace")
	existing.Set("vcard_uid", "urn:uuid:11111111-1111-1111-1111-111111111111")
	if err := env.app.Save(existing); err != nil {
		t.Fatal(err)
	}

	rec := env.importReq(t, env.token, vcardAda)
	if rec.Code != http.StatusOK {
		t.Fatalf("import status %d, want 200 (body %q)", rec.Code, rec.Body.String())
	}
	got := decodeImportResult(t, rec)
	if got.Created != 0 || got.Updated != 1 {
		t.Fatalf("import reported created=%d updated=%d, want 0/1", got.Created, got.Updated)
	}

	records, err := env.app.FindRecordsByFilter("contacts", "owner = {:o}", "", 0, 0,
		map[string]any{"o": env.owner.Id})
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 {
		t.Fatalf("after re-import found %d contacts, want 1 (UID upsert failed)", len(records))
	}
	if got := records[0].GetString("company"); got != "Analytical Engines" {
		t.Fatalf("upsert did not apply the card: company %q", got)
	}
}

// A UID belonging to ANOTHER user must not be matched — otherwise a crafted
// card overwrites someone else's contact.
func TestVCardImport_DoesNotUpsertAcrossOwners(t *testing.T) {
	env := setupVCardApp(t)
	theirs := seedContact(t, env, env.other, "Grace", "Hopper")
	theirs.Set("vcard_uid", "urn:uuid:11111111-1111-1111-1111-111111111111")
	if err := env.app.Save(theirs); err != nil {
		t.Fatal(err)
	}

	rec := env.importReq(t, env.token, vcardAda)
	if rec.Code != http.StatusOK {
		t.Fatalf("import status %d, want 200 (body %q)", rec.Code, rec.Body.String())
	}
	got := decodeImportResult(t, rec)
	if got.Created != 1 {
		t.Fatalf("import reported created=%d, want 1 (matched across owners)", got.Created)
	}

	fresh, err := env.app.FindRecordById("contacts", theirs.Id)
	if err != nil {
		t.Fatal(err)
	}
	if fresh.GetString("first_name") != "Grace" {
		t.Fatalf("import overwrote another user's contact: first_name %q",
			fresh.GetString("first_name"))
	}
}

// idx_contacts_vcard_uid is globally unique, but vCard UIDs are only unique
// within an address book (RFC 6350) — two people are routinely sent the same
// card. Without regenerating the UID on collision, whoever imported a contact
// first would permanently block everyone else from importing it.
func TestVCardImport_RegeneratesUIDTakenByAnotherOwner(t *testing.T) {
	env := setupVCardApp(t)
	theirs := seedContact(t, env, env.other, "Grace", "Hopper")
	theirs.Set("vcard_uid", "urn:uuid:11111111-1111-1111-1111-111111111111")
	if err := env.app.Save(theirs); err != nil {
		t.Fatal(err)
	}

	got := decodeImportResult(t, env.importReq(t, env.token, vcardAda))
	if got.Created != 1 || got.Failed != 0 {
		t.Fatalf("import of a card whose UID another user holds gave created=%d "+
			"failed=%d %v, want 1/0", got.Created, got.Failed, got.Errors)
	}

	records, err := env.app.FindRecordsByFilter("contacts", "owner = {:o}", "", 0, 0,
		map[string]any{"o": env.owner.Id})
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 {
		t.Fatalf("found %d contacts for the caller, want 1", len(records))
	}
	uid := records[0].GetString("vcard_uid")
	if uid == "" {
		t.Fatal("imported contact has no vcard_uid")
	}
	if uid == theirs.GetString("vcard_uid") {
		t.Fatalf("imported contact kept the colliding UID %q", uid)
	}
}

// Import must not resurrect a contact the user deleted: export already skips
// soft-deleted rows, so re-importing an old file would otherwise silently
// undelete whatever it still contains.
func TestVCardImport_DoesNotResurrectSoftDeletedContact(t *testing.T) {
	env := setupVCardApp(t)
	gone := seedContact(t, env, env.owner, "Ada", "Lovelace")
	gone.Set("vcard_uid", "urn:uuid:11111111-1111-1111-1111-111111111111")
	gone.Set("deleted_at", types.NowDateTime())
	if err := env.app.Save(gone); err != nil {
		t.Fatal(err)
	}

	rec := env.importReq(t, env.token, vcardAda)
	if rec.Code != http.StatusOK {
		t.Fatalf("import status %d, want 200 (body %q)", rec.Code, rec.Body.String())
	}

	fresh, err := env.app.FindRecordById("contacts", gone.Id)
	if err != nil {
		t.Fatal(err)
	}
	if fresh.GetString("deleted_at") == "" {
		t.Fatal("import resurrected a soft-deleted contact")
	}
}

// A card with no UID cannot be matched, so it creates — and gets a generated
// UID, matching the create hook, so the NEXT export/import round-trips.
func TestVCardImport_GeneratesUIDWhenCardHasNone(t *testing.T) {
	env := setupVCardApp(t)

	const noUID = `BEGIN:VCARD
VERSION:4.0
FN:Grace Hopper
N:Hopper;Grace;;;
END:VCARD
`
	rec := env.importReq(t, env.token, noUID)
	if rec.Code != http.StatusOK {
		t.Fatalf("import status %d, want 200 (body %q)", rec.Code, rec.Body.String())
	}

	records, err := env.app.FindRecordsByFilter("contacts", "owner = {:o}", "", 0, 0,
		map[string]any{"o": env.owner.Id})
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 {
		t.Fatalf("found %d contacts, want 1", len(records))
	}
	if records[0].GetString("vcard_uid") == "" {
		t.Fatal("imported contact has no vcard_uid — it will duplicate on the next import")
	}
}

// Fault tolerance: one bad card must not lose the rest of the file, but the
// response has to NAME what failed so nothing is silently dropped.
func TestVCardImport_ReportsMalformedCardWithoutFailingRequest(t *testing.T) {
	env := setupVCardApp(t)

	// The second block never terminates, so the parser fails mid-file.
	body := vcardAda + "BEGIN:VCARD\nVERSION:4.0\nFN:Broken\n"

	rec := env.importReq(t, env.token, body)
	if rec.Code != http.StatusOK {
		t.Fatalf("import status %d, want 200 — a malformed card must not fail the "+
			"whole request (body %q)", rec.Code, rec.Body.String())
	}
	got := decodeImportResult(t, rec)
	if got.Created != 1 {
		t.Fatalf("import reported created=%d, want 1 (the good card before the bad one)",
			got.Created)
	}
	if got.Failed == 0 || len(got.Errors) == 0 {
		t.Fatalf("import silently dropped a malformed card: %+v", got)
	}
}

// A contact whose required first_name is absent must be counted as failed
// rather than aborting the file or saving a half-record.
func TestVCardImport_ReportsUnsavableCard(t *testing.T) {
	env := setupVCardApp(t)

	const noName = `BEGIN:VCARD
VERSION:4.0
UID:urn:uuid:22222222-2222-2222-2222-222222222222
EMAIL:nobody@example.com
END:VCARD
`
	rec := env.importReq(t, env.token, vcardAda+noName)
	if rec.Code != http.StatusOK {
		t.Fatalf("import status %d, want 200 (body %q)", rec.Code, rec.Body.String())
	}
	got := decodeImportResult(t, rec)
	if got.Created != 1 {
		t.Fatalf("import reported created=%d, want 1", got.Created)
	}
	if got.Failed != 1 || len(got.Errors) != 1 {
		t.Fatalf("a contact with no name was not reported as failed: %+v", got)
	}
}

func TestVCardImport_RequiresAuth(t *testing.T) {
	env := setupVCardApp(t)

	rec := env.importReq(t, "", vcardAda)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous import status %d, want 401 (body %q)", rec.Code, rec.Body.String())
	}
}

func TestVCardImport_DisabledUserCannotWrite(t *testing.T) {
	env := setupVCardApp(t)
	disableVCardUser(t, env, env.owner)

	rec := env.importReq(t, env.token, vcardAda)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("suspended import status %d, want 403 (body %q)", rec.Code, rec.Body.String())
	}

	records, err := env.app.FindRecordsByFilter("contacts", "owner = {:o}", "", 0, 0,
		map[string]any{"o": env.owner.Id})
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 0 {
		t.Fatalf("suspended user wrote %d contacts", len(records))
	}
}

// The round-trip the whole feature exists for: export a book, import it back,
// and end up with the same contacts rather than twice as many.
func TestVCardRoundTrip_ExportThenImportIsIdempotent(t *testing.T) {
	env := setupVCardApp(t)
	seedContact(t, env, env.owner, "Ada", "Lovelace")
	seedContact(t, env, env.owner, "Alan", "Turing")

	exported := env.exportReq(t, env.token).Body.String()

	rec := env.importReq(t, env.token, exported)
	if rec.Code != http.StatusOK {
		t.Fatalf("re-import status %d, want 200 (body %q)", rec.Code, rec.Body.String())
	}
	got := decodeImportResult(t, rec)
	if got.Created != 0 || got.Updated != 2 || got.Failed != 0 {
		t.Fatalf("re-importing an export gave created=%d updated=%d failed=%d, "+
			"want 0/2/0", got.Created, got.Updated, got.Failed)
	}

	records, err := env.app.FindRecordsByFilter("contacts", "owner = {:o}", "", 0, 0,
		map[string]any{"o": env.owner.Id})
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 2 {
		t.Fatalf("round-trip left %d contacts, want 2", len(records))
	}
}
