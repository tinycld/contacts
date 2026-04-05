import { Plus } from 'lucide-react-native'
import { useRouter } from 'one'
import { Pressable, StyleSheet } from 'react-native'
import { useTheme } from 'tamagui'
import { useOrgHref } from '~/lib/org-routes'

interface CalendarFABProps {
    isVisible: boolean
}

export function CalendarFAB({ isVisible }: CalendarFABProps) {
    const theme = useTheme()
    const router = useRouter()
    const orgHref = useOrgHref()

    if (!isVisible) return null

    return (
        <Pressable
            style={[styles.fab, { backgroundColor: theme.accentBackground.val }]}
            onPress={() => router.push(orgHref('calendar/[id]', { id: 'new' }))}
            accessibilityLabel="Create event"
        >
            <Plus size={24} color={theme.accentColor.val} />
        </Pressable>
    )
}

const styles = StyleSheet.create({
    fab: {
        position: 'absolute',
        bottom: 80,
        right: 16,
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        zIndex: 50,
    },
})
