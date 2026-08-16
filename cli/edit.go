package cli

import (
	"fmt"

	"github.com/spf13/cobra"

	"tinycld.org/cli/client"
	"tinycld.org/cli/output"
)

func newEditCmd(c *client.Client) *cobra.Command {
	var (
		flags   contactFlags
		restore bool
	)
	cmd := &cobra.Command{
		Use:   "edit <id>",
		Short: "Change fields on a contact",
		Long: "Change fields on a contact.\n\n" +
			"Only the flags you pass are sent, so the other fields keep their\n" +
			"values. Pass an empty string to clear one: --phone \"\".\n\n" +
			"--restore takes a contact back out of the Trash.",
		Args:    cobra.ExactArgs(1),
		Aliases: []string{"update", "set"},
		Example: "  tinycld contacts edit cnt123 --phone 555-0100\n" +
			"  tinycld contacts edit cnt123 --notes \"\" --favorite",
		RunE: func(cmd *cobra.Command, args []string) error {
			o, _, err := output.FromCommand(cmd)
			if err != nil {
				return err
			}

			body := flags.body(cmd)
			// Clearing deleted_at is exactly what the app's restore action
			// does, so the CLI's Trash and the app's are the same one.
			if restore {
				body["deleted_at"] = ""
			}
			// An empty PATCH would report success while changing nothing,
			// which reads as "the edit worked" — say what is missing instead.
			if len(body) == 0 {
				return fmt.Errorf("nothing to change: pass at least one field flag (see --help)")
			}

			updated, err := client.UpdateRecord[contact](cmd.Context(), c, collection, args[0], body)
			if err != nil {
				return fmt.Errorf("%s: %w", args[0], err)
			}
			o.Info(cmd.ErrOrStderr(), "updated %s", updated.name())
			return o.Write(cmd.OutOrStdout(),
				[]string{"NAME", "EMAIL", "PHONE", "ID"},
				[][]string{{updated.name(), updated.Email, updated.Phone, updated.ID}},
				updated)
		},
	}
	flags.bind(cmd)
	cmd.Flags().BoolVar(&restore, "restore", false, "take the contact back out of the Trash")
	return cmd
}
