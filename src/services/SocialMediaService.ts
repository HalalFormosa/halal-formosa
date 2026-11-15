import dayjs from 'dayjs'

export interface SocialPost {
  id: string
  caption: string
  media_type: string
  media_url: string
  thumbnail_url?: string
  video_url?: string
  permalink: string
  username: string
  timestamp: string
  platform: 'instagram' | 'tiktok'
  isMultiPlatform?: boolean
  permalink_ig?: string
  permalink_tt?: string
}

export const SocialMediaService = {
  /**
   * Normalizes caption text for consistent comparison.
   */
  normalizeCaption(text: string | null | undefined): string {
    if (!text) return ''
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '') // Remove symbols/emojis
      .replace(/\s+/g, ' ')
      .trim()
  },

  /**
   * Checks if two captions are "similar enough" without being translated.
   * Uses a combination of start-of-string matching and word overlap.
   */
  isSimilarCaption(c1: string, c2: string): boolean {
    const n1 = this.normalizeCaption(c1)
    const n2 = this.normalizeCaption(c2)
    
    // 1. Exact normalized match
    if (n1 === n2) return true
    
    // 2. Substantial start match (covers slight edits at the end)
    if (n1.length > 50 && n2.length > 50) {
      if (n1.substring(0, 45) === n2.substring(0, 45)) return true
    }

    // 3. Substring match (one is contained in the other)
    if (n1.length > 20 && n2.length > 20) {
      if (n1.includes(n2) || n2.includes(n1)) return true
    }

    return false
  },

  /**
   * Merges Instagram and TikTok posts.
   * Clusters posts based on caption similarity and 24-hour time proximity.
   */
  mergeSocialPosts(igData: any[] | null, ttData: any[] | null): SocialPost[] {
    const results: SocialPost[] = []
    const usedTTIds = new Set<string>()
    const ttPosts = ttData || []
    const igPosts = igData || []

    // 1. Match IG to TikTok
    igPosts.forEach((igPost) => {
      const igTime = dayjs(igPost.timestamp)
      
      let ttMatch: any = null
      ttPosts.forEach((ttPost) => {
        if (usedTTIds.has(ttPost.id)) return

        const ttTime = dayjs(ttPost.timestamp)
        const hourDiff = Math.abs(igTime.diff(ttTime, 'hour'))

        // Only match within a reasonable window (now 7 days to catch delayed cross-posts)
        if (hourDiff <= 168) {
          if (this.isSimilarCaption(igPost.caption, ttPost.caption)) {
            ttMatch = ttPost
          }
        }
      })

      if (ttMatch) {
        usedTTIds.add(ttMatch.id)
        results.push({
          ...igPost,
          platform: 'instagram',
          isMultiPlatform: true,
          permalink_ig: igPost.permalink,
          permalink_tt: ttMatch.permalink,
          video_url: igPost.video_url || ttMatch.video_url,
          thumbnail_url: igPost.thumbnail_url || ttMatch.thumbnail_url || igPost.media_url
        })
      } else {
        results.push({
          ...igPost,
          platform: 'instagram',
          isMultiPlatform: false
        })
      }
    })

    // 2. Add remaining TikTok posts
    ttPosts.forEach((ttPost) => {
      if (!usedTTIds.has(ttPost.id)) {
        results.push({
          ...ttPost,
          platform: 'tiktok',
          isMultiPlatform: false
        })
      }
    })

    // 3. Sort by timestamp descending
    return results.sort((a, b) => dayjs(b.timestamp).valueOf() - dayjs(a.timestamp).valueOf())
  }
}
