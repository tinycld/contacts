import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useReducer,
    useRef,
    useState,
} from 'react'
import * as Y from 'yjs'
import {
    type CellData,
    cellKey,
    DEFAULT_COL_WIDTH,
    DEFAULT_ROW_HEIGHT,
    inferCellType,
} from '../lib/cell-utils'

export interface SheetMeta {
    id: string
    name: string
    position: number
}

interface Selection {
    row: number
    col: number
}

interface SpreadsheetContextValue {
    doc: Y.Doc | null
    activeSheetId: string
    sheets: SheetMeta[]
    selection: Selection
    editingCell: Selection | null
    cells: Map<string, CellData>
    colWidths: Map<number, number>
    rowHeights: Map<number, number>
    isReadOnly: boolean

    setActiveSheet: (sheetId: string) => void
    setSelection: (sel: Selection) => void
    startEditing: (sel: Selection) => void
    stopEditing: () => void
    setCellValue: (row: number, col: number, value: string) => void
    getCellValue: (row: number, col: number) => CellData | undefined
    setCellFormat: (row: number, col: number, format: Partial<CellData>) => void
    setColWidth: (col: number, width: number) => void
    setRowHeight: (row: number, height: number) => void
    addSheet: (name: string) => void
    renameSheet: (sheetId: string, name: string) => void
    deleteSheet: (sheetId: string) => void
    getColWidth: (col: number) => number
    getRowHeight: (row: number) => number
    gridDimensions: { rows: number; cols: number }
}

export const SpreadsheetContext = createContext<SpreadsheetContextValue | null>(null)

export function useSpreadsheet(): SpreadsheetContextValue {
    const ctx = useContext(SpreadsheetContext)
    if (!ctx) throw new Error('useSpreadsheet must be used within SpreadsheetProvider')
    return ctx
}

interface UseSpreadsheetStateOptions {
    doc: Y.Doc | null
    isReadOnly: boolean
}

