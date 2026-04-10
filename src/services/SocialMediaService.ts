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
   * Normalizes caption text for fuzzy matching by:
   * 1. Converting to lowercase
   * 2. Removing hashtags
   * 3. Removing extra whitespace/newlines
   * 4. Removing special characters/emojis (optional, but keeping it simple for now)
   */
  normalizeCaption(text: string | null | undefined): string {
    if (!text) return ''
    return text
      .toLowerCase()
      .replace(/#\w+/g, '') // Remove hashtags
      .replace(/[^\p{L}\p{N}\s]/gu, '') // Remove punctuation and emojis for stricter text match
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim()
  },

  /**
   * Merges Instagram and TikTok posts, combining duplicates based on similar captions.
   * Prefers Instagram's video_url and media_url for combined items.
   */
  mergeSocialPosts(igData: any[] | null, ttData: any[] | null): SocialPost[] {
    const results: SocialPost[] = []
    const usedTTIds = new Set<string>()
    const ttPosts = ttData || []
    const igPosts = igData || []

    // 1. Process Instagram posts and look for matches in TikTok
    igPosts.forEach((igPost) => {
      const igNorm = this.normalizeCaption(igPost.caption)
      
      let ttMatch = null
      if (igNorm.length > 10) { // Only match if caption is substantial
        ttMatch = ttPosts.find((ttPost) => {
          if (usedTTIds.has(ttPost.id)) return false
          const ttNorm = this.normalizeCaption(ttPost.caption)
          return ttNorm.length > 10 && (igNorm === ttNorm || igNorm.includes(ttNorm) || ttNorm.includes(igNorm))
        })
      }

      if (ttMatch) {
        usedTTIds.add(ttMatch.id)
        results.push({
          ...igPost,
          platform: 'instagram',
          isMultiPlatform: true,
          permalink_ig: igPost.permalink,
          permalink_tt: ttMatch.permalink,
          // Prefer IG video, but fallback to TT if IG is empty
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
