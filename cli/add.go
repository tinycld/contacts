package cli

import (
	"fmt"

	"github.com/spf13/cobra"

	"tinycld.org/cli/client"
	"tinycld.org/cli/output"
)

func newAddCmd(c *client.Client) *cobra.Command {
	var flags contactFlags
	cmd := &cobra.Command{
		Use:     "add",
		Short:   "Add a contact",
		Args:    cobra.NoArgs,
		Aliases: []string{"new", "create"},
		Example: "  tinycld contacts add --first Ada --last Lovelace --email ada@example.com\n" +
			"  tinycld contacts add --first Grace --company Navy --favorite",
		RunE: func(cmd *cobra.Command, _ []string) error {
			o, _, err := output.FromCommand(cmd)
			if err != nil {
				return err
			}
			// first_name is `required, min: 1` in the schema. Catching it here
			// turns a 400 with a field-path body into the flag the user has to
			// add.
			if flags.first == "" {
				return fmt.Errorf("--first is required")
			}

			body := flags.body(cmd)

			// owner is set explicitly, mirroring the app's create form: the
			// collection's createRule is `owner = @request.auth.id`, so an
			// omitted owner is rejected outright rather than defaulted.
			userID, err := c.UserID(cmd.Context())
			if err != nil {
				return err
			}
			body["owner"] = userID

			created, err := client.CreateRecord[contact](cmd.Context(), c, collection, body)
			if err != nil {
				return err
			}
			o.Info(cmd.ErrOrStderr(), "added %s (%s)", created.name(), created.ID)
			return o.Write(cmd.OutOrStdout(),
				[]string{"NAME", "EMAIL", "ID"},
				[][]string{{created.name(), created.Email, created.ID}},
				created)
		},
	}
	flags.bind(cmd)
	return cmd
}
