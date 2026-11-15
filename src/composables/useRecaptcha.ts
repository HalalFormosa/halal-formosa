import { ref, onMounted } from 'vue';
import { Capacitor, registerPlugin } from '@capacitor/core';

declare global {
  interface Window {
    grecaptcha: {
      ready?: (callback: () => void) => void;
      execute?: (siteKey: string, options: { action: string }) => Promise<string>;
      enterprise: {
        ready: (callback: () => void) => void;
        execute: (siteKey: string, options: { action: string }) => Promise<string>;
      };
    };
  }
}

interface RecaptchaNativePlugin {
  execute(options: { siteKey: string; action: string }): Promise<{ token: string }>;
}

const RecaptchaNative = registerPlugin<RecaptchaNativePlugin>('RecaptchaNative');

// The web JS SDK's site key is registered for real web origins, so it doesn't
// validate from inside the Capacitor WebView (fails with BROWSER_ERROR there).
// Android and iOS each use their own platform-type key via the native SDK instead.
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';
const RECAPTCHA_ANDROID_SITE_KEY = import.meta.env.VITE_RECAPTCHA_ANDROID_SITE_KEY || '';
const RECAPTCHA_IOS_SITE_KEY = import.meta.env.VITE_RECAPTCHA_IOS_SITE_KEY || '';
const IS_RECAPTCHA_ENABLED = import.meta.env.VITE_RECAPTCHA_ENABLED === 'true';
const PLATFORM = Capacitor.getPlatform();
const NATIVE_SITE_KEY = PLATFORM === 'android'
  ? RECAPTCHA_ANDROID_SITE_KEY
  : PLATFORM === 'ios'
    ? RECAPTCHA_IOS_SITE_KEY
    : '';

export function useRecaptcha() {
  const isScriptLoaded = ref(false);
  const isExecuting = ref(false);
  const error = ref<string | null>(null);

  const isCaptchaEnabled = IS_RECAPTCHA_ENABLED;
  const activeSiteKey = (PLATFORM === 'android' || PLATFORM === 'ios') ? NATIVE_SITE_KEY : RECAPTCHA_SITE_KEY;

  // Load Google reCAPTCHA Enterprise script dynamically (web only — Android uses
  // the native SDK below, and it isn't needed at all when execute() skips on iOS).
  const loadScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!isCaptchaEnabled || PLATFORM !== 'web') {
        resolve();
        return;
      }
      if (window.grecaptcha && window.grecaptcha.enterprise) {
        isScriptLoaded.value = true;
        resolve();
        return;
      }

      // Check if script is already injected by checking script tags
      const existingScript = document.querySelector('script[src*="/recaptcha/enterprise.js"]');
      if (existingScript) {
        const checkGrecaptcha = () => {
          if (window.grecaptcha && window.grecaptcha.enterprise) {
            window.grecaptcha.enterprise.ready(() => {
              isScriptLoaded.value = true;
              resolve();
            });
          } else {
            setTimeout(checkGrecaptcha, 50);
          }
        };
        checkGrecaptcha();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/enterprise.js?render=${RECAPTCHA_SITE_KEY}`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        const checkReady = () => {
          if (window.grecaptcha && window.grecaptcha.enterprise && typeof window.grecaptcha.enterprise.ready === 'function') {
            window.grecaptcha.enterprise.ready(() => {
              isScriptLoaded.value = true;
              resolve();
            });
          } else {
            setTimeout(checkReady, 50);
          }
        };
        checkReady();
      };

      script.onerror = () => {
        error.value = 'Failed to load reCAPTCHA Enterprise script';
        reject(new Error('Failed to load reCAPTCHA Enterprise script'));
      };

      document.head.appendChild(script);
    });
  };

  // Programmatic Enterprise token generation for a given action
  const execute = (actionName: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!isCaptchaEnabled) {
        resolve('disabled');
        return;
      }

      if (PLATFORM === 'android' || PLATFORM === 'ios') {
        if (!NATIVE_SITE_KEY) {
          reject(new Error(`VITE_RECAPTCHA_${PLATFORM.toUpperCase()}_SITE_KEY is not set`));
          return;
        }
        isExecuting.value = true;
        error.value = null;
        RecaptchaNative.execute({ siteKey: NATIVE_SITE_KEY, action: actionName })
          .then((result) => {
            isExecuting.value = false;
            resolve(result.token);
          })
          .catch((err: any) => {
            isExecuting.value = false;
            error.value = err.message || 'reCAPTCHA native execution failed';
            reject(err);
          });
        return;
      }

      if (!window.grecaptcha || !window.grecaptcha.enterprise) {
        reject(new Error('reCAPTCHA Enterprise script not loaded'));
        return;
      }

      isExecuting.value = true;
      error.value = null;

      window.grecaptcha.enterprise.ready(async () => {
        try {
          if (!RECAPTCHA_SITE_KEY) {
            throw new Error('VITE_RECAPTCHA_SITE_KEY is not set');
          }
          const token = await window.grecaptcha.enterprise.execute(RECAPTCHA_SITE_KEY, { action: actionName });
          isExecuting.value = false;
          resolve(token);
        } catch (err: any) {
          isExecuting.value = false;
          error.value = err.message || 'reCAPTCHA Enterprise execution failed';
          reject(err);
        }
      });
    });
  };

  onMounted(() => {
    loadScript();
  });

  return {
    isExecuting,
    isCaptchaEnabled,
    activeSiteKey,
    error,
    loadScript,
    execute
  };
}
