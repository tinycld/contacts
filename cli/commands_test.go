package cli

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// book builds the standard fixture:
//
//	cntA  Ada Lovelace   ada@example.com    (favorite)
//	cntB  Grace Hopper   grace@example.com
//	cntC  Alan Turing    alan@example.com   (soft-deleted)
func book(t *testing.T) *fakeContacts {
	f := newFakeContacts(t)
	f.add("cntA", "Ada", "Lovelace", "ada@example.com").Favorite = true
	f.add("cntB", "Grace", "Hopper", "grace@example.com")
	f.add("cntC", "Alan", "Turing", "alan@example.com").DeletedAt = "2026-08-01 09:00:00Z"
	return f
}

func TestListShowsLiveContacts(t *testing.T) {
	f := book(t)
	_, c := f.serve()
	out, _, err := runCmd(t, c, "contacts", "list")
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"Ada", "Grace", "ada@example.com"} {
		if !strings.Contains(out, want) {
			t.Errorf("list missing %q:\n%s", want, out)
		}
	}
}

// A soft-deleted contact is in the Trash, not the address book. The old
// per-package search endpoint leaked those rows; the federated source
// deliberately does not, and neither must `list`.
func TestListHidesTrashedUnlessTrashed(t *testing.T) {
	f := book(t)
	_, c := f.serve()

	out, _, err := runCmd(t, c, "contacts", "list")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(out, "Turing") {
		t.Errorf("soft-deleted contact listed:\n%s", out)
	}

	out, _, err = runCmd(t, c, "contacts", "list", "--trashed")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "Turing") {
		t.Errorf("--trashed did not list the soft-deleted contact:\n%s", out)
	}
	if strings.Contains(out, "Lovelace") {
		t.Errorf("--trashed must show ONLY trashed contacts:\n%s", out)
	}
}

func TestListFavoritesOnly(t *testing.T) {
	f := book(t)
	_, c := f.serve()
	out, _, err := runCmd(t, c, "contacts", "list", "--favorites")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "Ada") {
		t.Errorf("--favorites dropped a favorite:\n%s", out)
	}
	if strings.Contains(out, "Grace") {
		t.Errorf("--favorites listed a non-favorite:\n%s", out)
	}
}

// The whole contract of `contacts search`: contacts has NO package search
// route (register.go calls fts.RegisterSync, not fts.Register), so the command
// must go through the federated aggregator scoped to this package. The fake
// fails the test if /api/contacts/search is touched at all.
func TestSearchUsesFederatedEndpointScopedToContacts(t *testing.T) {
	f := book(t)
	f.searchRows = []searchRow{{
		Slug: "contacts", ID: "cntA", Title: "Ada Lovelace", Subtitle: "ada@example.com",
		Fields: map[string]any{
			"first_name": "Ada", "last_name": "Lovelace",
			"email": "ada@example.com", "phone": "555-0100", "company": "Analytical",
		},
	}}
	_, c := f.serve()

	out, _, err := runCmd(t, c, "contacts", "search", "ada")
	if err != nil {
		t.Fatal(err)
	}
	if got := f.searchQuery.Get("q"); got != "ada" {
		t.Errorf("q = %q, want %q", got, "ada")
	}
	if got := f.searchQuery["pkg"]; len(got) != 1 || got[0] != "contacts" {
		t.Errorf("pkg = %v, want [contacts] — search must not span other packages", got)
	}
	// Rendered from Fields, which the search source populates precisely so a
	// client can build a contacts table from a normalized row.
	for _, want := range []string{"Ada", "Lovelace", "ada@example.com", "555-0100"} {
		if !strings.Contains(out, want) {
			t.Errorf("search output missing %q:\n%s", want, out)
		}
	}
}

func TestSearchPassesLimit(t *testing.T) {
	f := book(t)
	_, c := f.serve()
	if _, _, err := runCmd(t, c, "contacts", "search", "ada", "--limit", "5"); err != nil {
		t.Fatal(err)
	}
	if got := f.searchQuery.Get("limit"); got != "5" {
		t.Errorf("limit = %q, want 5", got)
	}
}

