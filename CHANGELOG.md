# Changelog

## 2.0.1

### New features
- **"What will you do with this product?"** After an ingredient scan result (Muslim-friendly, Syubhah or Haram), a small card under the product name asks what you will do: *Buy / eat it*, *Skip it* or *Check further*. It is optional and never blocks anything. Ignore it and carry on, or tap once and it replies "Thanks, noted". An info icon (i) explains how answers are used: to improve the app, never shown to other users, and possibly used anonymised in academic research.
- **Research choice in Settings > Privacy.** A new switch, "Include my data in academic research", lets you exclude your data from anonymised academic research at any time. Data is included by default. Turning it off applies to future research use; results that were already published cannot be withdrawn.
- The new text is available in English, Traditional Chinese, Simplified Chinese, Indonesian and Malay. Other languages show English for now.

### Behind the scenes
- Two new activity events: `scan_decision_shown` when the card appears (so the answer rate can be measured) and `scan_decision` when you answer. An answer records the choice, the scan's own rating, the rating you actually saw on screen (the database product's rating when the product is already known) and whether the product is already in the database.
- The team gets an internal Discord notification (contributions channel) for each answer with the product, whether it is in the database, the result, the decision, and the detected Chinese and English ingredients. When the product is already in the database, its photo is attached. **No user name, email or ID is included.** Flagged ingredients are left out for products already in the database or rated Muslim-friendly, and `@everyone`, `@here` and mentions are neutralised.
- Version bumped to 2.0.1 (Android versionCode 136).

### Developer notes
- The card shows on every result that has a verdict. `VITE_DECISION_PROMPT_RATE` (0 to 1, see `.env.example`) can be set to show it on a random share instead.
- Database: adds `user_profiles.research_opt_out` and `research_opt_out_at`, plus private `research.*` views for the study. These migrations are already applied to production. The `supabase/` folder is not in git, so keep a copy of the SQL.
- New `scripts/update-native-version.js`, run by `npm version`, keeps `package.json`, Android (`versionName` and `versionCode`), all three iOS targets (app, widget and OneSignal extension) and `VITE_APP_VERSION` in sync. It replaces the previous `postversion` hook, which pointed at a script that did not exist. Preview it with `node scripts/update-native-version.js --dry-run`.
- iOS is still at 2.0.0 (builds 41, 41 and 27). Run the script before the next iOS release.

## 2.0

### Design
- New "modern-minimal" design system, with tokens rolled out across every screen.
- Redesigned global shell: floating tab bar and refined header.
- Redesigned auth screens (Login/Sign Up/Update Password) and the profile menu.
- Structural redesign of core screens — flatter cards, fewer nested borders/shadows, softer overall look.
- Explore: full-viewport map and a redesigned filter sheet.
- Search, Store, and Trip: floating/frosted search bars, reworked pull-to-refresh, bigger icons, sort moved into the filter sheet.
- Product Details: merged into a single flowing sheet instead of separate cards.

### New features
- Live barcode scanning with a camera overlay, plus barcode scanning from the photo gallery.
- Live auto-scan (OCR) ingredient analysis, with daily scan limits.
- LINE Login, with a linked-accounts view for managing connected sign-in methods.
- In-app notifications: bell icon and badges for approvals, rejections, and report replies.
- Android home screen widget (light/dark, 3 sizes).
- Offline handling for scanning — connectivity checks and clearer offline feedback.
- Admin: overhauled product review UI, photo-based duplicate detection, pending/archived counts on review tabs, and expanded engagement analytics.

### Fixes & reliability
- Improved sign-up and login reliability on native builds.
- Fixed contributor approvals that could silently fail under certain conditions.
- Tightened barcode format validation (UPC-E).
- Fixed daily missions detection scope and notification badge behavior.
- Fixed various layout issues: stray CSS leaks, stretched Android back button, header button styling.
- Fixed ad refresh and OCR keyword matching bugs.

### Removed
- Removed the donation feature (superseded by LINE Login work).

---

## 1.x

_Prior history not yet documented — see git log for details._
