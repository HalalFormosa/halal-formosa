import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Clipboard } from '@capacitor/clipboard'
import { loadImageFromFile, loadImageFromUrl, roundRect, blobToBase64 } from '@/utils/imageHelpers'
import type { Ref } from 'vue'
import type { IngredientHighlight } from '@/types/Ingredient'
import { extractIonColor } from '@/utils/ingredientHelpers'

interface ShareCardOptions {
    productName?: string
    status?: string
    ingredients: string
    logoUrl?: string
    highlightRules?: HighlightRule[]
}

type HighlightRule = {
    regex: RegExp
    color: string
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default function useShareCard(
    productNameRef: Ref<string>,
    ingredientsTextRef: Ref<string>,
    autoStatusRef: Ref<string>,
    ingredientHighlightsRef: Ref<IngredientHighlight[]>,
    ingredientsTextZhRef: Ref<string>
) {
    const shareCTA = `
Join us and contribute to make Halal Formosa more beneficial for others 🌟
Get it here: bit.ly/DownloadHalalFormosa
(iOS coming soon)
`

    /** Main card builder */
    /** Main card builder */
    async function makeShareCard(
        imageFile: Blob,
        opts: ShareCardOptions
    ): Promise<File> {
        const W = 1080
        const P = 48
        const cardR = 40
        const imageR = 36
        const headerH = 80
        const imgH = 580
        const nameRowH = 72
        const gapAfterName = 16
        const footerH = 72
        const lineH = 42

        const cardX = P / 2
        const cardY = P / 2
        const cardW = W - P
        const contentX = cardX + P
        const contentW = cardW - P * 2

        function resolveColor(name: string): string {
            const map: Record<string, string> = {
                danger: "#e53935",
                warning: "#ff9800",
                primary: "#1e88e5",
                success: "#43a047",
                default: "#111"
            }
            return map[name] || name || map.default
        }

        function colorToStatus(color: string): string {
            switch (extractIonColor(color)) {
                case 'danger': return 'Haram'
                case 'warning': return 'Syubhah'
                case 'primary': return 'Muslim-friendly'
                default: return 'Unknown'
            }
        }

        // --- Draw highlighted ingredients ---
        function drawHighlightedItems(
            ctx: CanvasRenderingContext2D,
            items: string[],
            x: number,
            y: number,
            maxW: number,
            lineH: number,
            draw: boolean,
            cfg: { label?: string; highlightRules?: HighlightRule[] } = {}
        ): number {
            const fontFor = (bold: boolean) =>
                `${bold ? '700' : '400'} 30px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`

            let cx = x, cy = y

            const drawnTokens: { text: string; color: string; bold: boolean; x: number; y: number }[] = []

            const drawToken = (text: string, bold: boolean, color: string) => {
                ctx.font = fontFor(bold)
                const w = ctx.measureText(text).width
                if (cx + w > x + maxW) { cx = x; cy += lineH }
                if (draw) {
                    ctx.fillStyle = resolveColor(color)
                    ctx.fillText(text, cx, cy)
                    drawnTokens.push({ text, color, bold, x: cx, y: cy })
                }
                cx += w
            }

            // Label
            if (cfg.label) {
                ctx.font = fontFor(true)
                const lw = ctx.measureText(cfg.label).width
                if (cx + lw > x + maxW) { cx = x; cy += lineH }
                if (draw) {
                    ctx.fillStyle = '#111'
                    ctx.fillText(cfg.label, cx, cy)
                    drawnTokens.push({ text: cfg.label, color: '#111', bold: true, x: cx, y: cy })
                }
                cx += lw
            }

            // For each ingredient item
            items.forEach((raw, idx) => {
                const item = raw.trim()
                if (!item) return
                if (idx > 0) drawToken(', ', false, '#666')

                let remaining = item

                while (remaining.length > 0) {
                    const normRemaining = remaining.normalize('NFC').trim()
                    let earliestIndex = Infinity
                    let matchedRule: HighlightRule | null = null
                    let matchedText = ''

                    for (const rule of cfg.highlightRules || []) {
                        const m = normRemaining.match(rule.regex)
                        if (m && m.index! < earliestIndex) {
                            earliestIndex = m.index!
                            matchedRule = rule
                            matchedText = m[0]
                        }
                    }

                    if (matchedRule && matchedText) {
                        const pos = normRemaining.indexOf(matchedText)
                        const before = remaining.slice(0, pos)
                        if (before) drawToken(before, false, '#111')

                        drawToken(matchedText, true, matchedRule.color)
                        remaining = remaining.slice(pos + matchedText.length)
                    } else {
                        drawToken(remaining, false, '#111')
                        break
                    }
                }
            })

            return cy + lineH - y
        }

        // --- 1. Pre-measure ---
        const measure = document.createElement('canvas').getContext('2d')!
        measure.font = '400 30px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'
        const items = opts.ingredients
            .replace(/[，、（）()]/g, ',')
            .split(/\s*,\s*/)
            .map(s => s.trim())
            .filter(Boolean)

        const ingredientsYStart = cardY + 20 + headerH + 16 + imgH + 24 + nameRowH + gapAfterName
        const blockH = drawHighlightedItems(
            measure,
            items,
            contentX,
            ingredientsYStart,
            contentW,
            lineH,
            false,
            { label: 'Ingredients: ', highlightRules: opts.highlightRules ?? [] }
        )

        const filteredHighlights = ingredientHighlightsRef.value.filter(h => {
            const aliases: string[] = []
            if (h.keyword) aliases.push(...h.keyword.split('|'))
            if (h.keyword_zh) aliases.push(...h.keyword_zh.split('|'))

            const ingText = (opts.ingredients || '').trim()
            const matchedAlias = aliases.find(a =>
                new RegExp(escapeRegex(a.trim()), 'i').test(ingText)
            )

            return matchedAlias && extractIonColor(h.color) !== 'primary' // only keep actual draws
        })

        let cardH = 72
        let gap = 12

        const cardsBlockH = filteredHighlights.length > 0
            ? filteredHighlights.length * (cardH + gap) - gap + 32
            : 0

        const H = Math.ceil(ingredientsYStart + blockH + cardsBlockH + footerH + cardY)

        // --- 2. Create canvas & draw ---
        const canvas = document.createElement('canvas')
        canvas.width = W
        canvas.height = H
        const ctx = canvas.getContext('2d')!

        // Background
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = '#ffffff'
        ctx.shadowColor = 'rgba(0,0,0,0.08)'
        ctx.shadowBlur = 24
        ctx.shadowOffsetY = 6
        roundRect(ctx, cardX, cardY, cardW, H - P, cardR)
        ctx.fill()
        ctx.shadowColor = 'transparent'

        // Header
        let y = cardY + 20
        if (opts.logoUrl) {
            try {
                const logo = await loadImageFromUrl(opts.logoUrl)
                const s = 42
                ctx.drawImage(logo, contentX, y + (headerH - s) / 2, s, s)
            } catch { /* empty */ }
        }
        ctx.fillStyle = '#111'
        ctx.font = '600 42px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'
        ctx.textBaseline = 'top'
        ctx.fillText('Halal Formosa', contentX + 56, y + 24)
        y += headerH + 16

        // Main image
        const img = await loadImageFromFile(imageFile)
        ctx.save()
        roundRect(ctx, contentX, y, contentW, imgH, imageR)
        ctx.clip()
        {
            const ratio = img.width / img.height
            let drawW = contentW
            let drawH = Math.round(drawW / ratio)
            if (drawH < imgH) { drawH = imgH; drawW = Math.round(drawH * ratio) }
            const dx = contentX + Math.round((contentW - drawW) / 2)
            const dy = y + Math.round((imgH - drawH) / 2)
            ctx.drawImage(img, dx, dy, drawW, drawH)
        }
        ctx.restore()

        // Name + status
        y += imgH + 24
        ctx.fillStyle = '#111'
        ctx.font = '700 44px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'
        const name = (opts.productName || 'Product Name').trim()
        const pillW = 240, pillH = 56
        const nameMaxW = contentW - pillW - 16
        ctx.fillText(name, contentX, y, nameMaxW)

        if (opts.status) {
            const status = opts.status
            const pillX = contentX + contentW - pillW
            const pillY = y - 8
            const pillColor: Record<string, string> = {
                'Halal': '#2dd36f', 'Muslim-friendly': '#3880ff',
                'Syubhah': '#ffc409', 'Haram': '#eb445a'
            }
            ctx.lineWidth = 4
            ctx.strokeStyle = pillColor[status] || '#3880ff'
            roundRect(ctx, pillX, pillY, pillW, pillH, 18)
            ctx.stroke()
            ctx.font = '600 30px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'
            ctx.fillStyle = '#111'
            const textW = ctx.measureText(status).width
            ctx.fillText(status, pillX + (pillW - textW) / 2, pillY + 12)
        }

        // Ingredients
        y = ingredientsYStart
       drawHighlightedItems(
            ctx,
            items,
            contentX,
            y,
            contentW,
            lineH,
            true,
            { label: 'Ingredients: ', highlightRules: opts.highlightRules ?? [] }
        )

        // --- Highlighted Ingredient Cards Block ---
        y += blockH + 22 // some space after ingredients

        cardH = 72
        gap = 12

        filteredHighlights.forEach((h, idx) => {
            const aliases: string[] = []
            if (h.keyword) aliases.push(...h.keyword.split('|'))
            if (h.keyword_zh) aliases.push(...h.keyword_zh.split('|'))

            const ingText = (opts.ingredients || '').trim()
            const matchedAlias = aliases.find(a =>
                new RegExp(escapeRegex(a.trim()), 'i').test(ingText)
            )

            const rawColor = extractIonColor(h.color)
            const color = resolveColor(rawColor)
            const status = colorToStatus(rawColor)

            const cardY = y + idx * (cardH + gap)

            // border
            ctx.lineWidth = 3
            ctx.strokeStyle = color
            roundRect(ctx, contentX, cardY, contentW, cardH, 16)
            ctx.stroke()

            // text
            ctx.font = '500 30px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'
            ctx.fillStyle = '#111'
            ctx.fillText(`${matchedAlias} = ${h.keyword} — ${status}`, contentX + 20, cardY + 25)
        })

        // push y down for footer
        y += filteredHighlights.length * (cardH + gap) + 12

        // Footer (place relative to y, not just H)
        ctx.fillStyle = '#777'
        ctx.font = '500 26px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'
        const year = new Date().getFullYear()
        ctx.fillText(`Halal Formosa © ${year}`, contentX, y)

        const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/jpeg', 0.92))
        return new File([blob], `halal-formosa-card-${Date.now()}.jpg`, { type: 'image/jpeg' })
    }

    /** Fallback share text */
    function shareTextFallback(): Promise<void> | void {
        const text = [
            productNameRef.value ? `Product: ${productNameRef.value}` : null,
            autoStatusRef.value ? `Status: ${autoStatusRef.value}` : null,
            `Ingredients: ${ingredientsTextRef.value}`,
            '',
            shareCTA.trim()
        ].filter(Boolean).join('\n')

        if ((navigator as any).share) {
            return (navigator as any).share({ title: 'Ingredients', text })
        }
        return Clipboard.write({ string: text })
    }

    /** Main share function */
    async function shareResult(originalFile: Ref<Blob | null>): Promise<void> {
        try {
            const imageBlob: Blob | null = originalFile.value
            if (!imageBlob) return shareTextFallback()

            // Build highlight rules
            const highlightRules: HighlightRule[] = []
            ingredientHighlightsRef.value.forEach(h => {
                const aliases: string[] = []
                if (h.keyword) aliases.push(...h.keyword.split('|'))
                if (h.keyword_zh) aliases.push(...h.keyword_zh.split('|'))

                // Find which alias actually exists in the ingredients text
                const ingText = (ingredientsTextZhRef.value || ingredientsTextRef.value) || ''
                const matchedAlias = aliases.find(a =>
                    new RegExp(escapeRegex(a.trim()), 'i').test(ingText)
                )

                if (matchedAlias) {
                    highlightRules.push({
                        regex: new RegExp(escapeRegex(matchedAlias.trim()), 'i'),
                        color: extractIonColor(h.color)
                    })
                }
            })

            const card = await makeShareCard(imageBlob, {
                productName: productNameRef.value,
                status: autoStatusRef.value,
                ingredients: ingredientsTextZhRef.value || ingredientsTextRef.value,
                logoUrl: '/android-chrome-192x192.png',
                highlightRules
            })

            if (Capacitor.getPlatform() !== 'web') {
                const base64 = (await blobToBase64(card)).replace(/^data:image\/\w+;base64,/, '')
                const path = `share/ingredients-${Date.now()}.jpg`

                await Filesystem.writeFile({ path, data: base64, directory: Directory.Cache, recursive: true })
                const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache })

                const can = await Share.canShare()
                if (!can.value) return shareTextFallback()

                await Share.share({
                    title: 'Ingredients',
                    text: [
                        productNameRef.value ? `Product: ${productNameRef.value}` : null,
                        autoStatusRef.value ? `Status: ${autoStatusRef.value}` : null,
                        '',
                        shareCTA.trim()
                    ].filter(Boolean).join('\n'),
                    files: [uri],
                    dialogTitle: 'Share ingredients'
                })
                return
            }

            if ((navigator as any).canShare?.({ files: [card] })) {
                await (navigator as any).share({ title: 'Ingredients', files: [card] })
                return
            }

            const url = URL.createObjectURL(card)
            const a = document.createElement('a')
            a.href = url
            a.download = card.name
            document.body.appendChild(a)
            a.click()
            URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (err) {
            console.error('[shareResult] failed:', err)
            await shareTextFallback()
        }
    }

    return { makeShareCard, shareResult, shareTextFallback }
}
