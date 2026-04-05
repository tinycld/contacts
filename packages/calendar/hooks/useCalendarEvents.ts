import {
    createContext,
    createElement,
    type ReactNode,
    useCallback,
    useContext,
    useMemo,
    useState,
} from 'react'
import { getAllCalendars, getEventById, getEventsForDateRange } from '../mock-data'
import type { Calendar, CalendarEvent } from '../types'

interface VisibleCalendarsState {
    calendars: Calendar[]
    mineCalendars: Calendar[]
    otherCalendars: Calendar[]
    visibleIds: Set<string>
    toggleCalendar: (id: string) => void
}

const VisibleCalendarsContext = createContext<VisibleCalendarsState | null>(null)

export function VisibleCalendarsProvider({ children }: { children: ReactNode }) {
    const [visibleIds, setVisibleIds] = useState<Set<string>>(
        () => new Set(getAllCalendars().map(c => c.id))
    )
    const calendars = getAllCalendars()

    const toggleCalendar = useCallback((id: string) => {
        setVisibleIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }, [])

    const mineCalendars = useMemo(() => calendars.filter(c => c.group === 'mine'), [calendars])
    const otherCalendars = useMemo(() => calendars.filter(c => c.group === 'other'), [calendars])

    const value = useMemo(
        () => ({ calendars, mineCalendars, otherCalendars, visibleIds, toggleCalendar }),
        [calendars, mineCalendars, otherCalendars, visibleIds, toggleCalendar]
    )

    return createElement(VisibleCalendarsContext.Provider, { value }, children)
}

export function useVisibleCalendars(): VisibleCalendarsState {
    const ctx = useContext(VisibleCalendarsContext)
    if (!ctx) {
        throw new Error('useVisibleCalendars must be used within VisibleCalendarsProvider')
    }
    return ctx
}

export function useCalendarEvents(startDate: Date, endDate: Date) {
    const { visibleIds } = useVisibleCalendars()

    return useMemo(() => {
        const allEvents = getEventsForDateRange(startDate, endDate)
        return allEvents.filter(e => visibleIds.has(e.calendarId))
    }, [startDate, endDate, visibleIds])
}

export function useEventDetail(eventId: string | undefined): {
    event: CalendarEvent | undefined
    calendar: Calendar | undefined
} {
    return useMemo(() => {
        if (!eventId) return { event: undefined, calendar: undefined }
        const event = getEventById(eventId)
        const calendar = event ? getAllCalendars().find(c => c.id === event.calendarId) : undefined
        return { event, calendar }
    }, [eventId])
}
