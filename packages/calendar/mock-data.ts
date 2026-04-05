import { eventOverlapsRange } from './hooks/useCalendarNavigation'
import type { Calendar, CalendarEvent, EventGuest } from './types'

function today() {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
}

function dateAt(dayOffset: number, hour: number, minute = 0) {
    const d = today()
    d.setDate(d.getDate() + dayOffset)
    d.setHours(hour, minute, 0, 0)
    return d.toISOString()
}

function allDayDate(dayOffset: number) {
    const d = today()
    d.setDate(d.getDate() + dayOffset)
    return d.toISOString()
}

const calendars: Calendar[] = [
    { id: 'cal-work', name: 'Work', colorKey: 'blue', group: 'mine' },
    { id: 'cal-personal', name: 'Personal', colorKey: 'green', group: 'mine' },
    { id: 'cal-team', name: 'Team', colorKey: 'teal', group: 'other' },
    { id: 'cal-holidays', name: 'Holidays', colorKey: 'red', group: 'other' },
]

const guests: Record<string, EventGuest[]> = {
    standup: [
        { name: 'Alice Chen', email: 'alice@acme.co', rsvp: 'accepted', role: 'organizer' },
        { name: 'Bob Smith', email: 'bob@acme.co', rsvp: 'accepted', role: 'attendee' },
        { name: 'Carol Wu', email: 'carol@acme.co', rsvp: 'tentative', role: 'attendee' },
    ],
    review: [
        { name: 'Alice Chen', email: 'alice@acme.co', rsvp: 'accepted', role: 'organizer' },
        { name: 'Dave Johnson', email: 'dave@acme.co', rsvp: 'pending', role: 'attendee' },
    ],
    lunch: [
        { name: 'Bob Smith', email: 'bob@acme.co', rsvp: 'accepted', role: 'organizer' },
        { name: 'Eve Miller', email: 'eve@acme.co', rsvp: 'declined', role: 'attendee' },
    ],
}

