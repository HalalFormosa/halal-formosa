import type { HighlightedIngredient } from '@/types/Ingredient'

export function highlightIngredients(
    text: string,
    dictionary: Record<string, string>,
    productStatus: string
): HighlightedIngredient[] {
    const parts = text.split(/[,，、]/).map(p => p.trim()).filter(Boolean)
    const sortedKeys = Object.keys(dictionary).sort((a, b) => b.length - a.length)

    return parts.map<HighlightedIngredient>(part => {
        let matchedKey: string | null = null

        for (const key of sortedKeys) {
            let regex: RegExp
            if (/[㐀-鿿]/.test(key)) {
                // A single-character key (e.g. 水) must be the whole segment: as a substring it would
                // also hit longer words like 水解動物蛋白 and wrongly mark them with the short key's colour.
                // Quantities and brackets are ignored, so 水 70% and 水（純水）still count as 水.
                if (key.length === 1) {
                    const bare = part.replace(/[（(][^）)]*[）)]/g, '').replace(/[\d.%％\s]/g, '')
                    if (bare === key) {
                        matchedKey = key
                        break
                    }
                    continue
                }
                // \b never matches around CJK (not \w), so use a plain substring match
                // keys like 脂肪酸甘油[酯脂] are intentional regexes; others are literal
                try {
                    regex = /[()[\]\\]/.test(key)
                        ? new RegExp(key, 'i')
                        : new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
                } catch {
                    continue
                }
            } else if (/[|()[\]\\]/.test(key)) {
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
            // 🔄 downgrade Syubhah & Haram → Muslim-friendly if the product status is Muslim-friendly
            if (productStatus === 'Muslim-friendly') {
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
