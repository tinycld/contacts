package contacts

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/emersion/go-vcard"
	"github.com/google/uuid"
	"github.com/pocketbase/pocketbase/core"

	"tinycld.org/core/carddav"
)

// vcard_endpoints.go serves the contacts address book as a vCard FILE, for the
// CLI's `contacts export` / `contacts import`.
//
// CardDAV already speaks vCard, but it cannot be the CLI's transport: it is
// Basic-Auth only and mounted outside the API router, while the CLI carries an
// OAuth bearer token. So these are ordinary API routes that reuse the CardDAV
// codec and — importantly — cardDAVSource's field map, so one mapping stays
// behind both protocols instead of drifting into two.
//
// SECURITY: these are RAW routes. PocketBase evaluates collection rules for
// /api/collections/... and for nothing bound on e.Router, so the shipped
// contacts rules (owner scoping, the disabled clause) do NOT run here. Every
// check they would have made is made below by hand:
//   - owner scoping via cardDAVSource.ListFilter, the same filter CardDAV uses
//   - the suspension check via requireEnabledAuth
//   - OAuth scope (contacts:read / contacts:write) via core's route→scope table
//
// Drop any one of them and a token reads or writes an address book it does not
// own. vcard_endpoints_test.go pins all three.

// maxImportBytes caps an uploaded .vcf. A vCard file is text with no embedded
// media in our mapping, so a real address book is well under this; the cap is
// here so a malicious upload cannot be streamed into memory unbounded.
const maxImportBytes = 10 << 20 // 10 MiB

// importResult is the JSON body of a successful import. Counts are reported
// per-card rather than as a single pass/fail because import is deliberately
// fault tolerant: a malformed card is skipped, not fatal. Errors names each
// skipped card so nothing is dropped silently — a count alone would let a user
// believe a file imported cleanly when half of it did not.
type importResult struct {
	Created int      `json:"created"`
	Updated int      `json:"updated"`
	Failed  int      `json:"failed"`
	Errors  []string `json:"errors,omitempty"`
}

// bindVCardEndpoints registers the file export/import routes. Split from
// Register so the test can bind exactly these two onto its own app.
func bindVCardEndpoints(app core.App, e *core.ServeEvent) {
	e.Router.GET("/api/contacts/export", func(re *core.RequestEvent) error {
		return handleVCardExport(app, re)
	}).BindFunc(requireEnabledAuth)

	e.Router.POST("/api/contacts/import", func(re *core.RequestEvent) error {
		return handleVCardImport(app, re)
	}).BindFunc(requireEnabledAuth)
}

// requireEnabledAuth rejects an anonymous caller and a suspended one.
//
// The suspension half is the part that is easy to miss: coreserver's guard
// blocks token ISSUANCE, not use, so a token minted before an account was
// disabled keeps working until it expires. For REST the collection rules close
// that (migration 1830000000's `@request.auth.disabled != true`); a raw route
// has no rule engine, so it re-checks the flag on the live record here.
func requireEnabledAuth(re *core.RequestEvent) error {
	if re.Auth == nil {
		return re.UnauthorizedError("Authentication required", nil)
	}
	if re.Auth.GetBool("disabled") {
		return re.ForbiddenError("Account is disabled", nil)
	}
	return re.Next()
}

// handleVCardExport streams the caller's address book as a single vCard file.
//
// Per-user, always: there is no admin-wide export. The filter is
// cardDAVSource.ListFilter verbatim, so export and CardDAV cannot disagree
// about which rows belong to a book (it already excludes soft-deleted rows).
func handleVCardExport(app core.App, re *core.RequestEvent) error {
	records, err := app.FindRecordsByFilter(
		cardDAVSource.Collection,
		cardDAVSource.ListFilter,
		cardDAVSource.Sort,
		0, 0,
		map[string]any{"ownerId": re.Auth.Id},
	)
	if err != nil {
		return re.InternalServerError("failed to load contacts", err)
	}

	var buf bytes.Buffer
	enc := vcard.NewEncoder(&buf)
	for _, record := range records {
		card := carddav.RecordToVCard(record, cardDAVSource.VCard)
		if err := enc.Encode(card); err != nil {
			return re.InternalServerError("failed to encode vCard", err)
		}
	}

	re.Response.Header().Set("Content-Type", "text/vcard; charset=utf-8")
	re.Response.Header().Set("Content-Disposition", `attachment; filename="contacts.vcf"`)
	return re.String(http.StatusOK, buf.String())
}

// handleVCardImport reads a .vcf and upserts each card into the caller's book.
//
// Upsert, not insert: re-importing your own export must not duplicate every
// contact. The match key is vcard_uid — the only identity a vCard file carries,
// since (unlike CardDAV) there is no URL path to address an object by. The
// lookup is always scoped to the caller, so a card bearing someone else's UID
// creates a new contact rather than overwriting theirs.
func handleVCardImport(app core.App, re *core.RequestEvent) error {
	body, err := readImportBody(re)
	if err != nil {
		return re.BadRequestError(err.Error(), nil)
	}

	collection, err := app.FindCollectionByNameOrId(cardDAVSource.Collection)
	if err != nil {
		return re.InternalServerError("contacts collection unavailable", err)
	}

	result := importResult{}
	dec := vcard.NewDecoder(bytes.NewReader(body))
	for index := 0; ; index++ {
		card, err := dec.Decode()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			// A parse failure consumes the rest of the stream — the decoder
			// cannot resynchronize mid-card — so report it and stop rather
			// than spinning on the same error. Cards already applied stand.
			result.Failed++
			result.Errors = append(result.Errors,
				fmt.Sprintf("card %d: malformed vCard: %v", index+1, err))
			break
		}

		created, err := upsertCard(app, re, collection, card)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors,
				fmt.Sprintf("card %d (%s): %v", index+1, cardLabel(card), err))
			continue
		}
		if created {
			result.Created++
		} else {
			result.Updated++
		}
	}

	return re.JSON(http.StatusOK, result)
}

