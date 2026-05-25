import { ref } from 'vue';

const BOT_STORAGE_KEY = 'hf_bot_shield_flag';

// Reactive bot detection flag initialized from localStorage
export const isBotDetected = ref<boolean>(
  localStorage.getItem(BOT_STORAGE_KEY) === 'true'
);

/**
 * Performs multiple low-overhead browser-level checks to detect standard headless / automation bots.
 * @returns true if client is identified as a bot, false otherwise.
 */
export function performBotChecks(): boolean {
  // If already flagged, skip check and return true
  if (isBotDetected.value) {
    return true;
  }

  // Skip checks if we are running in native mobile context (Capacitor)
  // Standard headless bot checks could false-positive on raw app webviews
  const isNative = !!(window as any).Capacitor || navigator.userAgent.includes('Capacitor');

  // 1. Webdriver Flag
  if (navigator.webdriver) {
    flagBot('webdriver_active');
    return true;
  }

  // 2. Navigator Plugins Check
  // Headless browsers on automation servers usually have zero plugins configured.
  // Standard desktop browsers always have core plugins hydrated.
  if (!isNative && navigator.plugins.length === 0) {
    flagBot('zero_plugins');
    return true;
  }

  // 3. Chrome Object Integrity
  // Standard Google Chrome has a global window.chrome object.
  // Automation scripts pretending to be Chrome often forget to hydrate it.
  const isChrome = /Chrome/i.test(navigator.userAgent) && !/Edge|Edg|OPR/i.test(navigator.userAgent);
  const hasChromeObject = !!(window as any).chrome;
  if (!isNative && isChrome && !hasChromeObject) {
    flagBot('chrome_integrity_missing');
    return true;
  }

  // 4. WebGL SwiftShader / VM Software Render Check
  // Automated browsers typically run on virtualized software rendering.
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
        if (/SwiftShader|VirtualBox|llvmpipe|Software Renderer/i.test(renderer)) {
          flagBot(`webgl_software_renderer_${renderer}`);
          return true;
        }
      }
    }
  } catch (e) {
    // Suppress WebGL Context errors gracefully
  }

  return false;
}

/**
 * Flag client as a bot, update local storage and reactive Vue state.
 */
export function flagBot(reason: string) {
  console.warn(`🚨 [BotShield] Automated bot detected. Reason: ${reason}`);
  localStorage.setItem(BOT_STORAGE_KEY, 'true');
  isBotDetected.value = true;
}

/**
 * Clear bot flags for manual rescue/debugging purposes.
 */
export function resetBotFlag() {
  localStorage.removeItem(BOT_STORAGE_KEY);
  isBotDetected.value = false;
}
