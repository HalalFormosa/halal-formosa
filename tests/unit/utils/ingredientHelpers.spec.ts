import { describe, it, expect } from 'vitest'
import { ionToHex, extractIonColor, colorMeaning, statusToChipClass } from '@/utils/ingredientHelpers'

describe('ingredientHelpers', () => {
    describe('ionToHex', () => {
        it('should return correct hex for known colors', () => {
            expect(ionToHex('danger')).toBe('#eb445a')
            expect(ionToHex('warning')).toBe('#ffc409')
            expect(ionToHex('primary')).toBe('#3880ff')
            expect(ionToHex('success')).toBe('#2dd36f')
            expect(ionToHex('medium')).toBe('#92949c')
            expect(ionToHex('dark')).toBe('#222428')
        })
        it('should return default hex for unknown colors', () => {
            expect(ionToHex('unknown')).toBe('#333')
            expect(ionToHex()).toBe('#333')
        })
    })

    describe('extractIonColor', () => {
        it('should extract color from ion class', () => {
            expect(extractIonColor('ion-color-danger')).toBe('danger')
            expect(extractIonColor('danger')).toBe('danger')
            expect(extractIonColor('')).toBe('')
        })
    })

    describe('colorMeaning', () => {
        it('should return meaning for valid colors', () => {
            expect(colorMeaning('danger')).toBe('Haram')
            expect(colorMeaning('warning')).toBe('Syubhah')
            expect(colorMeaning('success')).toBe('Halal')
            expect(colorMeaning('primary')).toBe('Muslim-friendly')
        })
        it('should return Unknown for invalid color', () => {
            expect(colorMeaning('blue')).toBe('Unknown')
            expect(colorMeaning('medium')).toBe('Unknown')
        })
    })

    describe('statusToChipClass', () => {
        it('should map status to chip class', () => {
            expect(statusToChipClass('Halal')).toBe('chip-success')
            expect(statusToChipClass('Muslim-friendly')).toBe('chip-primary')
            expect(statusToChipClass('Syubhah')).toBe('chip-warning')
            expect(statusToChipClass('Haram')).toBe('chip-danger')
            expect(statusToChipClass('Unknown')).toBe('chip-medium')
        })
    })
})
