import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

interface VerifyRequest {
  token: string;
  action?: string;
  siteKey?: string;
}

interface RecaptchaVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  score?: number;
  action?: string;
  'error-codes'?: string[];
}

interface HCaptchaVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

interface RecaptchaEnterpriseResponse {
  name?: string;
  riskAnalysis?: {
    score: number;
    reasons?: string[];
  };
  tokenProperties?: {
    valid: boolean;
    invalidReason?: string;
    hostname?: string;
    action?: string;
    createTime?: string;
  };
}

const RECAPTCHA_SECRET = Deno.env.get('RECAPTCHA_SECRET') || '';
const HCAPTCHA_SECRET = Deno.env.get('HCAPTCHA_SECRET') || '';
// Website key (app.halalformosa.com / localhost). Only valid for tokens generated
// by the web JS SDK — a native app WebView has no matching origin for this key.
const WEB_SITE_KEY = Deno.env.get('RECAPTCHA_SITE_KEY') || '6LfLMwAtAAAAAL5FmTtXMeIkGkBWx7KWkoJJJjne';
// Android-type key (package: com.rcreative.halalformosa), used by the native
// reCAPTCHA Enterprise Android SDK. Site keys are public identifiers (unlike
// RECAPTCHA_SECRET), so it's safe to hardcode here alongside the web key.
const ANDROID_SITE_KEY = Deno.env.get('RECAPTCHA_ANDROID_SITE_KEY') || '6LeZA60tAAAAAOiMsm9Uv8TzQrUVZq86A-jqaxDe';
// iOS-type key (bundle: com.rcreative.halalformosa.ios), used by the native
// reCAPTCHA Enterprise iOS SDK.
const IOS_SITE_KEY = Deno.env.get('RECAPTCHA_IOS_SITE_KEY') || '6Lc1_6wtAAAAAMecPjvZphHPig19R8qw9bcGYbbt';
const ALLOWED_SITE_KEYS = new Set([WEB_SITE_KEY, ANDROID_SITE_KEY, IOS_SITE_KEY]);
const SCORE_THRESHOLD = 0.5; // Standard recommended threshold for bots

