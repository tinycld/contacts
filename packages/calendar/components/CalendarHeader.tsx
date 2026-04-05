import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { Pressable } from 'react-native'
import { Button, SizableText, useTheme, XStack } from 'tamagui'
import { useBreakpoint } from '~/components/workspace/useBreakpoint'
import { formatDateLabel } from '../hooks/useCalendarNavigation'
import { useCalendarView, type ViewMode } from '../hooks/useCalendarView'

const VIEW_MODES: ViewMode[] = ['day', 'week', 'month']
const VIEW_LABELS: Record<ViewMode, string> = {
    day: 'Day',
    week: 'Week',
    month: 'Month',
}

export function CalendarHeader() {
    const { viewMode, setViewMode, focusDate, goToday, goNext, goPrevious } = useCalendarView()
    const theme = useTheme()
    const breakpoint = useBreakpoint()
    const isMobile = breakpoint === 'mobile'

    const dateLabel = formatDateLabel(focusDate, viewMode)

    return (
        <XStack
            alignItems="center"
            paddingHorizontal="$4"
            paddingVertical="$2"
            gap="$2"
            borderBottomWidth={1}
            borderBottomColor="$borderColor"
        >
            <Button size="$3" variant="outlined" borderColor="$borderColor" onPress={goToday}>
                <Button.Text>Today</Button.Text>
            </Button>

            <Pressable onPress={goPrevious} hitSlop={8}>
                <ChevronLeft size={20} color={theme.color.val} />
            </Pressable>
            <Pressable onPress={goNext} hitSlop={8}>
                <ChevronRight size={20} color={theme.color.val} />
            </Pressable>

            <SizableText size="$6" fontWeight="600" color="$color" flex={1}>
                {dateLabel}
            </SizableText>

            {!isMobile && (
                <XStack gap="$1">
                    {VIEW_MODES.map(mode => (
                        <Button
                            key={mode}
                            size="$3"
                            theme={viewMode === mode ? 'accent' : undefined}
                            variant={viewMode === mode ? undefined : 'outlined'}
                            borderColor={viewMode === mode ? undefined : '$borderColor'}
                            onPress={() => setViewMode(mode)}
                        >
                            <Button.Text>{VIEW_LABELS[mode]}</Button.Text>
                        </Button>
                    ))}
                </XStack>
            )}
        </XStack>
    )
}
