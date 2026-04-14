import { eq } from '@tanstack/db'
import { useMemo, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { NameAvatar } from '~/components/NameAvatar'
import { hexToRgba } from '~/lib/color-utils'
import { useOrgLiveQuery, useStore } from '~/lib/pocketbase'
import { useThemeColor } from '~/lib/use-app-theme'

interface MemberCard {
    id: string
    firstName: string
    lastName: string
    email: string
    role: string
}

export default function DirectoryScreen() {
    const [searchQuery, setSearchQuery] = useState('')
    const [userOrgCollection] = useStore('user_org')
    const fgColor = useThemeColor('foreground')
    const mutedColor = useThemeColor('muted-foreground')
    const bgColor = useThemeColor('background')
    const borderColor = useThemeColor('border')
    const placeholderColor = useThemeColor('field-placeholder')
    const primaryColor = useThemeColor('primary')
    const infoColor = useThemeColor('info')
    const successColor = useThemeColor('success')
    const warningColor = useThemeColor('warning')

    const badgeColors: Record<string, { bg: string; fg: string; border: string }> = {
        owner: {
            bg: hexToRgba(primaryColor, 0.12),
            fg: primaryColor,
            border: hexToRgba(primaryColor, 0.3),
        },
        admin: { bg: hexToRgba(infoColor, 0.12), fg: infoColor, border: hexToRgba(infoColor, 0.3) },
        member: {
            bg: hexToRgba(successColor, 0.12),
            fg: successColor,
            border: hexToRgba(successColor, 0.3),
        },
        guest: {
            bg: hexToRgba(warningColor, 0.12),
            fg: warningColor,
            border: hexToRgba(warningColor, 0.3),
        },
    }
    const defaultBadge = {
        bg: hexToRgba(mutedColor, 0.12),
        fg: mutedColor,
        border: hexToRgba(mutedColor, 0.3),
    }

    const { data: userOrgs } = useOrgLiveQuery((query, { orgId }) =>
        query.from({ user_org: userOrgCollection }).where(({ user_org }) => eq(user_org.org, orgId))
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
                role: uo.role,
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
        <View className="flex-1 p-5" style={{ backgroundColor: bgColor }}>
            <View className="flex-row justify-between items-center mb-4">
                <Text className="text-2xl font-bold" style={{ color: fgColor }}>
                    Directory ({filtered.length})
                </Text>
                {members.length > 5 ? (
                    <TextInput
                        placeholder="Search members..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        className="w-[250px] border rounded-lg px-3 py-2 text-sm"
                        style={{
                            backgroundColor: bgColor,
                            borderColor: borderColor,
                            color: fgColor,
                        }}
                        placeholderTextColor={placeholderColor}
                    />
                ) : null}
            </View>

            <View className="flex-row flex-wrap gap-4">
                {filtered.map(member => {
                    const badge = badgeColors[member.role] ?? defaultBadge
                    return (
                        <View
                            key={member.id}
                            className="w-[220px] border rounded-lg p-3"
                            style={{
                                backgroundColor: bgColor,
                                borderColor: borderColor,
                            }}
                        >
                            <View className="items-center gap-3">
                                <NameAvatar
                                    firstName={member.firstName}
                                    lastName={member.lastName}
                                    size={56}
                                />
                                <View className="items-center gap-1">
                                    <Text
                                        className="text-base font-semibold"
                                        style={{ color: fgColor }}
                                        numberOfLines={1}
                                    >
                                        {member.firstName} {member.lastName}
                                    </Text>
                                    <Text
                                        className="text-xs"
                                        style={{ color: mutedColor }}
                                        numberOfLines={1}
                                    >
                                        {member.email}
                                    </Text>
                                    <View
                                        className="px-2 py-0.5 rounded-md border mt-1"
                                        style={{
                                            backgroundColor: badge.bg,
                                            borderColor: badge.border,
                                        }}
                                    >
                                        <Text
                                            className="text-[11px] font-medium"
                                            style={{ color: badge.fg }}
                                        >
                                            {member.role}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    )
                })}
            </View>

            {filtered.length === 0 ? (
                <View className="flex-1 items-center justify-center p-10">
                    <Text className="text-base" style={{ color: mutedColor }}>
                        No members found.
                    </Text>
                </View>
            ) : null}
        </View>
    )
}
