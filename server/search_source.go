package contacts

import (
	"fmt"
	"strings"

	"github.com/pocketbase/pocketbase/core"

	"tinycld.org/core/fts"
	"tinycld.org/core/search"
)

// searchSource contributes contacts to the federated GET /api/search.
//
// The row mapping here is what the TypeScript adapter's toRow used to own.
// Server-side means the palette, the contacts screen's own search box, and the
// CLI all render from one implementation.
//
// Fields carries the columns the contacts list sorts by (first_name, last_name,
// email, phone, company) plus favorite. That is not incidental: the screen sorts
// server results by those fields, so a normalized row alone — title, subtitle,
// meta — could not drive it.
func searchSource() search.Source {
	return search.Source{
		Slug:  "contacts",
		Label: "Contacts",
		// Mirrors manifest.ts nav.order, the cross-package ranking tie-break.
		Order:  10,
		Scopes: []string{"contacts:read"},
		Search: searchContactRows,
	}
}

func searchContactRows(app core.App, userID string, q search.Query) (search.Result, error) {
	hits, total, err := fts.Search(app, ftsConfig, userID, fts.SearchOpts{
		Query:   strings.Join(q.Include, " "),
		Exclude: strings.Join(q.Exclude, " "),
		Limit:   q.Limit,
		Offset:  q.Offset,
		// Soft-deleted contacts stay out. Searching the Trash view was an
		// unintended capability of the old per-package endpoint, not a feature
		// anyone asked for, so the federated path does not carry it forward.
		IncludeDeleted: false,
	})
	if err != nil {
		return search.Result{}, err
	}

	rows := make([]search.Row, 0, len(hits))
	for _, hit := range hits {
		first := str(hit.Columns["first_name"])
		last := str(hit.Columns["last_name"])
		email := str(hit.Columns["email"])

		name := strings.TrimSpace(strings.Join([]string{first, last}, " "))
		rows = append(rows, search.Row{
			ID: hit.ID,
			// A contact may legitimately have no name — an address captured from
			// a mail thread, say — so fall back to the email before a
			// placeholder, since that is what a person would recognize.
			Title:    firstNonEmpty(name, email, "Unnamed contact"),
			Subtitle: email,
			Meta:     str(hit.Columns["company"]),
			Fields: map[string]any{
				"first_name": first,
				"last_name":  last,
				"email":      email,
				"phone":      str(hit.Columns["phone"]),
				"company":    str(hit.Columns["company"]),
				"favorite":   hit.Columns["favorite"],
			},
		})
	}
	return search.Result{Rows: rows, Total: total}, nil
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

// str coerces an Output column to a string. fts.coerce already types columns per
// their declared Type, so this only guards a config change that turns a text
// column into something else.
func str(v any) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprint(v)
}
