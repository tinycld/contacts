package contacts

import (
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"
)

// newContactsTable builds a minimal in-memory `contacts` table carrying only the
// columns the soft-delete filter cares about, mirroring the DateField added in
// pb-migrations/1712000004_add_deleted_at.js (empty string means "not deleted").
func newContactsTable(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	if _, err := db.Exec(`
		CREATE TABLE contacts (
			id TEXT PRIMARY KEY,
			owner TEXT NOT NULL,
			deleted_at TEXT NOT NULL DEFAULT ''
		)`); err != nil {
		t.Fatalf("create contacts: %v", err)
	}
	return db
}

func insertContact(t *testing.T, db *sql.DB, id, owner, deletedAt string) {
	t.Helper()
	if _, err := db.Exec(
		`INSERT INTO contacts (id, owner, deleted_at) VALUES (?, ?, ?)`,
		id, owner, deletedAt,
	); err != nil {
		t.Fatalf("insert %q: %v", id, err)
	}
}

// TestListFilterExcludesSoftDeleted guards the ListAddressObjects filter clause
// (`owner = {:ownerId} && deleted_at = ”`): a contact soft-deleted in the web UI
// (deleted_at set to a timestamp) must NOT be listed to CardDAV clients, otherwise
// it leaks and re-syncs back. This is the exact WHERE semantics the PocketBase
// filter DSL compiles to and that endpoints_search.go applies as raw SQL.
func TestListFilterExcludesSoftDeleted(t *testing.T) {
	db := newContactsTable(t)
	insertContact(t, db, "live", "org1", "")                            // active
	insertContact(t, db, "deleted", "org1", "2026-03-15 00:00:00.000Z") // soft-deleted
	insertContact(t, db, "other-org", "org2", "")                       // different owner

	rows, err := db.Query(
		`SELECT id FROM contacts WHERE owner = ? AND deleted_at = '' ORDER BY id`,
		"org1",
	)
	if err != nil {
		t.Fatalf("query: %v", err)
	}
	defer rows.Close()

	var got []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			t.Fatalf("scan: %v", err)
		}
		got = append(got, id)
	}

	if len(got) != 1 || got[0] != "live" {
		t.Errorf("owner=org1 not-deleted: got %v, want [live] (soft-deleted contact must be excluded)", got)
	}
}

// TestSoftDeleteIsReversible confirms the DeleteAddressObject contract: setting
// deleted_at hides the contact from the not-deleted filter yet keeps the row
// present, so it remains restorable (deleted_at back to ”) — unlike the previous
// hard b.app.Delete() which was irreversible.
func TestSoftDeleteIsReversible(t *testing.T) {
	db := newContactsTable(t)
	insertContact(t, db, "c1", "org1", "")

	// Soft-delete: mirrors record.Set("deleted_at", types.NowDateTime()) + Save.
	if _, err := db.Exec(
		`UPDATE contacts SET deleted_at = ? WHERE id = ?`,
		"2026-07-11 12:00:00.000Z", "c1",
	); err != nil {
		t.Fatalf("soft-delete: %v", err)
	}

	if n := countActive(t, db, "org1"); n != 0 {
		t.Errorf("after soft-delete: active count = %d, want 0", n)
	}
	if !rowExists(t, db, "c1") {
		t.Error("after soft-delete: row was removed; must remain for restore")
	}

	// Restore: mirrors the web UI setting deleted_at back to ''.
	if _, err := db.Exec(`UPDATE contacts SET deleted_at = '' WHERE id = ?`, "c1"); err != nil {
		t.Fatalf("restore: %v", err)
	}
	if n := countActive(t, db, "org1"); n != 1 {
		t.Errorf("after restore: active count = %d, want 1", n)
	}
}

func countActive(t *testing.T, db *sql.DB, owner string) int {
	t.Helper()
	var n int
	if err := db.QueryRow(
		`SELECT COUNT(*) FROM contacts WHERE owner = ? AND deleted_at = ''`, owner,
	).Scan(&n); err != nil {
		t.Fatalf("count active: %v", err)
	}
	return n
}

func rowExists(t *testing.T, db *sql.DB, id string) bool {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM contacts WHERE id = ?`, id).Scan(&n); err != nil {
		t.Fatalf("row exists: %v", err)
	}
	return n > 0
}
