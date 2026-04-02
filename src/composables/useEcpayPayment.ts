/**
 * ECPay Payment Composable
 * 
 * Shared logic for initiating ECPay payments from any view.
 * Handles: invoking the edge function, building the hidden form,
 * and polling for payment status after the user returns.
 */
import { ref } from 'vue'
import { supabase } from '@/plugins/supabaseClient'

export function useEcpayPayment() {
  const submitting = ref(false)
  const submittingOrderId = ref<string | null>(null)

  /**
   * Initiate ECPay payment for an order.
   * Creates a hidden form and submits it to ECPay's payment page.
   * 
   * @param orderId - The UUID of the store_order
   * @throws Error if the edge function fails or returns invalid data
   */
  async function initiatePayment(orderId: string): Promise<void> {
    submitting.value = true
    submittingOrderId.value = orderId

    try {
      const { data: payData, error: payErr } = await supabase.functions.invoke('ecpay-payment', {
        body: { orderId },
      })

      if (payErr || !payData) {
        throw new Error(payErr?.message || 'Failed to initiate payment')
      }

      if (payData.error) {
        throw new Error(payData.error)
      }

      // Build and submit hidden form to ECPay
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = payData.apiUrl
      form.style.display = 'none'

      Object.entries(payData.params).forEach(([key, value]) => {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = key
        input.value = String(value)
        form.appendChild(input)
      })

      document.body.appendChild(form)

      // Small delay to ensure DOM is ready, then submit
      await new Promise(resolve => setTimeout(resolve, 50))
      form.submit()

      // Clean up form after submission
      setTimeout(() => {
        if (document.body.contains(form)) {
          document.body.removeChild(form)
        }
      }, 1000)

    } finally {
      submitting.value = false
      submittingOrderId.value = null
    }
  }

  /**
   * Poll for payment status after user returns from ECPay.
   * Checks the order status every 2 seconds for up to 30 seconds.
   * 
   * @param orderId - The UUID of the store_order
   * @param onPaid - Callback when payment is confirmed
   * @param maxAttempts - Maximum polling attempts (default: 15 = 30 seconds)
   */
  function pollPaymentStatus(
    orderId: string,
    onPaid: () => void,
    maxAttempts = 15
  ): () => void {
    let attempts = 0
    let stopped = false

    const poll = async () => {
      if (stopped || attempts >= maxAttempts) return

      attempts++

      try {
        const { data } = await supabase
          .from('store_orders')
          .select('status')
          .eq('id', orderId)
          .single()

        if (data?.status === 'paid') {
          onPaid()
          return
        }
      } catch {
        // Silently continue polling
      }

      if (!stopped && attempts < maxAttempts) {
        setTimeout(poll, 2000)
      }
    }

    // Start polling
    poll()

    // Return a stop function
    return () => {
      stopped = true
    }
  }

  return {
    submitting,
    submittingOrderId,
    initiatePayment,
    pollPaymentStatus,
  }
}
