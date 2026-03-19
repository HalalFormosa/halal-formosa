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
