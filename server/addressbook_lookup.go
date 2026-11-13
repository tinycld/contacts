package contacts

import (
	"context"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"tinycld.org/core/addressbook"
)

func registerAddressBook() {
	addressbook.RegisterLookup(contactKnown)
}

// contactKnown matches case-insensitively and ignores soft-deleted contacts.
// owner is indexed, so the scan is bounded by one user's contacts.
func contactKnown(ctx context.Context, app core.App, userID, email string) (bool, error) {
	var n int
	err := app.DB().
		Select("count(*)").
		From("contacts").
		Where(dbx.NewExp("owner = {:o} AND lower(email) = {:e} AND (deleted_at = '' OR deleted_at IS NULL)",
			dbx.Params{"o": userID, "e": email})).
		WithContext(ctx).
		Row(&n)
	return n > 0, err
}
