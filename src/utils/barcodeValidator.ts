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

    /**
     * Expands the 6 compressed digits of a UPC-E code (plus its number-system
     * digit) back into the 11-digit manufacturer+product body of the UPC-A
     * code it represents, per the standard GS1 UPC-E↔UPC-A conversion table.
     */
    private static expandUPCEToUPCABody(numberSystem: string, six: string): string {
        const d = six.split("");
        const last = d[5];
        let mfr: string;
        let product: string;

        if (last === "0" || last === "1" || last === "2") {
            mfr = d[0] + d[1] + last + "00";
            product = "00" + d[2] + d[3] + d[4];
        } else if (last === "3") {
            mfr = d[0] + d[1] + d[2] + "00";
            product = "000" + d[3] + d[4];
        } else if (last === "4") {
            mfr = d[0] + d[1] + d[2] + d[3] + "0";
            product = "0000" + d[4];
        } else {
            mfr = d[0] + d[1] + d[2] + d[3] + d[4];
            product = "0000" + last;
        }

        return numberSystem + mfr + product; // 11 digits
    }

    // UPC-E only carries a real checksum in its 8-digit form (number system +
    // 6 compressed digits + check digit) — a bare 6-digit code has no check
    // digit to validate against, so it can't be trusted as a genuine barcode.
    static isValidUPCE(code: string): boolean {
        if (!/^\d{8}$/.test(code)) return false;

        const numberSystem = code[0];
        if (numberSystem !== "0" && numberSystem !== "1") return false;

        const six = code.slice(1, 7);
        const providedCheck = code[7];

        const upcABody = this.expandUPCEToUPCABody(numberSystem, six);
        const expectedCheck = this.calculateEANCheckDigit(upcABody);
        return String(expectedCheck) === providedCheck;
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

/** Strips separators so a hand-typed barcode validates the same as a scanned one. */
export function normalizeBarcode(barcode: string): string {
    return barcode.trim().replace(/[-\s]/g, "");
}

/**
 * Catches placeholder/test input that can slip past a pure checksum check by
 * coincidence — e.g. "6666666666666" (13 sixes) is a mathematically valid
 * EAN-13 (repdigits of 0/2/4/6/8 satisfy the GS1 check-digit formula at that
 * length), but no real product is ever printed with a literal repdigit or a
 * straight ascending/descending run as its barcode.
 */
function isObviouslyFakePattern(digits: string): boolean {
    if (/^(\d)\1+$/.test(digits)) return true; // all the same digit

    let ascending = true;
    let descending = true;
    for (let i = 1; i < digits.length; i++) {
        const prev = Number(digits[i - 1]);
        const curr = Number(digits[i]);
        if (curr !== (prev + 1) % 10) ascending = false;
        if (curr !== (prev + 9) % 10) descending = false;
    }
    return ascending || descending;
}

/**
 * True if the barcode passes any of the supported symbologies' checksums.
 * Shared by the contributor form (AddProductView) and the admin review screen
 * (ReviewProductsView) so both judge a barcode identically.
 *
 * IMEI is deliberately excluded: it's a phone identifier, not something that
 * appears on product packaging, and its 14/16-digit forms have no check
 * digit at all — including it here let any 14-digit string (e.g. a repeated
 * "66666666666666") pass as "valid".
 */
export function isValidBarcodeFormat(barcode: string): boolean {
    const clean = normalizeBarcode(barcode);
    if (!clean) return false;
    if (/^\d+$/.test(clean) && isObviouslyFakePattern(clean)) return false;

    return (
        BarcodeValidator.isValidEAN8(clean) ||
        BarcodeValidator.isValidEAN13(clean) ||
        BarcodeValidator.isValidEAN14(clean) ||
        BarcodeValidator.isValidUPCA(clean) ||
        BarcodeValidator.isValidUPCE(clean) ||
        BarcodeValidator.isValidISBN(clean) ||
        BarcodeValidator.isValidGSIN(clean) ||
        BarcodeValidator.isValidSSCC(clean) ||
        BarcodeValidator.isValidGLN(clean) ||
        BarcodeValidator.isValidASIN(clean)
    );
}
