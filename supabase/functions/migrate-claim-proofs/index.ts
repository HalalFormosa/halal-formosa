// RETIRED (2026-10-07): this one-off migration already ran (legacy claim proof moved from the public
// `location-image` bucket to the private `claim-proofs` bucket). The function is now a stub that refuses
// every request. Safe to delete from the Supabase dashboard (Edge Functions -> migrate-claim-proofs).
Deno.serve(() => new Response("Gone: this one-off migration has been retired", { status: 410 }));
