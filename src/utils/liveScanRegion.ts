import type { HighlightBox } from '@/types/Ingredient'
import type { LiveTextFrame } from '@/plugins/liveText'

/**
 * The scan box on the Live Verdict screen, as fractions (0-1) of the screen. It sits in the upper
 * part; the verdict card covers the bottom, so nothing there is read.
 */
export const LIVE_SCAN_REGION = { left: 0.06, top: 0.14, width: 0.88, height: 0.4 }

type Size = { width: number; height: number }

/** The scan box in screen pixels. */
export function scanRegionInView(view: Size, region = LIVE_SCAN_REGION): HighlightBox {
    return {
        x: region.left * view.width,
        y: region.top * view.height,
        width: region.width * view.width,
        height: region.height * view.height,
    }
}

/**
 * Maps a screen-pixel box back into camera-image pixels. The camera preview fills the screen
 * (centre-cropped), the inverse of `mapImageBoxToView`.
 */
export function mapViewBoxToImage(box: HighlightBox, image: Size, view: Size): HighlightBox {
    const scale = Math.max(view.width / image.width, view.height / image.height)
    const offsetX = (view.width - image.width * scale) / 2
    const offsetY = (view.height - image.height * scale) / 2
    return {
        x: (box.x - offsetX) / scale,
        y: (box.y - offsetY) / scale,
        width: box.width / scale,
        height: box.height / scale,
    }
}

function centreInside(box: HighlightBox, region: HighlightBox): boolean {
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    return cx >= region.x && cx <= region.x + region.width && cy >= region.y && cy <= region.y + region.height
}

/**
 * Keeps only the recognised text whose centre lies inside `region` (camera-image pixels).
 * Words are tested one by one, so a line that runs past the box edge is trimmed rather than
 * dropped or kept whole.
 */
export function cropFrameToRegion(frame: LiveTextFrame, region: HighlightBox): LiveTextFrame {
    const blocks = frame.blocks
        .map(block => ({
            lines: block.lines
                .map(line => {
                    const elements = line.elements.filter(el => centreInside(el.box, region))
                    if (!elements.length) return null
                    if (elements.length === line.elements.length) return line
                    const x1 = Math.min(...elements.map(e => e.box.x))
                    const y1 = Math.min(...elements.map(e => e.box.y))
                    const x2 = Math.max(...elements.map(e => e.box.x + e.box.width))
                    const y2 = Math.max(...elements.map(e => e.box.y + e.box.height))
                    return {
                        text: elements.map(e => e.text).join(/[\u3400-\u9fff]/.test(line.text) ? '' : ' '),
                        box: { x: x1, y: y1, width: x2 - x1, height: y2 - y1 },
                        elements,
                    }
                })
                .filter((l): l is NonNullable<typeof l> => l !== null),
        }))
        .filter(block => block.lines.length > 0)
    return { ...frame, blocks }
}
