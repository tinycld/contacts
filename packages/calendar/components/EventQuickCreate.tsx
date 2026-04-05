import { Users, X } from 'lucide-react-native'
import { useRouter } from 'one'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Button, SizableText, useTheme, XStack, YStack } from 'tamagui'
import { useBreakpoint } from '~/components/workspace/useBreakpoint'
import { useOrgHref } from '~/lib/org-routes'
import { TextInput, useForm, z, zodResolver } from '~/ui/form'
import { getTimeLabel } from '../hooks/useCalendarNavigation'

const quickCreateSchema = z.object({
    title: z.string().min(1, 'Title is required'),
})

interface EventQuickCreateProps {
    isVisible: boolean
    initialDate: Date
    initialHour: number
    onClose: () => void
}

export function EventQuickCreate({
    isVisible,
    initialDate,
    initialHour,
    onClose,
}: EventQuickCreateProps) {
    const theme = useTheme()
    const router = useRouter()
    const orgHref = useOrgHref()
    const isMobile = useBreakpoint() === 'mobile'

    const { control, handleSubmit, reset } = useForm({
        mode: 'onChange',
        resolver: zodResolver(quickCreateSchema),
        defaultValues: { title: '' },
    })

    if (!isVisible) return null

    const dayLabel = initialDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    })
    const endHour = (initialHour + 1) % 24
    const timeLabel = `${getTimeLabel(initialHour)} – ${getTimeLabel(endHour)}`

    const onSave = handleSubmit(() => {
        reset()
        onClose()
    })

    const onMoreOptions = () => {
        onClose()
        router.push(orgHref('calendar/[id]', { id: 'new' }))
    }

    if (isMobile) {
        return (
            <Pressable style={mobileStyles.overlay} onPress={onClose}>
                <Pressable
                    style={[
                        mobileStyles.sheet,
                        {
                            backgroundColor: theme.background.val,
                            shadowColor: theme.shadowColor.val,
                        },
                    ]}
                    onPress={e => e.stopPropagation()}
                >
                    <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
                        <Pressable onPress={onClose}>
                            <SizableText size="$3" color="$color8">
                                Cancel
                            </SizableText>
                        </Pressable>
                        <Button theme="accent" size="$3" onPress={onSave}>
                            <Button.Text fontWeight="600">Save</Button.Text>
                        </Button>
                    </XStack>

                    <YStack gap="$3">
                        <TextInput
                            control={control}
                            name="title"
                            placeholder="Add title"
                            autoFocus
                        />

                        <YStack gap="$1">
                            <SizableText size="$2" color="$color8">
                                {dayLabel}
                            </SizableText>
                            <SizableText size="$2" color="$color8">
                                {timeLabel}
                            </SizableText>
                        </YStack>

                        <Pressable style={mobileStyles.addGuestsRow} onPress={onMoreOptions}>
                            <Users size={18} color={theme.color8.val} />
                            <Text style={{ color: theme.color8.val, fontSize: 14 }}>
                                Add guests
                            </Text>
                        </Pressable>
                    </YStack>
                </Pressable>
            </Pressable>
        )
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
                <View style={styles.header}>
                    <SizableText size="$4" fontWeight="600" color="$color">
                        New Event
                    </SizableText>
                    <Pressable onPress={onClose} hitSlop={8}>
                        <X size={18} color={theme.color8.val} />
                    </Pressable>
                </View>

                <YStack gap="$3" paddingVertical="$2">
                    <TextInput control={control} name="title" placeholder="Add title" autoFocus />

                    <YStack gap="$1">
                        <SizableText size="$2" color="$color8">
                            {dayLabel}
                        </SizableText>
                        <SizableText size="$2" color="$color8">
                            {timeLabel}
                        </SizableText>
                    </YStack>
                </YStack>

                <View style={styles.footer}>
                    <Pressable onPress={onMoreOptions}>
                        <SizableText size="$2" color="$accentBackground">
                            More options
                        </SizableText>
                    </Pressable>
                    <Button theme="accent" size="$3" onPress={onSave}>
                        <Button.Text fontWeight="600">Save</Button.Text>
                    </Button>
                </View>
            </Pressable>
        </Pressable>
    )
}

const mobileStyles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'flex-end',
        zIndex: 100,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    sheet: {
        width: '100%',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: 20,
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
    },
    addGuestsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 8,
    },
})

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
        width: 340,
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
})