export function useSpreadsheetState({
    doc,
    isReadOnly,
}: UseSpreadsheetStateOptions): SpreadsheetContextValue {
    const [activeSheetId, setActiveSheetId] = useState('')
    const [selection, setSelection] = useState<Selection>({ row: 0, col: 0 })
    const [editingCell, setEditingCell] = useState<Selection | null>(null)
    const [yjsVersion, bumpYjsVersion] = useReducer((n: number) => n + 1, 0)
    const observerRef = useRef<(() => void) | null>(null)

    // Subscribe to Y.Doc changes and force re-render
    if (doc && !observerRef.current) {
        const handler = () => bumpYjsVersion()
        doc.getMap('cells').observeDeep(handler)
        doc.getMap('sheets').observeDeep(handler)
        doc.getMap('colWidths').observeDeep(handler)
        doc.getMap('rowHeights').observeDeep(handler)
        observerRef.current = () => {
            doc.getMap('cells').unobserveDeep(handler)
            doc.getMap('sheets').unobserveDeep(handler)
            doc.getMap('colWidths').unobserveDeep(handler)
            doc.getMap('rowHeights').unobserveDeep(handler)
        }
    }

    // biome-ignore lint/correctness/useExhaustiveDependencies: yjsVersion triggers re-read from Y.Doc on remote changes
    const sheets = useMemo<SheetMeta[]>(() => {
        if (!doc) return []
        const sheetsMap = doc.getMap('sheets')
        const result: SheetMeta[] = []
        sheetsMap.forEach((value, key) => {
            const meta = value as Y.Map<unknown>
            result.push({
                id: key,
                name: (meta.get('name') as string) ?? key,
                position: (meta.get('position') as number) ?? 0,
            })
        })
        return result.sort((a, b) => a.position - b.position)
    }, [doc, yjsVersion])

    // Auto-select first sheet
    const effectiveSheetId = activeSheetId || sheets[0]?.id || ''

    // biome-ignore lint/correctness/useExhaustiveDependencies: yjsVersion triggers re-read from Y.Doc on remote changes
    const cells = useMemo(() => {
        if (!doc || !effectiveSheetId) return new Map<string, CellData>()
        const cellsMap = doc.getMap('cells')
        const result = new Map<string, CellData>()
        cellsMap.forEach((value, key) => {
            if (!key.startsWith(`${effectiveSheetId}:`)) return
            const cell = value as Y.Map<unknown>
            const parts = key.split(':')
            const localKey = `${parts[1]}:${parts[2]}`
            result.set(localKey, {
                value: (cell.get('value') as string) ?? '',
                computed: cell.get('computed') as string | undefined,
                type: (cell.get('type') as CellData['type']) ?? 'text',
                format: cell.get('format') as string | undefined,
                bold: cell.get('bold') as boolean | undefined,
                italic: cell.get('italic') as boolean | undefined,
                align: cell.get('align') as CellData['align'],
                textColor: cell.get('textColor') as string | undefined,
                bgColor: cell.get('bgColor') as string | undefined,
            })
        })
        return result
    }, [doc, effectiveSheetId, yjsVersion])

    // biome-ignore lint/correctness/useExhaustiveDependencies: yjsVersion triggers re-read from Y.Doc on remote changes
    const colWidths = useMemo(() => {
        if (!doc || !effectiveSheetId) return new Map<number, number>()
        const widthsMap = doc.getMap('colWidths')
        const result = new Map<number, number>()
        widthsMap.forEach((value, key) => {
            if (!key.startsWith(`${effectiveSheetId}:`)) return
            const col = Number.parseInt(key.split(':')[1], 10)
            result.set(col, value as number)
        })
        return result
    }, [doc, effectiveSheetId, yjsVersion])

    // biome-ignore lint/correctness/useExhaustiveDependencies: yjsVersion triggers re-read from Y.Doc on remote changes
    const rowHeights = useMemo(() => {
        if (!doc || !effectiveSheetId) return new Map<number, number>()
        const heightsMap = doc.getMap('rowHeights')
        const result = new Map<number, number>()
        heightsMap.forEach((value, key) => {
            if (!key.startsWith(`${effectiveSheetId}:`)) return
            const row = Number.parseInt(key.split(':')[1], 10)
            result.set(row, value as number)
        })
        return result
    }, [doc, effectiveSheetId, yjsVersion])

    const gridDimensions = useMemo(() => {
        let maxRow = 0
        let maxCol = 0
        for (const key of Array.from(cells.keys())) {
            const parts = key.split(':')
            const row = Number.parseInt(parts[0], 10)
            const col = Number.parseInt(parts[1], 10)
            maxRow = Math.max(maxRow, row)
            maxCol = Math.max(maxCol, col)
        }
        // Always show at least 50 rows and 26 columns
        return { rows: Math.max(maxRow + 1, 50), cols: Math.max(maxCol + 1, 26) }
    }, [cells])

    const setCellValue = useCallback(
        (row: number, col: number, value: string) => {
            if (!doc || isReadOnly) return
            const cellsMap = doc.getMap('cells')
            const key = cellKey(effectiveSheetId, row, col)

            if (!value) {
                cellsMap.delete(key)
                return
            }

            let cell = cellsMap.get(key) as Y.Map<unknown> | undefined
            if (!cell) {
                cell = new Y.Map()
                cellsMap.set(key, cell)
            }
            cell.set('value', value)
            cell.set('type', inferCellType(value))
        },
        [doc, effectiveSheetId, isReadOnly]
    )

    const getCellValue = useCallback(
        (row: number, col: number) => {
            return cells.get(`${row}:${col}`)
        },
        [cells]
    )

    const setCellFormat = useCallback(
        (row: number, col: number, format: Partial<CellData>) => {
            if (!doc || isReadOnly) return
            const cellsMap = doc.getMap('cells')
            const key = cellKey(effectiveSheetId, row, col)
            let cell = cellsMap.get(key) as Y.Map<unknown> | undefined
            if (!cell) {
                cell = new Y.Map()
                cell.set('value', '')
                cell.set('type', 'empty')
                cellsMap.set(key, cell)
            }
            for (const [k, v] of Object.entries(format)) {
                if (v !== undefined) cell.set(k, v)
            }
        },
        [doc, effectiveSheetId, isReadOnly]
    )

    const setColWidth = useCallback(
        (col: number, width: number) => {
            if (!doc) return
            doc.getMap('colWidths').set(`${effectiveSheetId}:${col}`, width)
        },
        [doc, effectiveSheetId]
    )

    const setRowHeight = useCallback(
        (row: number, height: number) => {
            if (!doc) return
            doc.getMap('rowHeights').set(`${effectiveSheetId}:${row}`, height)
        },
        [doc, effectiveSheetId]
    )

    const getColWidth = useCallback(
        (col: number) => colWidths.get(col) ?? DEFAULT_COL_WIDTH,
        [colWidths]
    )

    const getRowHeight = useCallback(
        (row: number) => rowHeights.get(row) ?? DEFAULT_ROW_HEIGHT,
        [rowHeights]
    )

    const addSheet = useCallback(
        (name: string) => {
            if (!doc || isReadOnly) return
            const sheetsMap = doc.getMap('sheets')
            const id = `sheet${sheetsMap.size + 1}`
            const meta = new Y.Map()
            meta.set('name', name)
            meta.set('position', sheetsMap.size)
            meta.set('frozenRows', 0)
            meta.set('frozenCols', 0)
            sheetsMap.set(id, meta)
            setActiveSheetId(id)
        },
        [doc, isReadOnly]
    )

    const renameSheet = useCallback(
        (sheetId: string, name: string) => {
            if (!doc || isReadOnly) return
            const sheetsMap = doc.getMap('sheets')
            const meta = sheetsMap.get(sheetId) as Y.Map<unknown> | undefined
            if (meta) meta.set('name', name)
        },
        [doc, isReadOnly]
    )

    const deleteSheet = useCallback(
        (sheetId: string) => {
            if (!doc || isReadOnly) return
            const sheetsMap = doc.getMap('sheets')
            if (sheetsMap.size <= 1) return
            sheetsMap.delete(sheetId)

            // Clean up cells for this sheet
            const cellsMap = doc.getMap('cells')
            const keysToDelete: string[] = []
            cellsMap.forEach((_, key) => {
                if (key.startsWith(`${sheetId}:`)) keysToDelete.push(key)
            })
            for (const key of keysToDelete) cellsMap.delete(key)

            if (effectiveSheetId === sheetId) {
                const remaining = Array.from(sheetsMap.keys())
                setActiveSheetId(remaining[0] ?? '')
            }
        },
        [doc, isReadOnly, effectiveSheetId]
    )

    const startEditing = useCallback((sel: Selection) => {
        setEditingCell(sel)
        setSelection(sel)
    }, [])

    const stopEditing = useCallback(() => {
        setEditingCell(null)
    }, [])

    const setActiveSheet = useCallback((sheetId: string) => {
        setActiveSheetId(sheetId)
        setSelection({ row: 0, col: 0 })
        setEditingCell(null)
    }, [])

    // biome-ignore lint/correctness/useExhaustiveDependencies: setSelection is stable from useState
    return useMemo(
        () => ({
            doc,
            activeSheetId: effectiveSheetId,
            sheets,
            selection,
            editingCell,
            cells,
            colWidths,
            rowHeights,
            isReadOnly,
            setActiveSheet,
            setSelection,
            startEditing,
            stopEditing,
            setCellValue,
            getCellValue,
            setCellFormat,
            setColWidth,
            setRowHeight,
            addSheet,
            renameSheet,
            deleteSheet,
            getColWidth,
            getRowHeight,
            gridDimensions,
        }),
        [
            doc,
            effectiveSheetId,
            sheets,
            selection,
            editingCell,
            cells,
            colWidths,
            rowHeights,
            isReadOnly,
            setActiveSheet,
            setSelection,
            startEditing,
            stopEditing,
            setCellValue,
            getCellValue,
            setCellFormat,
            setColWidth,
            setRowHeight,
            addSheet,
            renameSheet,
            deleteSheet,
            getColWidth,
            getRowHeight,
            gridDimensions,
        ]
    )
}
