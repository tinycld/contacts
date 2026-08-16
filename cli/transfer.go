package cli

import (
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/spf13/cobra"

	"tinycld.org/cli/client"
	"tinycld.org/cli/output"
)

// transfer.go holds the two commands that move a whole address book as a vCard
// FILE. Unlike every other command here they call typed routes rather than the
// record API, and they have to: the vCard codec lives in core's carddav
// package and takes a *core.Record, which this module cannot reach (the CLI
// deliberately does not depend on tinycld.org/core — see gen-cli.ts), and
// CardDAV itself is Basic-Auth only and mounted outside the API router. So the
// conversion happens server-side in contacts/server/vcard_endpoints.go, and
// these commands only move bytes.

// importResult mirrors contacts/server/vcard_endpoints.go's importResult.
// Duplicated for the module-boundary reason above; only the fields this
// command reports are declared.
type importResult struct {
	Created int      `json:"created"`
	Updated int      `json:"updated"`
	Failed  int      `json:"failed"`
	Errors  []string `json:"errors,omitempty"`
}

func newExportCmd(c *client.Client) *cobra.Command {
	var out string
	cmd := &cobra.Command{
		Use:   "export",
		Short: "Export your contacts as a vCard (.vcf) file",
		Long: "Export your contacts as a vCard (.vcf) file.\n\n" +
			"Writes to stdout unless --out is given. Contacts in the Trash are\n" +
			"never exported.",
		Args: cobra.NoArgs,
		Example: "  tinycld contacts export --out contacts.vcf\n" +
			"  tinycld contacts export > backup.vcf",
		RunE: func(cmd *cobra.Command, _ []string) error {
			o, _, err := output.FromCommand(cmd)
			if err != nil {
				return err
			}

			// Streamed, not buffered: an address book is unbounded, and the
			// endpoint already hands back a finished document.
			body, _, err := c.Get(cmd.Context(), "/api/contacts/export")
			if err != nil {
				return err
			}
			defer body.Close()

			if out == "" {
				_, err := io.Copy(cmd.OutOrStdout(), body)
				return err
			}

			file, err := os.Create(out)
			if err != nil {
				return err
			}
			// Closed explicitly rather than only deferred: a write error that
			// surfaces at Close would otherwise be swallowed, reporting a
			// truncated export as a success.
			if _, err := io.Copy(file, body); err != nil {
				file.Close()
				return err
			}
			if err := file.Close(); err != nil {
				return err
			}
			o.Info(cmd.ErrOrStderr(), "saved %s", out)
			return nil
		},
	}
	cmd.Flags().StringVar(&out, "out", "", "write to this file instead of stdout")
	return cmd
}

func newImportCmd(c *client.Client) *cobra.Command {
	return &cobra.Command{
		Use:   "import <file.vcf>",
		Short: "Import contacts from a vCard (.vcf) file",
		Long: "Import contacts from a vCard (.vcf) file.\n\n" +
			"Cards are matched on their UID, so re-importing a file you exported\n" +
			"updates those contacts rather than duplicating them. A malformed\n" +
			"card is reported and skipped, not fatal.",
		Args:    cobra.ExactArgs(1),
		Example: "  tinycld contacts import contacts.vcf",
		RunE: func(cmd *cobra.Command, args []string) error {
			o, _, err := output.FromCommand(cmd)
			if err != nil {
				return err
			}
			// Checked before the upload so a typo'd path fails immediately
			// with a filesystem error rather than as a server-side 400.
			if _, err := os.Stat(args[0]); err != nil {
				return err
			}

			result, err := client.PostMultipart[importResult](cmd.Context(), c,
				"/api/contacts/import", "", nil,
				[]client.FilePart{{Field: "file", Name: "contacts.vcf", Path: args[0]}}, nil)
			if err != nil {
				return err
			}

			w := cmd.ErrOrStderr()
			o.Info(w, "imported: %d created, %d updated, %d failed",
				result.Created, result.Updated, result.Failed)
			// Not routed through Info: a partially-applied import must not be
			// hideable with --quiet. A count alone would let a user believe a
			// file imported cleanly when half of it did not.
			if len(result.Errors) > 0 {
				fmt.Fprintf(w, "%d card(s) skipped:\n  %s\n",
					len(result.Errors), strings.Join(result.Errors, "\n  "))
			}
			return nil
		},
	}
}
