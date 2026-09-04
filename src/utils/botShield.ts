import { ref } from 'vue';

const BOT_STORAGE_KEY = 'hf_bot_shield_flag';
const BOT_STORAGE_TS_KEY = 'hf_bot_shield_flag_ts';
const BOT_FLAG_TTL_MS = 30 * 60 * 1000; // 30 minutes

function readStoredFlag(): boolean {
  if (localStorage.getItem(BOT_STORAGE_KEY) !== 'true') {
    return false;
  }

  const ts = Number(localStorage.getItem(BOT_STORAGE_TS_KEY) || 0);
  if (!ts || Date.now() - ts > BOT_FLAG_TTL_MS) {
    // Stale flag — clear it instead of trusting it forever.
    localStorage.removeItem(BOT_STORAGE_KEY);
    localStorage.removeItem(BOT_STORAGE_TS_KEY);
    return false;
  }

  return true;
}

// Reactive bot detection flag initialized from localStorage
export const isBotDetected = ref<boolean>(readStoredFlag());

/**
 * Performs a low-overhead check to detect standard headless / automation bots.
 * @returns true if client is identified as a bot, false otherwise.
 */
export function performBotChecks(): boolean {
  // If already flagged (and not stale), skip check and return true
  if (isBotDetected.value) {
    if (readStoredFlag()) {
      return true;
    }
    // Flag expired since it was set — clear reactive state too
    isBotDetected.value = false;
  }

  // Webdriver Flag — this is the one reliable, low-false-positive signal.
  // Automation tools (Selenium, Playwright, Puppeteer, etc.) set this explicitly;
  // real browsers on real devices never do.
  if (navigator.webdriver) {
    flagBot('webdriver_active');
    return true;
  }

  return false;
}

/**
 * Flag client as a bot, update local storage and reactive Vue state.
 */
export function flagBot(reason: string) {
  console.warn(`🚨 [BotShield] Automated bot detected. Reason: ${reason}`);
  localStorage.setItem(BOT_STORAGE_KEY, 'true');
  localStorage.setItem(BOT_STORAGE_TS_KEY, String(Date.now()));
  isBotDetected.value = true;
}

/**
 * Clear bot flags for manual rescue/debugging purposes.
 */
export function resetBotFlag() {
  localStorage.removeItem(BOT_STORAGE_KEY);
  localStorage.removeItem(BOT_STORAGE_TS_KEY);
  isBotDetected.value = false;
}
