# Changelog

## 2.0.1

### New features
- **"What will you do with this product?"** After an ingredient scan result (Muslim-friendly, Syubhah or Haram), a small card under the product name asks what you will do: *Buy / eat it*, *Skip it* or *Check further*. It is optional and never blocks anything. Ignore it and carry on, or tap once and it replies "Thanks, noted". An info icon (i) explains how answers are used: to improve the app, never shown to other users, and possibly used anonymised in academic research.
- **Research choice in Settings > Privacy.** A new switch, "Include my data in academic research", lets you exclude your data from anonymised academic research at any time. Data is included by default. Turning it off applies to future research use; results that were already published cannot be withdrawn.
- The new text is available in English, Traditional Chinese, Simplified Chinese, Indonesian and Malay. Other languages show English for now.
- **Split-shift opening hours.** When you add or edit a place (Add Place, Review Locations, Business Manage) you can now enter several opening periods per day, for example 09:00-12:00 and 17:00-22:00. Place details lists every shift of a day. Hours are only changed when you edit them. The fields are wider so times are easier to read.
- **Price range when adding a place.** Add Place now has a price range selector.
- "Add shift" and "Remove shift" are available in English, Traditional Chinese, Simplified Chinese and Indonesian.

### Fixes
- **Pro and trial users no longer hit "scan limit reached" after purchase.** A profile reload that still showed the Free tier could switch a new Pro or trial user back to free. The app now keeps the last answer from RevenueCat and treats you as Pro if either your profile or RevenueCat says so. It only ever upgrades, never downgrades.
- **Review Locations photo upload.** Photos now upload to the correct storage bucket (it pointed at one that does not exist), upload errors are shown, and file names are unique.
- **Priority support wording.** The "24/7" claim is removed from the Priority support description in all 16 languages that had it.
- **Google profile photos load reliably.** On first load your Google photo is copied into our own storage, so it no longer fails when many photos load at once.
- **Privacy hardening.** Sensitive profile details and merchant sender details are now read only through restricted server functions instead of being selected straight from the tables. Nothing changes in how the screens look.
- **Auto Scan sign-in.** The Auto Scan camera now sends your signed-in session to the OCR service instead of only the public key.
- **Admin push links.** Admin notifications open the exact item on its review screen.

### Behind the scenes
- Two new activity events: `scan_decision_shown` when the card appears (so the answer rate can be measured) and `scan_decision` when you answer. An answer records the choice, the scan's own rating, the rating you actually saw on screen (the database product's rating when the product is already known) and whether the product is already in the database.
- The team gets an internal Discord notification (contributions channel) for each answer with the product, whether it is in the database, the result, the decision, and the detected Chinese and English ingredients. When the product is already in the database, its photo is attached. **No user name, email or ID is included.** Flagged ingredients are left out for products already in the database or rated Muslim-friendly, and `@everyone`, `@here` and mentions are neutralised.
- Version bumped to 2.0.1 (Android versionCode 136, iOS build 44).
- Merchant chat inbox no longer shows buyer emails, and notification texts use the signed-in account email instead of reading it from `user_profiles`.

### Developer notes
- The card shows on every result that has a verdict. `VITE_DECISION_PROMPT_RATE` (0 to 1, see `.env.example`) can be set to show it on a random share instead.
- Database: adds `user_profiles.research_opt_out` and `research_opt_out_at`, plus private `research.*` views for the study. These migrations are already applied to production. `supabase/functions` is now tracked in git (migrations and pending scripts are still ignored, so keep a copy of the SQL).
- Privacy stage B: the app reads sensitive profile fields only through `get_my_private_profile()` (own data, new `PrivateProfileService`) and `admin_get_user_contacts()` (admin), and merchant stores through an explicit safe column list (`src/utils/merchantStore.ts`) plus `get_my_merchant_sender()`. Once 2.0.1 is the minimum supported version, the underlying columns can be hidden from other users.
- google-ocr accepts a signed-in user's token or the service role key and rejects the anon key once `app_config.enforce_ocr_auth` is switched on. Do not enable it until older builds are gone.
- New `OpeningHoursEditor` component and `utils/openingHours` store hours as Google-style periods. `scripts/mirror-google-avatars.js` backfills avatars (dry run by default).
- New `scripts/update-native-version.js`, run by `npm version`, keeps `package.json`, Android (`versionName` and `versionCode`), all three iOS targets (app, widget and OneSignal extension) and `VITE_APP_VERSION` in sync. It replaces the previous `postversion` hook, which pointed at a script that did not exist. Preview it with `node scripts/update-native-version.js --dry-run`.
- iOS is synced to 2.0.1 (latest build number 44).

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
