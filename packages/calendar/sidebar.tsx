import { useActiveParams, useRouter } from 'one'
import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from 'tamagui'
import { SidebarDivider, SidebarNav } from '~/components/sidebar-primitives'
import { useOrgHref } from '~/lib/org-routes'
import { CalendarList } from './components/CalendarList'
import { MiniCalendar } from './components/MiniCalendar'
import { useVisibleCalendars } from './hooks/useCalendarEvents'
import { parseDate, toDateString } from './hooks/useCalendarNavigation'

interface CalendarSidebarProps {
    isCollapsed: boolean
}

export default function CalendarSidebar(_props: CalendarSidebarProps) {
    const theme = useTheme()
    const router = useRouter()
    const orgHref = useOrgHref()
    const { calendars, visibleIds, toggleCalendar } = useVisibleCalendars()
    const { view, date } = useActiveParams<{ view?: string; date?: string }>()

    const selectedDate = useMemo(() => parseDate(date), [date])

    const handleDateSelect = (d: Date) => {
        router.push(orgHref('calendar', { view: view ?? 'week', date: toDateString(d) }))
    }

    const handleCreate = () => {
        router.push(orgHref('calendar/[id]', { id: 'new' }))
    }

    return (
        <SidebarNav>
            <View style={styles.createWrapper}>
                <Pressable
                    style={[styles.createButton, { backgroundColor: theme.accentBackground.val }]}
                    onPress={handleCreate}
                >
                    <Text style={[styles.createText, { color: theme.accentColor.val }]}>
                        + Create
                    </Text>
                </Pressable>
            </View>

            <MiniCalendar selectedDate={selectedDate} onDateSelect={handleDateSelect} />

            <SidebarDivider />

            <CalendarList calendars={calendars} visibleIds={visibleIds} onToggle={toggleCalendar} />
        </SidebarNav>
    )
}

const styles = StyleSheet.create({
    createWrapper: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
    },
    createText: {
        fontSize: 14,
        fontWeight: '600',
    },
})
