package cli

import (
	"github.com/spf13/cobra"

	"tinycld.org/cli/client"
	"tinycld.org/cli/output"
)

// newShowCmd renders one contact as a field/value table rather than a row, so
// notes and every empty field stay readable — a single-row table of eleven
// columns is not something a person can read in a terminal.
func newShowCmd(c *client.Client) *cobra.Command {
	return &cobra.Command{
		Use:     "show <id>",
		Short:   "Show one contact in full",
		Args:    cobra.ExactArgs(1),
		Aliases: []string{"view"},
		RunE: func(cmd *cobra.Command, args []string) error {
			o, _, err := output.FromCommand(cmd)
			if err != nil {
				return err
			}
			ct, err := fetchContact(cmd.Context(), c, args[0])
			if err != nil {
				return err
			}

			rows := [][]string{
				{"Name", ct.name()},
				{"First", ct.FirstName},
				{"Last", ct.LastName},
				{"Email", ct.Email},
				{"Phone", ct.Phone},
				{"Company", ct.Company},
				{"Title", ct.JobTitle},
				{"Favorite", yesNo(ct.Favorite)},
				{"Notes", ct.Notes},
				{"Updated", ct.Updated},
				{"ID", ct.ID},
			}
			if ct.DeletedAt != "" {
				// A trashed contact looks identical to a live one otherwise,
				// and acting on one (edit, export) behaves differently — say so.
				rows = append(rows, []string{"Trashed", ct.DeletedAt})
			}
			return o.Write(cmd.OutOrStdout(), []string{"FIELD", "VALUE"}, rows, ct)
		},
	}
}

func yesNo(v bool) string {
	if v {
		return "yes"
	}
	return "no"
}
