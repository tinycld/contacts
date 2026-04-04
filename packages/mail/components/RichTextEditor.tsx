import { type RefObject, useEffect, useRef } from 'react'
import { Platform, StyleSheet, TextInput, View } from 'react-native'
import { useTheme } from 'tamagui'

export interface RichTextEditorHandle {
    getHTML: () => Promise<string>
    getText: () => Promise<string>
    focus: () => void
    clear: () => void
}

interface RichTextEditorProps {
    placeholder?: string
    initialContent?: string
    editorRef: RefObject<RichTextEditorHandle | null>
}

export function RichTextEditor({
    placeholder = 'Compose email',
    initialContent = '',
    editorRef,
}: RichTextEditorProps) {
    const theme = useTheme()
    const textRef = useRef<TextInput | null>(null)
    const currentText = useRef(initialContent)

    useEffect(() => {
        editorRef.current = {
            getHTML: async () => {
                const escaped = currentText.current
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/\n/g, '<br>')
                return `<div>${escaped}</div>`
            },
            getText: async () => currentText.current,
            focus: () => textRef.current?.focus(),
            clear: () => {
                currentText.current = ''
                textRef.current?.clear()
            },
        }
        return () => {
            editorRef.current = null
        }
    }, [editorRef])

    return (
        <View style={styles.container}>
            <TextInput
                ref={textRef}
                style={[
                    styles.input,
                    { color: theme.color.val },
                    Platform.OS === 'web'
                        ? ({ outlineStyle: 'none' } as Record<string, unknown>)
                        : {},
                ]}
                multiline
                placeholder={placeholder}
                placeholderTextColor={theme.placeholderColor.val}
                defaultValue={initialContent}
                onChangeText={text => {
                    currentText.current = text
                }}
            />
        </View>
    )
}

const webInputStyle = Platform.OS === 'web' ? ({ height: '100%' } as Record<string, unknown>) : {}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        minHeight: 100,
    },
    input: {
        flex: 1,
        fontSize: 14,
        textAlignVertical: 'top',
        padding: 0,
        ...webInputStyle,
    },
})
