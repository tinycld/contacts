import { useRouter } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { newRecordId } from 'pbtsdb/core'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { handleMutationErrorsWithForm } from '~/lib/errors'
import { mutation, useMutation } from '~/lib/mutations'
import { useStore } from '~/lib/pocketbase'
import { useThemeColor } from '~/lib/use-app-theme'
import { useCurrentUserOrg } from '~/lib/use-current-user-org'
import { useOrgInfo } from '~/lib/use-org-info'
import { Button, ButtonText } from '~/ui/button'
import { useForm, type z, zodResolver } from '~/ui/form'
import { ContactForm } from '../components/ContactForm'
import { contactSchema } from '../components/contactSchema'

export default function NewContactScreen() {
    const router = useRouter()
    const { orgSlug } = useOrgInfo()
    const userOrg = useCurrentUserOrg(orgSlug)
    const [contactsCollection] = useStore('contacts')
    const fgColor = useThemeColor('foreground')
    const bgColor = useThemeColor('background')

    const {
        control,
        handleSubmit,
        setError,
        getValues,
        formState: { errors, isSubmitted },
    } = useForm({
        mode: 'onChange',
        resolver: zodResolver(contactSchema),
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

    const createContact = useMutation({
        mutationFn: mutation(function* (data: z.infer<typeof contactSchema>) {
            if (!userOrg) throw new Error('No organization context')
            yield contactsCollection.insert({
                id: newRecordId(),
                first_name: data.first_name.trim(),
                last_name: data.last_name.trim(),
                email: data.email,
                phone: data.phone,
                company: data.company.trim(),
                job_title: data.job_title.trim(),
                notes: data.notes,
                favorite: data.favorite,
                owner: userOrg.id,
                vcard_uid: crypto.randomUUID(),
            })
        }),
        onSuccess: () => router.back(),
        onError: handleMutationErrorsWithForm({ setError, getValues }),
    })

    const onSubmit = handleSubmit((data) => createContact.mutate(data))
    const canSubmit = !createContact.isPending && !!userOrg

    return (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} style={{ backgroundColor: bgColor }}>
            <View className="flex-1 p-5">
                <View className="flex-row justify-between items-center mb-5">
                    <View className="flex-row gap-3 items-center">
                        <Pressable onPress={() => router.back()}>
                            <ArrowLeft size={24} color={fgColor} />
                        </Pressable>
                        <Text className="text-2xl font-bold" style={{ color: fgColor }}>
                            Create Contact
                        </Text>
                    </View>
                    <Button onPress={onSubmit} isDisabled={!canSubmit} size="sm">
                        <ButtonText>{createContact.isPending ? 'Creating...' : 'Create'}</ButtonText>
                    </Button>
                </View>

                <ContactForm control={control} errors={errors} isSubmitted={isSubmitted} />
            </View>
        </ScrollView>
    )
}