func TestShow(t *testing.T) {
	f := book(t)
	f.contacts["cntA"].Phone = "555-0100"
	f.contacts["cntA"].Notes = "Wrote the first algorithm"
	_, c := f.serve()

	out, _, err := runCmd(t, c, "contacts", "show", "cntA")
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"Ada", "Lovelace", "ada@example.com", "555-0100", "Wrote the first algorithm"} {
		if !strings.Contains(out, want) {
			t.Errorf("show missing %q:\n%s", want, out)
		}
	}
}

// Every flag must reach the record. A flag that parses but is never sent is
// the failure mode a fake server catches only if the test reads what was SENT.
func TestAddRoundTripsEveryFlag(t *testing.T) {
	f := book(t)
	_, c := f.serve()

	_, _, err := runCmd(t, c, "contacts", "add",
		"--first", "Katherine", "--last", "Johnson",
		"--email", "kj@example.com", "--phone", "555-0199",
		"--company", "NASA", "--title", "Mathematician",
		"--notes", "Orbital mechanics", "--favorite")
	if err != nil {
		t.Fatal(err)
	}

	want := map[string]any{
		"first_name": "Katherine", "last_name": "Johnson",
		"email": "kj@example.com", "phone": "555-0199",
		"company": "NASA", "job_title": "Mathematician",
		"notes": "Orbital mechanics", "favorite": true,
	}
	for key, value := range want {
		if got := f.lastCreate[key]; got != value {
			t.Errorf("create[%q] = %v, want %v", key, got, value)
		}
	}
	// owner is set explicitly, mirroring the app's create form: the collection
	// rule requires owner = @request.auth.id, so an omitted owner is rejected.
	if got := f.lastCreate["owner"]; got != "user1" {
		t.Errorf("create[owner] = %v, want user1 (resolved from /oauth/userinfo)", got)
	}
}

func TestAddRequiresAName(t *testing.T) {
	f := book(t)
	_, c := f.serve()
	if _, _, err := runCmd(t, c, "contacts", "add", "--email", "nobody@example.com"); err == nil {
		t.Fatal("add without --first must fail: first_name is required and min 1")
	}
}

// edit sends ONLY the flags the user passed. Sending the whole struct would
// blank every field the user did not mention.
func TestEditSendsOnlyProvidedFlags(t *testing.T) {
	f := book(t)
	_, c := f.serve()

	if _, _, err := runCmd(t, c, "contacts", "edit", "cntA", "--phone", "555-0111"); err != nil {
		t.Fatal(err)
	}
	if got := f.lastPatch["phone"]; got != "555-0111" {
		t.Errorf("patch[phone] = %v", got)
	}
	if len(f.lastPatch) != 1 {
		t.Errorf("edit sent %v — an unmentioned field must not be overwritten", f.lastPatch)
	}
}

func TestEditWithNoFlagsFails(t *testing.T) {
	f := book(t)
	_, c := f.serve()
	if _, _, err := runCmd(t, c, "contacts", "edit", "cntA"); err == nil {
		t.Fatal("edit with no flags must fail rather than send an empty patch")
	}
}

// rm is a SOFT delete — it sets deleted_at, matching the app's delete action,
// so the contact lands in the Trash and stays restorable. A DELETE here would
// be unrecoverable data loss from a command a user expects to be undoable.
func TestRmSoftDeletes(t *testing.T) {
	f := book(t)
	_, c := f.serve()

	if _, _, err := runCmd(t, c, "contacts", "rm", "cntA", "--yes"); err != nil {
		t.Fatal(err)
	}
	if len(f.deleted) != 0 {
		t.Fatalf("rm issued a hard DELETE for %v — it must soft-delete", f.deleted)
	}
	stamp, ok := f.lastPatch["deleted_at"].(string)
	if !ok || stamp == "" {
		t.Fatalf("rm patch = %v, want a non-empty deleted_at", f.lastPatch)
	}
	if f.contacts["cntA"].DeletedAt == "" {
		t.Error("contact was not soft-deleted")
	}
}

func TestRmPermanentDeletes(t *testing.T) {
	f := book(t)
	_, c := f.serve()

	if _, _, err := runCmd(t, c, "contacts", "rm", "cntA", "--permanent", "--yes"); err != nil {
		t.Fatal(err)
	}
	if len(f.deleted) != 1 || f.deleted[0] != "cntA" {
		t.Fatalf("--permanent must issue a DELETE, got %v", f.deleted)
	}
}

