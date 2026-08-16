package cli

import (
	"context"
	"fmt"
	"strings"

	"tinycld.org/cli/client"
)

// collection is the PocketBase collection every CRUD command reads and writes.
const collection = "contacts"

// contact mirrors the `contacts` collection — the same fields as the app's
// tinycld/contacts/types.ts. Hand-mirrored rather than imported: the generated
// TS types are not reachable from Go, and this module deliberately does not
// depend on tinycld.org/core (see gen-cli.ts). A field renamed in a migration
// and not here fails at RUNTIME, not at compile time, which is why the
// round-trip tests assert on the wire body rather than on the struct.
type contact struct {
	ID        string `json:"id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Email     string `json:"email"`
	Phone     string `json:"phone"`
	Company   string `json:"company"`
	JobTitle  string `json:"job_title"`
	Notes     string `json:"notes"`
	Favorite  bool   `json:"favorite"`
	Owner     string `json:"owner"`
	DeletedAt string `json:"deleted_at"`
	Created   string `json:"created"`
	Updated   string `json:"updated"`
}

// name renders a contact the way a person would recognize it. A contact may
// legitimately have no name — an address captured from a mail thread, say — so
// fall back to the email before a placeholder, matching the search source.
func (c contact) name() string {
	if full := strings.TrimSpace(c.FirstName + " " + c.LastName); full != "" {
		return full
	}
	if c.Email != "" {
		return c.Email
	}
	return "Unnamed contact"
}

// liveFilter selects the address book proper. Owner scoping is deliberately
// absent: the collection rules already restrict every read to the caller, and
// duplicating that here would be a second copy of a security boundary that can
// drift from the authoritative one.
const liveFilter = `deleted_at = ""`

// trashedFilter selects the Trash — soft-deleted rows only.
const trashedFilter = `deleted_at != ""`

// listSort matches the contacts screen's default ordering, so the CLI and the
// app disagree about nothing a user can see.
const listSort = "first_name,last_name,id"

// fetchContact reads one contact by id, turning the API's 404 into a message
// naming what the user actually typed.
func fetchContact(ctx context.Context, c *client.Client, id string) (contact, error) {
	found, err := client.GetRecord[contact](ctx, c, collection, id)
	if err != nil {
		return contact{}, fmt.Errorf("%s: %w", id, err)
	}
	return found, nil
}
