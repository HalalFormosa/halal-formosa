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
const resilientFetch: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    const response = await baseFetch(input, init);
    if (
        url.includes('/auth/v1/token') &&
        url.includes('grant_type=refresh_token') &&
        (response.status >= 500 || response.status === 429 || response.status === 408)
    ) {
        console.warn('[Auth] Refresh got transient HTTP', response.status, '- keeping session and retrying');
        throw new TypeError('Failed to fetch');
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

