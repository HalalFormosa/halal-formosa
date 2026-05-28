import { ref, onMounted } from 'vue';

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

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';
const IS_RECAPTCHA_ENABLED = import.meta.env.VITE_RECAPTCHA_ENABLED === 'true';

export function useRecaptcha() {
  const isScriptLoaded = ref(false);
  const isExecuting = ref(false);
  const error = ref<string | null>(null);

  const isCaptchaEnabled = IS_RECAPTCHA_ENABLED;

  // Load Google reCAPTCHA Enterprise script dynamically
  const loadScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!isCaptchaEnabled) {
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
    error,
    loadScript,
    execute
  };
}
