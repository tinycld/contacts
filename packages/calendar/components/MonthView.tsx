import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from 'tamagui'
import { useCalendarEvents } from '../hooks/useCalendarEvents'
import { eventOverlapsRange } from '../hooks/useCalendarNavigation'
import { useCalendarView } from '../hooks/useCalendarView'
import { getMonthGrid, type MonthGridCell } from '../hooks/useMonthGrid'
import type { CalendarEvent } from '../types'
import { MonthCell } from './MonthCell'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function MonthView() {
    const { focusDate, openEventDetail, setViewMode, goToDate } = useCalendarView()
    const theme = useTheme()

    const grid = useMemo(() => getMonthGrid(focusDate), [focusDate])

    const gridStart = grid[0].date
    const gridEnd = grid[grid.length - 1].date

    const events = useCalendarEvents(gridStart, gridEnd)

    const eventsByDate = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>()
        for (const cell of grid) {
            const dayStart = new Date(cell.date)
            dayStart.setHours(0, 0, 0, 0)
            const dayEnd = new Date(cell.date)
            dayEnd.setHours(23, 59, 59, 999)
            const key = cell.date.toISOString()
            map.set(
                key,
                events.filter(event => eventOverlapsRange(event, dayStart, dayEnd))
            )
        }
        return map
    }, [grid, events])

    const rows = useMemo(() => {
        const result: MonthGridCell[][] = []
        for (let i = 0; i < grid.length; i += 7) {
            result.push(grid.slice(i, i + 7))
        }
        return result
    }, [grid])

    const handleDatePress = (date: Date) => {
        goToDate(date)
        setViewMode('day')
    }

    return (
        <View style={styles.container}>
            <View style={[styles.headerRow, { borderBottomColor: theme.borderColor.val }]}>
                {DAY_LABELS.map(label => (
                    <View key={label} style={styles.headerCell}>
                        <Text style={[styles.headerText, { color: theme.color8.val }]}>
                            {label}
                        </Text>
                    </View>
                ))}
            </View>

            {rows.map(row => (
                <View key={row[0].date.toISOString()} style={styles.row}>
                    {row.map(cell => (
                        <MonthCell
                            key={cell.date.toISOString()}
                            date={cell.date}
                            isCurrentMonth={cell.isCurrentMonth}
                            isToday={cell.isToday}
                            events={eventsByDate.get(cell.date.toISOString()) ?? []}
                            onDatePress={handleDatePress}
                            onEventPress={openEventDetail}
                        />
                    ))}
                </View>
            ))}
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
    headerCell: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
    },
    headerText: {
        fontSize: 12,
        fontWeight: '600',
    },
    row: {
        flex: 1,
        flexDirection: 'row',
    },
})
