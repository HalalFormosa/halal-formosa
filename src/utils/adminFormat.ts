// Small formatting helpers shared by the operations admin pages.

export function fmtDateTime(iso: string | null | undefined, locale: string): string {
    if (!iso) return '–'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '–'
    return d.toLocaleString(locale, { timeZone: 'Asia/Taipei', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function fmtDay(iso: string | null | undefined, locale: string): string {
    if (!iso) return '–'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '–'
    return d.toLocaleDateString(locale, { timeZone: 'Asia/Taipei', year: 'numeric', month: 'short', day: 'numeric' })
}

/** First 8 characters of an id, enough to tell rows apart without printing a whole uuid. */
export function shortId(id: string | null | undefined): string {
    return id ? id.slice(0, 8) : '–'
}

/** Percentage of `part` in `whole`, rounded; 0 when there is nothing to divide by. */
export function pct(part: number, whole: number): number {
    return whole > 0 ? Math.round((part / whole) * 100) : 0
}

/** Pretty JSON for a details box, shortened so one huge payload cannot flood the page. */
export function prettyJson(value: unknown, max = 1500): string {
    let s: string
    try {
        s = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
    } catch {
        s = String(value)
    }
    s = s ?? ''
    return s.length > max ? s.slice(0, max) + '…' : s
}
