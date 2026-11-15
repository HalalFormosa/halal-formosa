# Changelog

## 2.1.0

### New features
- **Live Scan.** Point the camera at an ingredient list and get a verdict as you move, with no photo to take. The label is read on your phone (ML Kit on Android, Apple Vision on iOS) and the camera frames are never saved or uploaded. Haram and Syubhah ingredients are outlined on the label with their English name, and a banner shows the verdict, the product name and, when nothing is flagged, how many Muslim-friendly ingredients were found. Live Scan is a Pro feature on Android and iOS. A how-to image and a help sheet explain how to use it, and the screen stays on while you scan.
- **Add unknown products from Live Scan.** When the product is not in the database yet, a card offers "Add this product". It takes one photo, reads the label and opens the usual add-product flow, prefilled the same way a scan does.
- **Quick-swap bar between scan modes.** Auto Capture and Live Scan have a bottom bar to switch between Camera, Auto Capture, Live Scan and Gallery without going back to the scan page.
- **Clearer scan buttons.** Scan Ingredients now has one main "Take a photo" button and three tiles (Gallery, Auto Capture, Live Scan), each with its own icon and a one-line hint. Free users see a gold PRO badge on Live Scan.
- **Auto Scan is now called Auto Capture and Live Verdict is now called Live Scan.** Only the names shown to users changed.
- **Prayer calculation settings.** A gear on the Home prayer card opens a sheet to pick the calculation method (MWL, ISNA, Egypt, Makkah, Karachi, Tehran, Jafari, France, Russia, Singapore), the Asr school (Standard or Hanafi) and a minute adjustment per prayer, so times can match your local mosque. The default is MWL with Standard Asr, so nothing changes unless you choose.
- **Verdict history on the product page.** A product now shows when it was last updated and, after a recent change, "Verdict changed from X on <date>" and whether the ingredient list changed in the same edit.
- **A clear card when a scan fails.** An empty or failed scan now leaves a card with tips and a "Try again" button instead of a toast that disappears after 2 seconds.

### Pro and free limits
- **Scan limit sheet.** When a free user reaches the 5 daily scans, a sheet offers Go Pro, "Earn bonus scans" (add a product or location, up to 3 a day) and Not now. It replaces the old warning toast on the manual scan screen and in Auto Capture. Once the bonus cap is reached the earn option is hidden.
- **AI explanation teaser.** When a scan has flagged ingredients, free users see a card ("Why is E471 flagged?") that explains what Pro adds, instead of a bare unlock button. The verdict itself stays free. The card makes no AI call.
- **Save limit sheet.** Saving a sixth item or location opens a sheet with Go Pro, "Manage saved items" or "Manage saved locations", and Not now. After a purchase the save carries on.
- **Milestone sheet.** Free users on the app see a one-time "You've scanned 10 products" sheet the next time they open Home, listing what Pro adds. It is shown once per user and never during a scan.
- The new sheets are in English, Indonesian and Traditional Chinese. Other languages show English for now.

### Fixes
- **Ingredient matching offline.** If the ingredient dictionary could not refresh, the app now falls back to the last saved copy instead of matching against an empty list.
- **酒 and 醋 inside longer words.** 酒 in 酒石酸 and 醋 in 醋酸 are no longer flagged.
- **Scan counts.** A scan rejected by the daily limit no longer counts as a success.
- **Crashes and sign-in.** Fixed an add-product crash caused by the OCR overlay, and stopped the app from losing its sign-in lock when a request was slow.
- **Translations.** Around 380 messages in 14 languages could not load because placeholder names had been translated, which broke the Home screen. They are restored.
- **Pro purchases are recognised everywhere.** After buying Pro from Search, the badge shop or the scan screen, the app now refreshes your subscription straight away. Previously some of those paths did not.
- **TikTok link.** The profile link, Community Buzz and Malay text now use @halalformosa.
- **Update prompt.** The optional Android "Update available" prompt shows at most once every 7 days. The required-update screen is unchanged.

