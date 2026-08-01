package contacts

import (
	"net/http"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
	"tinycld.org/core/rlstest"
)

// disabled_rls_test.go proves the contacts rules deny a suspended account.
//
// coreserver's disabled guard blocks token ISSUANCE, not use, so a live token
// kept working. CardDAV is covered by davauth (it re-checks the flag on every
// Basic request), but PocketBase's REST API evaluates the collection rules
// instead of any Go — and for a hosted tenant the rule is the entire
// authorization. Before 1830000000 every contacts rule was a bare
// `owner = @request.auth.id`.
//
// These run against the SHIPPED migrations (rlstest), not a rule constant
// declared here, so a later migration that restates a rule without the clause
// turns them red instead of leaving them validating a stale copy.

type contactsDisabledEnv struct {
	app     *tests.TestApp
	contact *core.Record
	owner   *core.Record
	token   string
}

func setupContactsDisabledApp(t *testing.T) *contactsDisabledEnv {
	t.Helper()
	app := rlstest.NewApp(t)

	// `disabled` belongs to core's users schema, which this module does not
	// carry; the shipped rules read it.
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatal(err)
	}
	users.Fields.Add(&core.BoolField{Name: "disabled"})
	if err := app.Save(users); err != nil {
		t.Fatalf("add users fields: %v", err)
	}

	rlstest.Apply(t, app, rlstest.MigrationsDir(t, "../pb-migrations"))

	owner := core.NewRecord(users)
	owner.SetEmail("owner@test.local")
	owner.Set("name", "Owner")
	owner.SetVerified(true)
	owner.SetPassword("Password123!")
	if err := app.Save(owner); err != nil {
		t.Fatal(err)
	}

	contactsCol, err := app.FindCollectionByNameOrId("contacts")
	if err != nil {
		t.Fatal(err)
	}
	contact := core.NewRecord(contactsCol)
	contact.Set("first_name", "Private")
	contact.Set("last_name", "Contact")
	contact.Set("owner", owner.Id)
	if err := app.Save(contact); err != nil {
		t.Fatal(err)
	}

	token, err := owner.NewAuthToken()
	if err != nil {
		t.Fatal(err)
	}

	return &contactsDisabledEnv{app: app, contact: contact, owner: owner, token: token}
}

func (env *contactsDisabledEnv) disableOwner(t *testing.T) {
	t.Helper()
	fresh, err := env.app.FindRecordById("users", env.owner.Id)
	if err != nil {
		t.Fatal(err)
	}
	fresh.Set("disabled", true)
	if err := env.app.Save(fresh); err != nil {
		t.Fatal(err)
	}
	if check, err := env.app.FindRecordById("users", env.owner.Id); err != nil || !check.GetBool("disabled") {
		t.Fatalf("disabled flag did not persist (err=%v)", err)
	}
}

// The clause the deny-tests depend on must be present in every SHIPPED rule.
func TestContactsDisabledRLS_ShippedRulesCarryDisabledClause(t *testing.T) {
	env := setupContactsDisabledApp(t)
	for _, kind := range []string{"list", "view", "create", "update", "delete"} {
		rlstest.RequireRuleContains(t, env.app, "contacts", kind,
			`@request.auth.disabled != true`)
	}
}

// Positive control: without it, a rule that denied everyone would pass below.
func TestContactsDisabledRLS_EnabledOwnerCanView(t *testing.T) {
	env := setupContactsDisabledApp(t)
	(&tests.ApiScenario{
		Name:                  "enabled owner reads their contact",
		Method:                http.MethodGet,
		URL:                   "/api/collections/contacts/records/" + env.contact.Id,
		Headers:               map[string]string{"Authorization": env.token},
		ExpectedStatus:        http.StatusOK,
		ExpectedContent:       []string{`"first_name":"Private"`},
		TestAppFactory:        func(_ testing.TB) *tests.TestApp { return env.app },
		DisableTestAppCleanup: true,
	}).Test(t)
}

func TestContactsDisabledRLS_DisabledOwnerDenied(t *testing.T) {
	env := setupContactsDisabledApp(t)
	env.disableOwner(t)

	(&tests.ApiScenario{
		Name:                  "disabled owner is refused their own contact",
		Method:                http.MethodGet,
		URL:                   "/api/collections/contacts/records/" + env.contact.Id,
		Headers:               map[string]string{"Authorization": env.token},
		ExpectedStatus:        http.StatusNotFound,
		NotExpectedContent:    []string{"Private"},
		TestAppFactory:        func(_ testing.TB) *tests.TestApp { return env.app },
		DisableTestAppCleanup: true,
	}).Test(t)
}

// Suspension must close writes too, not only reads: a disabled account that
// could still edit its address book would keep changing what CardDAV serves.
func TestContactsDisabledRLS_DisabledOwnerCannotCreate(t *testing.T) {
	env := setupContactsDisabledApp(t)
	env.disableOwner(t)

	(&tests.ApiScenario{
		Name:   "disabled owner cannot create a contact",
		Method: http.MethodPost,
		URL:    "/api/collections/contacts/records",
		Body:   strings.NewReader(`{"first_name":"New","owner":"` + env.owner.Id + `"}`),
		Headers: map[string]string{
			"Authorization": env.token, "Content-Type": "application/json",
		},
		ExpectedStatus:        http.StatusBadRequest,
		ExpectedContent:       []string{`"message"`},
		TestAppFactory:        func(_ testing.TB) *tests.TestApp { return env.app },
		DisableTestAppCleanup: true,
	}).Test(t)
}
