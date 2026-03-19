/**
 * BarcodeValidator - TypeScript version of imelgrat/barcode-validator (PHP)
 * Supports: EAN-8/13/14, UPC-A/E, GTIN, ISBN-10/13, IMEI, SSCC, GSIN, GLN, ASIN
 * Author: Ported and patched by ChatGPT from Ivan Melgrati's PHP original
 */

export class BarcodeValidator {
    /* ---------------- GS1 Check Digit (EAN/UPC/GTIN) ---------------- */
    private static calculateEANCheckDigit(code: string): number {
        const digits = code.split("").map(Number);
        let sum = 0;

        // ✅ Correct GS1 Mod10:
        // From the right (excluding the check digit):
        // odd positions × 3, even positions × 1
        for (let i = digits.length - 1, pos = 1; i >= 0; i--, pos++) {
            sum += digits[i] * (pos % 2 === 1 ? 3 : 1);
        }

        const mod = sum % 10;
        return mod === 0 ? 0 : 10 - mod;
    }

    private static validateEANCheckDigit(code: string, length: number): boolean {
        if (!/^\d+$/.test(code)) return false;
        if (code.length !== length) return false;

        const expected = this.calculateEANCheckDigit(code.slice(0, -1));
        const actual = Number(code.slice(-1));
        return expected === actual;
    }

    /* ---------------- Luhn Check Digit (IMEI, Credit Card) ---------------- */
    private static calculateLuhnCheckDigit(code: string): number {
        const digits = code.split("").map(Number).reverse();
        let sum = 0;

        for (let i = 0; i < digits.length; i++) {
            let d = digits[i];
            if (i % 2 === 0) {
                d *= 2;
                if (d > 9) d -= 9;
            }
            sum += d;
        }

        return (10 - (sum % 10)) % 10;
    }

    private static validateLuhnCheckDigit(code: string, length: number): boolean {
        if (!/^\d+$/.test(code)) return false;
        if (code.length !== length) return false;

        const expected = this.calculateLuhnCheckDigit(code.slice(0, -1));
        const actual = Number(code.slice(-1));
        return expected === actual;
    }

    /* ---------------- ISBN ---------------- */
    private static calculateISBNCheckDigit(code: string): string | number {
        if (code.length === 13) {
            return this.calculateEANCheckDigit(code);
        } else {
            let sum = 0;
            for (let i = 0; i < 9; i++) {
                sum += (10 - i) * Number(code[i]);
            }
            const check = (11 - (sum % 11)) % 11;
            return check === 10 ? "X" : check;
        }
    }

    private static validateISBN10(code: string): boolean {
        if (!/^\d{9}(\d|X)$/.test(code)) return false;
        const expected = this.calculateISBNCheckDigit(code.slice(0, -1));
        const actual = code.slice(-1);
        return String(expected) === actual;
    }

    /* ---------------- Public Methods ---------------- */
    static isValidEAN8(code: string): boolean {
        return this.validateEANCheckDigit(code, 8);
    }

    static isValidEAN13(code: string): boolean {
        return this.validateEANCheckDigit(code, 13);
    }

    static isValidEAN14(code: string): boolean {
        return this.validateEANCheckDigit(code, 14);
    }

    static isValidUPCA(code: string): boolean {
        return this.validateEANCheckDigit(code, 12);
    }

    // Simplified UPC-E (full expansion requires more detailed rules)
    static isValidUPCE(code: string): boolean {
        return /^\d{6,8}$/.test(code); // accepts 6–8 digits
    }

    static isValidISBN(code: string): boolean {
        const clean = code.replace(/-/g, "");
        if (clean.length === 10) return this.validateISBN10(clean);
        if (clean.length === 13) return this.validateEANCheckDigit(clean, 13);
        return false;
    }

    static isValidIMEI(code: string): boolean {
        if (!/^\d+$/.test(code)) return false;
        if (code.length === 14 || code.length === 16) return true; // IMEISV → no check digit
        if (code.length === 15) return this.validateLuhnCheckDigit(code, 15);
        return false;
    }

    static isValidGSIN(code: string): boolean {
        return this.validateEANCheckDigit(code, 17);
    }

    static isValidSSCC(code: string): boolean {
        return this.validateEANCheckDigit(code, 18);
    }

    static isValidGLN(code: string): boolean {
        return this.validateEANCheckDigit(code, 13);
    }

    static isValidASIN(code: string): boolean {
        return /^B\d{2}\w{7}$/.test(code) || /^\d{9}(\d|X)$/.test(code);
    }
}
