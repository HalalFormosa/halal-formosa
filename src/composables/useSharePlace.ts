import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Clipboard } from '@capacitor/clipboard'
import { blobToBase64, loadImageFromUrl, roundRect } from '@/utils/imageHelpers'

export interface PlaceShareOptions {
    name: string
    type?: string
    imageUrl?: string
    lat: number
    lng: number
}

/** Share text CTA (same spirit as Halal Formosa style) */
const shareCTA = `
Shared via Halal Formosa 🕌
Contribute to our halal map: bit.ly/DownloadHalalFormosa
(iOS coming soon)
`

export default function useSharePlace() {
    /** 🖼️ Create a simple image card */
    async function makeSharePlaceCard(opts: PlaceShareOptions): Promise<File> {
        const W = 1080
        const H = 720
        const R = 36
        const IMG_H = 400

        const canvas = document.createElement('canvas')
        canvas.width = W
        canvas.height = H
        const ctx = canvas.getContext('2d')!

        // === 🌿 Full white background ===
        ctx.fillStyle = '#ffffff'       // ✅ canvas background
        ctx.fillRect(0, 0, W, H)

        // === 🖼️ Inner card area ===
        const cardX = 48
        const cardY = 48
        const cardW = W - 96
        const cardH = H - 96

        // Shadow behind the card
        ctx.shadowColor = 'rgba(0,0,0,0.15)'
        ctx.shadowBlur = 18
        ctx.shadowOffsetY = 6
        roundRect(ctx, cardX, cardY, cardW, cardH, R)
        ctx.fillStyle = '#ffffff'   // ✅ White background
        ctx.fill()
        ctx.shadowColor = 'transparent'

        // Optional: subtle carrot border for elegance
        ctx.lineWidth = 6
        ctx.strokeStyle = '#ff7b00'
        ctx.stroke()


        // === 📸 Place image (centered properly) ===
        if (opts.imageUrl) {
            try {
                const img = await loadImageFromUrl(opts.imageUrl)
                const imgX = cardX + 32
                const imgY = cardY + 32
                const imgW = cardW - 64
                const imgH = IMG_H

                ctx.save()
                roundRect(ctx, imgX, imgY, imgW, imgH, R - 8)
                ctx.clip()

                const ratio = img.width / img.height
                const targetRatio = imgW / imgH
                let drawW, drawH

                // ✅ If image is wider — crop width; if taller — crop height
                if (ratio > targetRatio) {
                    // Image is wider than box → fit height, crop width
                    drawH = imgH
                    drawW = imgH * ratio
                } else {
                    // Image is taller than box → fit width, crop height
                    drawW = imgW
                    drawH = imgW / ratio
                }

                const dx = imgX + (imgW - drawW) / 2
                const dy = imgY + (imgH - drawH) / 2
                ctx.drawImage(img, dx, dy, drawW, drawH)
                ctx.restore()
            } catch {
                console.warn('❌ Failed to load image for card')
            }
        }

        // === 🏷️ Place name ===
        const textStartY = cardY + IMG_H + 90
        ctx.fillStyle = '#424242'
        ctx.font = '700 54px system-ui, -apple-system, Segoe UI, Roboto'
        const name = opts.name.length > 40 ? opts.name.slice(0, 38) + '…' : opts.name
        ctx.fillText(name, cardX + 48, textStartY, cardW - 48)

        // === 🍽️ Category ===
        ctx.font = '400 36px system-ui, -apple-system, Segoe UI, Roboto'
        ctx.fillStyle = '#ffb84d'
        ctx.fillText(opts.type || 'Halal Location', cardX + 48, textStartY + 45, cardW - 48)

        // === 🕌 Footer (simple copyright style) ===
        const year = new Date().getFullYear()
        ctx.font = '400 30px system-ui, -apple-system, Segoe UI, Roboto'
        ctx.fillStyle = '#888'
        ctx.fillText(`Halal Formosa © ${year}`, cardX + 48, cardY + cardH - 30)

        const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/jpeg', 0.92))
        return new File([blob], `halalformosa-place-${Date.now()}.jpg`, { type: 'image/jpeg' })
    }

    /** 🕋 Share the location with image + text */
    /** 🕋 Share the location with image + text */
    async function sharePlace(opts: PlaceShareOptions) {
        const mapUrl = `maps.google.com/?q=${opts.lat},${opts.lng}`
        const text = `${opts.name} (${opts.type || 'Halal Location'})\n📍 Navigate: ${mapUrl}\n\n${shareCTA.trim()}`

        try {
            // === 🧠 Platform check ===
            const isMobile =
                Capacitor.getPlatform() === 'ios' || Capacitor.getPlatform() === 'android'

            // === 📱 Mobile: build and share image card ===
            if (isMobile) {
                const card = await makeSharePlaceCard(opts)
                const base64 = (await blobToBase64(card)).replace(/^data:image\/\w+;base64,/, '')
                const path = `share/places-${Date.now()}.jpg`

                await Filesystem.writeFile({
                    path,
                    data: base64,
                    directory: Directory.Cache,
                    recursive: true,
                })
                const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache })

                await Share.share({
                    title: opts.name,
                    text, // clickable Google Maps link
                    files: [uri],
                    dialogTitle: 'Share place',
                })
                return
            }

            // === 💻 Web/Desktop: fallback to text-only share ===
            if (navigator.share) {
                // Modern browsers support native share without files
                await navigator.share({
                    title: opts.name,
                    text,
                })
            } else {
                // Clipboard fallback
                await Clipboard.write({ string: text })
                alert('📋 Copied place info to clipboard!')
            }
        } catch (err) {
            console.error('Share failed', err)
            // Always ensure text fallback works if something goes wrong
            await Clipboard.write({ string: text })
            alert('📋 Copied place info to clipboard!')
        }
    }



    return { sharePlace }
}
