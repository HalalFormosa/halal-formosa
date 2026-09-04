/**
 * Newebpay Logistics Composable
 *
 * Mirrors useEcpayLogistics.ts's shape (CVS store map picker, logistics
 * order creation, shipping label printing) so call sites only need an
 * import swap once the backend is ready.
 *
 * ⚠️ The backing edge function (newebpay-logistics) is a scaffold — every
 * action currently returns a "not verified" error because Newebpay's
 * logistics field spec is gated behind their merchant portal and could not
 * be confirmed in this session. Do not wire this into checkout/settings
 * views until that function is filled in and tested against sandbox.
 */
import { ref } from 'vue'
import { supabase } from '@/plugins/supabaseClient'

export interface CvsStoreSelection {
  storeId: string
  storeName: string
  storeAddress: string
  subType?: string
}

export function useNewebpayLogistics() {
  const logisticsLoading = ref(false)
  const selectedStore = ref<CvsStoreSelection | null>(null)

  async function handleInvokeError(error: any) {
    let errorMsg = error.message
    if (error && typeof error === 'object' && 'context' in error) {
      const httpError = error as any
      if (httpError.context && typeof httpError.context.json === 'function') {
        try {
          const body = await httpError.context.json()
          if (body?.error) errorMsg = body.error
        } catch (_) {}
      }
    }
    throw new Error(errorMsg)
  }

  async function openCvsMapPicker(
    deliveryMethod: string,
    orderId?: string
  ): Promise<CvsStoreSelection | null> {
    logisticsLoading.value = true

    try {
      const { data, error } = await supabase.functions.invoke('newebpay-logistics', {
        body: {
          action: 'get_map_url',
          deliveryMethod,
          orderId: orderId || '',
          clientOrigin: window.location.origin,
        },
      })

      if (error || !data?.mapUrl) {
        console.error('[NEWEBPAY-LOGISTICS] Failed to get map URL:', error || data?.error)
        if (error) await handleInvokeError(error)
        throw new Error(data?.error || 'Failed to get map URL')
      }

      return await new Promise<CvsStoreSelection | null>((resolve) => {
        const popup = window.open('about:blank', 'newebpay_cvs_map', 'width=800,height=600,scrollbars=yes')

        if (!popup) {
          console.error('[NEWEBPAY-LOGISTICS] Popup blocked')
          logisticsLoading.value = false
          resolve(null)
          return
        }

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

        const messageHandler = (event: MessageEvent) => {
          if (event.data?.type === 'newebpay_cvs_store_selected') {
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

        const pollInterval = setInterval(() => {
          if (popup.closed) {
            clearInterval(pollInterval)
            window.removeEventListener('message', messageHandler)
            logisticsLoading.value = false
            if (!selectedStore.value) {
              resolve(null)
            }
          }
        }, 500)

        setTimeout(() => {
          clearInterval(pollInterval)
          window.removeEventListener('message', messageHandler)
          logisticsLoading.value = false
          if (!popup.closed) popup.close()
          resolve(selectedStore.value)
        }, 300000)
      })
    } catch (err) {
      console.error('[NEWEBPAY-LOGISTICS] openCvsMapPicker error:', err)
      logisticsLoading.value = false
      throw err
    }
  }

  async function createLogisticsOrder(orderId: string) {
    logisticsLoading.value = true
    try {
      const { data, error } = await supabase.functions.invoke('newebpay-logistics', {
        body: { action: 'create_order', orderId },
      })

      if (error) await handleInvokeError(error)
      if (data?.error) throw new Error(data.error)

      console.log('[NEWEBPAY-LOGISTICS] Order created:', data)
      return data
    } finally {
      logisticsLoading.value = false
    }
  }

  async function createHomeDeliveryOrder(orderId: string, courierSubType = 'TCAT') {
    logisticsLoading.value = true
    try {
      const { data, error } = await supabase.functions.invoke('newebpay-logistics', {
        body: { action: 'create_home_order', orderId, courierSubType },
      })

      if (error) await handleInvokeError(error)
      if (data?.error) throw new Error(data.error)

      console.log('[NEWEBPAY-LOGISTICS] Home delivery order created:', data)
      return data
    } finally {
      logisticsLoading.value = false
    }
  }

  async function printShippingLabel(orderId: string) {
    logisticsLoading.value = true
    try {
      const { data, error } = await supabase.functions.invoke('newebpay-logistics', {
        body: { action: 'print_label', orderId },
      })

      if (error) await handleInvokeError(error)
      if (data?.error) throw new Error(data.error)

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

  function clearSelectedStore() {
    selectedStore.value = null
  }

  return {
    logisticsLoading,
    selectedStore,
    openCvsMapPicker,
    createLogisticsOrder,
    createHomeDeliveryOrder,
    printShippingLabel,
    clearSelectedStore,
  }
}
