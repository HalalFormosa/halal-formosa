import { vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import en from '@/locales/en.json'

// Shared setup for the operations admin page specs: real English strings, Ionic components replaced by plain
// elements (so clicks and custom events work in jsdom), and the page lifecycle hook run on mount.

export const i18n = createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { en } })

const box = { template: '<div v-bind="$attrs"><slot /></div>' }
const button = { template: '<button v-bind="$attrs"><slot /></button>' }
const input = { template: '<input v-bind="$attrs" />' }

export const adminStubs = {
    AppHeader: true,
    IonPage: box, IonHeader: box, IonToolbar: box, IonTitle: box, IonButtons: box, IonContent: box,
    IonRefresher: box, IonRefresherContent: box, IonSegment: box, IonSegmentButton: box, IonLabel: box,
    IonSelect: box, IonSelectOption: box, IonModal: box, IonToggle: box, IonTextarea: box, IonSearchbar: input,
    IonSpinner: true, IonIcon: true,
    IonButton: button,
    IonInput: input,
}

/** Replacement for the '@ionic/vue' module: real components, but lifecycle hook = mounted, and fake dialogs. */
export async function ionicMock(importActual: () => Promise<typeof import('@ionic/vue')>, dialogRole = 'confirm', dialogValues: Record<string, string> = {}) {
    const actual = await importActual()
    const { onMounted } = await import('vue')
    return {
        ...actual,
        onIonViewWillEnter: (fn: () => void) => onMounted(fn),
        alertController: {
            create: vi.fn(async () => ({ present: vi.fn(), onDidDismiss: vi.fn(async () => ({ role: dialogRole, data: { values: dialogValues } })) })),
        },
        toastController: { create: vi.fn(async () => ({ present: vi.fn() })) },
    }
}

/**
 * Fires an Ionic custom event (ionChange, ionInput, ...). On a plain element Vue listens for the hyphenated name
 * ("ion-input"), while real Ionic components emit the camelCase one, so both are sent.
 */
export function emitIonic(el: Element, name: string, detail: unknown) {
    const hyphenated = name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
    el.dispatchEvent(new CustomEvent(hyphenated, { detail }))
    el.dispatchEvent(new CustomEvent(name, { detail }))
}