const events: CalendarEvent[] = [
    {
        id: 'evt-1',
        title: 'Team Standup',
        description: 'Daily sync with the engineering team',
        location: 'Conference Room A',
        start: dateAt(0, 9, 0),
        end: dateAt(0, 9, 30),
        allDay: false,
        recurrence: 'daily',
        calendarId: 'cal-work',
        guests: guests.standup,
        reminder: 10,
        busyStatus: 'busy',
        visibility: 'default',
    },
    {
        id: 'evt-2',
        title: 'Design Review',
        description: 'Review Q2 design proposals and prototypes',
        location: 'Zoom',
        start: dateAt(0, 11, 0),
        end: dateAt(0, 12, 0),
        allDay: false,
        recurrence: '',
        calendarId: 'cal-work',
        guests: guests.review,
        reminder: 15,
        busyStatus: 'busy',
        visibility: 'default',
    },
    {
        id: 'evt-3',
        title: 'Lunch with Bob',
        description: '',
        location: 'Cafe Milano',
        start: dateAt(0, 12, 30),
        end: dateAt(0, 13, 30),
        allDay: false,
        recurrence: '',
        calendarId: 'cal-personal',
        guests: guests.lunch,
        reminder: 30,
        busyStatus: 'free',
        visibility: 'default',
    },
    {
        id: 'evt-4',
        title: 'Sprint Planning',
        description: 'Plan sprint goals and allocate tasks',
        location: '',
        start: dateAt(0, 14, 0),
        end: dateAt(0, 15, 30),
        allDay: false,
        recurrence: '',
        calendarId: 'cal-team',
        guests: [],
        reminder: 10,
        busyStatus: 'busy',
        visibility: 'default',
    },
    {
        id: 'evt-5',
        title: 'Team Standup',
        description: 'Daily sync with the engineering team',
        location: 'Conference Room A',
        start: dateAt(1, 9, 0),
        end: dateAt(1, 9, 30),
        allDay: false,
        recurrence: 'daily',
        calendarId: 'cal-work',
        guests: guests.standup,
        reminder: 10,
        busyStatus: 'busy',
        visibility: 'default',
    },
    {
        id: 'evt-6',
        title: '1:1 with Manager',
        description: 'Weekly check-in',
        location: 'Office',
        start: dateAt(1, 10, 0),
        end: dateAt(1, 10, 45),
        allDay: false,
        recurrence: 'weekly',
        calendarId: 'cal-work',
        guests: [],
        reminder: 10,
        busyStatus: 'busy',
        visibility: 'private',
    },
    {
        id: 'evt-7',
        title: 'Yoga Class',
        description: '',
        location: 'Downtown Studio',
        start: dateAt(1, 18, 0),
        end: dateAt(1, 19, 0),
        allDay: false,
        recurrence: '',
        calendarId: 'cal-personal',
        guests: [],
        reminder: 60,
        busyStatus: 'free',
        visibility: 'default',
    },
    {
        id: 'evt-8',
        title: 'Team Standup',
        description: 'Daily sync with the engineering team',
        location: 'Conference Room A',
        start: dateAt(2, 9, 0),
        end: dateAt(2, 9, 30),
        allDay: false,
        recurrence: 'daily',
        calendarId: 'cal-work',
        guests: guests.standup,
        reminder: 10,
        busyStatus: 'busy',
        visibility: 'default',
    },
    {
        id: 'evt-9',
        title: 'Product Demo',
        description: 'Demo new features to stakeholders',
        location: 'Main Conference Room',
        start: dateAt(2, 14, 0),
        end: dateAt(2, 15, 0),
        allDay: false,
        recurrence: '',
        calendarId: 'cal-team',
        guests: guests.review,
        reminder: 30,
        busyStatus: 'busy',
        visibility: 'public',
    },
    {
        id: 'evt-10',
        title: 'Team Standup',
        description: 'Daily sync with the engineering team',
        location: 'Conference Room A',
        start: dateAt(3, 9, 0),
        end: dateAt(3, 9, 30),
        allDay: false,
        recurrence: 'daily',
        calendarId: 'cal-work',
        guests: guests.standup,
        reminder: 10,
        busyStatus: 'busy',
        visibility: 'default',
    },
    {
        id: 'evt-11',
        title: 'Dentist Appointment',
        description: '',
        location: 'Dr. Smith Office',
        start: dateAt(3, 15, 0),
        end: dateAt(3, 16, 0),
        allDay: false,
        recurrence: '',
        calendarId: 'cal-personal',
        guests: [],
        reminder: 120,
        busyStatus: 'busy',
        visibility: 'private',
    },
    {
        id: 'evt-12',
        title: 'Team Standup',
        description: 'Daily sync with the engineering team',
        location: 'Conference Room A',
        start: dateAt(-1, 9, 0),
        end: dateAt(-1, 9, 30),
        allDay: false,
        recurrence: 'daily',
        calendarId: 'cal-work',
        guests: guests.standup,
        reminder: 10,
        busyStatus: 'busy',
        visibility: 'default',
    },
    {
        id: 'evt-13',
        title: 'Client Call',
        description: 'Quarterly business review with client',
        location: 'Zoom',
        start: dateAt(-1, 13, 0),
        end: dateAt(-1, 14, 0),
        allDay: false,
        recurrence: '',
        calendarId: 'cal-work',
        guests: [],
        reminder: 15,
        busyStatus: 'busy',
        visibility: 'default',
    },
    {
        id: 'evt-14',
        title: 'Matt OOO',
        description: 'Out of office - vacation',
        location: '',
        start: allDayDate(0),
        end: allDayDate(2),
        allDay: true,
        recurrence: '',
        calendarId: 'cal-team',
        guests: [],
        reminder: 0,
        busyStatus: 'free',
        visibility: 'default',
    },
    {
        id: 'evt-15',
        title: 'Company Holiday',
        description: 'National holiday - office closed',
        location: '',
        start: allDayDate(5),
        end: allDayDate(5),
        allDay: true,
        recurrence: '',
        calendarId: 'cal-holidays',
        guests: [],
        reminder: 0,
        busyStatus: 'free',
        visibility: 'public',
    },
    {
        id: 'evt-16',
        title: 'Team Offsite',
        description: 'Annual team offsite event',
        location: 'Mountain Lodge',
        start: allDayDate(7),
        end: allDayDate(9),
        allDay: true,
        recurrence: '',
        calendarId: 'cal-team',
        guests: guests.standup,
        reminder: 1440,
        busyStatus: 'busy',
        visibility: 'default',
    },
    {
        id: 'evt-17',
        title: 'Team Standup',
        description: 'Daily sync with the engineering team',
        location: 'Conference Room A',
        start: dateAt(4, 9, 0),
        end: dateAt(4, 9, 30),
        allDay: false,
        recurrence: 'daily',
        calendarId: 'cal-work',
        guests: guests.standup,
        reminder: 10,
        busyStatus: 'busy',
        visibility: 'default',
    },
    {
        id: 'evt-18',
        title: 'Coffee Chat',
        description: 'Catch up with Eve',
        location: 'Blue Bottle',
        start: dateAt(4, 16, 0),
        end: dateAt(4, 16, 30),
        allDay: false,
        recurrence: '',
        calendarId: 'cal-personal',
        guests: [],
        reminder: 30,
        busyStatus: 'free',
        visibility: 'default',
    },
    {
        id: 'evt-19',
        title: 'Retrospective',
        description: 'Sprint retrospective',
        location: 'Conference Room B',
        start: dateAt(-2, 15, 0),
        end: dateAt(-2, 16, 0),
        allDay: false,
        recurrence: '',
        calendarId: 'cal-team',
        guests: guests.standup,
        reminder: 10,
        busyStatus: 'busy',
        visibility: 'default',
    },
    {
        id: 'evt-20',
        title: 'Vacation',
        description: 'Beach trip',
        location: '',
        start: allDayDate(-3),
        end: allDayDate(-1),
        allDay: true,
        recurrence: '',
        calendarId: 'cal-personal',
        guests: [],
        reminder: 0,
        busyStatus: 'free',
        visibility: 'private',
    },
]

export function getAllCalendars(): Calendar[] {
    return calendars
}

export function getCalendarById(id: string): Calendar | undefined {
    return calendars.find(c => c.id === id)
}

export function getEventById(id: string): CalendarEvent | undefined {
    return events.find(e => e.id === id)
}

export function getEventsForDate(date: Date): CalendarEvent[] {
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(date)
    dayEnd.setHours(23, 59, 59, 999)

    return events.filter(event => eventOverlapsRange(event, dayStart, dayEnd))
}

export function getEventsForDateRange(start: Date, end: Date): CalendarEvent[] {
    const rangeStart = new Date(start)
    rangeStart.setHours(0, 0, 0, 0)
    const rangeEnd = new Date(end)
    rangeEnd.setHours(23, 59, 59, 999)

    return events.filter(event => eventOverlapsRange(event, rangeStart, rangeEnd))
}
