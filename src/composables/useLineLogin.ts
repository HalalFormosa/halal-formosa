import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { supabase, invokeFunction } from '@/plugins/supabaseClient';

// LINE Login has no native Supabase provider, so this composable drives a
// manual OAuth code flow: request an authorization code from LINE, hand it
// to the `line-login` edge function (which verifies it and mints a one-time
// Supabase token), then redeem that token with verifyOtp().
//
// Native apps can't use a custom-scheme redirect_uri with LINE (their
// callback URL validator rejects non-http(s) URLs), so on native we send
// LINE to an HTTPS "bounce" page (/auth/line/native-callback) that just
// forwards the resulting code+state to myapp://callback, where the existing
// deep-link handler in main.ts picks it back up inside the app and finishes
// the flow here with `native: true`.

const STATE_KEY = 'line_login_state';
const NONCE_KEY = 'line_login_nonce';
const REDIRECT_KEY = 'line_login_redirect';

function randomToken(): string {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function getLineWebCallbackUrl(): string {
  return window.location.origin + '/auth/line/callback';
}

export function getLineNativeCallbackUrl(): string {
  return window.location.origin + '/auth/line/native-callback';
}

export async function startLineLogin(afterLoginPath = '/'): Promise<void> {
  const state = randomToken();
  const nonce = randomToken();
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(NONCE_KEY, nonce);
  sessionStorage.setItem(REDIRECT_KEY, afterLoginPath);

  const isNative = Capacitor.isNativePlatform();
  const redirectUri = isNative ? getLineNativeCallbackUrl() : getLineWebCallbackUrl();
  const channelId = import.meta.env.VITE_LINE_LOGIN_CHANNEL_ID as string;

  const authorizeUrl = 'https://access.line.me/oauth2/v2.1/authorize?' + new URLSearchParams({
    response_type: 'code',
    client_id: channelId,
    redirect_uri: redirectUri,
    state,
    scope: 'profile openid email',
    nonce,
  }).toString();

  if (isNative) {
    await Browser.open({ url: authorizeUrl });
  } else {
    window.location.href = authorizeUrl;
  }
}

export async function completeLineLogin(code: string, state: string, opts: { native?: boolean } = {}): Promise<string> {
  const savedState = sessionStorage.getItem(STATE_KEY);
  const nonce = sessionStorage.getItem(NONCE_KEY) ?? undefined;
  const redirectPath = sessionStorage.getItem(REDIRECT_KEY) || '/';
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(NONCE_KEY);
  sessionStorage.removeItem(REDIRECT_KEY);

  if (!savedState || !state || state !== savedState) {
    throw new Error('Your LINE login request expired or could not be verified. Please try again.');
  }

  const redirectUri = opts.native ? getLineNativeCallbackUrl() : getLineWebCallbackUrl();

  const { data, error } = await invokeFunction('line-login', {
    body: { code, redirectUri, nonce },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  // generateLink returns a pre-hashed token; it must be redeemed via
  // `token_hash`, not `token` (which expects the raw, unhashed value and
  // hashes it again internally, so passing the hashed value there always
  // fails as "expired or invalid").
  const { error: otpError } = await supabase.auth.verifyOtp({
    token_hash: data.token_hash,
    type: 'magiclink',
  });
  if (otpError) throw otpError;

  return redirectPath;
}
