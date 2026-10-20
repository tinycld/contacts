package contacts

import (
	"context"
	"errors"
	"testing"

	"tinycld.org/core/search"
)

// The aggregator cancels a source's context when its time is up or the app
// terminates; the source must not run its query after that.
func TestSearchContactRows_StopsWhenTheContextEnded(t *testing.T) {
	env := setupContactsDisabledApp(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	result, err := searchContactRows(env.app, env.owner.Id, search.Query{
		Include: []string{"private"},
		Limit:   25,
		Ctx:     ctx,
	})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v, want context.Canceled", err)
	}
	if len(result.Rows) != 0 {
		t.Fatalf("rows = %+v, want none", result.Rows)
	}
}
