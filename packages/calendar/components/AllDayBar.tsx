import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from 'tamagui'
import { getCalendarById } from '../mock-data'
import type { CalendarEvent } from '../types'
import { getCalendarColorResolved } from './calendar-colors'

interface AllDayBarProps {
    events: CalendarEvent[]
    onEventPress: (eventId: string) => void
}

export function AllDayBar({ events, onEventPress }: AllDayBarProps) {
    const theme = useTheme()

    if (events.length === 0) return null

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: theme.sidebarBackground.val,
                    borderBottomColor: theme.borderColor.val,
                },
            ]}
        >
            {events.map(event => {
                const cal = getCalendarById(event.calendarId)
                const colors = getCalendarColorResolved(cal?.colorKey ?? 'blue')
                return (
                    <Pressable key={event.id} onPress={() => onEventPress(event.id)}>
                        <View style={[styles.pill, { backgroundColor: colors.bg }]}>
                            <Text style={[styles.pillText, { color: colors.text }]}>
                                {event.title}
                            </Text>
                        </View>
                    </Pressable>
                )
            })}
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        gap: 4,
        borderBottomWidth: 1,
    },
    pill: {
        borderRadius: 3,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    pillText: {
        fontSize: 12,
        fontWeight: '600',
    },
})
