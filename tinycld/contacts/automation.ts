import type { AutomationDefinitions } from '@tinycld/core/lib/automation/types'
import type { ContactsSchema } from './types'

// contacts.owner is a direct relation to users, which the engine's owner
// auto-detection finds on its own (autoOwnerFields = user/owner/author) — so
// no ownerField and no registered resolver, and no package Go for automation.
//
// Both entries are pure declaration: a record-op create is executed by core's
// generic executor, which also re-applies pkgaccess for personal rules
// (checkPersonalAccess) — a native handler would have to enforce that itself.
const automation = {
    triggers: [
        {
            id: 'contact-added',
            label: 'A contact is added',
            collection: 'contacts',
            on: 'create',
            fields: [
                { key: 'first_name', label: 'First name' },
                { key: 'last_name', label: 'Last name' },
                'email',
                'phone',
                'company',
                { key: 'job_title', label: 'Job title' },
                'favorite',
            ],
        },
        {
            id: 'contact-updated',
            label: 'A contact changes',
            collection: 'contacts',
            on: 'update',
            // Watched columns are the ones a person edits. vcard_uid is
            // assigned once by the server hook and deleted_at is bookkeeping
            // for the trash — an update touching either is not "a contact
            // changed" in any sense a user would recognize, and watching them
            // would fire this on every CardDAV sync and every delete.
            watch: [
                'first_name',
                'last_name',
                'email',
                'phone',
                'company',
                'job_title',
                'favorite',
                'notes',
            ],
            fields: [
                { key: 'first_name', label: 'First name' },
                { key: 'last_name', label: 'Last name' },
                'email',
                'phone',
                'company',
                { key: 'job_title', label: 'Job title' },
                'favorite',
            ],
        },
    ],
    actions: [
        {
            id: 'add-contact',
            label: 'Add a contact',
            kind: 'record-op',
            collection: 'contacts',
            op: {
                type: 'create',
                set: {
                    first_name: { param: 'first_name' },
                    last_name: { param: 'last_name' },
                    email: { param: 'email' },
                    company: { param: 'company' },
                    // The rule's owner owns the contact. contacts.owner is
                    // required, so this is what makes the insert valid at all.
                    owner: { context: 'owner' },
                },
            },
            params: [
                { key: 'first_name', field: 'first_name', label: 'First name' },
                { key: 'last_name', field: 'last_name', label: 'Last name' },
                { key: 'email', field: 'email' },
                { key: 'company', field: 'company' },
            ],
        },
    ],
} satisfies AutomationDefinitions<ContactsSchema>

export default automation
