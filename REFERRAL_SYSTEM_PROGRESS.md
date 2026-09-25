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
- [ ] **ACTION NEEDED (outside code, one-time setup):** set a new Supabase Edge Function secret `REVENUECAT_SECRET_API_KEY` = your RevenueCat **secret** key (starts `sk_`, from the RevenueCat dashboard → API Keys). Without it, `free_days` mode grants will fail with `"REVENUECAT_SECRET_API_KEY not configured"` (visible in `referral_rewards.rc_grant_error`) while `commission` mode is unaffected. Run: `supabase secrets set REVENUECAT_SECRET_API_KEY=sk_xxx --project-ref svmlwnzmheiishkdwafk`.
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
9. [ ] New composable `src/composables/useAdminReferrals.ts` (admin data).
10. [ ] New view `src/views/admin/ReferralsView.vue` + route `/admin/referrals` (mode toggle, config, funnel, tables) + admin menu link.
11. [x] Extended `supabase/functions/revenuecat-webhook/index.ts`: new branch for the Pro entitlement — upserts `pro_subscriptions` (active on ACTIVE-type events, expired on EXPIRATION), flips matching `referral_redemptions` to `converted` via `process_referral_conversion`, creates `referral_rewards` row(s) per current mode, calls RC promotional-grant API for `free_days` mode and records `granted`/`failed` per reward.
12. [x] Deployed updated edge function (version 4) to project `svmlwnzmheiishkdwafk`. **Needs the `REVENUECAT_SECRET_API_KEY` secret set before free_days mode will actually grant anything — see action item above.**
13. [ ] Add locale strings (`src/locales/en.json`) for new UI text.
14. [ ] Manual smoke test: redeem a code in onboarding, simulate/trigger a webhook conversion event, verify rows + admin dashboard + user page all reflect it correctly in both modes.
15. [ ] Delete this progress file once everything above is done and verified.
