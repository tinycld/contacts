import { ArrowLeft } from 'lucide-react-native'
import { useParams, useRouter } from 'one'
import { Pressable } from 'react-native'
import { Button, ScrollView, SizableText, useTheme, XStack, YStack } from 'tamagui'
import { useBreakpoint } from '~/components/workspace/useBreakpoint'
import { useForm, z, zodResolver } from '~/ui/form'
import { EventForm } from '../components/EventForm'
import { EventGuestList } from '../components/EventGuestList'
import { getAllCalendars, getEventById } from '../mock-data'

const eventSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string(),
    location: z.string(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
    allDay: z.boolean(),
    calendarId: z.string(),
    busyStatus: z.enum(['busy', 'free']),
    visibility: z.enum(['default', 'public', 'private']),
    reminderMinutes: z.number(),
})

export default function EventEditorScreen() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const theme = useTheme()
    const breakpoint = useBreakpoint()

    const isNew = !id || id === 'new'
    const event = isNew ? undefined : getEventById(id)
    const calendars = getAllCalendars()

    const startDate = event ? new Date(event.start) : new Date()
    const endDate = event ? new Date(event.end) : new Date()

    const {
        control,
        handleSubmit,
        formState: { errors, isSubmitted },
    } = useForm({
        mode: 'onChange',
        resolver: zodResolver(eventSchema),
        defaultValues: {
            title: event?.title ?? '',
            description: event?.description ?? '',
            location: event?.location ?? '',
            startDate: startDate.toISOString().split('T')[0],
            startTime: startDate.toTimeString().slice(0, 5),
            endDate: endDate.toISOString().split('T')[0],
            endTime: endDate.toTimeString().slice(0, 5),
            allDay: event?.allDay ?? false,
            calendarId: event?.calendarId ?? calendars[0]?.id ?? '',
            busyStatus: event?.busyStatus ?? ('busy' as const),
            visibility: event?.visibility ?? ('default' as const),
            reminderMinutes: event?.reminder ?? 30,
        },
    })

    if (!isNew && !event) {
        return (
            <YStack
                flex={1}
                alignItems="center"
                justifyContent="center"
                backgroundColor="$background"
            >
                <SizableText size="$4" color="$color8">
                    Event not found
                </SizableText>
                <Button size="$3" marginTop="$3" onPress={() => router.back()}>
                    <Button.Text>Go back</Button.Text>
                </Button>
            </YStack>
        )
    }

    const onSubmit = handleSubmit(() => {
        router.back()
    })

    const isDesktop = breakpoint === 'desktop'
    const guests = event?.guests ?? []

    const formContent = (
        <EventForm
            control={control}
            errors={errors}
            isSubmitted={isSubmitted}
            calendars={calendars}
        />
    )

    const guestContent = <EventGuestList guests={guests} />

    return (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} backgroundColor="$background">
            <YStack flex={1} padding="$5">
                <XStack justifyContent="space-between" alignItems="center" marginBottom="$5">
                    <XStack gap="$3" alignItems="center">
                        <Pressable onPress={() => router.back()}>
                            <ArrowLeft size={24} color={theme.color.val} />
                        </Pressable>
                        <SizableText size="$7" fontWeight="bold" color="$color">
                            {event ? 'Edit Event' : 'New Event'}
                        </SizableText>
                    </XStack>
                    <Button theme="accent" size="$3" onPress={onSubmit}>
                        <Button.Text fontWeight="600">Save</Button.Text>
                    </Button>
                </XStack>

                {isDesktop ? (
                    <XStack gap="$5" flex={1}>
                        <YStack flex={2}>{formContent}</YStack>
                        <YStack flex={1}>{guestContent}</YStack>
                    </XStack>
                ) : (
                    <YStack gap="$4">
                        {formContent}
                        {guestContent}
                    </YStack>
                )}
            </YStack>
        </ScrollView>
    )
}
