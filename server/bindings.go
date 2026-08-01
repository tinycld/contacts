package contacts

import (
	"github.com/grafana/sobek"
	"github.com/pocketbase/pocketbase"

	"tinycld.org/core/coreserver"
	"tinycld.org/core/fts"
)

// registerJSVMBinding installs a `$contacts` namespace onto every server-side JS
// VM (via core's OnInit binder registry), so package-author `.pb.ts` hooks can
// call contacts' Go from TS. This is the seam for logic that must stay in Go (the
// FTS query here) but be invokable from customizer TS — the counterpart to the
// record-event hooks a TS author can bind to directly.
//
// Registered from Register() before the first VM spins up. Today it exposes:
//
//	$contacts.search(userId, { q, limit, offset, includeDeleted }) -> { items, total }
func registerJSVMBinding(_ *pocketbase.PocketBase) {
	coreserver.RegisterJSVMBinder(func(vm *sobek.Runtime, app *pocketbase.PocketBase) error {
		search := func(userID string, opts map[string]any) (map[string]any, error) {
			so := fts.SearchOpts{Limit: 25}
			if v, ok := opts["q"].(string); ok {
				so.Query = v
			}
			if v, ok := opts["limit"].(int64); ok && v > 0 {
				so.Limit = int(v)
			}
			if v, ok := opts["offset"].(int64); ok && v >= 0 {
				so.Offset = int(v)
			}
			if v, ok := opts["includeDeleted"].(bool); ok {
				so.IncludeDeleted = v
			}

			results, total, err := fts.Search(app, ftsConfig, userID, so)
			if err != nil {
				return nil, err
			}
			items := make([]any, len(results))
			for i, r := range results {
				m := map[string]any{"id": r.ID}
				for k, v := range r.Columns {
					m[k] = v
				}
				items[i] = m
			}
			return map[string]any{"items": items, "total": total}, nil
		}

		obj, err := coreserver.NewBindNamespace(vm, map[string]any{"search": search})
		if err != nil {
			return err
		}
		return vm.Set("$contacts", obj)
	})
}
