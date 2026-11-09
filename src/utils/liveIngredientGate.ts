import type { LiveTextFrame } from '@/plugins/liveText'
import type { HighlightBox } from '@/types/Ingredient'

/** Same ingredient headers the OCR pipeline looks for (useOcrPipeline). */
const INGREDIENT_HEADER = /(ingredients?|成分|成份|配料|原料|內容物|内容物|材料)/i

export function frameHasIngredientHeader(frame: LiveTextFrame): boolean {
    return frame.blocks.some(b => b.lines.some(l => INGREDIENT_HEADER.test(l.text)))
}

/** Where the ingredient heading(s) are in the frame (image pixels), so the screen can point at them. */
export function findIngredientHeaders(frame: LiveTextFrame): { text: string; box: HighlightBox }[] {
    const out: { text: string; box: HighlightBox }[] = []
    for (const block of frame.blocks) {
        for (const line of block.lines) {
            if (!INGREDIENT_HEADER.test(line.text)) continue
            const el = line.elements.find(e => INGREDIENT_HEADER.test(e.text))
            out.push(el ? { text: el.text, box: el.box } : { text: line.text, box: line.box })
        }
    }
    return out
}

export function frameCharCount(frame: LiveTextFrame): number {
    return frame.blocks.reduce((n, b) => n + b.lines.reduce((m, l) => m + l.text.length, 0), 0)
}

/**
 * Decides when Live Verdict may start reading: only after an ingredient header (成分, 原料, ...)
 * has been seen inside the scan box. Once found it stays on while text keeps being read, so the
 * user can move down the list after the header has left the box. It switches off again when the
 * box has been (nearly) empty for a while, e.g. the camera moved to another product.
 */
export class LiveIngredientGate {
    private armed = false
    private emptySince = 0

    constructor(
        private readonly emptyMs = 3000,
        private readonly minChars = 4,
    ) {}

    /** Feed the in-box frame; returns whether the ingredient list has been found. */
    update(frame: LiveTextFrame, now: number): boolean {
        const hasHeader = frameHasIngredientHeader(frame)
        if (hasHeader) {
            this.armed = true
            this.emptySince = 0
            return true
        }
        if (!this.armed) return false
        if (frameCharCount(frame) >= this.minChars) {
            this.emptySince = 0
        } else {
            if (!this.emptySince) this.emptySince = now
            if (now - this.emptySince >= this.emptyMs) this.armed = false
        }
        return this.armed
    }

    get found(): boolean {
        return this.armed
    }

    reset() {
        this.armed = false
        this.emptySince = 0
    }
}
