import { Slot } from 'one'
import { YStack } from 'tamagui'
import { CalendarHeader } from '../components/CalendarHeader'
import { EventDetailPopover } from '../components/EventDetailPopover'
import { EventQuickCreate } from '../components/EventQuickCreate'
import { useEventDetail, VisibleCalendarsProvider } from '../hooks/useCalendarEvents'
import { CalendarViewProvider, useCalendarView } from '../hooks/useCalendarView'

function CalendarLayoutInner() {
    const { popover, closePopover } = useCalendarView()

    const eventId = popover.type === 'event-detail' ? popover.eventId : undefined
    const { event, calendar } = useEventDetail(eventId)

    return (
        <YStack flex={1} backgroundColor="$background">
            <CalendarHeader />
            <YStack flex={1}>
                <Slot />
            </YStack>

            <EventQuickCreate
                isVisible={popover.type === 'quick-create'}
                initialDate={popover.type === 'quick-create' ? popover.date : new Date()}
                initialHour={popover.type === 'quick-create' ? popover.hour : 9}
                onClose={closePopover}
            />

            <EventDetailPopover
                isVisible={popover.type === 'event-detail'}
                event={event}
                calendarName={calendar?.name ?? ''}
                calendarColorKey={calendar?.colorKey ?? 'blue'}
                onClose={closePopover}
            />
        </YStack>
    )
}

export default function CalendarLayout() {
    return (
        <VisibleCalendarsProvider>
            <CalendarViewProvider>
                <CalendarLayoutInner />
            </CalendarViewProvider>
        </VisibleCalendarsProvider>
    )
}
