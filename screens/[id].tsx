import { eq } from '@tanstack/db'
import { useLiveQuery } from '@tanstack/react-db'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ArrowLeft, Star } from 'lucide-react-native'
import { useMemo } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { LabelBadge } from '~/components/LabelBadge'
import { handleMutationErrorsWithForm } from '~/lib/errors'
import { mutation, useMutation } from '~/lib/mutations'
import { useStore } from '~/lib/pocketbase'
import { useThemeColor } from '~/lib/use-app-theme'
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
    const warningColor = useThemeColor('warning')
    const bgColor = useThemeColor('background')

    const { labels: orgLabels } = useLabels()
    const recordLabels = useLabelsForRecord(id, 'contacts')
    const { assignLabel, unassignLabel } = useLabelMutations()

    const assignedLabelIds = useMemo(
        () => new Set(recordLabels.labels.map(l => l.id)),
        [recordLabels.labels]
    )

    const { data } = useLiveQuery(
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
            <View style={{ flex: 1, padding: 20, backgroundColor: bgColor }}>
                <Text style={{ fontSize: 16, color: mutedColor }}>Contact not found</Text>
            </View>
        )
    }

    const displayName = [contact.first_name, contact.last_name].filter(Boolean).join(' ')

    return (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} style={{ backgroundColor: bgColor }}>
            <View style={{ flex: 1, padding: 20 }}>
                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 20,
                    }}
                >
                    <Pressable onPress={() => router.back()}>
                        <ArrowLeft size={24} color={fgColor} />
                    </Pressable>
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                        <Pressable onPress={() => toggleFavorite.mutate()}>
                            <Star
                                size={24}
                                color={contact.favorite ? mutedColor : warningColor}
                                fill={contact.favorite ? 'transparent' : warningColor}
                            />
                        </Pressable>
                        <Button onPress={onSubmit} isDisabled={updateContact.isPending} size="sm">
                            <ButtonText>
                                {updateContact.isPending ? 'Saving...' : 'Save'}
                            </ButtonText>
                        </Button>
                    </View>
                </View>

                <View style={{ alignItems: 'center', marginBottom: 20, gap: 8 }}>
                    <ContactAvatar
                        firstName={contact.first_name}
                        lastName={contact.last_name}
                        size={80}
                    />
                    <Text
                        style={{
                            fontSize: 24,
                            fontWeight: 'bold',
                            color: fgColor,
                        }}
                    >
                        {displayName}
                    </Text>
                    {contact.email ? (
                        <Text style={{ fontSize: 14, color: mutedColor }}>{contact.email}</Text>
                    ) : null}
                </View>

                {orgLabels.length > 0 ? (
                    <View style={{ marginBottom: 20, gap: 8 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: mutedColor }}>
                            Labels
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
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
