/// <reference path="../../tinycld/server/pb_data/types.d.ts" />
// Deny a suspended account REST access to contacts.
//
// Every contacts rule was `owner = @request.auth.id` and nothing more, so a
// disabled user kept full CRUD over their own address book via
// /api/collections/contacts/records for as long as their token lived.
//
// coreserver's disabled guard blocks token ISSUANCE, not use, and PocketBase's
// REST API evaluates these rules instead of any Go — so for a hosted tenant the
// rule is the entire authorization. CardDAV is already covered (davauth checks
// the flag on every Basic request, since DAV has no session to revoke); REST
// was the hole. calendar's 1830000004 added the same clause to its collections;
// contacts didn't follow.
//
// Covered by server/disabled_rls_test.go, which reads the SHIPPED rules
// (rlstest) and pairs the deny with an enabled-owner positive control.
migrate(
    app => {
        const enabled = '@request.auth.disabled != true'
        const isOwner = 'owner = @request.auth.id'

        const collection = app.findCollectionByNameOrId('contacts')
        collection.listRule = `${enabled} && ${isOwner}`
        collection.viewRule = `${enabled} && ${isOwner}`
        collection.createRule = `${enabled} && ${isOwner}`
        collection.updateRule = `${enabled} && ${isOwner}`
        collection.deleteRule = `${enabled} && ${isOwner}`
        return app.save(collection)
    },
    app => {
        const isOwner = 'owner = @request.auth.id'

        const collection = app.findCollectionByNameOrId('contacts')
        collection.listRule = isOwner
        collection.viewRule = isOwner
        collection.createRule = isOwner
        collection.updateRule = isOwner
        collection.deleteRule = isOwner
        return app.save(collection)
    }
)
