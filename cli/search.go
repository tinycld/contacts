package cli

import (
	"net/url"
	"strconv"

	"github.com/spf13/cobra"

	"tinycld.org/cli/client"
	"tinycld.org/cli/output"
)

// searchRow mirrors core/server/search.Row, and searchResponse its Response.
// Duplicated rather than imported for the reason gen-cli.ts documents: this
// module does not depend on tinycld.org/core, so a shared contract is mirrored
// and kept minimal. Only the fields this command reads are declared.
type searchRow struct {
	Slug     string         `json:"slug"`
	ID       string         `json:"id"`
	Title    string         `json:"title"`
	Subtitle string         `json:"subtitle,omitempty"`
	Meta     string         `json:"meta,omitempty"`
	Fields   map[string]any `json:"fields,omitempty"`
}

type searchResponse struct {
	Rows    []searchRow    `json:"rows"`
	Counts  map[string]int `json:"counts"`
	Partial []string       `json:"partial,omitempty"`
}

// newSearchCmd searches contacts through core's FEDERATED aggregator.
//
// There is no /api/contacts/search to call: contacts/server/register.go
// registers fts.RegisterSync instead of fts.Register precisely so one search
// implementation serves the palette, the app screen, and this command. The
// rows come back normalized, and the per-package columns a contacts table
// needs (phone, company) ride in Fields — the search source populates them for
// exactly this purpose.
func newSearchCmd(c *client.Client) *cobra.Command {
	var limit int
	cmd := &cobra.Command{
		Use:   "search <query>",
		Short: "Full-text search your contacts",
		Long: "Full-text search your contacts by name, email, phone, company, or notes.\n\n" +
			"Quote the query so the shell keeps it as one argument. Soft-deleted\n" +
			"contacts are never matched — search the Trash with `contacts list --trashed`.",
		Example: "  tinycld contacts search ada\n" +
			"  tinycld contacts search \"analytical engine\" --limit 5 --json",
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			o, _, err := output.FromCommand(cmd)
			if err != nil {
				return err
			}

			q := url.Values{"q": {args[0]}, "pkg": {"contacts"}}
			if limit > 0 {
				q.Set("limit", strconv.Itoa(limit))
			}

			var resp searchResponse
			if err := c.GetJSON(cmd.Context(), "/api/search?"+q.Encode(), &resp); err != nil {
				return err
			}

			rows := make([][]string, len(resp.Rows))
			for i, r := range resp.Rows {
				rows[i] = []string{
					// Rendered from Fields rather than the normalized Title so
					// the columns match `contacts list` — a name split across
					// first/last cannot be recovered from Title alone.
					output.StripMarks(fieldStr(r.Fields, "first_name")),
					output.StripMarks(fieldStr(r.Fields, "last_name")),
					output.StripMarks(fieldStr(r.Fields, "email")),
					output.StripMarks(fieldStr(r.Fields, "phone")),
					output.StripMarks(fieldStr(r.Fields, "company")),
					r.ID,
				}
			}
			if err := o.Write(cmd.OutOrStdout(),
				[]string{"FIRST", "LAST", "EMAIL", "PHONE", "COMPANY", "ID"}, rows, resp.Rows); err != nil {
				return err
			}

			o.Info(cmd.ErrOrStderr(), "%d result(s)", len(resp.Rows))
			// A search that silently dropped this package reads exactly like
			// one that found nothing, which is the worse of the two lies. Not
			// routed through Info: --quiet must not be able to hide it.
			if len(resp.Partial) > 0 {
				cmd.PrintErrln("warning: the contacts search failed or timed out — results are incomplete")
			}
			return nil
		},
	}
	cmd.Flags().IntVar(&limit, "limit", 0, "maximum results (the server caps the total)")
	return cmd
}

// fieldStr reads one string out of a row's Fields map. A missing or
// non-string value renders empty rather than as Go's %!s(<nil>) — the map is
// server-shaped, so a type that surprises us must not corrupt the table.
func fieldStr(fields map[string]any, key string) string {
	s, _ := fields[key].(string)
	return s
}
