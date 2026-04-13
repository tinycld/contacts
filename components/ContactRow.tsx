import { useRouter } from 'expo-router'
import { Edit3, RotateCcw, Star, Trash2 } from 'lucide-react-native'
import { useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { HoverAction } from '~/components/HoverAction'
import { LabelDots } from '~/components/LabelBadge'
import { ConfirmTrash } from '~/components/SuretyGuard'
import { SwipeableRow } from '~/components/SwipeableRow'
import { useBreakpoint } from '~/components/workspace/useBreakpoint'
import { useOrgHref } from '~/lib/org-routes'
import { useThemeColor } from '~/lib/use-app-theme'
import { ContactAvatar } from './ContactAvatar'

interface ContactRowProps {
    contact: {
        id: string
        first_name: string
        last_name: string
        email: string
        phone: string
        favorite: boolean
    }
    labels: { id: string; name: string; color: string }[]
    onToggleFavorite: () => void
    onDelete: () => void
    onRestore?: () => void
    onPermanentDelete?: () => void
    index?: number
}

export function ContactRow({
    contact,
    labels,
    onToggleFavorite,
    onDelete,
    onRestore,
    onPermanentDelete,
    index,
}: ContactRowProps) {
    const router = useRouter()
    const orgHref = useOrgHref()
    const [isHovered, setIsHovered] = useState(false)
    const fgColor = useThemeColor('foreground')
    const mutedColor = useThemeColor('muted')
    const borderColor = useThemeColor('border')
    const bgColor = useThemeColor('background')
    const warningColor = useThemeColor('warning')

    const displayName = [contact.first_name, contact.last_name].filter(Boolean).join(' ')

    const hoverWebProps =
        Platform.OS === 'web'
            ? {
                  onMouseEnter: () => setIsHovered(true),
                  onMouseLeave: () => setIsHovered(false),
              }
            : {}

    const tooltipPosition = index === 0 ? ('below' as const) : ('above' as const)

    const navigateToContact = onRestore
        ? undefined
        : () => router.push(orgHref('contacts/[id]', { id: contact.id }))

    const isCompact = useBreakpoint() === 'mobile'

    const isTrashView = Boolean(onRestore)

    const swipeActions = isTrashView
        ? [
              {
                  icon: RotateCcw,
                  label: 'Restore',
                  onPress: () => onRestore?.(),
                  backgroundColor: '#22c55e',
              },
              {
                  icon: Trash2,
                  label: 'Delete',
                  onPress: () => onPermanentDelete?.(),
                  backgroundColor: '#ef4444',
              },
          ]
        : [
              {
                  icon: Trash2,
                  label: 'Delete',
                  onPress: onDelete,
                  backgroundColor: '#ef4444',
              },
              {
                  icon: Edit3,
                  label: 'Edit',
                  onPress: () => navigateToContact?.(),
                  backgroundColor: '#3b82f6',
              },
              {
                  icon: Star,
                  label: contact.favorite ? 'Unstar' : 'Star',
                  onPress: onToggleFavorite,
                  backgroundColor: '#eab308',
              },
          ]

    const row = (
        <Pressable onPress={navigateToContact} {...hoverWebProps}>
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: borderColor,
                    width: '100%',
                    position: 'relative',
                    backgroundColor: bgColor,
                }}
            >
                {labels.length > 0 ? <LabelDots labels={labels} max={3} /> : null}
                <ContactAvatar firstName={contact.first_name} lastName={contact.last_name} />
                {isCompact ? (
                    <View
                        style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginLeft: 12,
                        }}
                    >
                        <View style={{ flex: 1, gap: 2 }}>
                            <Text
                                style={{
                                    fontSize: 16,
                                    color: fgColor,
                                    fontWeight: '500',
                                }}
                                numberOfLines={1}
                            >
                                {displayName}
                            </Text>
                            <Text style={{ fontSize: 12, color: mutedColor }} numberOfLines={1}>
                                {[contact.email, contact.phone].filter(Boolean).join(' · ')}
                            </Text>
                        </View>
                        <Pressable
                            style={{ padding: 4 }}
                            onPress={e => {
                                e.stopPropagation()
                                onToggleFavorite()
                            }}
                        >
                            <Star
                                size={18}
                                color={contact.favorite ? warningColor : mutedColor}
                                fill={contact.favorite ? warningColor : 'transparent'}
                            />
                        </Pressable>
                    </View>
                ) : (
                    <>
                        <View
                            style={{
                                flex: 2,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 12,
                                marginLeft: 12,
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 16,
                                    color: fgColor,
                                    fontWeight: '500',
                                }}
                                numberOfLines={1}
                            >
                                {displayName}
                            </Text>
                        </View>
                        <Text
                            style={{ fontSize: 14, color: mutedColor, flex: 2 }}
                            numberOfLines={1}
                        >
                            {contact.email}
                        </Text>
                        <Text
                            style={{ fontSize: 14, color: mutedColor, flex: 1 }}
                            numberOfLines={1}
                        >
                            {contact.phone}
                        </Text>
                    </>
                )}
                {isCompact ? null : (
                    <>
                        <Pressable
                            style={[
                                {
                                    position: 'absolute',
                                    right: 12,
                                    top: 0,
                                    bottom: 0,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: bgColor,
                                },
                                !isHovered && { opacity: 0, pointerEvents: 'none' as const },
                            ]}
                            onPress={e => e.stopPropagation()}
                        >
                            {onRestore && onPermanentDelete ? (
                                <>
                                    <HoverAction
                                        icon={RotateCcw}
                                        label="Restore"
                                        onPress={onRestore}
                                        tooltipPosition={tooltipPosition}
                                    />
                                    <ConfirmTrash
                                        itemName={displayName}
                                        onConfirmed={onPermanentDelete}
                                    >
                                        {onOpen => (
                                            <HoverAction
                                                icon={Trash2}
                                                label="Delete permanently"
                                                onPress={onOpen}
                                                tooltipPosition={tooltipPosition}
                                            />
                                        )}
                                    </ConfirmTrash>
                                </>
                            ) : (
                                <>
                                    <ConfirmTrash itemName={displayName} onConfirmed={onDelete}>
                                        {onOpen => (
                                            <HoverAction
                                                icon={Trash2}
                                                label="Delete"
                                                onPress={onOpen}
                                                tooltipPosition={tooltipPosition}
                                            />
                                        )}
                                    </ConfirmTrash>
                                    <HoverAction
                                        icon={Edit3}
                                        label="Edit"
                                        onPress={() => navigateToContact?.()}
                                        tooltipPosition={tooltipPosition}
                                    />
                                    <HoverAction
                                        icon={Star}
                                        label={contact.favorite ? 'Unstar' : 'Star'}
                                        onPress={onToggleFavorite}
                                        iconColor={warningColor}
                                        iconFill={contact.favorite ? warningColor : 'transparent'}
                                        tooltipPosition={tooltipPosition}
                                    />
                                </>
                            )}
                        </Pressable>
                        {onRestore ? null : (
                            <Pressable
                                style={[
                                    {
                                        position: 'absolute',
                                        right: 12,
                                        top: 0,
                                        bottom: 0,
                                        justifyContent: 'center',
                                        padding: 4,
                                        width: 32,
                                        alignItems: 'center',
                                    },
                                    isHovered && { opacity: 0, pointerEvents: 'none' as const },
                                ]}
                                onPress={e => {
                                    e.stopPropagation()
                                    onToggleFavorite()
                                }}
                            >
                                <Star
                                    size={18}
                                    color={contact.favorite ? warningColor : mutedColor}
                                    fill={contact.favorite ? warningColor : 'transparent'}
                                />
                            </Pressable>
                        )}
                    </>
                )}
            </View>
        </Pressable>
    )

    if (isCompact) {
        return <SwipeableRow actions={swipeActions}>{row}</SwipeableRow>
    }

    return row
}
