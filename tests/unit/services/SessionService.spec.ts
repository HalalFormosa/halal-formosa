import { describe, it, expect, beforeEach } from 'vitest'
import SessionService from '@/services/SessionService'

describe('SessionService', () => {
    beforeEach(() => {
        // Force a reset before each test to ensure isolation
        SessionService.resetSession()
    })

    it('should generate a valid UUID session ID', () => {
        const id = SessionService.getSessionId()
        // Simple regex check for standard UUID v4 format
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    it('should return the same session ID on subsequent calls', () => {
        const id1 = SessionService.getSessionId()
        const id2 = SessionService.getSessionId()
        const id3 = SessionService.getSessionId()
        
        expect(id1).toBe(id2)
        expect(id2).toBe(id3)
    })

    it('should generate a new session ID after resetSession is called', () => {
        const id1 = SessionService.getSessionId()
        SessionService.resetSession()
        const id2 = SessionService.getSessionId()
        
        expect(id1).not.toBe(id2)
    })
})
