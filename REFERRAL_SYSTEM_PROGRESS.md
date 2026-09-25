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

- [ ] Confirm exact RevenueCat "Grant a promotional entitlement" REST endpoint + accepted `duration` values (may be fixed buckets like daily/weekly/monthly/yearly rather than arbitrary day counts) — map configured day counts to nearest supported bucket if needed.
- [ ] Confirm which RC secret API key is available as a Supabase Edge Function secret for server-to-server calls (separate from the client-side public keys in `.env`).

## Steps

1. [ ] Read current `EditProfileView.vue`, `router/index.ts`, `main.ts` (relevant sections), `business_account_subscriptions` migration, `revenuecat-webhook/index.ts`, `AnalyticsDashboardView.vue` for exact conventions/patterns to match.
2. [x] Write migration: `referral_codes`, `referral_redemptions`, `referral_rewards`, `referral_config`, `pro_subscriptions` tables + RLS policies. File: `supabase/migrations/20260925000000_referral_system.sql`.
3. [x] Write RPCs: `generate_referral_code_for_user`, `redeem_referral_code`, `get_my_referral_summary`, `admin_update_referral_config`, `admin_referral_funnel`, `admin_referral_list`, `admin_mark_commission_paid`, plus service-role-only `process_referral_conversion` + `apply_pro_subscription` (called from the webhook, not the client).
4. [x] Applied migration to Supabase project `svmlwnzmheiishkdwafk` (via MCP `apply_migration`) — live in the DB already. Also revoked `anon`/`public` EXECUTE on the authenticated/admin RPCs (advisor flagged default PUBLIC grant; functions were already safe internally via `auth.uid()`/`is_admin()` checks, tightened anyway).
5. [ ] Update `main.ts`: capture `?ref=CODE` deep link into localStorage; call `generate_referral_code_for_user` once per user (idempotent) alongside existing profile sync.
6. [ ] Update `EditProfileView.vue` Step 1: add required referral-code choice (enter code / "I don't have a code"), pre-fill from captured deep link, call `redeem_referral_code` on wizard completion.
7. [ ] New composable `src/composables/useReferrals.ts` (user-facing data).
8. [ ] New view `src/views/referral/InviteEarnView.vue` + route + dynamic menu label ("Invite & Earn NT$" / "Invite & Earn Pro").
9. [ ] New composable `src/composables/useAdminReferrals.ts` (admin data).
10. [ ] New view `src/views/admin/ReferralsView.vue` + route `/admin/referrals` (mode toggle, config, funnel, tables) + admin menu link.
11. [ ] Extend `supabase/functions/revenuecat-webhook/index.ts`: new branch for the Pro entitlement — upsert `pro_subscriptions`, flip matching `referral_redemptions` to `converted`, create `referral_rewards` row(s) per current mode, call RC promotional-grant API for `free_days` mode.
12. [ ] Deploy updated edge function.
13. [ ] Add locale strings (`src/locales/en.json`) for new UI text.
14. [ ] Manual smoke test: redeem a code in onboarding, simulate/trigger a webhook conversion event, verify rows + admin dashboard + user page all reflect it correctly in both modes.
15. [ ] Delete this progress file once everything above is done and verified.
