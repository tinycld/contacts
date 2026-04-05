import { MapPin } from 'lucide-react-native'
import type { Control, FieldErrors } from 'react-hook-form'
import { YStack } from 'tamagui'
import {
    FormErrorSummary,
    NumberInput,
    SelectInput,
    TextAreaInput,
    TextInput,
    Toggle,
} from '~/ui/form'
import type { Calendar } from '../types'

interface EventFormProps {
    control: Control<{
        title: string
        description: string
        location: string
        startDate: string
        startTime: string
        endDate: string
        endTime: string
        allDay: boolean
        calendarId: string
        busyStatus: 'busy' | 'free'
        visibility: 'default' | 'public' | 'private'
        reminderMinutes: number
    }>
    errors: FieldErrors
    isSubmitted: boolean
    calendars: Calendar[]
}

export function EventForm({ control, errors, isSubmitted, calendars }: EventFormProps) {
    const calendarOptions = calendars.map(c => ({ label: c.name, value: c.id }))

    return (
        <YStack gap="$4">
            <FormErrorSummary errors={errors} isEnabled={isSubmitted} />

            <TextInput control={control} name="title" label="Title" placeholder="Event title" />

            <Toggle control={control} name="allDay" label="All day" />

            <TextInput
                control={control}
                name="startDate"
                label="Start date"
                placeholder="YYYY-MM-DD"
            />
            <TextInput control={control} name="startTime" label="Start time" placeholder="HH:MM" />
            <TextInput control={control} name="endDate" label="End date" placeholder="YYYY-MM-DD" />
            <TextInput control={control} name="endTime" label="End time" placeholder="HH:MM" />

            <TextInput
                control={control}
                name="location"
                label="Location"
                labelIcon={MapPin}
                placeholder="Add location"
            />

            <NumberInput
                control={control}
                name="reminderMinutes"
                label="Reminder (minutes)"
                min={0}
                max={10080}
                increment={5}
            />

            <SelectInput
                control={control}
                name="calendarId"
                label="Calendar"
                options={calendarOptions}
            />

            <SelectInput
                control={control}
                name="busyStatus"
                label="Status"
                options={[
                    { label: 'Busy', value: 'busy' },
                    { label: 'Free', value: 'free' },
                ]}
                horizontal
            />

            <SelectInput
                control={control}
                name="visibility"
                label="Visibility"
                options={[
                    { label: 'Default', value: 'default' },
                    { label: 'Public', value: 'public' },
                    { label: 'Private', value: 'private' },
                ]}
                horizontal
            />

            <TextAreaInput
                control={control}
                name="description"
                label="Description"
                placeholder="Add description"
                numberOfLines={4}
            />
        </YStack>
    )
}
