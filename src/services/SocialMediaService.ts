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
   */
  normalizeCaption(text: string | null | undefined): string {
    if (!text) return ''
    return text
      .toLowerCase()
      .replace(/#\w+/g, '') // Remove hashtags
      .replace(/[^\p{L}\p{N}\s]/gu, '') // Remove punctuation and emojis
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim()
  },

  /**
   * Extracts meaningful tokens from a caption for similarity checking.
   * Filters out common footer words to avoid false positives.
   */
  getTokens(text: string): Set<string> {
    if (!text) return new Set()
    const footers = ['download', 'application', 'halal', 'formosa', 'taiwan', 'muslim', 'friendly', 'restaurants', 'mosques', 'products', 'follow', '⸻']
    
    return new Set(
      text.toLowerCase()
        .split(/[\s\n\r]+/)
        .map(w => w.replace(/[.,!?;:()"'<>]/g, ''))
        .filter(w => w.length > 2)
        .filter(w => !footers.includes(w))
    )
  },

  /**
   * Calculates Jaccard similarity between two captions based on tokens.
   */
  calculateSimilarity(text1: string, text2: string): number {
    const s1 = this.getTokens(text1)
    const s2 = this.getTokens(text2)
    if (s1.size === 0 || s2.size === 0) return 0
    
    const intersection = new Set([...s1].filter(x => s2.has(x)))
    const union = new Set([...s1, ...s2])
    return intersection.size / union.size
  },

  /**
   * Merges Instagram and TikTok posts, combining duplicates based on similarity and time proximity.
   */
  mergeSocialPosts(igData: any[] | null, ttData: any[] | null): SocialPost[] {
    const results: SocialPost[] = []
    const usedTTIds = new Set<string>()
    const ttPosts = ttData || []
    const igPosts = igData || []

    // 1. Process Instagram posts and look for matches in TikTok
    igPosts.forEach((igPost) => {
      const igTime = dayjs(igPost.timestamp)
      const igNorm = this.normalizeCaption(igPost.caption)
      
      let bestMatch = null
      let highestScore = 0

      ttPosts.forEach((ttPost) => {
        if (usedTTIds.has(ttPost.id)) return

        const ttTime = dayjs(ttPost.timestamp)
        const hourDiff = Math.abs(igTime.diff(ttTime, 'hour'))

        // Only consider matches within 24 hours
        if (hourDiff <= 24) {
          const ttNorm = this.normalizeCaption(ttPost.caption)
          
          // 1. Check for substring/exact match (very high confidence)
          const isHighConfidence = igNorm.length > 20 && (igNorm === ttNorm || igNorm.includes(ttNorm) || ttNorm.includes(igNorm))
          
          // 2. Check for token similarity (useful for translations/edits)
          const similarityScore = this.calculateSimilarity(igPost.caption, ttPost.caption)
          
          if (isHighConfidence || similarityScore > 0.3) {
            // Priority: High confidence > similarity score
            const currentScore = isHighConfidence ? 1.0 : similarityScore
            
            if (currentScore > highestScore) {
              highestScore = currentScore
              bestMatch = ttPost
            }
          }
        }
      })

      if (bestMatch) {
         usedTTIds.add(bestMatch.id)
         results.push({
           ...igPost,
           platform: 'instagram',
           isMultiPlatform: true,
           permalink_ig: igPost.permalink,
           permalink_tt: bestMatch.permalink,
           video_url: igPost.video_url || bestMatch.video_url,
           thumbnail_url: igPost.thumbnail_url || bestMatch.thumbnail_url || igPost.media_url
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
