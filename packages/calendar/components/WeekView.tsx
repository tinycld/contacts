import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTheme } from 'tamagui'
import { useCalendarEvents } from '../hooks/useCalendarEvents'
import {
    addDays,
    eventOverlapsRange,
    getWeekDays,
    isToday,
    startOfWeek,
} from '../hooks/useCalendarNavigation'
import { useCalendarView } from '../hooks/useCalendarView'
import type { CalendarEvent } from '../types'
import { AllDayBar } from './AllDayBar'
import { DayColumnHeader } from './DayColumnHeader'
import { TimeGrid } from './TimeGrid'

function getEventsForDay(events: CalendarEvent[], date: Date): CalendarEvent[] {
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(date)
    dayEnd.setHours(23, 59, 59, 999)

    return events.filter(event => eventOverlapsRange(event, dayStart, dayEnd))
}

export function WeekView() {
    const { focusDate, openQuickCreate, openEventDetail } = useCalendarView()
    const theme = useTheme()

    const weekStart = useMemo(() => startOfWeek(focusDate), [focusDate])
    const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])
    const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart])

    const events = useCalendarEvents(weekStart, weekEnd)

    const { allDayEvents, columns } = useMemo(() => {
        const allDay = events.filter(e => e.allDay)
        const timed = events.filter(e => !e.allDay)
        const cols = weekDays.map(date => ({
            date,
            events: getEventsForDay(timed, date),
        }))
        return { allDayEvents: allDay, columns: cols }
    }, [events, weekDays])

    return (
        <View style={styles.container}>
            <View style={[styles.headerRow, { borderBottomColor: theme.borderColor.val }]}>
                <View style={styles.gutterSpacer} />
                {weekDays.map(date => (
                    <View key={date.toISOString()} style={styles.headerCell}>
                        <DayColumnHeader date={date} isToday={isToday(date)} />
                    </View>
                ))}
            </View>
            <AllDayBar events={allDayEvents} onEventPress={openEventDetail} />
            <TimeGrid
                columns={columns}
                onSlotPress={openQuickCreate}
                onEventPress={openEventDetail}
            />
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
    },
    gutterSpacer: {
        width: 50,
    },
    headerCell: {
        flex: 1,
        alignItems: 'center',
    },
})
