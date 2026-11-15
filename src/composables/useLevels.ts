import { getLevelFromPoints } from '@/utils/xp'

export function getLevelLabel(points: number): string {
    return `Level ${getLevelFromPoints(points)}`
}

export function getLevelColor(points: number): string {
    const lvl = getLevelFromPoints(points)
    if (lvl < 10) return 'medium'
    if (lvl < 50) return 'primary'
    if (lvl < 100) return 'success'
    return 'warning'
}

// Compact number for tight badge layouts, e.g. 16005 -> "16k", 2855 -> "2.9k".
export function formatCompactPoints(points: number): string {
    const n = points || 0
    if (n < 1000) return `${n}`
    if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
    if (n < 1000000) return `${Math.round(n / 1000)}k`
    return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}M`
}

// RGB triplets matching the ionic color tokens in theme/variables.css,
// used to render soft/translucent tinted badges instead of solid fills.
export function getLevelAccentRgb(points: number): string {
    const color = getLevelColor(points)
    switch (color) {
        case 'primary': return 'var(--ion-color-primary-rgb)'
        case 'success': return 'var(--ion-color-success-rgb)'
        case 'warning': return 'var(--ion-color-warning-rgb)'
        default: return 'var(--ion-color-medium-rgb, 146, 148, 156)'
    }
}
