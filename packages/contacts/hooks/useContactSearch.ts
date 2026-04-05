import { useCallback, useEffect, useRef, useState } from 'react'
import { pb } from '~/lib/pocketbase'

export interface ContactSearchResult {
    id: string
    first_name: string
    last_name: string
    email: string
    company: string
    phone: string
    favorite: boolean
    highlight: string
}

interface ContactSearchResponse {
    items: ContactSearchResult[]
    total: number
}

interface UseContactSearchReturn {
    results: ContactSearchResult[]
    isSearching: boolean
}

const DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2

export function useContactSearch(query: string): UseContactSearchReturn {
    const [results, setResults] = useState<ContactSearchResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const abortRef = useRef<AbortController | null>(null)

    const search = useCallback(async (q: string) => {
        abortRef.current?.abort()
        const controller = new AbortController()
        abortRef.current = controller

        setIsSearching(true)

        try {
            const response: ContactSearchResponse = await pb.send('/api/contacts/search', {
                method: 'GET',
                query: { q },
                signal: controller.signal,
            })
            if (!controller.signal.aborted) {
                setResults(response.items)
            }
        } catch (err: unknown) {
            if (err instanceof DOMException && err.name === 'AbortError') return
            if (!controller.signal.aborted) {
                setResults([])
            }
        } finally {
            if (!controller.signal.aborted) {
                setIsSearching(false)
            }
        }
    }, [])

    useEffect(() => {
        if (timerRef.current) clearTimeout(timerRef.current)

        if (query.length < MIN_QUERY_LENGTH) {
            setResults([])
            setIsSearching(false)
            abortRef.current?.abort()
            return
        }

        timerRef.current = setTimeout(() => search(query), DEBOUNCE_MS)

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [query, search])

    useEffect(() => {
        return () => {
            abortRef.current?.abort()
        }
    }, [])

    return { results, isSearching }
}
