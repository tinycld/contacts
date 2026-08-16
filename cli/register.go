// Package cli contributes the `tinycld contacts` command group.
//
// Most commands are pure HTTP clients over the PocketBase record REST API —
// contacts has no bespoke CRUD endpoint, and should not grow one: the
// collection rules (owner scoping plus the disabled-user clause) are the whole
// authorization for any caller that does not pass through a hook, so a Go
// endpoint could only ADD to what the rules already enforce.
//
// Three things a reader should know before extending this package:
//
//   - SEARCH IS FEDERATED, NOT PACKAGE-LOCAL. There is no
//     /api/contacts/search: contacts/server/register.go registers
//     fts.RegisterSync *instead of* fts.Register, so the palette, the contacts
//     screen, and this CLI all read core's /api/search. `contacts search` is
//     that endpoint scoped with pkg=contacts, and it renders from the row's
//     Fields map, which the search source populates for exactly this purpose.
//
//   - `rm` IS A SOFT DELETE. It stamps deleted_at, matching the app's delete
//     action, so the contact lands in the Trash and stays restorable. The hard
//     DELETE is behind --permanent.
//
//   - EXPORT/IMPORT ARE THE ONLY TYPED ROUTES, and they must be. The vCard
//     codec lives in core's carddav package and takes a *core.Record, which
//     this module cannot reach (the CLI deliberately does not depend on
//     tinycld.org/core — see gen-cli.ts), and CardDAV itself is Basic-Auth only
//     and mounted outside the API router. So the file conversion happens
//     server-side, in contacts/server/vcard_endpoints.go.
package cli

import (
	"github.com/spf13/cobra"

	"tinycld.org/cli/client"
)

func Register(root *cobra.Command, c *client.Client) {
	contacts := &cobra.Command{
		Use:     "contacts",
		Short:   "Address book: people, phone numbers, and vCard files",
		Aliases: []string{"contact"},
	}
	contacts.AddCommand(
		newListCmd(c),
		newSearchCmd(c),
		newShowCmd(c),
		newAddCmd(c),
		newEditCmd(c),
		newRmCmd(c),
		newExportCmd(c),
		newImportCmd(c),
	)
	root.AddCommand(contacts)
}
