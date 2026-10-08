import type { RouteLocationNormalized } from 'vue-router'

type RouteLike = Pick<RouteLocationNormalized, 'path' | 'name' | 'matched'>

/**
 * The route *pattern* ('/item/:barcode'), never the concrete URL. That keeps barcodes, ids, tokens and
 * query strings out of the log and makes screens groupable. Unmatched URLs (404s) are never echoed back.
 */
export function screenPattern(route: RouteLike): string {
    const leaf = route.matched[route.matched.length - 1]
    return leaf ? (leaf.path || '/') : '(unmatched)'
}

export interface ScreenViewDetail {
    screen: string
    from: string | null
    name?: string
}

/**
 * What to log for a navigation, or null when it is not a new screen: a change of only the query string or
 * hash stays on the same page, and a first load has no previous screen.
 */
export function buildScreenView(to: RouteLike, from: RouteLike): ScreenViewDetail | null {
    if (to.path === from.path) return null

    const hasFrom = from.matched.length > 0
    return {
        screen: screenPattern(to),
        from: hasFrom ? screenPattern(from) : null,
        ...(typeof to.name === 'string' ? { name: to.name } : {}),
    }
}
