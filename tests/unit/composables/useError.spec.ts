import { describe, it, expect } from 'vitest'
import useError from '@/composables/useError'

describe('useError', () => {
    it('should set error message', () => {
        const { setError, clearError, errorMsg } = useError()
        setError('Network failed')
        expect(errorMsg.value).toBe('Network failed')
        clearError()
        expect(errorMsg.value).toBe('')
    })
})