serve(async (req: Request) => {
  const requestHeaders = req.headers.get('Access-Control-Request-Headers');

  const headers = new Headers({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': requestHeaders || 'authorization, x-client-info, apikey, content-type, x-csrf-token, x-recaptcha-token'
  });

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers }
      );
    }

    const { token, action, siteKey: requestedSiteKey } = await req.json() as VerifyRequest;

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token is required' }),
        { status: 400, headers }
      );
    }

    // Which key actually generated this token — defaults to the web key for
    // backwards compatibility with clients that don't send siteKey yet.
    const siteKeyToUse = requestedSiteKey && ALLOWED_SITE_KEYS.has(requestedSiteKey)
      ? requestedSiteKey
      : WEB_SITE_KEY;

    // Diagnostics: Check if RECAPTCHA_SECRET is set on Supabase
    if (!RECAPTCHA_SECRET) {
      console.error('❌ RECAPTCHA_SECRET is missing from Supabase environment.');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Configuration Error: RECAPTCHA_SECRET is not configured in Supabase Secrets. Please add it to your Supabase project.'
        }),
        { status: 400, headers }
      );
    }

    const isEnterpriseApiKey = RECAPTCHA_SECRET.startsWith('AIzaSy');

    // 1️⃣ Google reCAPTCHA Enterprise Verification
    if (isEnterpriseApiKey) {
      console.log('🛡️ reCAPTCHA Enterprise path triggered.');
      try {
        const url = `https://recaptchaenterprise.googleapis.com/v1/projects/halal-formosa/assessments?key=${RECAPTCHA_SECRET}`;
        const verifyResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            event: {
              token: token,
              siteKey: siteKeyToUse,
              expectedAction: action || 'LOGIN'
            }
          })
        });

        const enterpriseData = await verifyResponse.json() as RecaptchaEnterpriseResponse;
        console.log('reCAPTCHA Enterprise assessment response:', JSON.stringify(enterpriseData));

        if (!enterpriseData.tokenProperties) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Google reCAPTCHA Enterprise API did not return token properties. Verify that your Google Cloud project is correct and reCAPTCHA Enterprise API is enabled.',
              debug: enterpriseData
            }),
            { status: 400, headers }
          );
        }

        const { valid, invalidReason } = enterpriseData.tokenProperties;
        if (!valid) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `reCAPTCHA Enterprise token invalid: ${invalidReason || 'INVALID_REASON_UNSPECIFIED'}`
            }),
            { status: 400, headers }
          );
        }

        const score = enterpriseData.riskAnalysis?.score ?? 0;
        if (score < SCORE_THRESHOLD) {
          console.warn(`🚨 Blocked low score reCAPTCHA Enterprise assessment: ${score}`);
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Low score indicating potential automated / bot activity',
              score: score
            }),
            { status: 400, headers }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            score: score,
            hostname: enterpriseData.tokenProperties.hostname,
            action: enterpriseData.tokenProperties.action
          }),
          { status: 200, headers }
        );

      } catch (err: any) {
        console.error('reCAPTCHA Enterprise verification error:', err);
        return new Response(
          JSON.stringify({
            success: false,
            error: `reCAPTCHA Enterprise internal exception: ${err.message || err}`
          }),
          { status: 400, headers }
        );
      }
    }

    // 2️⃣ Try Google reCAPTCHA v3 verification (Legacy fallback / standard keys)
    let verifyData: RecaptchaVerifyResponse | null = null;
    let isGoogleToken = false;

    if (!isEnterpriseApiKey) {
      console.log('🔄 Standard reCAPTCHA v3 verification triggered.');
      try {
        const verifyResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            secret: RECAPTCHA_SECRET,
            response: token
          }).toString()
        });

        verifyData = await verifyResponse.json() as RecaptchaVerifyResponse;

        // If Google successfully processed it OR it is not an invalid token error
        const errors = verifyData['error-codes'] || [];
        if (verifyData.success || !errors.includes('invalid-input-response')) {
          isGoogleToken = true;
        }
      } catch (err) {
        console.error('Google reCAPTCHA verification error:', err);
      }
    }

    // 3️⃣ If it is a standard Google token, validate score
    if (isGoogleToken && verifyData) {
      if (!verifyData.success) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'reCAPTCHA v3 siteverify returned failure status.',
            codes: verifyData['error-codes'] || []
          }),
          { status: 400, headers }
        );
      }

      const score = verifyData.score ?? 0;
      if (score < SCORE_THRESHOLD) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Low reCAPTCHA score indicating bot activity',
            score: score
          }),
          { status: 400, headers }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          hostname: verifyData.hostname,
          timestamp: verifyData.challenge_ts,
          score: score,
          action: verifyData.action
        }),
        { status: 200, headers }
      );
    }

    // 4️⃣ hCaptcha fallback (Backwards compatibility for old clients)
    if (HCAPTCHA_SECRET) {
      console.log('🔄 hCaptcha fallback verification triggered.');
      const hCaptchaResponse = await fetch('https://api.hcaptcha.com/siteverify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          secret: HCAPTCHA_SECRET,
          response: token
        }).toString()
      });

      const hData = await hCaptchaResponse.json() as HCaptchaVerifyResponse;

      if (!hData.success) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Captcha verification failed (hCaptcha fallback)',
            codes: hData['error-codes'] || []
          }),
          { status: 400, headers }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          hostname: hData.hostname,
          timestamp: hData.challenge_ts
        }),
        { status: 200, headers }
      );
    }

    // If both failed or are unconfigured
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Captcha verification failed: RECAPTCHA_SECRET was treated as a standard v3 key (starts with 6L), but the token was generated via Enterprise and could not be verified by siteverify. Please configure a Google Cloud API Key (starts with AIzaSy) in Supabase Secrets.',
        googleCodes: verifyData?.['error-codes'] || []
      }),
      { status: 400, headers }
    );

  } catch (error: any) {
    console.error('Verification controller error:', error);
    return new Response(
      JSON.stringify({ success: false, error: `Internal server error: ${error.message || error}` }),
      { status: 500, headers }
    );
  }
});
