import { Forward, Reply, ReplyAll } from 'lucide-react-native'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from 'tamagui'
import { useBreakpoint } from '~/components/workspace/useBreakpoint'
import { useCompose } from '../hooks/useComposeState'
import type { MockEmail } from './mockData'

interface InlineReplyProps {
    email: MockEmail
}

export function InlineReply({ email }: InlineReplyProps) {
    const theme = useTheme()
    const breakpoint = useBreakpoint()
    const isMobile = breakpoint === 'mobile'
    const { openReply } = useCompose()

    const handleReply = () => {
        openReply({
            messageId: email.id,
            threadId: email.id,
            subject: email.subject,
            to: [{ name: email.sender, email: email.senderEmail }],
        })
    }

    // TODO: include Cc and other To recipients when real data replaces MockEmail
    const handleReplyAll = () => {
        openReply({
            messageId: email.id,
            threadId: email.id,
            subject: email.subject,
            to: [{ name: email.sender, email: email.senderEmail }],
        })
    }

    const handleForward = () => {
        openReply({
            messageId: email.id,
            threadId: email.id,
            subject: `Fwd: ${email.subject}`,
            to: [],
        })
    }

    return (
        <View
            style={[
                styles.container,
                isMobile && styles.containerMobile,
                { borderTopColor: theme.borderColor.val },
            ]}
        >
            <Pressable
                style={[styles.actionButton, { borderColor: theme.borderColor.val }]}
                onPress={handleReply}
            >
                <Reply size={16} color={theme.color8.val} />
                <Text style={[styles.actionText, { color: theme.color8.val }]}>Reply</Text>
            </Pressable>
            <Pressable
                style={[styles.actionButton, { borderColor: theme.borderColor.val }]}
                onPress={handleReplyAll}
            >
                <ReplyAll size={16} color={theme.color8.val} />
                <Text style={[styles.actionText, { color: theme.color8.val }]}>Reply all</Text>
            </Pressable>
            <Pressable
                style={[styles.actionButton, { borderColor: theme.borderColor.val }]}
                onPress={handleForward}
            >
                <Forward size={16} color={theme.color8.val} />
                <Text style={[styles.actionText, { color: theme.color8.val }]}>Forward</Text>
            </Pressable>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        gap: 8,
        padding: 16,
        borderTopWidth: 1,
    },
    containerMobile: {
        flexWrap: 'wrap',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    actionText: {
        fontSize: 13,
        fontWeight: '500',
    },
})
