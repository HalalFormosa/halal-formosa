import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Daily health check. Runs ops_health_report(), stores the result in ops_events and posts a Discord alert
// ONLY when something is flagged. Auth: x-cron-secret == CRON_SECRET, or the service role bearer.
// Query: ?dry_run=1 skips Discord, ?hours=N changes the window (default 24).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const DISCORD = Deno.env.get("DISCORD_WEBHOOK_URL_ALERTS") ?? Deno.env.get("DISCORD_WEBHOOK_URL") ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const short = (id: unknown) => String(id ?? "").slice(0, 8);

function describe(flag: string, c: any): string {
  switch (flag) {
    case "scan_log_gap":
      return `• scan_log_gap: ${c.scan_log.missing} successful scans were shown to users but not stored in the scan log (likely rejected by the daily-limit rule). Worst: ${(c.scan_log.worst_users ?? []).map((u: any) => `${short(u.user_id)}…(-${u.missing})`).join(", ")}`;
    case "purchase_not_synced":
      return `• purchase_not_synced: ${c.purchases_not_synced.length} user(s) completed a purchase in the app but the server does not show them as Pro: ${c.purchases_not_synced.map((u: any) => short(u.user_id) + "…").join(", ")}`;
    case "pro_flag_mismatch":
      return `• pro_flag_mismatch: ${c.pro_flag_mismatches} profile(s) whose Pro flag disagrees with their subscription row`;
    case "login_failure_spike":
      return `• login_failure_spike: ${c.login_failures.last_window} failed logins (expected about ${c.login_failures.expected})`;
    case "server_job_errors":
      return `• server_job_errors: ${c.server_job_errors.count} error(s), latest: ${(c.server_job_errors.latest ?? []).map((e: any) => `${e.source}/${e.event}`).join(", ")}`;
    case "webhook_silent":
      return `• webhook_silent: ${c.webhook.purchases_in_window} purchase(s) but the RevenueCat webhook processed no events`;
    case "cron_job_failed":
      return `• cron_job_failed: ${(c.cron_failures ?? []).map((j: any) => j.job).join(", ")}`;
    case "scheduled_call_5xx":
      return `• scheduled_call_5xx: ${c.scheduled_calls.http_5xx} scheduled call(s) got a server error`;
    case "scheduled_call_unauthorized":
      return `• scheduled_call_unauthorized: ${c.scheduled_calls.http_401} scheduled call(s) were rejected with 401 (a rotated CRON_SECRET not updated in cron/vault?)`;
    case "sensitive_change_by_non_admin":
      return `• sensitive_change_by_non_admin: ${(c.sensitive_changes.by_non_admin_users ?? []).map((a: any) => `${a.table}:${a.op}`).join(", ")} changed by a logged-in non-admin`;
    default:
      return `• ${flag}`;
  }
}

Deno.serve(async (req: Request) => {
  const secret = req.headers.get("x-cron-secret") ?? "";
  const auth = req.headers.get("authorization") ?? "";
  if (!((CRON_SECRET !== "" && secret === CRON_SECRET) || auth === `Bearer ${SERVICE_ROLE}`)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run") === "1";
  const hours = Math.min(Math.max(Number(url.searchParams.get("hours") ?? "24") || 24, 1), 168);

  const { data: report, error } = await admin.rpc("ops_health_report", { p_hours: hours });
  if (error || !report) {
    const msg = error?.message ?? "empty report";
    await admin.from("ops_events").insert({ source: "ops-daily-report", level: "error", event: "health_report_failed", detail: { error: msg } });
    if (DISCORD && !dryRun) {
      await fetch(DISCORD, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "Halal Formosa Bot", content: `**🚨 Daily health check FAILED to run**\n${msg}`.slice(0, 1900) }) }).catch(() => {});
    }
    return json({ error: msg }, 500);
  }

  await admin.from("ops_events").insert({
    source: "ops-daily-report", level: report.flagged ? "warn" : "info", event: "health_report", detail: report,
  });

  let alerted = false;
  if (report.flagged && !dryRun && DISCORD) {
    const lines = (report.flags as string[]).map((f) => describe(f, report.checks));
    const content = `**⚠️ Halal Formosa daily health check: ${report.flags.length} issue(s) in the last ${report.window_hours}h**\n${lines.join("\n")}\n\n(details: ops_events, event=health_report)`.slice(0, 1900);
    const res = await fetch(DISCORD, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "Halal Formosa Bot", content }) }).catch(() => null);
    alerted = !!res && res.ok;
  }
  return json({ ok: true, dry_run: dryRun, alerted, discord_configured: DISCORD !== "", report });
});
