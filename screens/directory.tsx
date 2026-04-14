import { eq } from '@tanstack/db'
import { useLiveQuery } from '@tanstack/react-db'
import { useMemo, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { NameAvatar } from '~/components/NameAvatar'
import { hexToRgba } from '~/lib/color-utils'
import { useStore } from '~/lib/pocketbase'
import { useThemeColor } from '~/lib/use-app-theme'
import { useOrgInfo } from '~/lib/use-org-info'

interface MemberCard {
    id: string
    firstName: string
    lastName: string
    email: string
    role: string
}

export default function DirectoryScreen() {
    const { orgId } = useOrgInfo()
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
        <View style={{ flex: 1, padding: 20, backgroundColor: bgColor }}>
            <View
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 16,
                }}
            >
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: fgColor }}>
                    Directory ({filtered.length})
                </Text>
                {members.length > 5 ? (
                    <TextInput
                        placeholder="Search members..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        style={{
                            width: 250,
                            backgroundColor: bgColor,
                            borderColor: borderColor,
                            borderWidth: 1,
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            fontSize: 14,
                            color: fgColor,
                        }}
                        placeholderTextColor={placeholderColor}
                    />
                ) : null}
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                {filtered.map(member => {
                    const badge = badgeColors[member.role] ?? defaultBadge
                    return (
                        <View
                            key={member.id}
                            style={{
                                width: 220,
                                backgroundColor: bgColor,
                                borderColor: borderColor,
                                borderWidth: 1,
                                borderRadius: 8,
                                padding: 12,
                            }}
                        >
                            <View style={{ alignItems: 'center', gap: 12 }}>
                                <NameAvatar
                                    firstName={member.firstName}
                                    lastName={member.lastName}
                                    size={56}
                                />
                                <View style={{ alignItems: 'center', gap: 4 }}>
                                    <Text
                                        style={{
                                            fontSize: 16,
                                            fontWeight: '600',
                                            color: fgColor,
                                        }}
                                        numberOfLines={1}
                                    >
                                        {member.firstName} {member.lastName}
                                    </Text>
                                    <Text
                                        style={{ fontSize: 12, color: mutedColor }}
                                        numberOfLines={1}
                                    >
                                        {member.email}
                                    </Text>
                                    <View
                                        style={{
                                            paddingHorizontal: 8,
                                            paddingVertical: 2,
                                            borderRadius: 6,
                                            backgroundColor: badge.bg,
                                            borderWidth: 1,
                                            borderColor: badge.border,
                                            marginTop: 4,
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontSize: 11,
                                                color: badge.fg,
                                                fontWeight: '500',
                                            }}
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
                <View
                    style={{
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 40,
                    }}
                >
                    <Text style={{ fontSize: 16, color: mutedColor }}>No members found.</Text>
                </View>
            ) : null}
        </View>
    )
}
