package contacts

import (
	"context"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

// seedAddressBookContact writes a contacts row for an owner id. deleted rows
// get a deleted_at timestamp, the same soft-delete the app writes.
func seedAddressBookContact(t *testing.T, app core.App, owner, email string, deleted bool) {
	t.Helper()
	col, err := app.FindCollectionByNameOrId("contacts")
	if err != nil {
		t.Fatal(err)
	}
	r := core.NewRecord(col)
	r.Set("first_name", "Seeded")
	r.Set("email", email)
	r.Set("owner", owner)
	if deleted {
		r.Set("deleted_at", types.NowDateTime())
	}
	if err := app.Save(r); err != nil {
		t.Fatalf("seed contact %s: %v", email, err)
	}
}

func TestAddressBookLookup(t *testing.T) {
	env := setupContactsDisabledApp(t)
	other := vcardTestUser(t, env.app, "other@test.local")
	owner := env.owner.Id

	seedAddressBookContact(t, env.app, owner, "Ann@Example.com", false)
	seedAddressBookContact(t, env.app, owner, "gone@example.com", true)
	seedAddressBookContact(t, env.app, other.Id, "bob@example.com", false)
	seedAddressBookContact(t, env.app, owner, "", false)

	cases := map[string]bool{"ann@example.com": true, "gone@example.com": false, "bob@example.com": false, "": false}
	for email, want := range cases {
		got, err := contactKnown(context.Background(), env.app, owner, email)
		if err != nil || got != want {
			t.Errorf("%s: got %v err %v", email, got, err)
		}
	}
}
