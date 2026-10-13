import { hexToRgba } from '@tinycld/core/lib/color-utils'
import { describe, expect, it } from 'vitest'
import { contactSchema } from '~/tinycld/contacts/components/contactSchema'

const blank = {
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: '',
    job_title: '',
    notes: '',
}

describe('contactSchema', () => {
    it('requires a first name', () => {
        const result = contactSchema.safeParse({
            first_name: '',
            last_name: '',
            email: '',
            phone: '',
            company: '',
            job_title: '',
            notes: '',
        })
        expect(result.success).toBe(false)
    })

    it('accepts a valid contact', () => {
        const result = contactSchema.safeParse({
            first_name: 'Ada',
            last_name: 'Lovelace',
            email: 'ada@example.com',
            phone: '',
            company: '',
            job_title: '',
            notes: '',
        })
        expect(result.success).toBe(true)
    })

    it('rejects a whitespace-only first name', () => {
        const result = contactSchema.safeParse({ ...blank, first_name: '   ' })
        expect(result.success).toBe(false)
        expect(result.error?.issues[0]?.path).toEqual(['first_name'])
    })

    it('trims every free-text field', () => {
        const result = contactSchema.parse({
            first_name: '  Ada ',
            last_name: ' Lovelace ',
            email: ' ada@example.com ',
            phone: ' 555 ',
            company: ' Analytical ',
            job_title: ' Engineer ',
            notes: ' hello ',
        })
        expect(result).toEqual({
            first_name: 'Ada',
            last_name: 'Lovelace',
            email: 'ada@example.com',
            phone: '555',
            company: 'Analytical',
            job_title: 'Engineer',
            notes: 'hello',
        })
    })

    it('accepts a blank or whitespace-only email as empty', () => {
        const result = contactSchema.parse({ ...blank, first_name: 'Ada', email: '   ' })
        expect(result.email).toBe('')
    })

    it('rejects an invalid email', () => {
        const result = contactSchema.safeParse({ ...blank, first_name: 'Ada', email: 'nope' })
        expect(result.success).toBe(false)
        expect(result.error?.issues[0]?.path).toEqual(['email'])
    })
})

describe('cross-package import from @tinycld/core', () => {
    it('resolves a core util', () => {
        expect(hexToRgba('#ffffff', 0.5)).toBe('rgba(255, 255, 255, 0.5)')
    })
})
