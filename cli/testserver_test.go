package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/spf13/cobra"

	"tinycld.org/cli/client"
)

// fakeContacts is an in-memory stand-in for the server: the `contacts`
// collection the commands read and write, the federated /api/search, and the
// two vCard file routes. Filters are matched against the EXACT shapes the CLI
// builds — an unrecognized filter fails the test rather than returning
// everything, because a silently-ignored filter is how `list` appears to work
// while showing you the Trash.
//
// WHAT THIS HARNESS CANNOT SEE, and it matters: it runs no access rules and no
// OAuth scope middleware. So it proves the commands send the right requests,
// never that a real server would allow them. Owner scoping is proven by the
// contacts collection rules, the raw routes' hand-written checks
// (vcard_endpoints.go), and core's route→scope table — that split is
// deliberate. Task 10 of the CLI plan found three of its four real bugs in
// exactly the scope layer a fake server does not have.
type fakeContacts struct {
	t *testing.T

	contacts map[string]*contact
	seq      int

	// Recorded writes, so a test can assert what was SENT rather than only
	// what came back — a fake that echoes its input proves nothing about the
	// body the command built.
	lastCreate map[string]any
	lastPatch  map[string]any
	deleted    []string

	// importBody is the raw .vcf the CLI uploaded, so a test can prove the
	// file's bytes reach the server unmangled rather than merely that a
	// request happened.
	importBody   string
	importResult importResult

	// searchQuery records the parsed /api/search query string, which is the
	// whole contract of `contacts search`: it must scope to pkg=contacts
	// rather than hitting a package route that no longer exists.
	searchQuery url.Values
	searchRows  []searchRow
}

func newFakeContacts(t *testing.T) *fakeContacts {
	return &fakeContacts{t: t, contacts: map[string]*contact{}}
}

func (f *fakeContacts) add(id, first, last, email string) *contact {
	c := &contact{
		ID: id, FirstName: first, LastName: last, Email: email,
		Owner: "user1", Updated: "2026-08-01 10:00:00Z",
	}
	f.contacts[id] = c
	return c
}

var (
	// The live-contacts filter the list command builds. Owner scoping is the
	// server's job (the collection rules), so the CLI filters only on the
	// soft-delete field and, optionally, favorite.
	reLive         = regexp.MustCompile(`^deleted_at = ""$`)
	reLiveFavorite = regexp.MustCompile(`^deleted_at = "" && favorite = true$`)
	reTrashed      = regexp.MustCompile(`^deleted_at != ""$`)
)

func listResponse[T any](w http.ResponseWriter, items []T) {
	if items == nil {
		items = []T{}
	}
	json.NewEncoder(w).Encode(map[string]any{
		"page": 1, "perPage": 200, "totalItems": len(items), "totalPages": 1,
		"items": items,
	})
}

func decodeBody(r *http.Request) map[string]any {
	var body map[string]any
	json.NewDecoder(r.Body).Decode(&body)
	return body
}

func (f *fakeContacts) nextID() string {
	f.seq++
	return fmt.Sprintf("cnt%03d", f.seq)
}

