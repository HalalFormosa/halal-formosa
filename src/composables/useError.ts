// src/composables/useError.ts
import { ref } from 'vue'

export default function useError() {
    const errorMsg = ref<string>('')     // message text
    const showErr = ref<boolean>(false)  // toast visibility

    function setError(msg: string) {
        errorMsg.value = msg
        showErr.value = false
        // ensure Vue processes the change before setting true
        requestAnimationFrame(() => {
            showErr.value = true
        })
    }

    function clearError() {
        errorMsg.value = ''
        showErr.value = false
    }

    return {
        errorMsg,
        showErr,
        setError,
        clearError,
    }
}
