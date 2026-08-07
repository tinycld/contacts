import { toRow } from '@tinycld/contacts/search-adapter'
import { describe, expect, it } from 'vitest'

describe('contacts toRow', () => {
    it('maps a hit to a row with the contact name, email and company', () => {
        const row = toRow({
            id: 'c1',
            first_name: 'Grace',
            last_name: 'Hopper',
            email: 'grace@navy.mil',
            company: 'US Navy',
        })
        expect(row).toEqual({
            id: 'c1',
            title: 'Grace Hopper',
            subtitle: 'grace@navy.mil',
            meta: 'US Navy',
        })
    })

    it('falls back to the email when both names are empty', () => {
        const row = toRow({
            id: 'c2',
            first_name: '',
            last_name: '',
            email: 'no-name@example.com',
            company: '',
        })
        expect(row?.title).toBe('no-name@example.com')
    })

    it('falls back to "Unnamed contact" when name and email are both empty', () => {
        const row = toRow({ id: 'c3', first_name: '', last_name: '', email: '', company: '' })
        expect(row?.title).toBe('Unnamed contact')
    })
})
