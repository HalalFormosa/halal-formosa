/** Compares dotted app versions numerically ("2.0.10" > "2.0.9"); missing parts count as 0. */
export function compareVersions(a: string, b: string): number {
    const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
    const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
    const len = Math.max(pa.length, pb.length)
    for (let i = 0; i < len; i++) {
        const d = (pa[i] ?? 0) - (pb[i] ?? 0)
        if (d !== 0) return d < 0 ? -1 : 1
    }
    return 0
}

/** True when `version` is older than the minimum. An empty minimum blocks nobody. */
export function isBelowMinimum(version: string, minimum: string | null | undefined): boolean {
    if (!minimum) return false
    return compareVersions(version, minimum) < 0
}

/** The newest version in a list, or null for an empty one. */
export function latestVersion(versions: string[]): string | null {
    return versions.reduce<string | null>((best, v) => (best === null || compareVersions(v, best) > 0 ? v : best), null)
}
