import { create } from '~/lib/store'

interface ContactsUIState {
    /**
     * Keyboard-driven focus index into the current contact listing. Persisted
     * so opening a contact and returning lands back on the row the user was on.
     */
    focusedIndex: number
    setFocusedIndex: (i: number | ((prev: number) => number)) => void
}

export const useContactsUIStore = create<ContactsUIState>((set) => ({
    focusedIndex: 0,
    setFocusedIndex: (next) =>
        set((state) => ({
            focusedIndex: typeof next === 'function' ? next(state.focusedIndex) : next,
        })),
}))
