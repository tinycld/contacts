package cli

import (
	"context"

	"github.com/spf13/cobra"

	"tinycld.org/cli/client"
	"tinycld.org/cli/output"
)

func newListCmd(c *client.Client) *cobra.Command {
	var (
		favorites bool
		trashed   bool
		limit     int
	)
	cmd := &cobra.Command{
		Use:     "list",
		Short:   "List your contacts",
		Long:    "List your contacts.\n\nSoft-deleted contacts live in the Trash and are shown only with --trashed.",
		Aliases: []string{"ls"},
		Args:    cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			o, _, err := output.FromCommand(cmd)
			if err != nil {
				return err
			}

			filter := liveFilter
			if trashed {
				filter = trashedFilter
			} else if favorites {
				filter += " && favorite = true"
			}

			contacts, err := listContacts(cmd.Context(), c, filter, limit)
			if err != nil {
				return err
			}

			rows := make([][]string, len(contacts))
			for i, ct := range contacts {
				rows[i] = []string{
					ct.name(), ct.Email, ct.Phone, ct.Company, star(ct.Favorite), ct.ID,
				}
			}
			return o.Write(cmd.OutOrStdout(),
				[]string{"NAME", "EMAIL", "PHONE", "COMPANY", "FAV", "ID"}, rows, contacts)
		},
	}
	fl := cmd.Flags()
	fl.BoolVar(&favorites, "favorites", false, "only contacts you have starred")
	fl.BoolVar(&trashed, "trashed", false, "list the Trash instead of the address book")
	fl.IntVar(&limit, "limit", 0, "maximum contacts to list (default: all)")
	cmd.MarkFlagsMutuallyExclusive("favorites", "trashed")
	return cmd
}

// listContacts reads the address book. A --limit of 0 pages through
// everything, which is what a person means by "list my contacts"; a limit
// takes a single page, since a cap larger than one page would silently return
// only the first anyway.
func listContacts(ctx context.Context, c *client.Client, filter string, limit int) ([]contact, error) {
	if limit <= 0 {
		return client.ListAll[contact](ctx, c, collection, filter, listSort)
	}
	res, err := client.ListRecords[contact](ctx, c, collection, client.ListOptions{
		Filter: filter, Sort: listSort, PerPage: limit,
	})
	if err != nil {
		return nil, err
	}
	return res.Items, nil
}

func star(favorite bool) string {
	if favorite {
		return "*"
	}
	return ""
}
