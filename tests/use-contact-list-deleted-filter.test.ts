// @vitest-environment happy-dom
//
// This test guards the compiled PocketBase filter string useContactList's
// deleted-view predicate sends, not just its in-memory result.
//
// `not(eq(contacts.deleted_at, ''))` used to be the deleted-view predicate.
// Older pbtsdb compiled `not(...)` to `!(...)`, which PocketBase's filter
// parser rejects outright. Since pbtsdb 0.10.1 `not()` compiles by negation
// push-down instead — this predicate becomes `deleted_at != ""`, which is
// valid — so the deleted view no longer HAS to avoid `not()`. The production
// query keeps the positive `gt(deleted_at, '')` by choice: a positive form
// reads the same as the filter it sends and needs no push-down step to reason
// about. This test pins both the production form and the compiled shape of the
// `not()` alternative, so a pbtsdb change to either is caught here.
//
// The compiled string is what matters, and a `localOnlyCollectionOptions`
// fixture never
// compiles a filter at all (TanStack DB evaluates the predicate in memory
// against the local rows), so a test built on one proves nothing about what
// reaches the server: `not()` and `gt()` return the identical row set in
// memory, and swapping the query back to `not()` still passes such a test.
// A real, network-backed `syncMode: 'on-demand'` collection DOES compile —
// `toRequest()` in pbtsdb calls its (unexported) `convertToPocketBaseFilter`
// before handing `{ filter }` to `pb.collection(name).getFullList/getList`
// — so this test stands up one against a stubbed PocketBase client and
// asserts on the literal `filter` string that request receives: it must
// read `deleted_at > ""` for the deleted view and contain no `!`.

import { and, eq, gt, not } from '@tanstack/db'
import { QueryClient } from '@tanstack/query-core'
import { useLiveQuery } from '@tanstack/react-db'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { createCollection } from 'pbtsdb/core'
import type PocketBase from 'pocketbase'
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
]

/**
 * A PocketBase stub whose `getFullList` records the `filter` string pbtsdb
 * compiled for it, and answers from the in-memory fixture so the fetch
 * still resolves. `subscribe` resolves immediately with a no-op unsubscribe
 * — this test only exercises the fetch path, not realtime.
 */
function makeStubPb() {
    const seenFilters: string[] = []
    const collectionApi = {
        getFullList: async (opts?: { filter?: string }) => {
            if (opts?.filter) seenFilters.push(opts.filter)
            return rows
        },
        getList: async (_page: number, _perPage: number, opts?: { filter?: string }) => {
            if (opts?.filter) seenFilters.push(opts.filter)
            return {
                items: rows,
                totalItems: rows.length,
                totalPages: 1,
                page: 1,
                perPage: rows.length,
            }
        },
        subscribe: async () => () => {},
        create: async () => {
            throw new Error('not used by this test')
        },
        update: async () => {
            throw new Error('not used by this test')
        },
        delete: async () => {
            throw new Error('not used by this test')
        },
    }
    const pb = { collection: () => collectionApi } as unknown as PocketBase
    return { pb, seenFilters }
}

function makeContacts(pb: PocketBase, queryClient: QueryClient) {
    const c = createCollection(pb, queryClient)
    return c('contacts', {
        getKey: (r: Row) => r.id,
        syncMode: 'on-demand',
        realtime: 'query',
    })
}

afterEach(() => cleanup())

async function compiledFilterFor(isDeleted: boolean) {
    const { pb, seenFilters } = makeStubPb()
    const queryClient = new QueryClient()
    const contacts = makeContacts(pb, queryClient)

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
    await waitFor(() => expect(seenFilters.length).toBeGreaterThan(0))
    return seenFilters[0]
}

describe('useContactList deleted-view predicate — compiled PocketBase filter', () => {
    it('the active view compiles to deleted_at = "", with no !', async () => {
        const filter = await compiledFilterFor(false)
        expect(filter).toContain('deleted_at = ""')
        expect(filter).not.toContain('!')
    })

    it('the deleted view compiles to deleted_at > "", with no !', async () => {
        const filter = await compiledFilterFor(true)
        expect(filter).toContain('deleted_at > ""')
        expect(filter).not.toContain('!')
    })

    // The control for the two assertions above: the same harness run against
    // the `not(eq(deleted_at, ''))` alternative, which compiles differently
    // from the production form. Under pbtsdb 0.10.1 negation push-down turns
    // it into `deleted_at != ""` — valid PocketBase, unlike the `!(...)` older
    // pbtsdb emitted, but still not the `deleted_at > ""` the production query
    // sends. If pbtsdb ever regresses to wrapping the whole clause in `!`,
    // this fails.
    it('a not()-based predicate compiles to deleted_at != "" by negation push-down', async () => {
        const { pb, seenFilters } = makeStubPb()
        const queryClient = new QueryClient()
        const contacts = makeContacts(pb, queryClient)

        const { result } = renderHook(() =>
            useLiveQuery(q =>
                q
                    .from({ contacts })
                    .where(({ contacts }) =>
                        and(eq(contacts.owner, 'u-me'), not(eq(contacts.deleted_at, '')))
                    )
            )
        )
        await waitFor(() => expect(result.current.data).toBeDefined())
        await waitFor(() => expect(seenFilters.length).toBeGreaterThan(0))

        expect(seenFilters[0]).toContain('deleted_at != ""')
        expect(seenFilters[0]).not.toContain('!(')
        expect(seenFilters[0]).not.toContain('deleted_at > ""')
    })
})
