import { describe, it, expect } from 'vitest'
import { BarcodeValidator } from '@/utils/barcodeValidator'

describe('BarcodeValidator', () => {
    describe('EAN Validation', () => {
        it('should correctly validate valid EAN-13 barcodes', () => {
            // Standard EAN-13 examples
            expect(BarcodeValidator.isValidEAN13('4006381333931')).toBe(true)
            expect(BarcodeValidator.isValidEAN13('9780201379624')).toBe(true)
        })

        it('should reject invalid EAN-13 barcodes', () => {
            // Incorrect check digit
            expect(BarcodeValidator.isValidEAN13('4006381333932')).toBe(false)
            // Incorrect length
            expect(BarcodeValidator.isValidEAN13('400638133393')).toBe(false)
            // Non-numeric characters
            expect(BarcodeValidator.isValidEAN13('400638133393A')).toBe(false)
        })

        it('should correctly validate EAN-8 barcodes', () => {
            expect(BarcodeValidator.isValidEAN8('73513537')).toBe(true)
            expect(BarcodeValidator.isValidEAN8('73513538')).toBe(false)
        })
    })

    describe('UPC Validation', () => {
        it('should correctly validate UPC-A barcodes', () => {
            expect(BarcodeValidator.isValidUPCA('036000291452')).toBe(true)
            expect(BarcodeValidator.isValidUPCA('036000291450')).toBe(false)
        })

        it('should correctly validate UPC-E barcodes', () => {
            // The current implementation is simple length checking for UPC-E
            expect(BarcodeValidator.isValidUPCE('123456')).toBe(true)
            expect(BarcodeValidator.isValidUPCE('12345678')).toBe(true)
            expect(BarcodeValidator.isValidUPCE('12345')).toBe(false)
        })
    })

    describe('ISBN Validation', () => {
        it('should correctly validate ISBN-10', () => {
            expect(BarcodeValidator.isValidISBN('0-306-40615-2')).toBe(true)
            expect(BarcodeValidator.isValidISBN('0-306-40615-3')).toBe(false)
            // With 'X' checksum
            expect(BarcodeValidator.isValidISBN('0-8044-2957-X')).toBe(true)
        })

        it('should correctly validate ISBN-13', () => {
            expect(BarcodeValidator.isValidISBN('978-0-306-40615-7')).toBe(true)
        })
    })

    describe('IMEI Validation', () => {
        it('should correctly validate 15-digit IMEI with Luhn algorithm', () => {
            expect(BarcodeValidator.isValidIMEI('351756051523993')).toBe(true)
            expect(BarcodeValidator.isValidIMEI('351756051523998')).toBe(false)
        })

        it('should accept 14 and 16 digit IMEISV without check digit validation', () => {
            expect(BarcodeValidator.isValidIMEI('12345678901234')).toBe(true)
            expect(BarcodeValidator.isValidIMEI('1234567890123456')).toBe(true)
        })
    })
})
