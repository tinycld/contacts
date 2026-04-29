import { rowFocusStyle } from '@tinycld/core/components/focusable-row'
import { HoverAction } from '@tinycld/core/components/HoverAction'
import { LabelDots } from '@tinycld/core/components/LabelBadge'
import { StarIcon } from '@tinycld/core/components/StarIcon'
import { ConfirmTrash } from '@tinycld/core/components/SuretyGuard'
import { SwipeableRow } from '@tinycld/core/components/SwipeableRow'
import { useBreakpoint } from '@tinycld/core/components/workspace/useBreakpoint'
import { useOrgHref } from '@tinycld/core/lib/org-routes'
import { useThemeColor } from '@tinycld/core/lib/use-app-theme'
import { useRouter } from 'expo-router'
import { Edit3, RotateCcw, Star, Trash2 } from 'lucide-react-native'
import { useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
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
    isFocused?: boolean
}

export function ContactRow({
    contact,
    labels,
    onToggleFavorite,
    onDelete,
    onRestore,
    onPermanentDelete,
    index,
    isFocused,
}: ContactRowProps) {
    const router = useRouter()
    const orgHref = useOrgHref()
    const [isHovered, setIsHovered] = useState(false)
    const fgColor = useThemeColor('foreground')
    const mutedColor = useThemeColor('muted-foreground')
    const borderColor = useThemeColor('border')
    const bgColor = useThemeColor('background')
    const activeIndicator = useThemeColor('active-indicator')
    const warningColor = useThemeColor('warning')
    const dangerColor = useThemeColor('danger')
    const successColor = useThemeColor('success')
    const infoColor = useThemeColor('info')

    const displayName = [contact.first_name, contact.last_name].filter(Boolean).join(' ')

    const hoverWebProps =
        Platform.OS === 'web'
            ? {
                  onMouseEnter: () => setIsHovered(true),
                  onMouseLeave: () => setIsHovered(false),
              }
            : {}

    const tooltipPosition = index === 0 ? ('below' as const) : ('above' as const)

    const navigateToContact = onRestore ? undefined : () => router.push(orgHref('contacts/[id]', { id: contact.id }))

    const isCompact = useBreakpoint() === 'mobile'

    const isTrashView = Boolean(onRestore)

    const swipeActions = isTrashView
        ? [
              {
                  icon: RotateCcw,
                  label: 'Restore',
                  onPress: () => onRestore?.(),
                  backgroundColor: successColor,
              },
              {
                  icon: Trash2,
                  label: 'Delete',
                  onPress: () => onPermanentDelete?.(),
                  backgroundColor: dangerColor,
              },
          ]
        : [
              {
                  icon: Trash2,
                  label: 'Delete',
                  onPress: onDelete,
                  backgroundColor: dangerColor,
              },
              {
                  icon: Edit3,
                  label: 'Edit',
                  onPress: () => navigateToContact?.(),
                  backgroundColor: infoColor,
              },
              {
                  icon: Star,
                  label: contact.favorite ? 'Unstar' : 'Star',
                  onPress: onToggleFavorite,
                  backgroundColor: warningColor,
              },
          ]

    const effectStyle = rowFocusStyle({ isFocused, isHovered, borderColor, activeIndicator })

    const showHoverActions = !isCompact && isHovered

    const row = (
        <Pressable onPress={navigateToContact} {...hoverWebProps}>
            <View
                className="flex-row items-center pr-1 py-3 w-full gap-2"
                style={[
                    {
                        paddingLeft: isCompact ? 4 : 12,
                        borderBottomWidth: 1,
                        borderBottomColor: borderColor,
                        backgroundColor: bgColor,
                    },
                    effectStyle,
                ]}
            >
                <ContactAvatar firstName={contact.first_name} lastName={contact.last_name} />
                <View className="flex-1 flex-row items-center gap-2 ml-3 min-w-0">
                    {isCompact ? (
                        <View className="flex-1 gap-0.5 min-w-0">
                            <Text className="text-base font-medium" style={{ color: fgColor }} numberOfLines={1}>
                                {displayName}
                            </Text>
                            <Text className="text-xs" style={{ color: mutedColor }} numberOfLines={1}>
                                {[contact.email, contact.phone].filter(Boolean).join(' · ')}
                            </Text>
                        </View>
                    ) : (
                        <>
                            <Text
                                className="text-base font-medium flex-[2] min-w-0"
                                style={{ color: fgColor }}
                                numberOfLines={1}
                            >
                                {displayName}
                            </Text>
                            <Text
                                className="text-sm flex-[2] min-w-0"
                                style={{ color: mutedColor }}
                                numberOfLines={1}
                            >
                                {contact.email}
                            </Text>
                            <Text
                                className="text-sm flex-1 min-w-0"
                                style={{ color: mutedColor }}
                                numberOfLines={1}
                            >
                                {contact.phone}
                            </Text>
                        </>
                    )}
                    {labels.length > 0 ? <LabelDots labels={labels} max={3} /> : null}
                </View>
                {showHoverActions ? (
                    <Pressable
                        className="flex-row items-center"
                        onPress={(e) => e.stopPropagation()}
                    >
                        {onRestore && onPermanentDelete ? (
                            <>
                                <HoverAction
                                    icon={RotateCcw}
                                    label="Restore"
                                    onPress={onRestore}
                                    tooltipPosition={tooltipPosition}
                                />
                                <ConfirmTrash itemName={displayName} onConfirmed={onPermanentDelete}>
                                    {(onOpen) => (
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
                                    {(onOpen) => (
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
                                    iconColor="#facc15"
                                    iconFill={contact.favorite ? '#facc15' : 'transparent'}
                                    tooltipPosition={tooltipPosition}
                                />
                            </>
                        )}
                    </Pressable>
                ) : onRestore ? null : (
                    <Pressable
                        className="p-1"
                        onPress={(e) => {
                            e.stopPropagation()
                            onToggleFavorite()
                        }}
                    >
                        <StarIcon isStarred={contact.favorite} size={18} />
                    </Pressable>
                )}
            </View>
        </Pressable>
    )

    if (isCompact) {
        return <SwipeableRow actions={swipeActions}>{row}</SwipeableRow>
    }

    return row
}
