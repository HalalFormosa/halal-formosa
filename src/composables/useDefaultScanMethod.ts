import { computed, ref } from 'vue'

/**
 * "Remember my choice" for the scan page. When it is on, opening Scan Ingredients goes straight to
 * the remembered method instead of showing the method picker. Stored on this device only.
 */
export type RememberedScanMethod = 'camera' | 'gallery' | 'auto' | 'live'
export type DefaultScanMethod = 'ask' | RememberedScanMethod

const KEY = 'scan_default_method'
const METHODS: RememberedScanMethod[] = ['camera', 'gallery', 'auto', 'live']

function load(): DefaultScanMethod {
    try {
        const v = localStorage.getItem(KEY)
        return METHODS.includes(v as RememberedScanMethod) ? (v as RememberedScanMethod) : 'ask'
    } catch {
        return 'ask'
    }
}

/** 'ask' means no remembered method: show the picker every time. */
export const defaultScanMethod = ref<DefaultScanMethod>(load())

export const rememberScanChoice = computed(() => defaultScanMethod.value !== 'ask')

export function setDefaultScanMethod(method: DefaultScanMethod) {
    defaultScanMethod.value = method
    try {
        if (method === 'ask') localStorage.removeItem(KEY)
        else localStorage.setItem(KEY, method)
    } catch {
        /* storage unavailable: the choice just lasts for this session */
    }
}

/** Called whenever the user picks a method on the scan page; only saves while "remember" is on. */
export function rememberScanMethodIfEnabled(method: RememberedScanMethod) {
    if (rememberScanChoice.value) setDefaultScanMethod(method)
}
