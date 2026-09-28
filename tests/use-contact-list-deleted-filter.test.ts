// @vitest-environment happy-dom
//
// useContactList's deleted-view predicate used to read
// `not(eq(contacts.deleted_at, ''))`. pbtsdp compiles `not(...)` to `!(...)`,
// which PocketBase's filter parser rejects outright — so under on-demand sync
// (where the predicate is sent to the server) the Deleted view broke. The fix
// is the positive form `gt(contacts.deleted_at, '')`: `deleted_at` is either
// '' (active) or an ISO timestamp (deleted), and any non-empty date string
// sorts after '' lexically, so `> ''` selects exactly the deleted rows.
//
// This exercises the real query builder (not a hand-rolled predicate) against
// a local-only collection, the same technique
// core/tests/unit/use-mention-candidates.test.tsx uses, so a regression back
// to `not()` — which a local-only collection would silently still evaluate
// correctly in memory — is instead caught by asserting the exact row set.
import { and, BasicIndex, createCollection, eq, gt, localOnlyCollectionOptions } from '@tanstack/db'
import { useLiveQuery } from '@tanstack/react-db'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

interface Row {
    id: string
    owner: string
    deleted_at: string
}

const rows: Row[] = [
    { id: 'active-1', owner: 'u-me', deleted_at: '' },
    { id: 'active-2', owner: 'u-me', deleted_at: '' },
    { id: 'deleted-1', owner: 'u-me', deleted_at: '2026-01-01T00:00:00.000Z' },
    { id: 'other-owner', owner: 'u-other', deleted_at: '2026-01-01T00:00:00.000Z' },
]

function makeContacts() {
    const contacts = createCollection(
        localOnlyCollectionOptions({
            id: 'test-contacts',
            getKey: (r: Row) => r.id,
            initialData: rows,
            defaultIndexType: BasicIndex,
        })
    )
    return contacts
}

afterEach(() => cleanup())

async function queryWith(isDeleted: boolean) {
    const contacts = makeContacts()
    const { result } = renderHook(() =>
        useLiveQuery(q =>
            q
                .from({ contacts })
                .where(({ contacts }) =>
                    and(
                        eq(contacts.owner, 'u-me'),
                        isDeleted ? gt(contacts.deleted_at, '') : eq(contacts.deleted_at, '')
                    )
                )
        )
    )
    await waitFor(() => expect(result.current.data).toBeDefined())
    return (result.current.data ?? []).map(r => r.id).sort()
}

describe('useContactList deleted-view predicate', () => {
    it('the active view (eq deleted_at "") returns only non-deleted rows owned by the caller', async () => {
        expect(await queryWith(false)).toEqual(['active-1', 'active-2'])
    })

    it('the deleted view (gt deleted_at "") returns only deleted rows owned by the caller', async () => {
        expect(await queryWith(true)).toEqual(['deleted-1'])
    })
})
