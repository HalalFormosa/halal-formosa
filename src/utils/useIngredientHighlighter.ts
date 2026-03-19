import type { HighlightedIngredient } from '@/types/Ingredient'

export function highlightIngredients(
    text: string,
    dictionary: Record<string, string>,
    productStatus: string
): HighlightedIngredient[] {
    const parts = text.split(',').map(p => p.trim()).filter(Boolean)
    const sortedKeys = Object.keys(dictionary).sort((a, b) => b.length - a.length)

    return parts.map<HighlightedIngredient>(part => {
        let matchedKey: string | null = null

        for (const key of sortedKeys) {
            let regex: RegExp
            if (/[|()[\]\\]/.test(key)) {
                try {
                    regex = new RegExp(key, 'i')
                } catch {
                    continue
                }
            } else {
                const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                regex = new RegExp(`\\b${escaped}\\b`, 'i')
            }

            if (regex.test(part)) {
                matchedKey = key
                break
            }
        }

        if (matchedKey) {
            let color = dictionary[matchedKey]
            // 🔄 downgrade Syubhah → Muslim-friendly
            if (productStatus === 'Muslim-friendly' && color === '--ion-color-warning') {
                color = '--ion-color-primary'
            }

            return {
                html: `<span style="color:var(${color});font-weight:600">${part}</span>`,
                highlighted: true,
            }
        }

        // default: plain text (not in DB)
        return {
            html: part,
            highlighted: false,
        }
    })
}
