package contacts

import "tinycld.org/core/oauth"

const (
	scopeRead  = "contacts:read"
	scopeWrite = "contacts:write"
)

// oauthPackage declares what an OAuth token may reach in contacts. Registered
// from registerShared; the catalog, the consent screen and the CLI's login
// request are all derived from it. A route or collection missing here is
// default-denied for OAuth callers only — sessions still work — so the CLI's
// surface is pinned in oauth_scopes_test.go.
//
// There is deliberately no GET /api/contacts/search: register.go calls
// fts.RegisterSync rather than fts.Register, so search is served only by
// core's federated /api/search. A scope entry for a route that does not
// exist would read as though the endpoint were live.
func oauthPackage() oauth.Package {
	rw := oauth.Access{Read: []string{scopeRead}, Write: []string{scopeWrite}}
	return oauth.Package{
		Slug: "contacts",
		Scopes: []oauth.Scope{
			{ID: scopeRead, Label: "Read your contacts"},
			{ID: scopeWrite, Label: "Create and modify your contacts"},
		},
		Collections: map[string]oauth.Access{
			"contacts": rw,
			// Labels are CORE collections shared with mail, which claims them
			// too; core unions the two, so either package's grant reaches
			// them.
			"labels":            rw,
			"label_assignments": rw,
		},
		Endpoints: map[string][]string{
			// vCard transfer. The read/write split is the point: an export
			// handed contacts:write would be reachable by a token granted
			// only to edit, and an import admitted by contacts:read alone
			// would let a read-only integration create records.
			"GET /api/contacts/export":  {scopeRead},
			"POST /api/contacts/import": {scopeWrite},
		},
	}
}
