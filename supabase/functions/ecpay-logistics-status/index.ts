import { serve } from "https://deno.land/std/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Server key: the new `default` secret key (SUPABASE_SECRET_KEYS is a JSON object keyed by key name),
// falling back to the legacy service_role key until that one is deactivated.
function readSecretKey(): string {
  try {
    const key = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default
    if (typeof key === 'string' && key !== '') return key
  } catch { /* fall through to the legacy key */ }
  return ''
}
const SERVER_KEY = readSecretKey() || (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

// ECPay Logistics C2C Staging Credentials
const SANDBOX_C2C = {
  HASH_KEY: 'XBERn1YOvpM9nfZc',
  HASH_IV: 'h1ONHk4P4yqbl5LK',
}

function getConfig() {
  const mode = (Deno.env.get('ECPAY_LOGISTICS_MODE') || 'sandbox').toLowerCase()
  const isProduction = mode === 'production'
  return {
    hashKey: isProduction
      ? Deno.env.get('ECPAY_LOGISTICS_HASH_KEY')!
      : (Deno.env.get('ECPAY_LOGISTICS_HASH_KEY') || SANDBOX_C2C.HASH_KEY),
    hashIV: isProduction
      ? Deno.env.get('ECPAY_LOGISTICS_HASH_IV')!
      : (Deno.env.get('ECPAY_LOGISTICS_HASH_IV') || SANDBOX_C2C.HASH_IV),
    isProduction,
  }
}

function dotNetUrlEncode(str: string): string {
  let encoded = encodeURIComponent(str)
  encoded = encoded.replace(/~/g, '%7E')
  encoded = encoded.replace(/'/g, '%27')
  encoded = encoded.replace(/%20/g, '+')
  return encoded
}

async function generateCheckMac(params: Record<string, string>, hashKey: string, hashIV: string): Promise<string> {
  const sortedKeys = Object.keys(params).sort((a, b) => a.localeCompare(b))
  let rawStr = `HashKey=${hashKey}`
  for (const key of sortedKeys) {
    rawStr += `&${key}=${params[key]}`
  }
  rawStr += `&HashIV=${hashIV}`
  const encodedStr = dotNetUrlEncode(rawStr).toLowerCase()
  const msgUint8 = new TextEncoder().encode(encodedStr)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

// Logistics status code to human-readable description
const STATUS_DESCRIPTIONS: Record<string, string> = {
  '300': 'Order created / 訂單建立',
  '310': 'Awaiting pickup from store / 待店到店寄件',
  '325': 'Received by logistics / 物流收件中',
  '330': 'In transit / 配送中',
  '2030': 'Arrived at store / 已送達門市',
  '2063': 'Picked up by buyer / 買家已取貨',
  '2067': 'Unclaimed, returning / 未取退回中',
  '2068': 'Returned to sender / 已退回寄件人',
  '2073': 'Closed / 關轉',
  '3020': 'Processing return / 退貨處理中',
  '3024': 'Return complete / 退貨完成',
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const formData = await req.formData()
    const allParams: Record<string, string> = {}
    formData.forEach((value, key) => { allParams[key] = String(value) })

    console.log('[ECPAY-LOGISTICS-STATUS] Received:', JSON.stringify(allParams))

    const receivedCheckMac = allParams['CheckMacValue']
    const merchantTradeNo = allParams['MerchantTradeNo'] || ''
    const logisticsId = allParams['AllPayLogisticsID'] || ''
    const rtnCode = allParams['RtnCode'] || ''
    const rtnMsg = allParams['RtnMsg'] || ''
    const goodsAmount = allParams['GoodsAmount'] || ''
    const updateDate = allParams['UpdateStatusDate'] || ''

    // Verify CheckMacValue
    if (receivedCheckMac) {
      const verifyParams: Record<string, string> = {}
      for (const [key, value] of Object.entries(allParams)) {
        if (key !== 'CheckMacValue') verifyParams[key] = value
      }

      const config = getConfig()
      const expectedCheckMac = await generateCheckMac(verifyParams, config.hashKey, config.hashIV)

      if (receivedCheckMac !== expectedCheckMac) {
        console.error('[ECPAY-LOGISTICS-STATUS] CheckMacValue MISMATCH')
        console.error(`  Received: ${receivedCheckMac}`)
        console.error(`  Expected: ${expectedCheckMac}`)
        // Still process in staging mode
        if (config.isProduction) {
          return new Response('0|CheckMacValue verification failed')
        }
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      SERVER_KEY
    )

    // Find order by logistics_trade_no or logistics_id
    let orderQuery = supabase.from('store_orders').select('id, status, delivery_method')
    if (merchantTradeNo) {
      orderQuery = orderQuery.eq('logistics_trade_no', merchantTradeNo)
    } else if (logisticsId) {
      orderQuery = orderQuery.eq('logistics_id', logisticsId)
    } else {
      console.error('[ECPAY-LOGISTICS-STATUS] No trade number or logistics ID')
      return new Response('0|Missing identifier')
    }

    const { data: order, error: findErr } = await orderQuery.single()

    if (findErr || !order) {
      console.error(`[ECPAY-LOGISTICS-STATUS] Order not found: tradeNo=${merchantTradeNo}, logisticsId=${logisticsId}`)
      return new Response('1|OK') // Return OK to stop ECPay from retrying
    }

    const statusDesc = STATUS_DESCRIPTIONS[rtnCode] || rtnMsg

    // Map certain logistics statuses to order statuses
    let newOrderStatus = order.status
    if (rtnCode === '2063') {
      // Buyer picked up → completed
      newOrderStatus = 'completed'
    } else if (['325', '330'].includes(rtnCode)) {
      // In transit → shipped
      newOrderStatus = 'shipped'
    } else if (rtnCode === '2030') {
      // Arrived at store → shipped (still waiting for pickup)
      if (order.status !== 'completed') newOrderStatus = 'shipped'
    }

    const { error: updateErr } = await supabase.from('store_orders').update({
      logistics_status: rtnCode,
      logistics_status_msg: statusDesc,
      status: newOrderStatus,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id)

    if (updateErr) {
      console.error('[ECPAY-LOGISTICS-STATUS] DB update error:', updateErr)
      return new Response('0|Database error')
    }

    console.log(`[ECPAY-LOGISTICS-STATUS] Order ${order.id} updated: status=${rtnCode} (${statusDesc}), orderStatus=${newOrderStatus}`)

    // Must respond with 1|OK
    return new Response('1|OK')
  } catch (err: any) {
    console.error('[ECPAY-LOGISTICS-STATUS] Fatal:', err)
    return new Response('0|Internal Error')
  }
})
