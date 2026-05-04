import { ref, onMounted } from 'vue';

declare global {
  interface Window {
    hcaptcha: {
      render: (container: string | HTMLElement, options: {
        sitekey: string;
        size: 'invisible';
        callback: (token: string) => void;
        'error-callback'?: () => void;
        'expired-callback'?: () => void;
      }) => number;
      execute: (widgetId?: number) => void;
      reset: (widgetId?: number) => void;
    };
  }
}

const HCAPTCHA_SITE_KEY = import.meta.env.VITE_HCAPTCHA_SITE_KEY || '';

export function useHCaptcha() {
  const isScriptLoaded = ref(false);
  const isExecuting = ref(false);
  const token = ref<string | null>(null);
  const error = ref<string | null>(null);
  let widgetId: number | null = null;

  // Load hCaptcha script
  const loadScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.hcaptcha) {
        isScriptLoaded.value = true;
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit';
      script.async = true;
      script.defer = true;

      script.onload = () => {
        isScriptLoaded.value = true;
        resolve();
      };

      script.onerror = () => {
        error.value = 'Failed to load hCaptcha script';
        reject(new Error('Failed to load hCaptcha script'));
      };

      document.head.appendChild(script);
    });
  };

  // Initialize invisible hCaptcha
  const initInvisible = (containerId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!HCAPTCHA_SITE_KEY) {
        reject(new Error('VITE_HCAPTCHA_SITE_KEY is not set'));
        return;
      }

      const checkHCaptcha = () => {
        if (window.hcaptcha && isScriptLoaded.value) {
          try {
            const container = document.getElementById(containerId);
            if (!container) {
              reject(new Error(`Container #${containerId} not found`));
              return;
            }

            widgetId = window.hcaptcha.render(container, {
              sitekey: HCAPTCHA_SITE_KEY,
              size: 'invisible',
              callback: (responseToken: string) => {
                token.value = responseToken;
              },
              'error-callback': () => {
                error.value = 'hCaptcha challenge failed';
                isExecuting.value = false;
              },
              'expired-callback': () => {
                token.value = null;
                error.value = 'hCaptcha token expired. Please try again.';
                isExecuting.value = false;
              }
            });

            resolve();
          } catch (err) {
            reject(err);
          }
        } else {
          setTimeout(checkHCaptcha, 100);
        }
      };

      checkHCaptcha();
    });
  };

  // Execute invisible challenge
  const execute = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!window.hcaptcha || widgetId === null) {
        reject(new Error('hCaptcha not initialized'));
        return;
      }

      token.value = null;
      error.value = null;
      isExecuting.value = true;

      // Set up a watcher for the token
      const unwatch = setInterval(() => {
        if (token.value) {
          clearInterval(unwatch);
          isExecuting.value = false;
          resolve(token.value);
        }
        if (error.value) {
          clearInterval(unwatch);
          isExecuting.value = false;
          reject(new Error(error.value));
        }
      }, 100);

      // Timeout after 2 minutes
      setTimeout(() => {
        clearInterval(unwatch);
        if (!token.value) {
          isExecuting.value = false;
          reject(new Error('hCaptcha verification timed out'));
        }
      }, 120000);

      window.hcaptcha.execute(widgetId);
    });
  };

  // Reset hCaptcha
  const reset = () => {
    if (window.hcaptcha && widgetId !== null) {
      window.hcaptcha.reset(widgetId);
    }
    token.value = null;
    error.value = null;
    isExecuting.value = false;
  };

  onMounted(() => {
    loadScript();
  });

  return {
    isScriptLoaded,
    isExecuting,
    token,
    error,
    loadScript,
    initInvisible,
    execute,
    reset
  };
}
