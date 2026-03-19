// utils/xp.ts
export function xpForLevel(level: number): number {
    if (level <= 1) return 0
    return Math.floor(0.5 * level * level * 2.5)
}


export function getLevelFromPoints(points: number): number {
    let lvl = 1
    while (points >= xpForLevel(lvl + 1)) {
        lvl++
    }
    return lvl
}