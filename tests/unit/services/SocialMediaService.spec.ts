import { describe, it, expect } from 'vitest'
import { SocialMediaService } from '@/services/SocialMediaService'

describe('SocialMediaService', () => {
    describe('normalizeCaption', () => {
        it('should normalize captions by lowering case and removing emojis and symbols', () => {
            expect(SocialMediaService.normalizeCaption('Hello World! 🌟🔥 #Halal')).toBe('hello world halal')
            expect(SocialMediaService.normalizeCaption(null)).toBe('')
            expect(SocialMediaService.normalizeCaption('   Multiple   Spaces   ')).toBe('multiple spaces')
        })
    })

    describe('isSimilarCaption', () => {
        it('should detect exact matches on normalized text', () => {
            expect(SocialMediaService.isSimilarCaption('Halal Food Taiwan', 'Halal Food Taiwan!')).toBe(true)
        })

        it('should detect substantial start matches for longer text', () => {
            const c1 = 'We are exploring the most amazing Muslim friendly restaurants in downtown Taipei today check out our story'
            const c2 = 'We are exploring the most amazing Muslim friendly restaurants in downtown Taipei today link in bio'
            expect(SocialMediaService.isSimilarCaption(c1, c2)).toBe(true)
        })

        it('should detect substring inclusion for medium length text', () => {
            const c1 = 'Halal Certified Beef Noodles in Kaohsiung'
            const c2 = 'Amazing Halal Certified Beef Noodles in Kaohsiung Taiwan'
            expect(SocialMediaService.isSimilarCaption(c1, c2)).toBe(true)
        })

        it('should return false for completely different captions', () => {
            expect(SocialMediaService.isSimilarCaption('Halal Noodles Taipei', 'Beautiful Mosques in Kaohsiung')).toBe(false)
        })
    })

    describe('mergeSocialPosts', () => {
        it('should merge IG and TT posts correctly when captions and timestamps match', () => {
            const ig: any[] = [{
                id: 'ig1',
                caption: 'Amazing Halal Beef Noodles in Taipei Taiwan',
                timestamp: '2026-05-16T08:00:00Z',
                permalink: 'ig_link'
            }]
            const tt: any[] = [{
                id: 'tt1',
                caption: 'Amazing Halal Beef Noodles in Taipei Taiwan #yummy',
                timestamp: '2026-05-16T09:00:00Z', // 1 hour difference
                permalink: 'tt_link'
            }]

            const merged = SocialMediaService.mergeSocialPosts(ig, tt)
            expect(merged.length).toBe(1)
            expect(merged[0].isMultiPlatform).toBe(true)
            expect(merged[0].permalink_ig).toBe('ig_link')
            expect(merged[0].permalink_tt).toBe('tt_link')
        })

        it('should include unmerged TikTok posts as separate entries', () => {
            const ig: any[] = []
            const tt: any[] = [{
                id: 'tt1',
                caption: 'Unique TikTok Video',
                timestamp: '2026-05-16T09:00:00Z',
                permalink: 'tt_link'
            }]

            const merged = SocialMediaService.mergeSocialPosts(ig, tt)
            expect(merged.length).toBe(1)
            expect(merged[0].platform).toBe('tiktok')
            expect(merged[0].isMultiPlatform).toBe(false)
        })
    })
})
