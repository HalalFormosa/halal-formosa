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

const SANDBOX = {
  MERCHANT_ID: '3002607',
  HASH_KEY: 'pwFHCqoQZGmho4w6',
  HASH_IV: 'EkRm7iFT261dpevs',
  API_URL: 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
}

const PRODUCTION = {
  API_URL: 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5',
}

function getConfig() {
  const mode = (Deno.env.get('ECPAY_MODE') || 'sandbox').toLowerCase()
  const isProduction = mode === 'production'
  return {
    merchantId: isProduction
      ? Deno.env.get('ECPAY_MERCHANT_ID')!
      : (Deno.env.get('ECPAY_MERCHANT_ID') || SANDBOX.MERCHANT_ID),
    hashKey: isProduction
      ? Deno.env.get('ECPAY_HASH_KEY')!
      : (Deno.env.get('ECPAY_HASH_KEY') || SANDBOX.HASH_KEY),
    hashIV: isProduction
      ? Deno.env.get('ECPAY_HASH_IV')!
      : (Deno.env.get('ECPAY_HASH_IV') || SANDBOX.HASH_IV),
    apiUrl: isProduction ? PRODUCTION.API_URL : SANDBOX.API_URL,
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

async function generateCheckMac(params: Record<string, any>, hashKey: string, hashIV: string): Promise<string> {
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

function generateTradeNo(orderId: string): string {
  const cleanId = orderId.replace(/-/g, '').substring(0, 10)
  const rand = crypto.randomUUID().replace(/-/g, '').substring(0, 6).toUpperCase()
  return `HF${cleanId}${rand}`.substring(0, 20)
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const { orderId, clientOrigin } = await req.json()
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'orderId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      })
    }

    const config = getConfig()
    console.log(`[ECPAY-PAYMENT] Mode: ${config.isProduction ? 'PRODUCTION' : 'SANDBOX'}, MerchantID: ${config.merchantId}`)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      SERVER_KEY
    )

    const { data: order, error: orderErr } = await supabase
      .from('store_orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      })
    }

    if (order.status !== 'pending') {
      return new Response(JSON.stringify({ error: `Order is already ${order.status}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      })
    }

    const merchantTradeNo = generateTradeNo(orderId)

    await supabase.from('store_orders')
      .update({ merchant_trade_no: merchantTradeNo, payment_type: 'ecpay' })
      .eq('id', orderId)

    const now = new Date()
    const merchantTradeDate = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('/') + ' ' + [
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join(':')

    const returnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ecpay-callback`
    const origin = clientOrigin || req.headers.get('origin') || 'https://app.halalformosa.com'
    const clientBackUrl = `${origin}/store/payment-result/${orderId}`

    const params: Record<string, any> = {
      ChoosePayment: 'ALL',
      ClientBackURL: clientBackUrl,
      EncryptType: 1,
      ItemName: 'HalalFormosa Order',
      MerchantID: config.merchantId,
      MerchantTradeDate: merchantTradeDate,
      MerchantTradeNo: merchantTradeNo,
      PaymentType: 'aio',
      ReturnURL: returnUrl,
      TotalAmount: Math.floor(Number(order.total_amount)),
      TradeDesc: 'HalalFormosa',
    }

    params.CheckMacValue = await generateCheckMac(params, config.hashKey, config.hashIV)

    console.log(`[ECPAY-PAYMENT] Order ${orderId} => TradeNo: ${merchantTradeNo}, Amount: ${params.TotalAmount}`)

    return new Response(JSON.stringify({
      params,
      apiUrl: config.apiUrl,
    }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })

  } catch (err: any) {
    console.error('[ECPAY-PAYMENT] Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  }
})