### Security and dependencies
- **News articles** are sanitised before they are shown, so scripts and event handlers in article HTML are removed.
- **Updated:** vue-i18n 11.2.8 to 11.4.18, Capacitor 8.1.0 to 8.6.0, vite 7.3.1 to 7.3.7, vitest 4.1.6 to 4.1.12, eslint 10.0.2 to 10.14.0, plus fixes for the tar, rollup and minimatch advisories. `npm audit` reports no vulnerabilities.
- **Removed:** Cypress, `@capacitor/assets` and the unused `natural` package. The `test:e2e` script went with Cypress.
- **Added:** `uuid` as a direct dependency (it was only resolving through another package). The lockfile now installs with npm 10.

### Behind the scenes
- **Paywall logging.** Every paywall entry point now logs `pro_paywall_trigger` with its source, and purchase, restore, cancel and failure outcomes share that source. Every new Pro purchase now sends the team the same Discord notice (no change to its content). Sources include `scan_limit`, `save_item_limit`, `save_location_limit`, `scan_milestone`, `search_sort_for_you`, `search_for_you_upgrade_button` and `badge_shop_view`.
- **New activity events:** `ai_teaser_shown`, `save_limit_reached` (with the kind and, for places, the place), `scan_limit_earn_tap`, `scan_milestone_shown`, `visit_prompt_shown`, `visit_prompt_yes`, `visit_prompt_no` (place id and name only) and `home_prayer_settings_open`.
- **TikTok sync.** `fetch-tiktok` now protects the RapidAPI quota: only the server cron can trigger a real run, a run happens at most once every 20 hours, and it is blocked until the next month once the quota is used up. Skips and failures are written to `ops_events`.
- Version bumped to 2.1.0 (Android versionCode 138, iOS synced).
- Brand guidelines now include header and footer rules for generated documents.
- 437 unit tests pass.

### Developer notes
- **One paywall entry.** All screens call `presentProPaywall(source, options)` in `src/utils/proPaywall.ts`. It logs, presents, refreshes and syncs the subscription, and notifies the team. About a dozen per-screen copies were removed. The Profile paywall and the business subscription keep their own flows.
- **Frequency cap.** `src/utils/paywallCap.ts` limits paywalls the app opens by itself to one per session, with a 24 hour pause after a dismissal and 7 days after two. Paywalls the user opens by tapping are never capped.
- **Reusable sheets.** `ProUpsellSheet` is the shared bottom sheet for free-limit moments. `ScanLimitSheet`, `SaveLimitSheet` and `ScanMilestoneSheet` build on it, `AiExplanationTeaser` is the free-user teaser, and `useScanMilestone` decides when the milestone shows. The free save limit (`FREE_SAVE_LIMIT`), the milestone count (`SCAN_MILESTONE`) and the daily contribution cap (`MAX_CONTRIBUTION_SCANS_PER_DAY`) each live in one constant.
- **Native plugins.** New `LiveTextPlugin` for Android (CameraX and ML Kit) and iOS (AVFoundation and Vision), with the same contract. The iOS camera permission text was updated. Live Scan reuses the `ingredient_highlights` dictionary, compiled once, and a tracker smooths per-frame noise.
- **Database.** Adds the RPC `product_verdict_info` (security definer, reads `audit_logs`, returns dates, the previous verdict and a flag only, for approved products). It is already applied to the live project. Its SQL file is local only because `supabase/migrations` is ignored by git, so keep a copy.
- **Needs deploying.** `supabase/functions/fetch-tiktok` needs the `CRON_SECRET` function secret and a cron call that sends it as `x-cron-secret`. Without them, real runs are refused.
- **Strings.** New text is in English, Traditional Chinese, Simplified Chinese, Indonesian and Malay where noted above. Other languages fall back to English. The "Experimental" and "Beta" labels were removed from Live Scan, together with the `scanIngredients.scan.beta` string.
- **Not in this release.** The free trial offer and a product Compare screen were considered and are not built. The text "Auto Capture (BETA)" still sits in some language files but nothing displays it.

## 2.0.2

### New features
- **Yearly survey on Home.** A short card asks one question per session. Every answer earns XP, with a bonus for finishing.
- **Partner pages** now list the partner's stores and products.

### Fixes and improvements
- Smoother barcode scanning, Explore map and search.
- Better highlighting of Chinese ingredients.
- Android bottom sheets are no longer covered by the navigation buttons.
- Signing out now only affects the device you are using.
- Other stability and performance improvements.

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
