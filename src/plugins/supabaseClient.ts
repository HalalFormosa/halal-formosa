import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Generate a secure dynamic CSRF token during client-side hydration
function generateCsrfToken(): string {
  try {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return Array.from(array, dec => dec.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    // Fallback for environment/test contexts without window.crypto
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}

export const csrfToken = generateCsrfToken();

// The default Web Locks lock evicts a holder that is still running after 5 s, and the evicted
// caller then rejects with 'Lock "lock:sb-...-auth-token" was released because another request
// stole it'. The app is a single webview with many parallel getUser() calls, so we serialise
// auth calls in-process instead. A holder that is stuck (e.g. a hung request after the app was
// backgrounded) is not waited on forever: after the timeout the next caller simply proceeds.
let authQueue: Promise<unknown> = Promise.resolve();
const AUTH_LOCK_WAIT_MS = 5000;

async function inProcessAuthLock<R>(_name: string, acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
    const previous = authQueue;
    let release!: () => void;
    authQueue = new Promise<void>(resolve => { release = resolve; });
    const wait = acquireTimeout > 0 ? Math.min(acquireTimeout, AUTH_LOCK_WAIT_MS) : AUTH_LOCK_WAIT_MS;
    try {
        await Promise.race([previous, new Promise(resolve => setTimeout(resolve, wait))]);
        return await fn();
    } finally {
        release();
    }
}

// Session storage. The default (WebView localStorage) can be wiped by the OS under storage
// pressure (notably iOS), which silently logs the user out. On native we keep the session in
// Capacitor Preferences (SharedPreferences / UserDefaults) as the source of truth and mirror it
// to localStorage. Existing users are migrated transparently: if only localStorage has the
// session we copy it across on first read, so nobody is logged out by this change.
const useNativeStore = Capacitor.isNativePlatform();

function lsGet(key: string): string | null {
    try { return window.localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, value: string) {
    try { window.localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}
function lsRemove(key: string) {
    try { window.localStorage.removeItem(key); } catch { /* storage unavailable */ }
}

const sessionStorageAdapter = {
    async getItem(key: string): Promise<string | null> {
        if (!useNativeStore) return lsGet(key);
        try {
            const { value } = await Preferences.get({ key });
            if (value) return value;
        } catch { /* fall through to localStorage */ }
        const fallback = lsGet(key);
        if (fallback) {
            Preferences.set({ key, value: fallback }).catch(() => { /* best effort */ });
        }
        return fallback;
    },
    async setItem(key: string, value: string): Promise<void> {
        lsSet(key, value);
        if (useNativeStore) {
            try { await Preferences.set({ key, value }); } catch { /* localStorage copy still written */ }
        }
    },
    async removeItem(key: string): Promise<void> {
        lsRemove(key);
        if (useNativeStore) {
            try { await Preferences.remove({ key }); } catch { /* best effort */ }
        }
    }
};

// Same key supabase-js derives by default, so existing sessions keep working.
const authStorageKey = (() => {
    try { return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`; } catch { return 'sb-auth-token'; }
})();

/**
 * The session as last persisted, without triggering a refresh. supabase-js deletes this entry
 * itself when a login is genuinely over (explicit sign-out, or the server rejected the refresh
 * token), so a value here means the user is still logged in even if getSession() came back
 * empty because of a transient network/server problem.
 */
export async function readStoredSession(): Promise<{ user?: any; refresh_token?: string } | null> {
    try {
        const raw = await sessionStorageAdapter.getItem(authStorageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed?.refresh_token ? parsed : null;
    } catch {
        return null;
    }
}

// supabase-js only keeps the session when a refresh fails with a "retryable" error (network
// failure, 502/503/504). Anything else — a 500, a 429 rate limit, a gateway hiccup — is treated
// as "this login is invalid" and wipes the session. Only a 4xx other than 408/429 is the server
// really rejecting the token, so turn the rest into a network-style failure and let it retry.
const baseFetch: typeof fetch = (...args) => fetch(...args);

// Set when the server definitively rejected a refresh token (e.g. refresh_token_not_found).
// Lets the SIGNED_OUT handler tell a genuine server-side logout from the library dropping the
// session for any other reason.
let lastRefreshRejection: { at: number; status: number; code?: string } | null = null;

// Error codes GoTrue returns when it genuinely will not accept this refresh token.
const DEFINITIVE_REFRESH_ERRORS = new Set([
    'refresh_token_not_found',
    'refresh_token_already_used',
    'session_not_found',
    'session_expired',
    'bad_jwt',
    'user_not_found',
    'user_banned',
    'invalid_grant',
]);

const resilientFetch: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    const response = await baseFetch(input, init);
    const isRefresh = url.includes('/auth/v1/token') && url.includes('grant_type=refresh_token');
    if (isRefresh) {
        if (response.status >= 500 || response.status === 429 || response.status === 408) {
            console.warn('[Auth] Refresh got transient HTTP', response.status, '- keeping session and retrying');
            throw new TypeError('Failed to fetch');
        }
        if (response.ok) {
            lastRefreshRejection = null;
        } else {
            // Only a recognisable answer from Supabase's auth server counts as the token being
            // rejected. Anything else (a captive portal, carrier proxy or half-dead connection
            // returning HTML or an empty body) is a connection problem — treat it as one, or
            // supabase-js would delete a perfectly good session.
            let body: any = null;
            try { body = await response.clone().json(); } catch { /* not JSON */ }
            const code: string | undefined = body?.error_code ?? body?.code;
            const definitive =
                (response.status === 400 || response.status === 401 || response.status === 403) &&
                (DEFINITIVE_REFRESH_ERRORS.has(String(code)) || body?.error === 'invalid_grant');
            if (!definitive) {
                console.warn('[Auth] Refresh got an unrecognised HTTP', response.status, '- treating as a connection problem');
                throw new TypeError('Failed to fetch');
            }
            lastRefreshRejection = { at: Date.now(), status: response.status, code };
        }
    }
    return response;
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,     // ✅ Automatically refresh expired tokens
        detectSessionInUrl: true,   // ✅ Parses session from OAuth redirect URL (enabled by default)
        storage: sessionStorageAdapter,
        storageKey: authStorageKey,
        lock: inProcessAuthLock
    },
    global: {
        fetch: resilientFetch,
        headers: {
            'X-App-Client': 'halal-formosa-web',
            'X-CSRF-Token': csrfToken,
            get 'X-Recaptcha-Token'() {
                return (window as any)._recaptchaToken || 'none';
            }
        }
    }
});

// ---- Unexpected sign-out protection ---------------------------------------------------------
// supabase-js wipes the session in several situations that are not a real logout. We keep a
// copy of the last good session; if a SIGNED_OUT arrives that the user did not ask for and the
// server did not reject the token, we restore the session instead of logging the user out.
const BACKUP_KEY = 'halal-auth-session-backup';
const DIAG_KEY = 'halal-auth-diag';
let explicitSignOutInProgress = false;
let lastRecoveryAt = 0;

supabase.auth.onAuthStateChange((event, session) => {
    // No supabase calls in here (auth-js holds its lock while notifying subscribers).
    if (session?.refresh_token && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
        sessionStorageAdapter
            .setItem(BACKUP_KEY, JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }))
            .catch(() => { /* best effort */ });
    }
});

/** Use for every user-initiated logout so it is never mistaken for an unexpected one. */
export async function signOutExplicitly(options?: { scope?: 'global' | 'local' | 'others' }) {
    explicitSignOutInProgress = true;
    try {
        await sessionStorageAdapter.removeItem(BACKUP_KEY);
        return await supabase.auth.signOut(options);
    } finally {
        explicitSignOutInProgress = false;
    }
}

export type SignOutOutcome = 'explicit' | 'rejected' | 'recovered' | 'failed';

async function recordDiag(entry: Record<string, unknown>) {
    try {
        const raw = await sessionStorageAdapter.getItem(DIAG_KEY);
        const list = raw ? JSON.parse(raw) : [];
        list.push({ at: new Date().toISOString(), ...entry });
        await sessionStorageAdapter.setItem(DIAG_KEY, JSON.stringify(list.slice(-10)));
    } catch { /* diagnostics are best effort */ }
}

/** Entries recorded for unexpected sign-outs since the last call (cleared once read). */
export async function takeAuthDiagnostics(): Promise<Record<string, unknown>[]> {
    try {
        const raw = await sessionStorageAdapter.getItem(DIAG_KEY);
        if (!raw) return [];
        await sessionStorageAdapter.removeItem(DIAG_KEY);
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

/**
 * Call after a SIGNED_OUT event (outside the auth callback). Returns 'recovered' if the user is
 * logged in again, otherwise says why the sign-out stands.
 */
export async function recoverUnexpectedSignOut(): Promise<SignOutOutcome> {
    if (explicitSignOutInProgress) return 'explicit';

    const rejection = lastRefreshRejection && Date.now() - lastRefreshRejection.at < 60_000 ? lastRefreshRejection : null;
    if (rejection) {
        await recordDiag({ outcome: 'rejected', status: rejection.status, code: rejection.code });
        return 'rejected';
    }

    // At most one attempt per 30s so a bad backup can never loop.
    if (Date.now() - lastRecoveryAt < 30_000) {
        await recordDiag({ outcome: 'failed', reason: 'recovery throttled' });
        return 'failed';
    }
    lastRecoveryAt = Date.now();

    try {
        const raw = await sessionStorageAdapter.getItem(BACKUP_KEY);
        if (!raw) {
            await recordDiag({ outcome: 'failed', reason: 'no backup' });
            return 'failed';
        }
        const { access_token, refresh_token } = JSON.parse(raw);
        const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (data?.session) {
            await recordDiag({ outcome: 'recovered' });
            return 'recovered';
        }
        await recordDiag({ outcome: 'failed', reason: error?.message ?? 'setSession returned no session' });
    } catch (e: any) {
        await recordDiag({ outcome: 'failed', reason: e?.message ?? 'exception' });
    }
    return 'failed';
}

// 🚀 Clean client specifically for edge functions to avoid CORS preflight failures caused by global custom headers (X-CSRF-Token / X-Recaptcha-Token)
const supabaseFunc = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'sb-edge-functions-noop' // 🔑 Custom key prevents the multiple instances console warning
    }
});

export async function invokeFunction(name: string, options: any = {}) {
    const session = (await supabase.auth.getSession()).data.session;
    const authHeader = session ? `Bearer ${session.access_token}` : `Bearer ${supabaseKey}`;
    
    return supabaseFunc.functions.invoke(name, {
        ...options,
        headers: {
            Authorization: authHeader,
            ...options.headers
        }
    });
}

