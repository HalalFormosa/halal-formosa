// Patches @capacitor/keyboard's Android native source so hide() always
// forces the WebView's content FrameLayout back to full height, even when
// nothing is focused (the common case: we call Keyboard.hide() defensively
// on app launch/resume, not because an input was actually focused).
//
// Why this exists: with `resizeOnFullScreen: true` (capacitor.config.ts),
// Keyboard.java shrinks the content FrameLayout to whatever height
// `WindowInsetsCompat.Type.ime()` reports as "visible" for. On some
// OEM launchers (seen on ASUS/ROG UI), resuming this app's singleTask
// Activity from the launcher's own search box — which has its own IME
// open — can report a stale/spurious "keyboard visible" inset on this
// Activity's window, shrinking the WebView and never un-shrinking it,
// since the corresponding "hide" transition never fires for a keyboard
// that was never really open in THIS window.
//
// The plugin's own hide() (KeyboardPlugin.hide -> Keyboard.hide) only
// calls InputMethodManager.hideSoftInputFromWindow when
// activity.getCurrentFocus() is non-null, and does nothing else —
// useless for unsticking a shrink that wasn't caused by a real focused
// input. This patch makes hide() ALWAYS reset the content height via
// the existing private possiblyResizeChildOfContent(false), regardless
// of focus state, then still hides the IME if something happens to be
// focused. Re-run automatically after every `npm install` and
// `npx cap sync` (see package.json's postinstall / capacitor:sync:after).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TAG = '[KeyboardResizePatch]';
const target = path.join(
    __dirname,
    '..',
    'node_modules',
    '@capacitor',
    'keyboard',
    'android',
    'src',
    'main',
    'java',
    'com',
    'capacitorjs',
    'plugins',
    'keyboard',
    'Keyboard.java',
);

if (!fs.existsSync(target)) {
    console.log(`${TAG} @capacitor/keyboard not installed, skipping.`);
    process.exit(0);
}

const MARKER = '// PATCHED: always reset resize, even with no focused view';
let src = fs.readFileSync(target, 'utf8');

if (src.includes(MARKER)) {
    console.log(`${TAG} Already patched.`);
    process.exit(0);
}

const original = `    public boolean hide() {
        InputMethodManager inputManager = (InputMethodManager) activity.getSystemService(Context.INPUT_METHOD_SERVICE);
        View v = activity.getCurrentFocus();
        if (v == null) {
            return false;
        } else {
            inputManager.hideSoftInputFromWindow(v.getWindowToken(), InputMethodManager.HIDE_NOT_ALWAYS);
            return true;
        }
    }`;

const patched = `    public boolean hide() {
        ${MARKER}
        // KeyboardPlugin.hide() calls this from Capacitor's background
        // execute() thread pool, not the main thread — but requestLayout()
        // inside possiblyResizeChildOfContent() must run on the UI thread
        // or it throws CalledFromWrongThreadException.
        activity.runOnUiThread(() -> possiblyResizeChildOfContent(false));
        InputMethodManager inputManager = (InputMethodManager) activity.getSystemService(Context.INPUT_METHOD_SERVICE);
        View v = activity.getCurrentFocus();
        if (v == null) {
            return true;
        } else {
            inputManager.hideSoftInputFromWindow(v.getWindowToken(), InputMethodManager.HIDE_NOT_ALWAYS);
            return true;
        }
    }`;

if (!src.includes(original)) {
    console.warn(
        `${TAG} ⚠️  hide() source didn't match the expected text (plugin version may have changed) — skipped, please re-check manually.`,
    );
    process.exit(0);
}

src = src.replace(original, patched);
fs.writeFileSync(target, src, 'utf8');
console.log(`${TAG} ✅ Patched Keyboard.java — hide() now always resets the content resize.`);
