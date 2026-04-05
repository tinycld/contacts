import type React from 'react'
import { useCallback } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTheme } from 'tamagui'
import { getTimeLabel, isToday } from '../hooks/useCalendarNavigation'
import { getCalendarById } from '../mock-data'
import type { CalendarEvent } from '../types'
import { CurrentTimeIndicator } from './CurrentTimeIndicator'
import { getCalendarColorResolved } from './calendar-colors'
import { EventBlock } from './EventBlock'

export const HOUR_HEIGHT = 60

interface TimeGridColumn {
    date: Date
    events: CalendarEvent[]
}

interface TimeGridProps {
    columns: TimeGridColumn[]
    startHour?: number
    endHour?: number
    onSlotPress: (date: Date, hour: number) => void
    onEventPress: (eventId: string) => void
}

function getEventPosition(event: CalendarEvent, startHour: number) {
    const start = new Date(event.start)
    const end = new Date(event.end)
    const startMinutes = start.getHours() * 60 + start.getMinutes()
    const endMinutes = end.getHours() * 60 + end.getMinutes()
    const topOffset = ((startMinutes - startHour * 60) / 60) * HOUR_HEIGHT
    const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT
    return { topOffset, height }
}

function formatEventTime(event: CalendarEvent): string {
    const start = new Date(event.start)
    const hours = start.getHours()
    const minutes = start.getMinutes()
    const suffix = hours >= 12 ? 'PM' : 'AM'
    const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    const minuteStr = minutes > 0 ? `:${String(minutes).padStart(2, '0')}` : ''
    return `${displayHour}${minuteStr} ${suffix}`
}

export function TimeGrid({
    columns,
    startHour = 0,
    endHour = 23,
    onSlotPress,
    onEventPress,
}: TimeGridProps) {
    const theme = useTheme()
    const totalHours = endHour - startHour + 1

    // Scroll to current hour once the ScrollView mounts
    const scrollRef = useCallback(
        (node: ScrollView | null) => {
            if (!node) return
            const now = new Date()
            const currentHour = now.getHours()
            const scrollTarget = Math.max(0, (currentHour - startHour - 1) * HOUR_HEIGHT)
            node.scrollTo({ y: scrollTarget, animated: false })
        },
        [startHour]
    )

    const renderTimeLabels = useCallback(() => {
        const labels: React.JSX.Element[] = []
        for (let h = startHour; h <= endHour; h++) {
            labels.push(
                <View key={h} style={[styles.timeLabel, { height: HOUR_HEIGHT }]}>
                    <Text style={[styles.timeLabelText, { color: theme.color8.val }]}>
                        {h === startHour ? '' : getTimeLabel(h)}
                    </Text>
                </View>
            )
        }
        return labels
    }, [startHour, endHour, theme.color8.val])

    const now = new Date()
    const currentTimeOffset =
        ((now.getHours() * 60 + now.getMinutes() - startHour * 60) / 60) * HOUR_HEIGHT

    return (
        <ScrollView ref={scrollRef} style={styles.scrollView} showsVerticalScrollIndicator>
            <View style={styles.gridContainer}>
                <View style={styles.gutterColumn}>{renderTimeLabels()}</View>

                <View style={styles.columnsContainer}>
                    {columns.map((column, colIndex) => {
                        const todayColumn = isToday(column.date)
                        return (
                            <View
                                key={column.date.toISOString()}
                                style={[
                                    styles.column,
                                    colIndex < columns.length - 1 && {
                                        borderRightWidth: 1,
                                        borderRightColor: theme.borderColor.val,
                                    },
                                ]}
                            >
                                {Array.from({ length: totalHours }, (_, i) => {
                                    const hour = startHour + i
                                    return (
                                        <Pressable
                                            key={hour}
                                            style={[
                                                styles.hourSlot,
                                                { borderBottomColor: theme.borderColor.val },
                                            ]}
                                            onPress={() => onSlotPress(column.date, hour)}
                                        />
                                    )
                                })}

                                {column.events.map(event => {
                                    const { topOffset, height } = getEventPosition(event, startHour)
                                    const cal = getCalendarById(event.calendarId)
                                    const colors = getCalendarColorResolved(cal?.colorKey ?? 'blue')
                                    return (
                                        <EventBlock
                                            key={event.id}
                                            title={event.title}
                                            timeLabel={formatEventTime(event)}
                                            bgColor={colors.bg}
                                            textColor={colors.text}
                                            topOffset={topOffset}
                                            height={height}
                                            onPress={() => onEventPress(event.id)}
                                        />
                                    )
                                })}

                                {todayColumn && (
                                    <CurrentTimeIndicator topOffset={currentTimeOffset} />
                                )}
                            </View>
                        )
                    })}
                </View>
            </View>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
    },
    gridContainer: {
        flexDirection: 'row',
    },
    gutterColumn: {
        width: 50,
    },
    timeLabel: {
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        paddingRight: 8,
    },
    timeLabelText: {
        fontSize: 11,
        marginTop: -6,
    },
    columnsContainer: {
        flex: 1,
        flexDirection: 'row',
    },
    column: {
        flex: 1,
        position: 'relative',
    },
    hourSlot: {
        height: HOUR_HEIGHT,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
})
