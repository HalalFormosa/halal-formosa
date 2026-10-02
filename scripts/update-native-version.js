// Syncs the native app versions with package.json's "version".
//
// Run automatically by `npm version <patch|minor|major|x.y.z>` (see the "version" script in
// package.json, which also stages the native files so they land in the version commit), or by hand:
//   node scripts/update-native-version.js            # apply
//   node scripts/update-native-version.js --dry-run  # show what would change
//
// What it updates:
//   Android  android/app/build.gradle        versionName = package version; versionCode + 1
//   iOS      ios/App/App.xcodeproj/...       MARKETING_VERSION = package version on EVERY target
//                                            (App, HalalFormosaWidget, OneSignalNotificationServiceExtension);
//                                            CURRENT_PROJECT_VERSION + 1 on each target
//   Web      .env  (local, untracked)        VITE_APP_VERSION, the update checker's fallback
//
// Build numbers only go up when the version actually changes, so running it twice is harmless.
// Each platform is handled independently: one that is already in sync is left alone.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const SEMVER = /^\d+\.\d+\.\d+/

/** Native stores only accept dotted numbers: "2.1.0-beta.1" -> "2.1.0". */
export function nativeVersionOf(packageVersion) {
    const match = SEMVER.exec(packageVersion)
    if (!match) throw new Error(`package.json version "${packageVersion}" is not x.y.z`)
    return match[0]
}

/** android/app/build.gradle: set versionName, bump versionCode when the name changes. */
export function updateGradle(text, version) {
    const name = /(versionName\s*=?\s*)(['"])([^'"\r\n]+)\2/.exec(text)
    const code = /(versionCode\s*=?\s*)(\d+)/.exec(text)
    if (!name || !code) throw new Error('versionName/versionCode not found in build.gradle')
    if (name[3] === version) {
        return { text, changed: false, versionName: name[3], versionCode: Number(code[2]) }
    }
    const nextCode = Number(code[2]) + 1
    const updated = text
        .replace(name[0], `${name[1]}${name[2]}${version}${name[2]}`)
        .replace(code[0], `${code[1]}${nextCode}`)
    return { text: updated, changed: true, versionName: version, versionCode: nextCode, previousName: name[3] }
}

/** project.pbxproj: set MARKETING_VERSION on every target, bump each CURRENT_PROJECT_VERSION by 1. */
export function updateXcodeProject(text, version) {
    const marketing = [...text.matchAll(/MARKETING_VERSION = ([^;\s]+);/g)].map((m) => m[1])
    const builds = [...text.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map((m) => Number(m[1]))
    if (marketing.length === 0 || builds.length === 0) {
        throw new Error('MARKETING_VERSION/CURRENT_PROJECT_VERSION not found in project.pbxproj')
    }
    if (marketing.every((v) => v === version)) {
        return { text, changed: false, versionName: version, builds }
    }
    const updated = text
        .replace(/MARKETING_VERSION = [^;\s]+;/g, `MARKETING_VERSION = ${version};`)
        .replace(/CURRENT_PROJECT_VERSION = (\d+);/g, (_, n) => `CURRENT_PROJECT_VERSION = ${Number(n) + 1};`)
    return {
        text: updated,
        changed: true,
        versionName: version,
        previousNames: [...new Set(marketing)],
        builds: builds.map((n) => n + 1),
    }
}

/** .env: set VITE_APP_VERSION (only if the key already exists; never adds or prints other keys). */
export function updateEnv(text, version) {
    const match = /^(VITE_APP_VERSION=)([^\r\n]*)/m.exec(text)
    if (!match) return { text, changed: false, missing: true }
    if (match[2] === version) return { text, changed: false }
    return { text: text.replace(match[0], `${match[1]}${version}`), changed: true, previous: match[2] }
}

function run(argv) {
    const dryRun = argv.includes('--dry-run')
    const rootFlag = argv.indexOf('--root')
    const root = rootFlag >= 0 ? path.resolve(argv[rootFlag + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
    const version = nativeVersionOf(pkg.version)
    console.log(`Syncing native versions to ${version}${dryRun ? ' (dry run)' : ''}`)

    const targets = [
        { label: 'Android build.gradle', file: 'android/app/build.gradle', update: updateGradle, required: true },
        { label: 'iOS project.pbxproj', file: 'ios/App/App.xcodeproj/project.pbxproj', update: updateXcodeProject, required: false },
        { label: '.env VITE_APP_VERSION', file: '.env', update: updateEnv, required: false },
    ]

    for (const { label, file, update, required } of targets) {
        const full = path.join(root, file)
        if (!fs.existsSync(full)) {
            if (required) throw new Error(`${file} not found`)
            console.log(`- ${label}: skipped (${file} not found)`)
            continue
        }
        const result = update(fs.readFileSync(full, 'utf8'), version)
        if (result.missing) {
            console.log(`- ${label}: skipped (key not present)`)
        } else if (!result.changed) {
            console.log(`- ${label}: already ${version}`)
        } else {
            if (!dryRun) fs.writeFileSync(full, result.text)
            const detail = result.versionCode
                ? `${result.previousName} -> ${version}, versionCode ${result.versionCode}`
                : result.builds
                    ? `${result.previousNames.join('/')} -> ${version}, build numbers ${result.builds.join('/')}`
                    : `${result.previous} -> ${version}`
            console.log(`- ${label}: ${detail}`)
        }
    }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
    try {
        run(process.argv.slice(2))
    } catch (err) {
        console.error(`update-native-version: ${err.message}`)
        process.exit(1)
    }
}
