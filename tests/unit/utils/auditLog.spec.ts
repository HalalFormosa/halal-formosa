import { describe, it, expect } from 'vitest'
import { actionColor, formatAuditValue, prettyTable, toChangeRows, AUDITED_TABLES, REDACTED } from '@/utils/auditLog'

describe('auditLog helpers', () => {
    it('formats values for display', () => {
        expect(formatAuditValue(null)).toBe('∅')
        expect(formatAuditValue(undefined)).toBe('∅')
        expect(formatAuditValue('')).toBe('""')
        expect(formatAuditValue('hello')).toBe('hello')
        expect(formatAuditValue(false)).toBe('false')
        expect(formatAuditValue(42)).toBe('42')
        expect(formatAuditValue({ a: 1 })).toBe('{"a":1}')
        expect(formatAuditValue(['x'.repeat(300)]).endsWith('…')).toBe(true)
    })

    it('shows an update as before/after rows, sorted by column', () => {
        const rows = toChangeRows({
            action: 'approve',
            changes: { approved: { old: false, new: true }, name: { old: 'A', new: 'B' } },
        })
        expect(rows.map(r => r.column)).toEqual(['approved', 'name'])
        expect(rows[0]).toMatchObject({ before: 'false', after: 'true', isDiff: true, redacted: false })
    })

    it('shows create/delete as plain values even if a value looks like a diff', () => {
        const rows = toChangeRows({ action: 'create', changes: { meta: { old: 1, new: 2 }, title: 'T' } })
        expect(rows.every(r => !r.isDiff)).toBe(true)
        expect(rows.find(r => r.column === 'meta')?.after).toBe('{"old":1,"new":2}')
    })

    it('flags redacted values on both sides', () => {
        const rows = toChangeRows({
            action: 'update',
            changes: { phone: { old: REDACTED, new: REDACTED }, email: REDACTED },
        })
        expect(rows.find(r => r.column === 'phone')?.redacted).toBe(true)
        expect(rows.find(r => r.column === 'email')?.redacted).toBe(true)
    })

    it('copes with empty or missing changes', () => {
        expect(toChangeRows({ action: 'update', changes: {} })).toEqual([])
        expect(toChangeRows({ action: 'update', changes: undefined as any })).toEqual([])
    })

    it('maps actions to colours and tidies table names', () => {
        expect(actionColor('approve')).toBe('success')
        expect(actionColor('reject')).toBe('danger')
        expect(actionColor('unapprove')).toBe('warning')
        expect(actionColor('status_change')).toBe('tertiary')
        expect(actionColor('update')).toBe('primary')
        expect(prettyTable('location_edit_requests')).toBe('location edit requests')
    })

    it('lists each audited table once', () => {
        expect(new Set(AUDITED_TABLES).size).toBe(AUDITED_TABLES.length)
        expect(AUDITED_TABLES).toContain('products')
        expect(AUDITED_TABLES).toContain('merchant_stores')
    })
})
