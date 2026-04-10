import { Edit3, RotateCcw, Star, Trash2 } from 'lucide-react-native'
import { useRouter } from 'one'
import { useState } from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import { SizableText, useTheme } from 'tamagui'
import { LabelDots } from '~/components/LabelBadge'
import { ConfirmTrash } from '~/components/SuretyGuard'
import { useOrgHref } from '~/lib/org-routes'
import { useWebStyles } from '~/lib/use-web-styles'
import { ContactAvatar } from './ContactAvatar'

const tooltipCSS = `
    .contact-hover-tooltip {
        position: relative;
        display: inline-flex;
    }
    .contact-hover-tooltip::after {
        content: attr(data-tooltip);
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        line-height: 1;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.15s ease-in;
        background: var(--tooltip-bg);
        color: var(--tooltip-fg);
        z-index: 10;
    }
    .contact-hover-tooltip.tooltip-above::after {
        bottom: calc(100% + 6px);
    }
    .contact-hover-tooltip.tooltip-below::after {
        top: calc(100% + 6px);
    }
    .contact-hover-tooltip:hover::after {
        opacity: 1;
    }
`

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
    useWebStyles('contact-hover-tooltip', tooltipCSS)
    const theme = useTheme()
    const router = useRouter()
    const orgHref = useOrgHref()
    const [isHovered, setIsHovered] = useState(false)

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

    return (
        <Pressable onPress={navigateToContact} {...hoverWebProps}>
            <View style={[styles.row, { borderBottomColor: theme.borderColor.val }]}>
                <View style={styles.nameCell}>
                    {labels.length > 0 ? <LabelDots labels={labels} max={3} /> : null}
                    <ContactAvatar firstName={contact.first_name} lastName={contact.last_name} />
                    <SizableText size="$4" color="$color" fontWeight="500" numberOfLines={1}>
                        {displayName}
                    </SizableText>
                </View>
                <SizableText size="$3" color="$color8" style={styles.emailCell} numberOfLines={1}>
                    {contact.email}
                </SizableText>
                <SizableText size="$3" color="$color8" style={styles.phoneCell} numberOfLines={1}>
                    {contact.phone}
                </SizableText>
                <Pressable
                    style={[
                        styles.hoverActions,
                        { backgroundColor: theme.background.val },
                        !isHovered && styles.hidden,
                    ]}
                    onPress={e => e.stopPropagation()}
                >
                    {onRestore && onPermanentDelete ? (
                        <>
                            <HoverAction
                                icon={RotateCcw}
                                label="Restore"
                                onPress={onRestore}
                                theme={theme}
                                tooltipPosition={tooltipPosition}
                            />
                            <ConfirmTrash itemName={displayName} onConfirmed={onPermanentDelete}>
                                {onOpen => (
                                    <HoverAction
                                        icon={Trash2}
                                        label="Delete permanently"
                                        onPress={onOpen}
                                        theme={theme}
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
                                        theme={theme}
                                        tooltipPosition={tooltipPosition}
                                    />
                                )}
                            </ConfirmTrash>
                            <HoverAction
                                icon={Edit3}
                                label="Edit"
                                onPress={navigateToContact!}
                                theme={theme}
                                tooltipPosition={tooltipPosition}
                            />
                            <HoverAction
                                icon={Star}
                                label={contact.favorite ? 'Unstar' : 'Star'}
                                onPress={onToggleFavorite}
                                theme={theme}
                                iconColor={theme.yellow8.val}
                                iconFill={contact.favorite ? theme.yellow8.val : 'transparent'}
                                tooltipPosition={tooltipPosition}
                            />
                        </>
                    )}
                </Pressable>
                {onRestore ? null : (
                    <Pressable
                        style={[styles.starButton, isHovered && styles.hidden]}
                        onPress={e => {
                            e.stopPropagation()
                            onToggleFavorite()
                        }}
                    >
                        <Star
                            size={18}
                            color={contact.favorite ? theme.yellow8.val : theme.color8.val}
                            fill={contact.favorite ? theme.yellow8.val : 'transparent'}
                        />
                    </Pressable>
                )}
            </View>
        </Pressable>
    )
}

function HoverAction({
    icon: Icon,
    label,
    onPress,
    theme,
    iconColor,
    iconFill,
    tooltipPosition = 'above',
}: {
    icon: typeof Star
    label: string
    onPress: () => void
    theme: ReturnType<typeof useTheme>
    iconColor?: string
    iconFill?: string
    tooltipPosition?: 'above' | 'below'
}) {
    const button = (
        <Pressable
            style={styles.hoverButton}
            onPress={e => {
                e.stopPropagation()
                e.preventDefault()
                onPress()
            }}
            accessibilityLabel={label}
        >
            <Icon size={16} color={iconColor ?? theme.color8.val} fill={iconFill} />
        </Pressable>
    )

    if (Platform.OS !== 'web') return button

    const tooltipStyle = {
        '--tooltip-bg': theme.color2.val,
        '--tooltip-fg': theme.color12.val,
    }

    return (
        <div
            data-tooltip={label}
            className={`contact-hover-tooltip tooltip-${tooltipPosition}`}
            style={tooltipStyle as never}
        >
            {button}
        </div>
    )
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        width: '100%',
        position: 'relative',
    },
    nameCell: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    emailCell: {
        flex: 2,
    },
    phoneCell: {
        flex: 1,
    },
    starButton: {
        position: 'absolute',
        right: 12,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        padding: 4,
        width: 32,
        alignItems: 'center',
    },
    hoverActions: {
        position: 'absolute',
        right: 12,
        top: 0,
        bottom: 0,
        flexDirection: 'row',
        alignItems: 'center',
    },
    hoverButton: {
        padding: 6,
        borderRadius: 16,
    },
    hidden: {
        opacity: 0,
        pointerEvents: 'none' as const,
    },
})
