export type CalendarColorKey = 'blue' | 'green' | 'red' | 'teal' | 'purple' | 'orange'

export type Recurrence = '' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface CalendarEvent {
    id: string
    title: string
    description: string
    location: string
    start: string
    end: string
    allDay: boolean
    recurrence: Recurrence
    calendarId: string
    guests: EventGuest[]
    reminder: number
    busyStatus: 'busy' | 'free'
    visibility: 'default' | 'public' | 'private'
}

export interface Calendar {
    id: string
    name: string
    colorKey: CalendarColorKey
    group: 'mine' | 'other'
}

export interface EventGuest {
    name: string
    email: string
    rsvp: 'accepted' | 'declined' | 'tentative' | 'pending'
    role: 'organizer' | 'attendee'
}

// biome-ignore lint/complexity/noBannedTypes: empty schema placeholder for addon system compatibility
export type CalendarSchema = {}
