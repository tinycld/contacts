package contacts

import (
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"
)

// liveFTSTokenizer mirrors the tokenizer string used by the live FTS migration
// (pb-migrations/..._create_fts_contacts.js). Keep them in sync: these tests are
// the guard that the tokenizer + sanitizeFTSQuery actually match the email-bearing
// search terms the reported bug showed were being missed.
const liveFTSTokenizer = "porter unicode61"

type seedContact struct {
	id, first, last, email, company, phone, notes string
}

func newContactsFTS(t *testing.T, tokenizer string, rows ...seedContact) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	if _, err := db.Exec(`
		CREATE VIRTUAL TABLE fts_contacts USING fts5(
			record_id UNINDEXED, first_name, last_name, email, company, phone, notes,
			tokenize='` + tokenizer + `'
		)`); err != nil {
		t.Fatalf("create fts (%q): %v", tokenizer, err)
	}

	for _, r := range rows {
		if _, err := db.Exec(`
			INSERT INTO fts_contacts
				(record_id, first_name, last_name, email, company, phone, notes)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
			r.id, r.first, r.last, r.email, r.company, r.phone, r.notes,
		); err != nil {
			t.Fatalf("seed %q: %v", r.id, err)
		}
	}
	return db
}

// matchIDs returns the record_ids matched by running the raw user query through
// sanitizeFTSQuery (the real production path) and MATCHing the index.
func matchIDs(t *testing.T, db *sql.DB, userQuery string) []string {
	t.Helper()
	fts := sanitizeFTSQuery(userQuery)
	if fts == "" {
		return nil
	}
	rows, err := db.Query(
		`SELECT record_id FROM fts_contacts WHERE fts_contacts MATCH ? ORDER BY rank`, fts,
	)
	if err != nil {
		t.Fatalf("match %q (fts=%q): %v", userQuery, fts, err)
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			t.Fatalf("scan: %v", err)
		}
		ids = append(ids, id)
	}
	return ids
}

func assertMatches(t *testing.T, db *sql.DB, userQuery string, wantIDs ...string) {
	t.Helper()
	got := matchIDs(t, db, userQuery)
	gotSet := map[string]bool{}
	for _, id := range got {
		gotSet[id] = true
	}
	if len(got) != len(wantIDs) {
		t.Errorf("query %q: got %v, want exactly %v", userQuery, got, wantIDs)
		return
	}
	for _, want := range wantIDs {
		if !gotSet[want] {
			t.Errorf("query %q: missing %q (got %v)", userQuery, want, got)
		}
	}
}

func assertNoMatch(t *testing.T, db *sql.DB, userQuery string) {
	t.Helper()
	if got := matchIDs(t, db, userQuery); len(got) != 0 {
		t.Errorf("query %q: expected no matches, got %v", userQuery, got)
	}
}

var (
	alice = seedContact{"alice", "Alice", "Smith", "zephyrqa.test@example.com", "Acme", "", ""}
	bob   = seedContact{"bob", "Bob", "Jones", "bob@globex.io", "Globex", "555-1212", ""}
	carol = seedContact{"carol", "Carol", "Nguyen", "c.nguyen+sales@sub.example.org", "Initech", "", "VIP client"}
)

// THE BUG: a partial email address that skips an interior token must still match.
// Typing "zephyrqa@example.com" (omitting the ".test" middle token) used to be
// wrapped as a single ordered phrase and matched nothing. This is the exact
// "records with a unique email term never show up" report.
func TestFTSPartialEmailAddressMatches(t *testing.T) {
	db := newContactsFTS(t, liveFTSTokenizer, alice, bob, carol)

	assertMatches(t, db, "zephyrqa@example.com", "alice")
	assertMatches(t, db, "zephyrqa.test@example.com", "alice") // full address still works
	assertMatches(t, db, "bob@globex.io", "bob")
	assertMatches(t, db, "c.nguyen@example.org", "carol") // skips "+sales" and "sub"
}

func TestFTSEmailLocalPartTokens(t *testing.T) {
	db := newContactsFTS(t, liveFTSTokenizer, alice, bob, carol)

	assertMatches(t, db, "zephyr", "alice")   // prefix of local-part
	assertMatches(t, db, "zephyrqa", "alice") // full local-part word
	assertMatches(t, db, "nguyen", "carol")   // local-part word shared w/ last name
	assertMatches(t, db, "sales", "carol")    // +tag portion
}

func TestFTSEmailDomainTokens(t *testing.T) {
	db := newContactsFTS(t, liveFTSTokenizer, alice, bob, carol)

	// "example" appears in alice (example.com) and carol (sub.example.org).
	assertMatches(t, db, "example", "alice", "carol")
	assertMatches(t, db, "globex", "bob")
	assertMatches(t, db, "globex.io", "bob")
	assertMatches(t, db, "sub.example.org", "carol")
}

func TestFTSNameAndCompanyStillWork(t *testing.T) {
	db := newContactsFTS(t, liveFTSTokenizer, alice, bob, carol)

	assertMatches(t, db, "alice", "alice")
	assertMatches(t, db, "smith", "alice")
	assertMatches(t, db, "acme", "alice")
	assertMatches(t, db, "Carol Nguyen", "carol") // multi-term AND
}

func TestFTSNonMatchingQueryReturnsNothing(t *testing.T) {
	db := newContactsFTS(t, liveFTSTokenizer, alice, bob, carol)

	assertNoMatch(t, db, "nonexistentxyz")
	assertNoMatch(t, db, "zephyr globex") // tokens from two different records, AND-ed
}

// sanitizeFTSQuery must neutralize FTS5 operator characters without throwing,
// and must split email punctuation into separate prefix terms.
func TestSanitizeFTSQuery(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"", ""},
		{"   ", ""},
		{"john", `"john"*`},
		{"john doe", `"john"* "doe"*`},
		{"a@b.com", `"a"* "b"* "com"*`},
		{"a.b@example.com", `"a"* "b"* "example"* "com"*`},
		// Pure-operator input collapses to empty rather than a broken query.
		{"*", ""},
		{"()", ""},
		{`"`, ""},
		{"-", ""},
		// Operators mixed with a real term keep the term.
		{"foo*", `"foo"*`},
		{"(bar)", `"bar"*`},
	}
	for _, tc := range cases {
		if got := sanitizeFTSQuery(tc.in); got != tc.want {
			t.Errorf("sanitizeFTSQuery(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

// stripHTML must remove markup so HTML in the notes field doesn't pollute or
// break the FTS index.
func TestStripHTML(t *testing.T) {
	cases := []struct{ in, want string }{
		{"", ""},
		{"plain text", "plain text"},
		{"<p>hello</p>", "hello"},
		{"<div><b>VIP</b> client</div>", "VIP  client"},
		{"  <span>trim me</span>  ", "trim me"},
	}
	for _, tc := range cases {
		if got := stripHTML(tc.in); got != tc.want {
			t.Errorf("stripHTML(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

// Notes are HTML-stripped before indexing; a word that only appears inside a
// notes tag must still be searchable as plain text.
func TestFTSNotesAreSearchableAfterStrip(t *testing.T) {
	withNotes := carol
	withNotes.notes = stripHTML("<p>loves <b>kayaking</b></p>")
	db := newContactsFTS(t, liveFTSTokenizer, alice, withNotes)

	assertMatches(t, db, "kayaking", "carol")
}
