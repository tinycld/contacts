import { type Control, type FieldErrors, useController } from 'react-hook-form'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { useTheme } from 'tamagui'
import type { ComposeFormData } from './ComposeWindow'

interface ComposeFieldsProps {
    control: Control<ComposeFormData>
    errors: FieldErrors<ComposeFormData>
}

function ComposeFieldInput({
    control,
    name,
}: {
    control: Control<ComposeFormData>
    name: keyof ComposeFormData
}) {
    const theme = useTheme()
    const { field } = useController({ control, name })

    return (
        <TextInput
            style={[styles.fieldInput, { color: theme.color.val }]}
            placeholderTextColor={theme.placeholderColor.val}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
        />
    )
}

export function ComposeFields({ control, errors }: ComposeFieldsProps) {
    const theme = useTheme()

    const borderStyle = { borderBottomColor: theme.borderColor.val }

    return (
        <View>
            <View
                style={[
                    styles.fieldRow,
                    borderStyle,
                    errors.to ? { borderBottomColor: theme.red8.val } : undefined,
                ]}
            >
                <Text style={[styles.fieldLabel, { color: theme.color8.val }]}>To</Text>
                <ComposeFieldInput control={control} name="to" />
            </View>
            <View
                style={[
                    styles.fieldRow,
                    borderStyle,
                    errors.subject ? { borderBottomColor: theme.red8.val } : undefined,
                ]}
            >
                <Text style={[styles.fieldLabel, { color: theme.color8.val }]}>Subject</Text>
                <ComposeFieldInput control={control} name="subject" />
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    fieldRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        height: 36,
        borderBottomWidth: 1,
    },
    fieldLabel: {
        fontSize: 13,
        width: 56,
    },
    fieldInput: {
        flex: 1,
        fontSize: 13,
    },
})
