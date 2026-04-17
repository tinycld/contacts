import { eq } from '@tanstack/db'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { useMemo } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { LabelBadge } from '~/components/LabelBadge'
import { StarIcon } from '~/components/StarIcon'
import { handleMutationErrorsWithForm } from '~/lib/errors'
import { mutation, useMutation } from '~/lib/mutations'
import { useStore } from '~/lib/pocketbase'
import { useThemeColor } from '~/lib/use-app-theme'
import { useOrgLiveQuery } from '~/lib/use-org-live-query'
import { Button, ButtonText } from '~/ui/button'
import { useForm, zodResolver } from '~/ui/form'
import { useLabelMutations } from '~/ui/hooks/useLabelMutations'
import { useLabels, useLabelsForRecord } from '~/ui/hooks/useLabels'
import { ContactAvatar } from '../components/ContactAvatar'
import { ContactForm } from '../components/ContactForm'
import { contactSchema } from '../components/contactSchema'

export default function ContactDetailScreen() {
    const router = useRouter()
    const { id = '' } = useLocalSearchParams<{ id: string }>()
    const [contactsCollection] = useStore('contacts')
    const fgColor = useThemeColor('foreground')
    const mutedColor = useThemeColor('muted-foreground')
    const bgColor = useThemeColor('background')

    const { labels: orgLabels } = useLabels()
    const recordLabels = useLabelsForRecord(id, 'contacts')
    const { assignLabel, unassignLabel } = useLabelMutations()

    const assignedLabelIds = useMemo(
        () => new Set(recordLabels.labels.map(l => l.id)),
        [recordLabels.labels]
    )

    const { data } = useOrgLiveQuery(
        query =>
            query
                .from({ contacts: contactsCollection })
                .where(({ contacts }) => eq(contacts.id, id)),
        [id]
    )

    const contact = data?.[0] ?? null

    const {
        control,
        handleSubmit,
        setError,
        getValues,
        formState: { errors, isSubmitted },
    } = useForm({
        mode: 'onChange',
        resolver: zodResolver(contactSchema),
        values: contact
            ? {
                  first_name: contact.first_name ?? '',
                  last_name: contact.last_name ?? '',
                  email: contact.email ?? '',
                  phone: contact.phone ?? '',
                  company: contact.company ?? '',
                  job_title: contact.job_title ?? '',
                  notes: contact.notes ?? '',
                  favorite: contact.favorite ?? false,
              }
            : undefined,
        defaultValues: {
            first_name: '',
            last_name: '',
            email: '',
            phone: '',
            company: '',
            job_title: '',
            notes: '',
            favorite: false,
        },
    })

    const updateContact = useMutation({
        mutationFn: mutation(function* (formData: {
            first_name: string
            last_name: string
            email: string
            phone: string
            company: string
            job_title: string
            notes: string
            favorite: boolean
        }) {
            yield contactsCollection.update(id, draft => {
                draft.first_name = formData.first_name.trim()
                draft.last_name = formData.last_name.trim()
                draft.email = formData.email
                draft.phone = formData.phone
                draft.company = formData.company.trim()
                draft.job_title = formData.job_title.trim()
                draft.notes = formData.notes
                draft.favorite = formData.favorite
            })
        }),
        onError: handleMutationErrorsWithForm({ setError, getValues }),
    })

    const toggleFavorite = useMutation({
        mutationFn: mutation(function* () {
            if (!contact) return
            yield contactsCollection.update(id, draft => {
                draft.favorite = !contact.favorite
            })
        }),
    })

    const onSubmit = handleSubmit(formData => updateContact.mutate(formData))

    const handleToggleLabel = (labelId: string) => {
        if (assignedLabelIds.has(labelId)) {
            unassignLabel.mutate({ labelId, recordId: id, collection: 'contacts' })
        } else {
            assignLabel.mutate({ labelId, recordId: id, collection: 'contacts' })
        }
    }

    if (!contact) {
        return (
            <View className="flex-1 p-5" style={{ backgroundColor: bgColor }}>
                <Text className="text-base" style={{ color: mutedColor }}>
                    Contact not found
                </Text>
            </View>
        )
    }

    const displayName = [contact.first_name, contact.last_name].filter(Boolean).join(' ')

    return (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} style={{ backgroundColor: bgColor }}>
            <View className="flex-1 p-5">
                <View className="flex-row justify-between items-center mb-5">
                    <Pressable onPress={() => router.back()}>
                        <ArrowLeft size={24} color={fgColor} />
                    </Pressable>
                    <View className="flex-row gap-3 items-center">
                        <Pressable onPress={() => toggleFavorite.mutate()}>
                            <StarIcon isStarred={contact.favorite} size={24} />
                        </Pressable>
                        <Button onPress={onSubmit} isDisabled={updateContact.isPending} size="sm">
                            <ButtonText>
                                {updateContact.isPending ? 'Saving...' : 'Save'}
                            </ButtonText>
                        </Button>
                    </View>
                </View>

                <View className="items-center mb-5 gap-2">
                    <ContactAvatar
                        firstName={contact.first_name}
                        lastName={contact.last_name}
                        size={80}
                    />
                    <Text className="text-2xl font-bold" style={{ color: fgColor }}>
                        {displayName}
                    </Text>
                    {contact.email ? (
                        <Text className="text-sm" style={{ color: mutedColor }}>
                            {contact.email}
                        </Text>
                    ) : null}
                </View>

                {orgLabels.length > 0 ? (
                    <View className="mb-5 gap-2">
                        <Text className="text-sm font-semibold" style={{ color: mutedColor }}>
                            Labels
                        </Text>
                        <View className="flex-row flex-wrap gap-2">
                            {orgLabels.map(label => {
                                const assigned = assignedLabelIds.has(label.id)
                                return (
                                    <Pressable
                                        key={label.id}
                                        onPress={() => handleToggleLabel(label.id)}
                                    >
                                        <LabelBadge
                                            name={label.name}
                                            color={assigned ? label.color : mutedColor}
                                        />
                                    </Pressable>
                                )
                            })}
                        </View>
                    </View>
                ) : null}

                <ContactForm control={control} errors={errors} isSubmitted={isSubmitted} />
            </View>
        </ScrollView>
    )
}
