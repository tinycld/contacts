import { eq } from '@tanstack/db'
import { useLiveQuery } from '@tanstack/react-db'
import { useThemeColor } from 'heroui-native'
import { useMemo, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { NameAvatar } from '~/components/NameAvatar'
import { useStore } from '~/lib/pocketbase'
import { useOrgInfo } from '~/lib/use-org-info'

const BADGE_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
    owner: { bg: '#f3e8ff', fg: '#7c3aed', border: '#d8b4fe' },
    admin: { bg: '#dbeafe', fg: '#2563eb', border: '#93c5fd' },
    member: { bg: '#dcfce7', fg: '#16a34a', border: '#86efac' },
    guest: { bg: '#ffedd5', fg: '#ea580c', border: '#fdba74' },
}

const DEFAULT_BADGE = { bg: '#f3f4f6', fg: '#6b7280', border: '#d1d5db' }

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
    const [fgColor, mutedColor, bgColor, borderColor, placeholderColor] = useThemeColor([
        'foreground',
        'muted',
        'background',
        'border',
        'field-placeholder',
    ])

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
                    const badge = BADGE_COLORS[member.role] ?? DEFAULT_BADGE
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
