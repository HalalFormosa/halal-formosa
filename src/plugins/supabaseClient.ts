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

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true,       // ✅ Enables storing session in localStorage (or Capacitor Preferences on native)
        autoRefreshToken: true,     // ✅ Automatically refresh expired tokens
        detectSessionInUrl: true    // ✅ Parses session from OAuth redirect URL (enabled by default)
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
        detectSessionInUrl: false
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

