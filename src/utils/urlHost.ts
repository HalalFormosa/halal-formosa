// Host checks must look at the parsed hostname. A plain substring test such as
// url.includes('halalformosa.com') also matches https://evil.example/?x=halalformosa.com
// or https://halalformosa.com.evil.example, so it cannot be used to trust a URL.

/** True when `url` is a valid URL whose hostname is `domain` or one of its subdomains. */
export function urlHostMatches(url: string | null | undefined, domain: string): boolean {
    if (!url) return false
    try {
        const host = new URL(url).hostname.toLowerCase()
        const d = domain.toLowerCase()
        return host === d || host.endsWith('.' + d)
    } catch {
        return false
    }
}

/**
 * Maps an incoming deep link to an in-app route: `myapp://item/123` -> `/item/123`, and
 * `https://halalformosa.com/place/9?x=1` (or any subdomain) -> `/place/9?x=1`.
 * Returns '' for anything else, including look-alike hosts.
 */
export function deepLinkToPath(url: string): string {
    if (url.startsWith('myapp://')) return url.replace('myapp://', '/')
    if (!urlHostMatches(url, 'halalformosa.com')) return ''
    const u = new URL(url)
    return u.pathname + u.search
}
