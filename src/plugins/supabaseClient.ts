import { createClient } from '@supabase/supabase-js';

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

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true,       // ✅ Enables storing session in localStorage (or Capacitor Preferences on native)
        autoRefreshToken: true,     // ✅ Automatically refresh expired tokens
        detectSessionInUrl: true,   // ✅ Parses session from OAuth redirect URL (enabled by default)
        lock: inProcessAuthLock
    },
    global: {
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

