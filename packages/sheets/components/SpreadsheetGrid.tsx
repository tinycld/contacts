import { useCallback, useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSpreadsheet } from '../hooks/useSpreadsheet'
import { HEADER_HEIGHT, ROW_HEADER_WIDTH } from '../lib/cell-utils'
import { CellEditor } from './CellEditor'
import { CellRenderer } from './CellRenderer'
import { ColumnHeader } from './ColumnHeader'
import { RowHeader } from './RowHeader'

export function SpreadsheetGrid() {
    const {
        gridDimensions,
        getColWidth,
        getRowHeight,
        selection,
        editingCell,
        getCellValue,
        setSelection,
        startEditing,
        isReadOnly,
    } = useSpreadsheet()

    // Pre-compute column positions
    const colPositions = useMemo(() => {
        const positions: number[] = []
        let x = 0
        for (let c = 0; c < gridDimensions.cols; c++) {
            positions.push(x)
            x += getColWidth(c)
        }
        return positions
    }, [gridDimensions.cols, getColWidth])

    // Pre-compute row positions
    const rowPositions = useMemo(() => {
        const positions: number[] = []
        let y = 0
        for (let r = 0; r < gridDimensions.rows; r++) {
            positions.push(y)
            y += getRowHeight(r)
        }
        return positions
    }, [gridDimensions.rows, getRowHeight])

    const totalWidth =
        colPositions.length > 0
            ? colPositions[colPositions.length - 1] + getColWidth(gridDimensions.cols - 1)
            : 0
    const totalHeight =
        rowPositions.length > 0
            ? rowPositions[rowPositions.length - 1] + getRowHeight(gridDimensions.rows - 1)
            : 0

    const handleCellPress = useCallback(
        (row: number, col: number) => {
            if (editingCell && editingCell.row === row && editingCell.col === col) return
            setSelection({ row, col })
        },
        [editingCell, setSelection]
    )

    const handleCellDoublePress = useCallback(
        (row: number, col: number) => {
            if (isReadOnly) return
            startEditing({ row, col })
        },
        [isReadOnly, startEditing]
    )

    // Compute editing cell position
    const editingCellPosition = editingCell
        ? {
              left: ROW_HEADER_WIDTH + colPositions[editingCell.col],
              top: HEADER_HEIGHT + rowPositions[editingCell.row],
              width: getColWidth(editingCell.col),
              height: getRowHeight(editingCell.row),
          }
        : null

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={{
                width: totalWidth + ROW_HEADER_WIDTH,
                minHeight: totalHeight + HEADER_HEIGHT,
            }}
            horizontal={false}
            showsVerticalScrollIndicator
        >
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator
                contentContainerStyle={{ minWidth: totalWidth + ROW_HEADER_WIDTH }}
            >
                <View style={{ width: totalWidth + ROW_HEADER_WIDTH }}>
                    {/* Column headers */}
                    <ColumnHeader />

                    {/* Grid body */}
                    <View style={styles.body}>
                        {Array.from({ length: gridDimensions.rows }, (_, row) => {
                            const rowHeight = getRowHeight(row)
                            return (
                                // biome-ignore lint/suspicious/noArrayIndexKey: row indices are stable positional identifiers
                                <View key={row} style={[styles.row, { height: rowHeight }]}>
                                    <RowHeader row={row} height={rowHeight} />
                                    {Array.from({ length: gridDimensions.cols }, (_, col) => {
                                        const colWidth = getColWidth(col)
                                        const cell = getCellValue(row, col)
                                        const isSelected =
                                            selection.row === row && selection.col === col

                                        return (
                                            <Pressable
                                                // biome-ignore lint/suspicious/noArrayIndexKey: col indices are stable positional identifiers
                                                key={col}
                                                onPress={() => handleCellPress(row, col)}
                                                onLongPress={() => handleCellDoublePress(row, col)}
                                            >
                                                <CellRenderer
                                                    cell={cell}
                                                    width={colWidth}
                                                    height={rowHeight}
                                                    isSelected={isSelected}
                                                />
                                            </Pressable>
                                        )
                                    })}
                                </View>
                            )
                        })}
                    </View>

                    {/* Cell editor overlay */}
                    {editingCell && editingCellPosition && (
                        <CellEditor
                            row={editingCell.row}
                            col={editingCell.col}
                            width={editingCellPosition.width}
                            height={editingCellPosition.height}
                            left={editingCellPosition.left}
                            top={editingCellPosition.top}
                        />
                    )}
                </View>
            </ScrollView>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    body: {
        flexDirection: 'column',
    },
    row: {
        flexDirection: 'row',
    },
})
