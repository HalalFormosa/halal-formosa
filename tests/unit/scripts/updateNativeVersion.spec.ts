import { describe, it, expect } from 'vitest'
// @ts-ignore - plain ESM script without type declarations
import { nativeVersionOf, updateGradle, updateXcodeProject, updateEnv } from '../../../scripts/update-native-version.js'

const gradle = (name: string, code: number, eol = '\n') =>
    ['android {', '    defaultConfig {', `        versionCode = ${code}`, `        versionName = '${name}'`, '    }', '}', ''].join(eol)

// three targets like the real project: App + widget at build 41, OneSignal extension at 27
const pbx = (name: string) =>
    [
        'CURRENT_PROJECT_VERSION = 41;', `MARKETING_VERSION = ${name};`, 'PRODUCT_BUNDLE_IDENTIFIER = a.ios.widget;',
        'CURRENT_PROJECT_VERSION = 41;', `MARKETING_VERSION = ${name};`, 'PRODUCT_BUNDLE_IDENTIFIER = a.ios;',
        'CURRENT_PROJECT_VERSION = 27;', `MARKETING_VERSION = ${name};`, 'PRODUCT_BUNDLE_IDENTIFIER = a.ios.OneSignalNotificationServiceExtension;',
        '',
    ].join('\r\n')

describe('nativeVersionOf', () => {
    it('keeps x.y.z and strips prerelease suffixes the stores reject', () => {
        expect(nativeVersionOf('2.0.1')).toBe('2.0.1')
        expect(nativeVersionOf('2.1.0-beta.1')).toBe('2.1.0')
    })
    it('rejects non-semver', () => {
        expect(() => nativeVersionOf('latest')).toThrow()
    })
})

describe('updateGradle', () => {
    it('sets versionName and bumps versionCode when the version changes', () => {
        const r = updateGradle(gradle('2.0.0', 135), '2.0.1')
        expect(r.changed).toBe(true)
        expect(r.text).toContain('versionCode = 136')
        expect(r.text).toContain("versionName = '2.0.1'")
        expect(r.versionCode).toBe(136)
    })
    it('is idempotent: leaves versionCode alone when already in sync', () => {
        const r = updateGradle(gradle('2.0.1', 136), '2.0.1')
        expect(r.changed).toBe(false)
        expect(r.text).toContain('versionCode = 136')
    })
    it('keeps Windows line endings and the quote style', () => {
        const input = gradle('2.0.0', 135, '\r\n')
        const out = updateGradle(input, '2.0.1').text
        expect(out.split('\r\n')).toHaveLength(input.split('\r\n').length)
        expect(out).not.toMatch(/[^\r]\n/)
        expect(out).toContain("versionName = '2.0.1'")
    })
    it('supports double quotes and no equals sign', () => {
        const out = updateGradle('versionCode 7\nversionName "1.0.0"\n', '1.1.0').text
        expect(out).toContain('versionCode 8')
        expect(out).toContain('versionName "1.1.0"')
    })
    it('throws a clear error when the fields are missing', () => {
        expect(() => updateGradle('android {}', '2.0.1')).toThrow(/versionName\/versionCode/)
    })
})

describe('updateXcodeProject', () => {
    it('sets the version on every target and bumps each build number by 1', () => {
        const r = updateXcodeProject(pbx('2.0.0'), '2.0.1')
        expect(r.changed).toBe(true)
        expect(r.text.match(/MARKETING_VERSION = 2\.0\.1;/g)).toHaveLength(3)
        expect(r.text.match(/MARKETING_VERSION = 2\.0\.0;/g)).toBeNull()
        expect(r.builds).toEqual([42, 42, 28]) // each target keeps its own numbering
        expect(r.text).toContain('CURRENT_PROJECT_VERSION = 28;')
    })
    it('is idempotent and keeps CRLF line endings', () => {
        expect(updateXcodeProject(pbx('2.0.1'), '2.0.1').changed).toBe(false)
        const out = updateXcodeProject(pbx('2.0.0'), '2.0.1').text
        expect(out).not.toMatch(/[^\r]\n/)
    })
    it('updates all targets even if only one is out of date', () => {
        const mixed = pbx('2.0.1').replace('MARKETING_VERSION = 2.0.1;', 'MARKETING_VERSION = 2.0.0;')
        expect(updateXcodeProject(mixed, '2.0.1').text.match(/MARKETING_VERSION = 2\.0\.1;/g)).toHaveLength(3)
    })
    it('throws when the project has no version fields', () => {
        expect(() => updateXcodeProject('nothing here', '2.0.1')).toThrow()
    })
})

describe('updateEnv', () => {
    it('changes only VITE_APP_VERSION and leaves other keys untouched', () => {
        const env = 'A=1\r\nVITE_APP_VERSION=2.0.0\r\nSECRET=abc\r\n'
        const r = updateEnv(env, '2.0.1')
        expect(r.text).toBe('A=1\r\nVITE_APP_VERSION=2.0.1\r\nSECRET=abc\r\n')
    })
    it('does nothing when the key is absent or already current', () => {
        expect(updateEnv('A=1\n', '2.0.1')).toMatchObject({ changed: false, missing: true })
        expect(updateEnv('VITE_APP_VERSION=2.0.1\n', '2.0.1').changed).toBe(false)
    })
})
