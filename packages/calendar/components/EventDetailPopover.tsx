import { Clock, MapPin, Pencil, Trash2, Users, X } from 'lucide-react-native'
import { useRouter } from 'one'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from 'tamagui'
import { useOrgHref } from '~/lib/org-routes'
import type { CalendarEvent } from '../types'
import { getCalendarColorResolved } from './calendar-colors'

interface EventDetailPopoverProps {
    isVisible: boolean
    event: CalendarEvent | undefined
    calendarName: string
    calendarColorKey: string
    onClose: () => void
}

function formatEventDateTime(event: CalendarEvent): string {
    const start = new Date(event.start)
    const end = new Date(event.end)
    if (event.allDay) {
        return start.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
        })
    }
    const dateStr = start.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    })
    const startTime = start.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
    })
    const endTime = end.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
    })
    return `${dateStr}\n${startTime} – ${endTime}`
}

export function EventDetailPopover({
    isVisible,
    event,
    calendarName,
    calendarColorKey,
    onClose,
}: EventDetailPopoverProps) {
    const theme = useTheme()
    const router = useRouter()
    const orgHref = useOrgHref()

    if (!isVisible || !event) return null

    const colors = getCalendarColorResolved(calendarColorKey)
    const dateTimeStr = formatEventDateTime(event)

    const onEdit = () => {
        onClose()
        router.push(orgHref('calendar/[id]', { id: event.id }))
    }

    const onDelete = () => {
        onClose()
    }

    return (
        <Pressable style={styles.overlay} onPress={onClose}>
            <Pressable
                style={[
                    styles.popover,
                    {
                        backgroundColor: theme.background.val,
                        borderColor: theme.borderColor.val,
                        shadowColor: theme.shadowColor.val,
                    },
                ]}
                onPress={e => e.stopPropagation()}
            >
                <View style={styles.actions}>
                    <Pressable onPress={onEdit} hitSlop={8}>
                        <Pencil size={18} color={theme.color8.val} />
                    </Pressable>
                    <Pressable onPress={onDelete} hitSlop={8}>
                        <Trash2 size={18} color={theme.color8.val} />
                    </Pressable>
                    <Pressable onPress={onClose} hitSlop={8}>
                        <X size={18} color={theme.color8.val} />
                    </Pressable>
                </View>

                <View style={styles.titleRow}>
                    <View style={[styles.colorBar, { backgroundColor: colors.bg }]} />
                    <Text style={[styles.title, { color: theme.color.val }]}>{event.title}</Text>
                </View>

                <View style={styles.detailRow}>
                    <Clock size={16} color={theme.color8.val} />
                    <Text style={[styles.detailText, { color: theme.color.val }]}>
                        {dateTimeStr}
                    </Text>
                </View>

                {event.location ? (
                    <View style={styles.detailRow}>
                        <MapPin size={16} color={theme.color8.val} />
                        <Text style={[styles.detailText, { color: theme.color.val }]}>
                            {event.location}
                        </Text>
                    </View>
                ) : null}

                {event.guests.length > 0 ? (
                    <View style={styles.detailRow}>
                        <Users size={16} color={theme.color8.val} />
                        <Text style={[styles.detailText, { color: theme.color.val }]}>
                            {event.guests.length} guest{event.guests.length !== 1 ? 's' : ''}
                        </Text>
                    </View>
                ) : null}

                {event.description ? (
                    <Text
                        style={[styles.description, { color: theme.color8.val }]}
                        numberOfLines={3}
                    >
                        {event.description}
                    </Text>
                ) : null}

                <Text style={[styles.calendarLabel, { color: theme.color8.val }]}>
                    {calendarName}
                </Text>
            </Pressable>
        </Pressable>
    )
}

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
    popover: {
        width: 360,
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 16,
        marginBottom: 12,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
    },
    colorBar: {
        width: 4,
        height: 24,
        borderRadius: 2,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        flex: 1,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 8,
        paddingLeft: 2,
    },
    detailText: {
        fontSize: 14,
        flex: 1,
    },
    description: {
        fontSize: 13,
        marginTop: 4,
        marginBottom: 8,
        paddingLeft: 2,
    },
    calendarLabel: {
        fontSize: 12,
        marginTop: 8,
        paddingLeft: 2,
    },
})