// Without --yes on a non-TTY the command must refuse rather than hang or
// silently proceed — the same contract drive rm holds.
func TestRmWithoutYesRefuses(t *testing.T) {
	f := book(t)
	_, c := f.serve()

	if _, _, err := runCmd(t, c, "contacts", "rm", "cntA"); err == nil {
		t.Fatal("rm without --yes on a non-TTY must refuse")
	}
	if f.contacts["cntA"].DeletedAt != "" {
		t.Error("a refused rm must not have modified the contact")
	}
}

func TestExportWritesFile(t *testing.T) {
	f := book(t)
	_, c := f.serve()
	dest := filepath.Join(t.TempDir(), "book.vcf")

	if _, _, err := runCmd(t, c, "contacts", "export", "--out", dest); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(dest)
	if err != nil {
		t.Fatalf("export --out wrote no file: %v", err)
	}
	body := string(data)
	if !strings.Contains(body, "BEGIN:VCARD") || !strings.Contains(body, "Ada Lovelace") {
		t.Errorf("exported file is not the served vCard payload:\n%s", body)
	}
	if strings.Contains(body, "Alan Turing") {
		t.Errorf("export included a soft-deleted contact:\n%s", body)
	}
}

func TestExportWithoutOutWritesStdout(t *testing.T) {
	f := book(t)
	_, c := f.serve()

	out, _, err := runCmd(t, c, "contacts", "export")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "BEGIN:VCARD") {
		t.Errorf("export without --out must stream the file to stdout:\n%s", out)
	}
}

// The uploaded bytes must be the file's bytes. A vCard is line-oriented and
// CRLF-delimited; a transport that re-encoded it would import garbage.
func TestImportUploadsFileVerbatim(t *testing.T) {
	f := book(t)
	f.importResult = importResult{Created: 1, Updated: 2}
	_, c := f.serve()

	vcf := "BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Katherine Johnson\r\nEND:VCARD\r\n"
	src := filepath.Join(t.TempDir(), "in.vcf")
	if err := os.WriteFile(src, []byte(vcf), 0o600); err != nil {
		t.Fatal(err)
	}

	_, errOut, err := runCmd(t, c, "contacts", "import", src)
	if err != nil {
		t.Fatal(err)
	}
	if f.importBody != vcf {
		t.Errorf("uploaded body = %q, want the file verbatim %q", f.importBody, vcf)
	}
	if !strings.Contains(errOut, "1") || !strings.Contains(errOut, "2") {
		t.Errorf("import must report created/updated counts, got: %s", errOut)
	}
}

// A partial import must say so. Reporting only a count would let a user
// believe a file imported cleanly when half of it did not.
func TestImportReportsPerCardFailures(t *testing.T) {
	f := book(t)
	f.importResult = importResult{
		Created: 1, Failed: 1,
		Errors: []string{"card 2 (Bad Card): malformed vCard"},
	}
	_, c := f.serve()

	src := filepath.Join(t.TempDir(), "in.vcf")
	if err := os.WriteFile(src, []byte("BEGIN:VCARD\r\nEND:VCARD\r\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	_, errOut, err := runCmd(t, c, "contacts", "import", src)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(errOut, "malformed vCard") {
		t.Errorf("a skipped card must be named, got: %s", errOut)
	}
}

func TestImportMissingFileFails(t *testing.T) {
	f := book(t)
	_, c := f.serve()
	if _, _, err := runCmd(t, c, "contacts", "import", filepath.Join(t.TempDir(), "nope.vcf")); err == nil {
		t.Fatal("import of a missing file must fail")
	}
}

func TestJSONOutputIsStable(t *testing.T) {
	f := book(t)
	_, c := f.serve()

	out, _, err := runCmd(t, c, "contacts", "list", "--json")
	if err != nil {
		t.Fatal(err)
	}
	var items []contact
	if err := json.Unmarshal([]byte(out), &items); err != nil {
		t.Fatalf("--json output is not a stable JSON array: %v\n%s", err, out)
	}
	if len(items) != 2 {
		t.Errorf("--json returned %d contacts, want 2", len(items))
	}
}
