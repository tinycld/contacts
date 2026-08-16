package cli

import (
	"fmt"
	"time"

	"github.com/spf13/cobra"

	"tinycld.org/cli/client"
	"tinycld.org/cli/output"
	"tinycld.org/cli/ui"
)

// newRmCmd removes a contact — by default a SOFT delete.
//
// Stamping deleted_at is what the app's delete action does
// (hooks/useContactList.ts), so a contact removed here lands in the same Trash
// and is restorable in the app or with `contacts edit <id> --restore`. A hard
// DELETE from a command a user reasonably expects to be undoable would be
// unrecoverable data loss, so it is behind --permanent.
func newRmCmd(c *client.Client) *cobra.Command {
	var permanent bool
	cmd := &cobra.Command{
		Use:   "rm <id>",
		Short: "Move a contact to the Trash, or delete it permanently",
		Long: "Moves the contact to your Trash, where it stays restorable.\n" +
			"--permanent deletes the record outright and cannot be undone.",
		Args:    cobra.ExactArgs(1),
		Aliases: []string{"delete", "remove"},
		RunE: func(cmd *cobra.Command, args []string) error {
			o, yes, err := output.FromCommand(cmd)
			if err != nil {
				return err
			}
			ctx := cmd.Context()
			ct, err := fetchContact(ctx, c, args[0])
			if err != nil {
				return err
			}

			question := fmt.Sprintf("Move %q to the Trash?", ct.name())
			if permanent {
				question = fmt.Sprintf("PERMANENTLY delete %q? This cannot be undone.", ct.name())
			}
			ok, err := ui.Confirm(o, yes, cmd.InOrStdin(), cmd.ErrOrStderr(), question)
			if err != nil {
				return err
			}
			if !ok {
				return nil
			}

			if permanent {
				if err := client.DeleteRecord(ctx, c, collection, ct.ID); err != nil {
					return err
				}
				o.Info(cmd.ErrOrStderr(), "deleted %s", ct.name())
				return nil
			}

			// RFC3339 with a UTC offset, matching the app's
			// `new Date().toISOString()`. PocketBase normalizes the stored
			// value; what matters is only that it is non-empty and parseable.
			_, err = client.UpdateRecord[contact](ctx, c, collection, ct.ID,
				map[string]any{"deleted_at": time.Now().UTC().Format(time.RFC3339)})
			if err != nil {
				return err
			}
			o.Info(cmd.ErrOrStderr(), "moved %s to the Trash", ct.name())
			return nil
		},
	}
	cmd.Flags().BoolVar(&permanent, "permanent", false, "delete the record instead of trashing it")
	return cmd
}
