import { getTokenValue } from 'tamagui'
import type { CalendarColorKey } from '../types'

const CALENDAR_COLORS: Record<CalendarColorKey, { bg: string; text: string }> = {
    blue: { bg: '$blue10', text: '$white1' },
    green: { bg: '$green10', text: '$white1' },
    red: { bg: '$red10', text: '$white1' },
    teal: { bg: '$teal10', text: '$white1' },
    purple: { bg: '$purple10', text: '$white1' },
    orange: { bg: '$orange10', text: '$white1' },
}

const DEFAULT_COLOR: CalendarColorKey = 'blue'

export function getCalendarColor(colorKey: string) {
    return CALENDAR_COLORS[colorKey as CalendarColorKey] ?? CALENDAR_COLORS[DEFAULT_COLOR]
}

export function getCalendarColorResolved(colorKey: string) {
    const tokens = getCalendarColor(colorKey)
    const bg = getTokenValue(tokens.bg as never, 'color')
    const text = getTokenValue(tokens.text as never, 'color')
    return {
        bg: typeof bg === 'string' ? bg : '#3b82f6',
        text: typeof text === 'string' ? text : '#ffffff',
    }
}