// upsertCard applies one card, returning whether it created a new record.
func upsertCard(
	app core.App,
	re *core.RequestEvent,
	collection *core.Collection,
	card vcard.Card,
) (bool, error) {
	uid := strings.TrimSpace(card.Value(vcard.FieldUID))

	record, err := findByUID(app, re.Auth.Id, uid)
	if err != nil {
		return false, err
	}

	created := record == nil
	if created {
		record = core.NewRecord(collection)
		record.Set(cardDAVSource.OwnerField, re.Auth.Id)

		// A card with no UID is unmatchable, so it creates — and gets a UID now,
		// mirroring the create hook, so the NEXT export/import of this contact
		// matches instead of duplicating.
		//
		// A UID already held by ANOTHER user is regenerated for the same
		// practical reason. vCard UIDs are unique within an address book, not
		// globally (RFC 6350) — two people are routinely sent the same card, or
		// import from the same source — but idx_contacts_vcard_uid is a global
		// unique index. Keeping the card's UID would fail the save, letting
		// whoever imported a contact first permanently block everyone else from
		// importing it.
		if uid == "" || uidTakenByAnotherOwner(app, re.Auth.Id, uid) {
			uid = "urn:uuid:" + uuid.NewString()
		}
		record.Set(cardDAVSource.UIDField, uid)
	}

	carddav.ApplyVCardToRecord(card, record, cardDAVSource.VCard)

	if err := app.Save(record); err != nil {
		return false, err
	}
	return created, nil
}

// uidTakenByAnotherOwner reports whether a UID is already held by someone
// else's contact — including a soft-deleted one, since the unique index covers
// those rows too.
//
// On a lookup error it answers true: regenerating a UID costs only the file's
// ability to re-match that one card later, while guessing wrong the other way
// fails the import outright.
func uidTakenByAnotherOwner(app core.App, ownerID, uid string) bool {
	records, err := app.FindRecordsByFilter(
		cardDAVSource.Collection,
		cardDAVSource.UIDField+" = {:uid} && "+cardDAVSource.OwnerField+" != {:ownerId}",
		"", 1, 0,
		map[string]any{"uid": uid, "ownerId": ownerID},
	)
	if err != nil {
		return true
	}
	return len(records) > 0
}

// findByUID looks up an existing contact by UID within the caller's own book.
// Returns (nil, nil) when there is no match — including for a card with no UID,
// which is unmatchable by definition and must therefore create.
func findByUID(app core.App, ownerID, uid string) (*core.Record, error) {
	if uid == "" {
		return nil, nil
	}

	// Scoped to the caller: matching a UID across owners would let a crafted
	// card overwrite another user's contact.
	records, err := app.FindRecordsByFilter(
		cardDAVSource.Collection,
		cardDAVSource.UIDField+" = {:uid} && "+cardDAVSource.OwnerField+" = {:ownerId}",
		"", 1, 0,
		map[string]any{"uid": uid, "ownerId": ownerID},
	)
	if err != nil {
		return nil, err
	}
	if len(records) == 0 {
		return nil, nil
	}
	return records[0], nil
}

// readImportBody pulls the .vcf out of either a multipart upload (the CLI and
// the browser both post a file) or a raw request body.
func readImportBody(re *core.RequestEvent) ([]byte, error) {
	limited := http.MaxBytesReader(re.Response, re.Request.Body, maxImportBytes)

	contentType := re.Request.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "multipart/form-data") {
		if err := re.Request.ParseMultipartForm(maxImportBytes); err != nil {
			return nil, fmt.Errorf("invalid multipart upload: %w", err)
		}
		file, _, err := re.Request.FormFile("file")
		if err != nil {
			return nil, errors.New("missing 'file' upload field")
		}
		defer file.Close()

		body, err := io.ReadAll(io.LimitReader(file, maxImportBytes))
		if err != nil {
			return nil, fmt.Errorf("failed to read upload: %w", err)
		}
		return body, nil
	}

	body, err := io.ReadAll(limited)
	if err != nil {
		return nil, fmt.Errorf("failed to read request body: %w", err)
	}
	if len(body) == 0 {
		return nil, errors.New("empty request body")
	}
	return body, nil
}

// cardLabel names a card in an error message so the user can find it in their
// file. Falls back to the UID, then a placeholder, since the card that failed
// may be exactly the one missing a name.
func cardLabel(card vcard.Card) string {
	if fn := strings.TrimSpace(card.Value(vcard.FieldFormattedName)); fn != "" {
		return fn
	}
	if uid := strings.TrimSpace(card.Value(vcard.FieldUID)); uid != "" {
		return uid
	}
	return "unnamed"
}
