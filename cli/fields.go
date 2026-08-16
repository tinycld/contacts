package cli

import (
	"github.com/spf13/cobra"
)

// contactFlags is the field flag set `add` and `edit` share, so the two
// commands cannot drift into accepting different names for the same field.
type contactFlags struct {
	first    string
	last     string
	email    string
	phone    string
	company  string
	title    string
	notes    string
	favorite bool
}

// bind registers the flags on a command. The flag names are the user-facing
// contract; the PocketBase field names they map to (job_title, first_name) are
// an implementation detail handled in body().
func (f *contactFlags) bind(cmd *cobra.Command) {
	fl := cmd.Flags()
	fl.StringVar(&f.first, "first", "", "first name")
	fl.StringVar(&f.last, "last", "", "last name")
	fl.StringVar(&f.email, "email", "", "email address")
	fl.StringVar(&f.phone, "phone", "", "phone number")
	fl.StringVar(&f.company, "company", "", "company")
	fl.StringVar(&f.title, "title", "", "job title")
	fl.StringVar(&f.notes, "notes", "", "freeform notes")
	fl.BoolVar(&f.favorite, "favorite", false, "star this contact")
}

// body builds the request payload from the flags the user ACTUALLY passed.
//
// Changed() rather than emptiness is the whole point: `--notes ""` must be
// able to clear a field, and an unmentioned field must never be sent at all.
// On an edit, sending the full struct would blank everything the user did not
// name; that is the bug this function exists to prevent.
func (f *contactFlags) body(cmd *cobra.Command) map[string]any {
	fl := cmd.Flags()
	body := map[string]any{}
	for _, m := range []struct {
		flag  string
		field string
		value *string
	}{
		{"first", "first_name", &f.first},
		{"last", "last_name", &f.last},
		{"email", "email", &f.email},
		{"phone", "phone", &f.phone},
		{"company", "company", &f.company},
		{"title", "job_title", &f.title},
		{"notes", "notes", &f.notes},
	} {
		if fl.Changed(m.flag) {
			body[m.field] = *m.value
		}
	}
	if fl.Changed("favorite") {
		body["favorite"] = f.favorite
	}
	return body
}
