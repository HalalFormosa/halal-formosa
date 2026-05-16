import { vi } from 'vitest'

// Global mock for Supabase client
vi.mock('@/plugins/supabaseClient', () => {
    return {
        supabase: {
            auth: {
                getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'mock-user-id' } }, error: null }),
                getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'mock-token' } }, error: null })
            },
            from: vi.fn(() => ({
                insert: vi.fn().mockResolvedValue({ data: null, error: null }),
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: {}, error: null })
            }))
        }
    }
})

// Mock common browser globals if necessary
if (typeof window !== 'undefined') {
    window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    }))
}
