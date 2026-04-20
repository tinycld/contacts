import { describe, expect, it } from 'vitest'
import manifest from '../manifest'

describe('contacts manifest', () => {
    it('declares required identifiers', () => {
        expect(manifest.name).toBe('Contacts')
        expect(manifest.slug).toBe('contacts')
        expect(manifest.version).toMatch(/^\d+\.\d+\.\d+/)
    })

    it('points routes directory at screens', () => {
        expect(manifest.routes?.directory).toBe('screens')
    })

    it('declares migrations, collections, and seed', () => {
        expect(manifest.migrations?.directory).toBe('pb-migrations')
        expect(manifest.collections?.register).toBe('collections')
        expect(manifest.collections?.types).toBe('types')
        expect(manifest.seed?.script).toBe('seed')
    })

    it('declares a nav entry', () => {
        expect(manifest.nav?.label).toBe('Contacts')
        expect(manifest.nav?.icon).toBe('users')
        expect(typeof manifest.nav?.order).toBe('number')
    })

    it('declares tests directory', () => {
        expect(manifest.tests?.directory).toBe('tests')
    })
})
