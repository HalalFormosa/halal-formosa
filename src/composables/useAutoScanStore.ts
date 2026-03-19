import { ref } from 'vue'

export interface AutoScanResult {
    blob: Blob
    roi: {
        left: number
        top: number
        width: number
        height: number
    } | null
}

const autoScanResult = ref<AutoScanResult | null>(null)

export function useAutoScanStore() {
    function setResult(result: AutoScanResult) {
        autoScanResult.value = result
    }

    function clearResult() {
        autoScanResult.value = null
    }

    return {
        autoScanResult,
        setResult,
        clearResult
    }
}
