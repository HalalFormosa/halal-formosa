/**
 * Turns an HTML string into plain text. The markup is parsed into an inert document (no scripts run,
 * nothing is loaded) and only the text content is returned, so tricks like "<scr<script>ipt>" cannot
 * survive the way they can with a tag-stripping regular expression.
 */
export function htmlToText(html: string | null | undefined): string {
    if (!html) return ''
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return (doc.body.textContent || '').trim()
}
