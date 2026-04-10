import { eq } from '@tanstack/db'
import { useLiveQuery } from '@tanstack/react-db'
import { useMemo, useState } from 'react'
import { Card, Input, SizableText, Theme, XStack, YStack } from 'tamagui'
import { NameAvatar } from '~/components/NameAvatar'
import { useStore } from '~/lib/pocketbase'
import { useOrgInfo } from '~/lib/use-org-info'

const BADGE_THEME = {
    owner: 'purple',
    admin: 'blue',
    member: 'green',
    guest: 'orange',
} as const

interface MemberCard {
    id: string
    firstName: string
    lastName: string
    email: string
    role: keyof typeof BADGE_THEME
}

export default function DirectoryScreen() {
    const { orgId } = useOrgInfo()
    const [searchQuery, setSearchQuery] = useState('')
    const [userOrgCollection] = useStore('user_org')

    const { data: userOrgs } = useLiveQuery(
        query =>
            query
                .from({ user_org: userOrgCollection })
                .where(({ user_org }) => eq(user_org.org, orgId)),
        [orgId]
    )

    const members: MemberCard[] = useMemo(() => {
        if (!userOrgs) return []
        const result: MemberCard[] = []
        for (const uo of userOrgs) {
            const user = uo.expand?.user
            if (!user) continue
            const nameParts = (user.name || '').split(' ')
            result.push({
                id: uo.id,
                firstName: nameParts[0] || user.email.split('@')[0],
                lastName: nameParts.slice(1).join(' '),
                email: user.email,
                role: uo.role as keyof typeof BADGE_THEME,
            })
        }
        return result
    }, [userOrgs])

    const filtered = useMemo(() => {
        if (!searchQuery) return members
        const q = searchQuery.toLowerCase()
        return members.filter(m => {
            const fullName = `${m.firstName} ${m.lastName}`.toLowerCase()
            return fullName.includes(q) || m.email.toLowerCase().includes(q)
        })
    }, [members, searchQuery])

    return (
        <YStack flex={1} padding="$5" backgroundColor="$background">
            <XStack justifyContent="space-between" alignItems="center" marginBottom="$4">
                <SizableText size="$7" fontWeight="bold" color="$color">
                    Directory ({filtered.length})
                </SizableText>
                {members.length > 5 ? (
                    <Input
                        size="$3"
                        placeholder="Search members..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        width={250}
                        backgroundColor="$background"
                        borderColor="$borderColor"
                        placeholderTextColor="$placeholderColor"
                        color="$color"
                    />
                ) : null}
            </XStack>

            <XStack flexWrap="wrap" gap="$4">
                {filtered.map(member => (
                    <Card
                        key={member.id}
                        width={220}
                        backgroundColor="$background"
                        borderColor="$borderColor"
                        borderWidth={1}
                        padding="$3"
                    >
                        <YStack alignItems="center" gap="$3">
                            <NameAvatar
                                firstName={member.firstName}
                                lastName={member.lastName}
                                size={56}
                            />
                            <YStack alignItems="center" gap="$1">
                                <SizableText
                                    size="$4"
                                    fontWeight="600"
                                    color="$color"
                                    numberOfLines={1}
                                >
                                    {member.firstName} {member.lastName}
                                </SizableText>
                                <SizableText size="$2" color="$color8" numberOfLines={1}>
                                    {member.email}
                                </SizableText>
                                <Theme name={BADGE_THEME[member.role] ?? 'gray'}>
                                    <XStack
                                        paddingHorizontal="$2"
                                        paddingVertical="$0.5"
                                        borderRadius="$2"
                                        backgroundColor="$background"
                                        borderWidth={1}
                                        borderColor="$borderColor"
                                        marginTop="$1"
                                    >
                                        <SizableText size="$1" color="$color" fontWeight="500">
                                            {member.role}
                                        </SizableText>
                                    </XStack>
                                </Theme>
                            </YStack>
                        </YStack>
                    </Card>
                ))}
            </XStack>

            {filtered.length === 0 ? (
                <YStack flex={1} alignItems="center" justifyContent="center" padding="$10">
                    <SizableText size="$4" color="$color8">
                        No members found.
                    </SizableText>
                </YStack>
            ) : null}
        </YStack>
    )
}
