import { ref } from 'vue';

const humanInteractionDetected = ref<boolean>(false);

/**
 * Initializes listeners for organic human pointer and scroll events.
 * Keydown, wheel, touch, and pointer movements all qualify as legitimate human events.
 */
export function initInteractionMonitor() {
  if (typeof window === 'undefined') return;

  const markHuman = () => {
    humanInteractionDetected.value = true;
    cleanup();
  };

  const cleanup = () => {
    window.removeEventListener('pointermove', markHuman);
    window.removeEventListener('keydown', markHuman);
    window.removeEventListener('touchstart', markHuman);
    window.removeEventListener('wheel', markHuman);
  };

  // Bind low-overhead, passive listeners for the first interaction
  window.addEventListener('pointermove', markHuman, { once: true, passive: true });
  window.addEventListener('keydown', markHuman, { once: true, passive: true });
  window.addEventListener('touchstart', markHuman, { once: true, passive: true });
  window.addEventListener('wheel', markHuman, { once: true, passive: true });
}

/**
 * Returns true if at least one organic human event has been registered, false otherwise.
 */
export function hasOrganicInteraction(): boolean {
  return humanInteractionDetected.value;
}

/**
 * Introduces a randomized human-like delay (500ms to 1500ms) to stall scrapers and throttle requests.
 */
export async function delayForHuman(): Promise<void> {
  const delayMs = Math.floor(Math.random() * (1500 - 500 + 1) + 500);
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
