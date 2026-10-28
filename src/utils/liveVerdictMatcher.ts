import type { HighlightBox, IngredientHighlight } from '@/types/Ingredient'
import type { LiveTextFrame } from '@/plugins/liveText'

/**
 * Frame-by-frame version of the keyword matching in useOcrPipeline.recheckHighlights.
 * Same dictionary (ingredient_highlights), same `|` variants, same regex convention,
 * but the dictionary is compiled once and matching runs straight on the on-device
 * OCR elements, so there is no translation step and no network call per frame.
 */

const MAX_BOXES_PER_MATCH = 5

/** Lower-case and drop everything that is not a letter or digit (works for Latin and CJK). */
export function normalizeLiveText(text: string): string {
    return text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

/**
 * Normalised text plus, for each normalised character, the index of the raw character it
 * came from. Lets a match be located inside the element's original text (punctuation and
 * spaces included) so its box can be cut to the matched characters.
 */
function normalizeWithMap(raw: string): { norm: string; rawIndex: number[] } {
    let norm = ''
    const rawIndex: number[] = []
    let i = 0
    for (const ch of raw) {
        const kept = normalizeLiveText(ch)
        for (let k = 0; k < kept.length; k++) rawIndex.push(i)
        norm += kept
        i += ch.length
    }
    return { norm, rawIndex }
}

interface TextSpan {
    start: number
    end: number
    box: HighlightBox
    rawLength: number
    rawIndex: number[]
}

/**
 * ML Kit reports a whole Chinese line as one element, so the element's box is far wider
 * than the characters we matched. Characters in a line are about equally wide, so cut the
 * box in proportion to where the matched characters sit in the element's text. Vertical
 * text (a tall, narrow element) is cut top to bottom instead.
 */
function subBox(span: TextSpan, start: number, end: number): HighlightBox {
    const from = Math.max(start, span.start) - span.start
    const to = Math.min(end, span.end) - span.start
    if (from <= 0 && to >= span.end - span.start) return span.box
    if (span.rawLength < 2) return span.box

    const fracStart = span.rawIndex[from] / span.rawLength
    const fracEnd = (span.rawIndex[to - 1] + 1) / span.rawLength
    const { x, y, width, height } = span.box

    if (height > width * 1.5) {
        return { x, y: y + height * fracStart, width, height: height * (fracEnd - fracStart) }
    }
    return { x: x + width * fracStart, y, width: width * (fracEnd - fracStart), height }
}

interface CompiledVariant {
    raw: string
    norm: string
    regex: RegExp | null
}

interface CompiledHighlight {
    highlight: IngredientHighlight
    variants: CompiledVariant[]
}

function compileVariant(raw: string): CompiledVariant | null {
    const trimmed = raw.trim()
    if (!trimmed) return null

    // Same rule as the photo flow: these characters mean "this variant is a regex".
    if (/[[\]\\]/.test(trimmed)) {
        try {
            return { raw: trimmed, norm: normalizeLiveText(trimmed), regex: new RegExp(trimmed, 'gi') }
        } catch {
            return null
        }
    }

    const norm = normalizeLiveText(trimmed)
    if (!norm) return null
    // A lone Latin letter or digit would match nearly everything.
    if (norm.length < 2 && /^[a-z0-9]$/.test(norm)) return null
    return { raw: trimmed, norm, regex: null }
}

export function compileHighlights(highlights: IngredientHighlight[]): CompiledHighlight[] {
    return [...highlights]
        .sort((a, b) => b.keyword.length - a.keyword.length)
        .map(highlight => {
            const variants = [
                ...(highlight.keyword?.split('|') ?? []),
                ...(highlight.keyword_zh?.split('|') ?? []),
            ]
                .map(compileVariant)
                .filter((v): v is CompiledVariant => v !== null)
            return { highlight, variants }
        })
        .filter(c => c.variants.length > 0)
}

function mergeBoxes(boxes: HighlightBox[]): HighlightBox | null {
    if (!boxes.length) return null
    const left = Math.min(...boxes.map(b => b.x))
    const top = Math.min(...boxes.map(b => b.y))
    const right = Math.max(...boxes.map(b => b.x + b.width))
    const bottom = Math.max(...boxes.map(b => b.y + b.height))
    return { x: left, y: top, width: right - left, height: bottom - top }
}

const CJK = /[\u3400-\u9fff]/

/** First plain-text variant of a dictionary field; regex-style variants are not readable names. */
function firstReadable(field: string | undefined): string {
    return (
        (field ?? '')
            .split('|')
            .map(v => v.trim())
            .find(v => v && !/[[\]\\]/.test(v)) ?? ''
    )
}

/**
 * Name to show for a match: the text that was read on the label, with its counterpart from
 * the dictionary in brackets, e.g. "甘油 (glycerin)" for a Chinese label, so people who
 * cannot read Chinese still see what was flagged. Falls back to the matched text alone
 * when the dictionary has no readable counterpart.
 */
export function liveDisplayName(h: IngredientHighlight): string {
    const matched = (h.matchedVariant ?? '').trim() || firstReadable(h.keyword) || firstReadable(h.keyword_zh)
    const counterpart = CJK.test(matched) ? firstReadable(h.keyword) : firstReadable(h.keyword_zh)
    if (!counterpart || counterpart.toLowerCase() === matched.toLowerCase()) return matched
    return `${matched} (${counterpart})`
}

/** Stable identity of a match across frames. */
export function liveMatchKey(h: IngredientHighlight): string {
    return `${h.keyword}|${h.keyword_zh}|${h.matchedVariant ?? ''}`
}

/** Number of letters/digits recognised in the frame; used to tell "no text" from "no flagged text". */
export function countRecognizedChars(frame: LiveTextFrame): number {
    let total = 0
    for (const block of frame.blocks) {
        for (const line of block.lines) total += normalizeLiveText(line.text).length
    }
    return total
}

/**
 * Returns a function that finds every dictionary hit in one OCR frame, each with the
 * pixel boxes (in the frame's own coordinate space) of the words that make it up.
 */
export function createLiveMatcher(highlights: IngredientHighlight[]) {
    const compiled = compileHighlights(highlights)

    return function matchFrame(frame: LiveTextFrame): IngredientHighlight[] {
        const found = new Map<string, IngredientHighlight>()
        const foundNorms: string[] = []

        for (const block of frame.blocks) {
            // Flatten the block so an ingredient wrapped over two lines still matches.
            let fullText = ''
            const spans: TextSpan[] = []
            for (const line of block.lines) {
                for (const el of line.elements) {
                    const { norm, rawIndex } = normalizeWithMap(el.text)
                    if (!norm) continue
                    spans.push({
                        start: fullText.length,
                        end: fullText.length + norm.length,
                        box: el.box,
                        rawLength: el.text.length,
                        rawIndex,
                    })
                    fullText += norm
                }
            }
            if (!fullText) continue

            for (const { highlight, variants } of compiled) {
                for (const variant of variants) {
                    // A longer variant that already matched covers this shorter one.
                    if (!variant.regex && foundNorms.some(n => n.includes(variant.norm) && n !== variant.norm)) continue

                    const ranges = findRanges(fullText, variant)
                    if (!ranges.length) continue

                    const boxes: HighlightBox[] = []
                    for (const [start, end] of ranges) {
                        const merged = mergeBoxes(
                            spans.filter(s => s.start < end && s.end > start).map(s => subBox(s, start, end)),
                        )
                        if (merged) boxes.push(merged)
                    }

                    const candidate: IngredientHighlight = { ...highlight, matchedVariant: variant.raw, boxes }
                    const key = liveMatchKey(candidate)
                    const existing = found.get(key)
                    if (existing) {
                        existing.boxes = [...(existing.boxes ?? []), ...boxes].slice(0, MAX_BOXES_PER_MATCH)
                    } else {
                        found.set(key, { ...candidate, boxes: boxes.slice(0, MAX_BOXES_PER_MATCH) })
                        if (!variant.regex) foundNorms.push(variant.norm)
                    }
                }
            }
        }

        return [...found.values()]
    }
}

function findRanges(fullText: string, variant: CompiledVariant): [number, number][] {
    const ranges: [number, number][] = []

    if (variant.regex) {
        variant.regex.lastIndex = 0
        let m: RegExpExecArray | null
        while (ranges.length < MAX_BOXES_PER_MATCH && (m = variant.regex.exec(fullText)) !== null) {
            if (m[0].length === 0) {
                variant.regex.lastIndex++
                continue
            }
            ranges.push([m.index, m.index + m[0].length])
        }
        return ranges
    }

    let from = 0
    while (ranges.length < MAX_BOXES_PER_MATCH) {
        const at = fullText.indexOf(variant.norm, from)
        if (at === -1) break
        ranges.push([at, at + variant.norm.length])
        from = at + variant.norm.length
    }
    return ranges
}

/**
 * The preview is shown "fill-centre" (scaled to cover the view, overflow cropped).
 * Maps a box from analysis-image pixels to view pixels under that scaling.
 */
export function mapImageBoxToView(
    box: HighlightBox,
    image: { width: number; height: number },
    view: { width: number; height: number },
): HighlightBox {
    const scale = Math.max(view.width / image.width, view.height / image.height)
    const offsetX = (view.width - image.width * scale) / 2
    const offsetY = (view.height - image.height * scale) / 2
    return {
        x: box.x * scale + offsetX,
        y: box.y * scale + offsetY,
        width: box.width * scale,
        height: box.height * scale,
    }
}
