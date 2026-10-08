import { describe, it, expect } from 'vitest'
import { buildScreenView, screenPattern } from '@/utils/screenView'

const route = (path: string, pattern: string | null, name?: string) =>
    ({ path, name, matched: pattern === null ? [] : [{ path: pattern }] }) as any

const START = route('/', null)

describe('screenView', () => {
    it('uses the route pattern, never the concrete URL', () => {
        expect(screenPattern(route('/item/4711203210061', '/item/:barcode'))).toBe('/item/:barcode')
        const detail = buildScreenView(route('/item/4711203210061', '/item/:barcode', 'item-details'), route('/home', '/home'))
        expect(detail).toEqual({ screen: '/item/:barcode', from: '/home', name: 'item-details' })
        expect(JSON.stringify(detail)).not.toContain('4711203210061')
    })

    it('never echoes an unmatched URL', () => {
        expect(screenPattern(route('/secret?token=abc', null))).toBe('(unmatched)')
    })

    it('has no previous screen on the first navigation', () => {
        expect(buildScreenView(route('/home', '/home'), START)).toEqual({ screen: '/home', from: null })
    })

    it('is not a new screen when only the query or hash changed', () => {
        expect(buildScreenView(route('/search', '/search'), route('/search', '/search'))).toBeNull()
    })

    it('is a new screen when only the param changed (same pattern, different item)', () => {
        const detail = buildScreenView(route('/item/2', '/item/:barcode'), route('/item/1', '/item/:barcode'))
        expect(detail).toMatchObject({ screen: '/item/:barcode', from: '/item/:barcode' })
    })

    it('omits the name for unnamed routes', () => {
        expect(buildScreenView(route('/news', '/news'), route('/home', '/home'))).not.toHaveProperty('name')
    })
})
