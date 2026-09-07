package contacts

import (
	"testing"

	"tinycld.org/core/oauth"
)

// Every route the contacts CLI drives must resolve to a scope. An unclassified
// route 403s for OAuth callers only — sessions still work — so the CLI's fake
// server never notices; this is the test that does.
func TestOAuthClassifiesCLIRoutes(t *testing.T) {
	oauth.RegisterPackage(oauthPackage())

	for _, r := range []struct{ method, path, scope string }{
		{"GET", "/api/collections/contacts/records", scopeRead},
		{"POST", "/api/collections/contacts/records", scopeWrite},
		{"PATCH", "/api/collections/contacts/records/abc123", scopeWrite},
		{"DELETE", "/api/collections/contacts/records/abc123", scopeWrite},
		{"GET", "/api/contacts/export", scopeRead},
		{"POST", "/api/contacts/import", scopeWrite},
		{"GET", "/api/collections/labels/records", scopeRead},
		{"POST", "/api/collections/label_assignments/records", scopeWrite},
	} {
		rule := oauth.ScopeForRoute(r.method, r.path)
		if len(rule) == 0 {
			t.Errorf("%s %s is default-denied for OAuth callers", r.method, r.path)
			continue
		}
		if !rule.SatisfiedBy([]string{r.scope}) {
			t.Errorf("%s %s: %q must admit it (got %v)", r.method, r.path, r.scope, rule)
		}
	}
}

// Export must not be reachable with a write-only grant, nor import with a
// read-only one. Asserting the mapping alone would pass even if both routes
// named the same scope.
func TestOAuthTransferRoutesAreAsymmetric(t *testing.T) {
	oauth.RegisterPackage(oauthPackage())

	if oauth.ScopeForRoute("GET", "/api/contacts/export").SatisfiedBy([]string{scopeWrite}) {
		t.Error("contacts export must NOT be satisfied by contacts:write alone")
	}
	if oauth.ScopeForRoute("POST", "/api/contacts/import").SatisfiedBy([]string{scopeRead}) {
		t.Error("contacts import must NOT be satisfied by contacts:read alone")
	}
}

// GET /api/contacts/search is not mounted — search goes through the federated
// /api/search. A scope entry for a route that does not exist reads as though
// the endpoint were live.
func TestOAuthDoesNotClassifyUnmountedSearch(t *testing.T) {
	oauth.RegisterPackage(oauthPackage())
	if got := oauth.ScopeForRoute("GET", "/api/contacts/search"); len(got) != 0 {
		t.Errorf("unmounted contacts search route must not carry a scope, got %v", got)
	}
}

// The search source's scopes must be scopes this package actually registers,
// or the federated search would admit a scope no grant can carry.
func TestSearchSourceScopesAreRegistered(t *testing.T) {
	oauth.RegisterPackage(oauthPackage())
	registered := oauth.PackageScopes("contacts")
	for _, s := range searchSource().Scopes {
		if !oauth.HasScope(registered, s) {
			t.Errorf("search source names scope %q, which contacts does not register (%v)", s, registered)
		}
	}
}