func (f *fakeContacts) serve() (*httptest.Server, *client.Client) {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /oauth/userinfo", func(w http.ResponseWriter, _ *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"sub": "user1"})
	})

	mux.HandleFunc("GET /api/collections/contacts/records", func(w http.ResponseWriter, r *http.Request) {
		filter := r.URL.Query().Get("filter")
		var wantDeleted, onlyFavorite bool
		switch {
		case reLiveFavorite.MatchString(filter):
			onlyFavorite = true
		case reLive.MatchString(filter):
		case reTrashed.MatchString(filter):
			wantDeleted = true
		default:
			f.t.Errorf("unsupported contacts filter: %q", filter)
			listResponse(w, []contact{})
			return
		}
		var out []contact
		for _, c := range f.contacts {
			if (c.DeletedAt != "") != wantDeleted {
				continue
			}
			if onlyFavorite && !c.Favorite {
				continue
			}
			out = append(out, *c)
		}
		sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
		listResponse(w, out)
	})

	mux.HandleFunc("GET /api/collections/contacts/records/{id}", func(w http.ResponseWriter, r *http.Request) {
		c, ok := f.contacts[r.PathValue("id")]
		if !ok {
			notFound(w)
			return
		}
		json.NewEncoder(w).Encode(c)
	})

	mux.HandleFunc("POST /api/collections/contacts/records", func(w http.ResponseWriter, r *http.Request) {
		body := decodeBody(r)
		f.lastCreate = body
		created := &contact{
			ID:        f.nextID(),
			FirstName: str(body["first_name"]),
			LastName:  str(body["last_name"]),
			Email:     str(body["email"]),
			Phone:     str(body["phone"]),
			Company:   str(body["company"]),
			JobTitle:  str(body["job_title"]),
			Notes:     str(body["notes"]),
			Favorite:  body["favorite"] == true,
			Owner:     str(body["owner"]),
		}
		f.contacts[created.ID] = created
		json.NewEncoder(w).Encode(created)
	})

	mux.HandleFunc("PATCH /api/collections/contacts/records/{id}", func(w http.ResponseWriter, r *http.Request) {
		c, ok := f.contacts[r.PathValue("id")]
		if !ok {
			notFound(w)
			return
		}
		body := decodeBody(r)
		f.lastPatch = body
		for key, set := range map[string]func(string){
			"first_name": func(v string) { c.FirstName = v },
			"last_name":  func(v string) { c.LastName = v },
			"email":      func(v string) { c.Email = v },
			"phone":      func(v string) { c.Phone = v },
			"company":    func(v string) { c.Company = v },
			"job_title":  func(v string) { c.JobTitle = v },
			"notes":      func(v string) { c.Notes = v },
			"deleted_at": func(v string) { c.DeletedAt = v },
		} {
			if v, ok := body[key].(string); ok {
				set(v)
			}
		}
		if v, ok := body["favorite"].(bool); ok {
			c.Favorite = v
		}
		json.NewEncoder(w).Encode(c)
	})

	mux.HandleFunc("DELETE /api/collections/contacts/records/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		f.deleted = append(f.deleted, id)
		delete(f.contacts, id)
		w.WriteHeader(http.StatusNoContent)
	})

	mux.HandleFunc("GET /api/search", func(w http.ResponseWriter, r *http.Request) {
		f.searchQuery = r.URL.Query()
		json.NewEncoder(w).Encode(searchResponse{
			Rows:   f.searchRows,
			Counts: map[string]int{"contacts": len(f.searchRows)},
		})
	})

	// The package-specific /api/contacts/search route was deliberately removed
	// (contacts/server/register.go registers fts.RegisterSync, not Register).
	// Answering it here would let `contacts search` be built against a route
	// the real server does not serve.
	mux.HandleFunc("/api/contacts/search", func(w http.ResponseWriter, r *http.Request) {
		f.t.Errorf("%s %s: contacts has no package search route — search is federated via /api/search?pkg=contacts",
			r.Method, r.URL.Path)
		notFound(w)
	})

	mux.HandleFunc("GET /api/contacts/export", func(w http.ResponseWriter, _ *http.Request) {
		var buf bytes.Buffer
		ids := make([]string, 0, len(f.contacts))
		for id := range f.contacts {
			ids = append(ids, id)
		}
		sort.Strings(ids)
		for _, id := range ids {
			c := f.contacts[id]
			if c.DeletedAt != "" {
				continue
			}
			fmt.Fprintf(&buf,
				"BEGIN:VCARD\r\nVERSION:4.0\r\nUID:urn:uuid:%s\r\nFN:%s %s\r\nEMAIL:%s\r\nEND:VCARD\r\n",
				c.ID, c.FirstName, c.LastName, c.Email)
		}
		w.Header().Set("Content-Type", "text/vcard; charset=utf-8")
		w.Write(buf.Bytes())
	})

	mux.HandleFunc("POST /api/contacts/import", func(w http.ResponseWriter, r *http.Request) {
		body, err := readUpload(r)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"message": err.Error()})
			return
		}
		f.importBody = string(body)
		json.NewEncoder(w).Encode(f.importResult)
	})

	srv := httptest.NewServer(mux)
	f.t.Cleanup(srv.Close)
	store := &staticStore{tok: client.TokenSet{
		AccessToken: "test-token", RefreshToken: "r", ExpiresAt: time.Now().Add(time.Hour),
	}}
	return srv, client.New(srv.URL, store, srv.Client())
}

// readUpload accepts the same two shapes the real endpoint does — a multipart
// `file` part or a raw body — so a test cannot pass against a fake that is
// more permissive than the server.
func readUpload(r *http.Request) ([]byte, error) {
	if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
		if err := r.ParseMultipartForm(1 << 20); err != nil {
			return nil, fmt.Errorf("invalid multipart upload: %w", err)
		}
		file, _, err := r.FormFile("file")
		if err != nil {
			return nil, fmt.Errorf("missing 'file' upload field")
		}
		defer file.Close()
		var buf bytes.Buffer
		buf.ReadFrom(file)
		return buf.Bytes(), nil
	}
	var buf bytes.Buffer
	buf.ReadFrom(r.Body)
	return buf.Bytes(), nil
}

func notFound(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNotFound)
	json.NewEncoder(w).Encode(map[string]string{"message": "Not found"})
}

func str(v any) string {
	s, _ := v.(string)
	return s
}

type staticStore struct{ tok client.TokenSet }

func (s *staticStore) Load() (client.TokenSet, error) { return s.tok, nil }
func (s *staticStore) Save(t client.TokenSet) error   { s.tok = t; return nil }

// newTestRoot mirrors the shell root's persistent flag set — the contract
// output.FromCommand reads — and registers the contacts group.
func newTestRoot(c *client.Client) *cobra.Command {
	root := &cobra.Command{Use: "tinycld", SilenceUsage: true, SilenceErrors: true}
	pf := root.PersistentFlags()
	pf.String("output", "table", "")
	pf.Bool("json", false, "")
	pf.String("context", "", "")
	pf.Bool("quiet", false, "")
	pf.Bool("no-color", false, "")
	pf.Bool("yes", false, "")
	Register(root, c)
	return root
}

func runCmd(t *testing.T, c *client.Client, args ...string) (string, string, error) {
	t.Helper()
	root := newTestRoot(c)
	var out, errBuf bytes.Buffer
	root.SetOut(&out)
	root.SetErr(&errBuf)
	root.SetIn(strings.NewReader(""))
	root.SetArgs(args)
	err := root.Execute()
	return out.String(), errBuf.String(), err
}
