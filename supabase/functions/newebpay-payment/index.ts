import { serve } from "https://deno.land/std/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { createCipheriv, createHash } from "node:crypto"

// Newebpay MPG (幕前支付) checkout initiation.
//
// NOTE: field names / endpoint follow Newebpay's publicly documented MPG
// pattern (TradeInfo = AES-256-CBC(HashKey, HashIV) of a "&"-joined field
// string, TradeSha = SHA256(`HashKey=...&${TradeInfo}&HashIV=...`)).
// Verify against your merchant sandbox before flipping checkout over to it —
// there is no hardcoded fallback sandbox credential here (unlike the ECPay
// function) because Newebpay's public sandbox keys were not available to
// confirm in this session.

const ENDPOINTS = {
  sandbox: 'https://ccore.newebpay.com/MPG/mpg_gateway',
  production: 'https://core.newebpay.com/MPG/mpg_gateway',
}

function getConfig() {
  const mode = (Deno.env.get('NEWEBPAY_MODE') || 'sandbox').toLowerCase()
  const isProduction = mode === 'production'
  const merchantId = Deno.env.get('NEWEBPAY_MERCHANT_ID')
  const hashKey = Deno.env.get('NEWEBPAY_HASH_KEY')
  const hashIV = Deno.env.get('NEWEBPAY_HASH_IV')

  if (!merchantId || !hashKey || !hashIV) {
    throw new Error('Newebpay is not configured: set NEWEBPAY_MERCHANT_ID, NEWEBPAY_HASH_KEY, NEWEBPAY_HASH_IV')
  }
  if (hashKey.length !== 32) throw new Error('NEWEBPAY_HASH_KEY must be exactly 32 characters')
  if (hashIV.length !== 16) throw new Error('NEWEBPAY_HASH_IV must be exactly 16 characters')

  return {
    merchantId,
    hashKey,
    hashIV,
    apiUrl: isProduction ? ENDPOINTS.production : ENDPOINTS.sandbox,
    isProduction,
  }
}

function aesEncrypt(plain: string, hashKey: string, hashIV: string): string {
  const cipher = createCipheriv('aes-256-cbc', hashKey, hashIV)
  let encrypted = cipher.update(plain, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return encrypted
}

function genTradeSha(tradeInfo: string, hashKey: string, hashIV: string): string {
  const raw = `HashKey=${hashKey}&${tradeInfo}&HashIV=${hashIV}`
  return createHash('sha256').update(raw).digest('hex').toUpperCase()
}

function generateOrderNo(orderId: string): string {
  // Newebpay MerchantOrderNo: alnum, <= 30 chars, unique per attempt.
  const cleanId = orderId.replace(/-/g, '').substring(0, 16)
  const rand = crypto.randomUUID().replace(/-/g, '').substring(0, 6).toUpperCase()
  return `HF${cleanId}${rand}`.substring(0, 30)
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
    console.log(`[NEWEBPAY-PAYMENT] Mode: ${config.isProduction ? 'PRODUCTION' : 'SANDBOX'}, MerchantID: ${config.merchantId}`)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
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

    const merchantOrderNo = generateOrderNo(orderId)

    await supabase.from('store_orders')
      .update({ merchant_trade_no: merchantOrderNo, payment_type: 'newebpay' })
      .eq('id', orderId)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const notifyUrl = `${supabaseUrl}/functions/v1/newebpay-notify`
    const origin = clientOrigin || req.headers.get('origin') || 'https://app.halalformosa.com'
    const clientBackUrl = `${origin}/store/payment-result/${orderId}`

    const tradeFields: Record<string, string | number> = {
      MerchantID: config.merchantId,
      RespondType: 'JSON',
      TimeStamp: Math.floor(Date.now() / 1000),
      Version: '2.0',
      MerchantOrderNo: merchantOrderNo,
      Amt: Math.floor(Number(order.total_amount)),
      ItemDesc: 'HalalFormosa Order',
      Email: order.buyer_email || '',
      LoginType: 0,
      NotifyURL: notifyUrl,
      ClientBackURL: clientBackUrl,
    }

    const tradeInfoPlain = Object.entries(tradeFields)
      .map(([k, v]) => `${k}=${v}`)
      .join('&')

    const tradeInfo = aesEncrypt(tradeInfoPlain, config.hashKey, config.hashIV)
    const tradeSha = genTradeSha(tradeInfo, config.hashKey, config.hashIV)

    console.log(`[NEWEBPAY-PAYMENT] Order ${orderId} => OrderNo: ${merchantOrderNo}, Amount: ${tradeFields.Amt}`)

    return new Response(JSON.stringify({
      params: {
        MerchantID: config.merchantId,
        TradeInfo: tradeInfo,
        TradeSha: tradeSha,
        Version: '2.0',
      },
      apiUrl: config.apiUrl,
    }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })

  } catch (err: any) {
    console.error('[NEWEBPAY-PAYMENT] Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  }
})
