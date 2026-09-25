# Referral System — Implementation Progress

Tracking doc for the referral/commission/free-Pro-days feature. Delete this file once everything below is checked off and verified in production. If a session gets interrupted, read this file to see what's done and pick up at the first unchecked item.

## Design summary (agreed with user)

- Code format: `HF` + 4 uppercase alphanumeric (e.g. `HF7K2M`).
- Tables: `referral_codes`, `referral_redemptions`, `referral_rewards`, `referral_config`, `pro_subscriptions`.
- Redemption happens at Step 1 of the mandatory onboarding wizard (`EditProfileView.vue`) — a **required** choice: enter a code, or explicitly tap "I don't have a referral code". Pre-filled/auto-chosen if a `?ref=CODE` deep link was captured.
- Admin toggle `referral_config.mode`: `'commission' | 'free_days'` (renamed from "discount" — it's a free reward, not a discount).
  - `commission`: referrer earns `commission_amount_ntd` (NT$) per conversion, admin manually marks payouts `paid`.
  - `free_days`: BOTH referrer and referred user get `discount_days_referrer` / `discount_days_referred` free days of "Halal Formosa Pro" granted automatically via RevenueCat's promotional-entitlement REST API when conversion happens — no store config, no signing needed.
- Reward type/amount is **snapshotted at the moment of conversion** (reading whatever mode is active then) — never retroactively recalculated if admin flips the switch later. Nothing is "banked" while a mode is inactive.
- Conversion = referred user's `INITIAL_PURCHASE`/`RENEWAL` webhook event for the "Halal Formosa Pro" entitlement (currently NOT handled at all in `supabase/functions/revenuecat-webhook/index.ts` — it only handles bronze/silver/gold business tiers and silently drops everything else).
- User-facing page: dynamic menu label — **"Invite & Earn NT$"** when mode=commission, **"Invite & Earn Pro"** when mode=free_days. Shows: own code, who referred them, list of people they've referred + status, and their reward totals (NT$ breakdown pending/paid, or free-days granted).
- Admin page `/admin/referrals`: mode toggle + editable reward amounts at top, funnel (codes generated → redeemed → converted, with %), referral-pair detail table, and reward/payout list (mark commission `paid` manually; free_days rows show granted/failed status from the RC API call).

## Open technical items to verify while implementing

- [x] Confirmed RevenueCat's promotional-entitlement grant API: `POST https://api.revenuecat.com/v1/subscribers/{app_user_id}/entitlements/{entitlement_identifier}/promotional`, `Authorization: Bearer <secret key>`, body `{ "end_time_ms": <epoch ms> }` — arbitrary day counts ARE supported this way (the `duration` enum is deprecated). Implemented in the webhook's `grantPromotionalDays()`.
- [x] Resolved — a secret already existed under the name `REVENUECAT_SECRET_KEY` (confirmed via `supabase secrets list --project-ref svmlwnzmheiishkdwafk`; only the digest is visible, not the value, but its presence is enough). The webhook originally read a different, nonexistent name (`REVENUECAT_SECRET_API_KEY`) — fixed to read `REVENUECAT_SECRET_KEY` instead and redeployed (version 5). No new secret needed.
- [ ] The RC entitlement identifier is assumed to be the literal string `"Halal Formosa Pro"` (matches the client-side check in `useSubscriptionStatus.ts`) — confirm this exactly matches the entitlement identifier configured in the RevenueCat dashboard (case/spacing-sensitive), otherwise the webhook will silently fall through to "not a business product" and never process Pro conversions.

## Steps

1. [ ] Read current `EditProfileView.vue`, `router/index.ts`, `main.ts` (relevant sections), `business_account_subscriptions` migration, `revenuecat-webhook/index.ts`, `AnalyticsDashboardView.vue` for exact conventions/patterns to match.
2. [x] Write migration: `referral_codes`, `referral_redemptions`, `referral_rewards`, `referral_config`, `pro_subscriptions` tables + RLS policies. File: `supabase/migrations/20260925000000_referral_system.sql`.
3. [x] Write RPCs: `generate_referral_code_for_user`, `redeem_referral_code`, `get_my_referral_summary`, `admin_update_referral_config`, `admin_referral_funnel`, `admin_referral_list`, `admin_mark_commission_paid`, plus service-role-only `process_referral_conversion` + `apply_pro_subscription` (called from the webhook, not the client).
4. [x] Applied migration to Supabase project `svmlwnzmheiishkdwafk` (via MCP `apply_migration`) — live in the DB already. Also revoked `anon`/`public` EXECUTE on the authenticated/admin RPCs (advisor flagged default PUBLIC grant; functions were already safe internally via `auth.uid()`/`is_admin()` checks, tightened anyway).
5. [x] Updated `main.ts`: `captureReferralCodeFromUrl()` in `handleDeepLink` stores `?ref=CODE` into `localStorage['hf_pending_referral_code']`; `generate_referral_code_for_user` RPC called (fire-and-forget, idempotent) from both the bootstrap `applySession()` path and the `SIGNED_IN` auth-state-change handler (covers fresh sign-up/OAuth completion, not just app relaunch).
6. [x] Updated `EditProfileView.vue` Step 1: required referral-code choice UI (choose / code-entry / applied / none states), pre-fills + auto-applies from `localStorage['hf_pending_referral_code']` on mount, calls `redeem_referral_code` immediately on choice (not deferred to `saveProfile()`, so invalid codes get instant feedback), gates both "Skip" and "Next" on `referralChoiceMade`. Added locale strings to `en.json`.
7. [x] New composable `src/composables/useReferrals.ts` (`loadReferralConfig`, `loadMyReferralSummary`, `inviteMenuLabel` computed).
8. [x] New view `src/views/profile/InviteEarnView.vue` (own code + share, who referred them, referral list with status badges, reward totals in NT$ or free-days depending on mode) + route `/profile/invite-earn` in `router/index.ts` + menu entry in `ProfileView.vue` with dynamic label ("Invite & Earn NT$" / "Invite & Earn Pro").
9. [x] New composable `src/composables/useAdminReferrals.ts` (funnel, referral list with `reward_id`, config get/update, mark-paid).
10. [x] New view `src/views/admin/ReferralsView.vue` + route `/admin/referrals` (mode segment, editable commission/free-days params, funnel numbers, referral-pair list with per-row "Mark paid") + admin menu link in `ProfileView.vue`. Also amended `admin_referral_list()` (live in DB) to return `reward_id` directly instead of a second client-side lookup.
11. [x] Extended `supabase/functions/revenuecat-webhook/index.ts`: new branch for the Pro entitlement — upserts `pro_subscriptions` (active on ACTIVE-type events, expired on EXPIRATION), flips matching `referral_redemptions` to `converted` via `process_referral_conversion`, creates `referral_rewards` row(s) per current mode, calls RC promotional-grant API for `free_days` mode and records `granted`/`failed` per reward.
12. [x] Deployed updated edge function (version 4) to project `svmlwnzmheiishkdwafk`. **Needs the `REVENUECAT_SECRET_API_KEY` secret set before free_days mode will actually grant anything — see action item above.**
13. [ ] Add locale strings (`src/locales/en.json`) for new UI text.
13. [x] Locale strings added to `en.json` for the onboarding referral step (`profile.editProfile.referral*`). Admin dashboard and Invite & Earn page mostly use plain English strings inline (consistent with other admin-only screens in this codebase, e.g. "Merge Duplicate Products").
14. [ ] **Still TODO — not yet done:**
    - Verified `vue-tsc --noEmit` and `eslint` are clean on all new/edited files (only pre-existing, unrelated warnings/errors remain in `App.vue`/`ProfileView.vue`).
    - **Not yet done**: manual end-to-end smoke test (redeem a code in onboarding on a real/simulated device, trigger a real or synthetic RevenueCat webhook event for "Halal Formosa Pro", verify `referral_redemptions`/`referral_rewards` update correctly, verify both the user "Invite & Earn" page and `/admin/referrals` reflect it, in BOTH commission and free_days modes).
    - **Action needed before free_days mode works**: set the `REVENUECAT_SECRET_API_KEY` Supabase Edge Function secret (see note above).
    - **Action needed to verify**: confirm the RevenueCat entitlement identifier really is the literal string `"Halal Formosa Pro"` in the RC dashboard (assumed from `useSubscriptionStatus.ts`).
15. [ ] Delete this progress file once everything above is done and verified.

## Follow-up: QR code sharing (added after initial build)

- [x] Added `qrcode` + `@types/qrcode` npm packages (installed; **not yet committed** — see note below).
- [x] `InviteEarnView.vue` now generates a QR code (client-side, offline-capable, no third-party API call) encoding `https://app.halalformosa.com/signup?ref=HFXXXX` — the same universal-link format `handleDeepLink()` in `main.ts` already parses `?ref=` from. Displayed inline under the code, plus a "Share QR code" button that (on native platforms) writes the PNG to `Directory.Cache` via `@capacitor/filesystem` and shares it as a file through `@capacitor/share`, mirroring the existing pattern in `useSharePlace.ts`. Falls back to the plain link share on web/desktop where there's no filesystem to hand the share sheet a file.
- [x] Added `referral.*` locale namespace to `en.json`.
- **NOTE — package.json/package-lock.json left uncommitted on purpose**: these files already had unrelated pending changes before this session started (an admob → levelplay migration in progress, visible in the initial git status). Adding `qrcode` landed in the same files, so committing them now would mix that unrelated in-progress work into a referral-feature commit. Left unstaged — review and commit `package.json`/`package-lock.json` yourself (they contain both the qrcode addition and your existing pending changes).
- Fixed a bug on the way: the webhook read `REVENUECAT_SECRET_API_KEY`, which was never set — a secret already existed under `REVENUECAT_SECRET_KEY` (confirmed via `supabase secrets list`). Repointed the webhook at the existing name, redeployed as version 5. No new secret needed.

## Follow-up: broader social sharing (added after QR code)

- [x] `shareCode()` now falls back to a clipboard copy + toast when the native/Web Share API throws (e.g. desktop browsers with no Web Share support), instead of silently doing nothing.
- [x] Added a quick-share row (WhatsApp, LINE, Facebook, X, copy-link) using each platform's own share/compose URL, opened via `@capacitor/browser`'s `Browser.open()` (falls back to `window.open` if that throws) — guarantees one-tap sharing to the platforms most relevant to this app's audience regardless of whether the device's own share sheet lists them. No new dependencies needed (`@capacitor/browser` and `@capacitor/clipboard` were already used elsewhere in the app).
- The primary "Share" button (native OS share sheet via `Share.share()`) still covers every other installed app on mobile — this is additive, not a replacement.

## Status as of this checkpoint

All code is written, applied/deployed, and type/lint-clean:
- DB migration `20260925000000_referral_system.sql` — applied live (plus a follow-up tweak adding `reward_id` to `admin_referral_list`, also applied live).
- `supabase/functions/revenuecat-webhook/index.ts` — deployed live (version 4).
- `src/main.ts`, `src/views/profile/EditProfileView.vue`, `src/views/profile/InviteEarnView.vue`, `src/views/admin/ReferralsView.vue`, `src/composables/useReferrals.ts`, `src/composables/useAdminReferrals.ts`, `src/router/index.ts`, `src/views/profile/ProfileView.vue`, `src/locales/en.json` — all committed to git.

What's left is verification, not more building: the two action items above (RC secret key + confirming the entitlement identifier), then a real device/sandbox smoke test end-to-end in both reward modes.
