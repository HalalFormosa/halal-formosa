/**
 * ECPay Logistics Composable
 *
 * Handles CVS store map picker, logistics order creation,
 * and shipping label printing via ECPay Logistics API.
 */
import { ref } from 'vue'
import { supabase } from '@/plugins/supabaseClient'

export interface CvsStoreSelection {
  storeId: string
  storeName: string
  storeAddress: string
  subType?: string
}

export function useEcpayLogistics() {
  const logisticsLoading = ref(false)
  const selectedStore = ref<CvsStoreSelection | null>(null)

  /**
   * Open the ECPay CVS Map picker in a popup window.
   * Listens for postMessage from the callback page with store data.
   *
   * @param deliveryMethod - Internal key: '7eleven', 'family_mart', 'hi_life', 'ok_mart'
   * @param orderId - Optional order ID to pre-associate the store selection
   * @returns Promise resolving to the selected store info
   */
  async function openCvsMapPicker(
    deliveryMethod: string,
    orderId?: string
  ): Promise<CvsStoreSelection | null> {
    logisticsLoading.value = true

    try {
      // Get map URL and params from edge function
      const { data, error } = await supabase.functions.invoke('ecpay-logistics', {
        body: {
          action: 'get_map_url',
          deliveryMethod,
          orderId: orderId || '',
          clientOrigin: window.location.origin,
        },
      })

      if (error || !data?.mapUrl) {
        console.error('[LOGISTICS] Failed to get map URL:', error || data?.error)
        throw new Error(data?.error || 'Failed to get map URL')
      }

      // Build form and submit in popup
      return await new Promise<CvsStoreSelection | null>((resolve) => {
        // Open popup first
        const popup = window.open('about:blank', 'ecpay_cvs_map', 'width=800,height=600,scrollbars=yes')

        if (!popup) {
          console.error('[LOGISTICS] Popup blocked')
          logisticsLoading.value = false
          resolve(null)
          return
        }

        // Create a form in the popup and submit it
        const form = popup.document.createElement('form')
        form.method = 'POST'
        form.action = data.mapUrl

        Object.entries(data.params).forEach(([key, value]) => {
          const input = popup.document.createElement('input')
          input.type = 'hidden'
          input.name = key
          input.value = String(value)
          form.appendChild(input)
        })

        popup.document.body.appendChild(form)
        form.submit()

        // Listen for postMessage from the callback page
        const messageHandler = (event: MessageEvent) => {
          if (event.data?.type === 'ecpay_cvs_store_selected') {
            const store: CvsStoreSelection = {
              storeId: event.data.storeId || '',
              storeName: event.data.storeName || '',
              storeAddress: event.data.storeAddress || '',
              subType: event.data.subType || '',
            }
            selectedStore.value = store
            window.removeEventListener('message', messageHandler)
            clearInterval(pollInterval)
            logisticsLoading.value = false
            resolve(store)
          }
        }

        window.addEventListener('message', messageHandler)

        // Poll for popup close (user cancelled)
        const pollInterval = setInterval(() => {
          if (popup.closed) {
            clearInterval(pollInterval)
            window.removeEventListener('message', messageHandler)
            logisticsLoading.value = false
            // If no store was selected, resolve null
            if (!selectedStore.value) {
              resolve(null)
            }
          }
        }, 500)

        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval)
          window.removeEventListener('message', messageHandler)
          logisticsLoading.value = false
          if (!popup.closed) popup.close()
          resolve(selectedStore.value)
        }, 300000)
      })
    } catch (err) {
      console.error('[LOGISTICS] openCvsMapPicker error:', err)
      logisticsLoading.value = false
      throw err
    }
  }

  /**
   * Create a logistics order at ECPay for a given order.
   * Should be called after the order has been paid.
   */
  async function createLogisticsOrder(orderId: string) {
    logisticsLoading.value = true
    try {
      const { data, error } = await supabase.functions.invoke('ecpay-logistics', {
        body: { action: 'create_order', orderId },
      })

      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)

      console.log('[LOGISTICS] Order created:', data)
      return data
    } finally {
      logisticsLoading.value = false
    }
  }

  /**
   * Get the print label URL and form params for a logistics order.
   * Returns { printUrl, params } which should be submitted as a form POST.
   */
  async function printShippingLabel(orderId: string) {
    logisticsLoading.value = true
    try {
      const { data, error } = await supabase.functions.invoke('ecpay-logistics', {
        body: { action: 'print_label', orderId },
      })

      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)

      // Open print label in new window via form POST
      if (data?.printUrl && data?.params) {
        const form = document.createElement('form')
        form.method = 'POST'
        form.action = data.printUrl
        form.target = '_blank'
        form.style.display = 'none'

        Object.entries(data.params).forEach(([key, value]) => {
          const input = document.createElement('input')
          input.type = 'hidden'
          input.name = key
          input.value = String(value)
          form.appendChild(input)
        })

        document.body.appendChild(form)
        form.submit()

        setTimeout(() => {
          if (document.body.contains(form)) {
            document.body.removeChild(form)
          }
        }, 1000)
      }

      return data
    } finally {
      logisticsLoading.value = false
    }
  }

  /**
   * Clear the selected store
   */
  function clearSelectedStore() {
    selectedStore.value = null
  }

  return {
    logisticsLoading,
    selectedStore,
    openCvsMapPicker,
    createLogisticsOrder,
    printShippingLabel,
    clearSelectedStore,
  }
}
