import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const androidPath = path.join(rootDir, 'android/app/build.gradle');
const iosPath = path.join(rootDir, 'ios/App/App.xcodeproj/project.pbxproj');

function updateVersion() {
    try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const version = pkg.version;
        console.log(`🚀 Syncing native versions to: ${version}`);

        // --- Android ---
        if (fs.existsSync(androidPath)) {
            let androidContent = fs.readFileSync(androidPath, 'utf8');

            // Update versionName
            androidContent = androidContent.replace(/versionName\s+['"].*?['"]/, `versionName '${version}'`);

            // Increment versionCode (optional but good practice)
            androidContent = androidContent.replace(/versionCode\s+(\d+)/, (match, p1) => {
                const newCode = parseInt(p1) + 1;
                console.log(`🤖 Android versionCode: ${p1} -> ${newCode}`);
                return `versionCode ${newCode}`;
            });

            fs.writeFileSync(androidPath, androidContent);
            console.log('✅ Android version updated.');
        } else {
            console.warn('⚠️ Android build.gradle not found at', androidPath);
        }

        // --- iOS ---
        if (fs.existsSync(iosPath)) {
            let iosContent = fs.readFileSync(iosPath, 'utf8');

            // Update MARKETING_VERSION
            iosContent = iosContent.replace(/MARKETING_VERSION\s+=\s+.*?;/g, `MARKETING_VERSION = ${version};`);

            // Increment CURRENT_PROJECT_VERSION
            iosContent = iosContent.replace(/CURRENT_PROJECT_VERSION\s+=\s+(\d+);/g, (match, p1) => {
                const newVersion = parseInt(p1) + 1;
                console.log(`🍎 iOS CURRENT_PROJECT_VERSION: ${p1} -> ${newVersion}`);
                return `CURRENT_PROJECT_VERSION = ${newVersion};`;
            });

            fs.writeFileSync(iosPath, iosContent);
            console.log('✅ iOS version updated.');
        } else {
            console.warn('⚠️ iOS project.pbxproj not found at', iosPath);
        }

    } catch (err) {
        console.error('❌ Error updating native versions:', err);
        process.exit(1);
    }
}

updateVersion();
