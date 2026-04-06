package drive

import (
	"context"
	"net/http"

	"github.com/emersion/go-webdav"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func Register(app *pocketbase.PocketBase) {
	// FTS sync hooks for drive_items
	app.OnRecordAfterCreateSuccess("drive_items").BindFunc(func(e *core.RecordEvent) error {
		syncDriveItemToFTS(app, e.Record, "create")
		// Async file content extraction
		go extractAndIndexDriveItem(app, e.Record)
		return e.Next()
	})

	app.OnRecordAfterUpdateSuccess("drive_items").BindFunc(func(e *core.RecordEvent) error {
		syncDriveItemToFTS(app, e.Record, "update")
		// Re-extract if file may have changed
		go extractAndIndexDriveItem(app, e.Record)
		return e.Next()
	})

	app.OnRecordAfterDeleteSuccess("drive_items").BindFunc(func(e *core.RecordEvent) error {
		syncDriveItemToFTS(app, e.Record, "delete")
		return e.Next()
	})

	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		// Search API endpoint
		e.Router.GET("/api/drive/search", func(re *core.RequestEvent) error {
			return handleDriveSearch(app, re)
		}).BindFunc(requireAuth)

		// WebDAV handler
		filesystem := &DriveFileSystem{app: app}
		handler := &webdav.Handler{FileSystem: filesystem}

		serveWebDAV := func(re *core.RequestEvent) error {
			_, _, ok := re.Request.BasicAuth()
			if !ok {
				re.Response.Header().Set("WWW-Authenticate", `Basic realm="TinyCld WebDAV"`)
				http.Error(re.Response, "Authentication required", http.StatusUnauthorized)
				return nil
			}

			ctx := context.WithValue(re.Request.Context(), httpRequestKey, re.Request)
			handler.ServeHTTP(re.Response, re.Request.WithContext(ctx))
			return nil
		}

		e.Router.Any("/webdav/{path...}", serveWebDAV)
		e.Router.Any("/webdav", serveWebDAV)

		e.Router.Any("/.well-known/webdav", func(re *core.RequestEvent) error {
			http.Redirect(re.Response, re.Request, "/webdav/", http.StatusMovedPermanently)
			return nil
		})

		return e.Next()
	})
}

func requireAuth(re *core.RequestEvent) error {
	if re.Auth == nil {
		return re.UnauthorizedError("Authentication required", nil)
	}
	return re.Next()
}
