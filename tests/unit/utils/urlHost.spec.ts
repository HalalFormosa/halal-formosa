import { describe, it, expect } from 'vitest'
import { urlHostMatches, deepLinkToPath } from '@/utils/urlHost'
import { htmlToText } from '@/utils/htmlToText'

describe('urlHostMatches', () => {
    it('accepts the domain and its subdomains', () => {
        expect(urlHostMatches('https://halalformosa.com/a', 'halalformosa.com')).toBe(true)
        expect(urlHostMatches('https://app.halalformosa.com/a', 'halalformosa.com')).toBe(true)
        expect(urlHostMatches('https://lh3.googleusercontent.com/x', 'googleusercontent.com')).toBe(true)
    })

    it('rejects look-alike hosts that merely contain the domain text', () => {
        expect(urlHostMatches('https://evil.example/?u=halalformosa.com', 'halalformosa.com')).toBe(false)
        expect(urlHostMatches('https://halalformosa.com.evil.example/', 'halalformosa.com')).toBe(false)
        expect(urlHostMatches('https://nothalalformosa.com/', 'halalformosa.com')).toBe(false)
        expect(urlHostMatches('https://evil.example/googleusercontent.com', 'googleusercontent.com')).toBe(false)
    })

    it('rejects empty and invalid input', () => {
        expect(urlHostMatches(null, 'halalformosa.com')).toBe(false)
        expect(urlHostMatches('', 'halalformosa.com')).toBe(false)
        expect(urlHostMatches('not a url', 'halalformosa.com')).toBe(false)
    })
})

describe('deepLinkToPath', () => {
    it('maps the app scheme and our own web links to routes', () => {
        expect(deepLinkToPath('myapp://item/123')).toBe('/item/123')
        expect(deepLinkToPath('https://halalformosa.com/place/9?x=1')).toBe('/place/9?x=1')
        expect(deepLinkToPath('https://app.halalformosa.com/news/abc')).toBe('/news/abc')
    })

    it('ignores look-alike and unrelated links', () => {
        expect(deepLinkToPath('https://evil.example/?u=halalformosa.com')).toBe('')
        expect(deepLinkToPath('https://halalformosa.com.evil.example/place/9')).toBe('')
        expect(deepLinkToPath('https://example.org/place/9')).toBe('')
    })
})

describe('htmlToText', () => {
    it('removes tags and keeps the text', () => {
        expect(htmlToText('<p>Hello <b>world</b></p>')).toBe('Hello world')
    })

    it('does not let nested tag tricks through', () => {
        const out = htmlToText('<scr<script>ipt>alert(1)</scr</script>ipt><img src=x onerror=alert(1)>ok')
        expect(out).not.toMatch(/<\s*script/i)
        expect(out).not.toMatch(/onerror/i)
        expect(out).toContain('ok')
    })

    it('handles empty input', () => {
        expect(htmlToText('')).toBe('')
        expect(htmlToText(null)).toBe('')
    })
})
