import { memo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from 'tamagui'
import type { CellData } from '../lib/cell-utils'

interface CellRendererProps {
    cell: CellData | undefined
    width: number
    height: number
    isSelected: boolean
}

export const CellRenderer = memo(function CellRenderer({
    cell,
    width,
    height,
    isSelected,
}: CellRendererProps) {
    const theme = useTheme()

    const displayValue = cell?.computed ?? cell?.value ?? ''
    const align = cell?.align ?? (cell?.type === 'number' ? 'right' : 'left')

    return (
        <View
            style={[
                styles.cell,
                {
                    width,
                    height,
                    borderRightColor: theme.borderColor.val,
                    borderBottomColor: theme.borderColor.val,
                    backgroundColor: cell?.bgColor ?? 'transparent',
                },
                isSelected && {
                    borderColor: theme.accentBackground.val,
                    borderWidth: 2,
                },
            ]}
        >
            <Text
                style={[
                    styles.cellText,
                    {
                        color: cell?.textColor ?? theme.color.val,
                        textAlign: align,
                        fontWeight: cell?.bold ? '700' : '400',
                        fontStyle: cell?.italic ? 'italic' : 'normal',
                    },
                ]}
                numberOfLines={1}
            >
                {displayValue}
            </Text>
        </View>
    )
})

const styles = StyleSheet.create({
    cell: {
        borderRightWidth: 1,
        borderBottomWidth: 1,
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    cellText: {
        fontSize: 13,
    },
})
