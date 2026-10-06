import { serve } from "https://deno.land/std/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { createDecipheriv, createHash } from "node:crypto"

// Newebpay MPG server-to-server NotifyURL handler.
//
// Newebpay posts form-encoded fields (Status, MerchantID, TradeInfo,
// TradeSha) to this endpoint. TradeInfo is an AES-256-CBC hex blob that
// decrypts to a JSON payload: { Status, Message, Result: { MerchantID,
// Amt, TradeNo, MerchantOrderNo, PaymentType, RespondCode, ... } }.
// This shape is corroborated by multiple public Newebpay SDK references but
// has not been round-tripped against a live sandbox in this session —
// verify against a real test transaction before relying on it in production.

const DELIVERY_LABELS: Record<string, string> = {
  home_delivery: '🚚 Home Delivery / 宅配到府',
  '7eleven': '🏪 7-Eleven Pickup',
  family_mart: '🏪 FamilyMart Pickup',
  hi_life: '🏪 Hi-Life Pickup',
  ok_mart: '🏪 OK Mart Pickup',
  cod_meetup: '🤝 Meet in Person / 面交自取',
}

function getConfig() {
  const mode = (Deno.env.get('NEWEBPAY_MODE') || 'sandbox').toLowerCase()
  return {
    hashKey: Deno.env.get('NEWEBPAY_HASH_KEY')!,
    hashIV: Deno.env.get('NEWEBPAY_HASH_IV')!,
    isProduction: mode === 'production',
  }
}

function aesDecrypt(hex: string, hashKey: string, hashIV: string): string {
  const decipher = createDecipheriv('aes-256-cbc', hashKey, hashIV)
  let decrypted = decipher.update(hex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

function genTradeSha(tradeInfo: string, hashKey: string, hashIV: string): string {
  const raw = `HashKey=${hashKey}&${tradeInfo}&HashIV=${hashIV}`
  return createHash('sha256').update(raw).digest('hex').toUpperCase()
}

async function sendDiscordNotification(
  order: any,
  orderItems: any[],
  tradeNo: string,
  tradeAmt: string,
  paymentType: string
) {
  const webhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL_GROWTH') || Deno.env.get('DISCORD_WEBHOOK_URL')
  if (!webhookUrl) return

  const amount = parseFloat(tradeAmt)
  const platformFee = Math.round(amount * 0.3)
  const merchantPayout = amount - platformFee

  const merchantNames = new Set<string>()
  let itemList = ''
  if (orderItems?.length) {
    itemList = orderItems.map((item: any) => {
      const name = item.store_products?.name_zh || item.store_products?.name || 'Product'
      const merchant = item.store_products?.merchant_stores
      if (merchant) {
        merchantNames.add(merchant.name_zh || merchant.name || 'Unknown')
      }
      return `• ${name} × ${item.quantity} — NT$${Number(item.unit_price).toLocaleString()}`
    }).join('\n')
  } else {
    itemList = '(No item details)'
  }

  const merchantLine = merchantNames.size > 0 ? [...merchantNames].join(', ') : 'N/A'

  const deliveryMethod = order.delivery_method
    ? (DELIVERY_LABELS[order.delivery_method] || order.delivery_method)
    : 'Not specified'
  let deliveryDetails = deliveryMethod
  if (order.cvs_store_info) deliveryDetails += `\n🏬 Store: ${order.cvs_store_info}`
  if (order.shipping_address) deliveryDetails += `\n🏠 Address: ${order.shipping_address}`

  const config = getConfig()
  const modeLabel = config.isProduction ? '🔴 PRODUCTION' : '🟡 SANDBOX'

  const embed = {
    title: '💰 New Payment Received! (Newebpay)',
    color: 0x2ECC71,
    fields: [
      { name: '🏬 Merchant', value: merchantLine, inline: true },
      { name: '👤 Buyer', value: `${order.buyer_name || 'N/A'}\n${order.buyer_email || ''}\n${order.buyer_phone ? '📞 ' + order.buyer_phone : ''}`, inline: true },
      { name: '💳 Payment', value: paymentType || 'Credit Card', inline: true },
      { name: '📦 Order Items', value: itemList, inline: false },
      { name: '🚚 Delivery', value: deliveryDetails, inline: false },
      { name: '💵 Total', value: `**NT$${amount.toLocaleString()}**`, inline: true },
      { name: '🏦 Platform Fee', value: `NT$${platformFee.toLocaleString()} (30%)`, inline: true },
      { name: '🛍️ Merchant Payout', value: `**NT$${merchantPayout.toLocaleString()}** (70%)`, inline: true },
      { name: '🔖 Trade No', value: tradeNo, inline: true },
      { name: '🏷️ Mode', value: modeLabel, inline: true },
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Halal Formosa Store — Payment Gateway (Newebpay)' },
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Halal Formosa Store', embeds: [embed] }),
    })
    console.log('[NEWEBPAY-NOTIFY] Discord notification sent')
  } catch (err) {
    console.error('[NEWEBPAY-NOTIFY] Discord failed:', err)
  }
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const formData = await req.formData()
    const allParams: Record<string, string> = {}
    formData.forEach((value, key) => { allParams[key] = String(value) })

    const status = allParams['Status']
    const merchantId = allParams['MerchantID']
    const tradeInfo = allParams['TradeInfo']
    const tradeSha = allParams['TradeSha']

    console.log(`[NEWEBPAY-NOTIFY] Status=${status}, MerchantID=${merchantId}`)

    if (!tradeInfo || !tradeSha) {
      console.error('[NEWEBPAY-NOTIFY] Missing TradeInfo/TradeSha')
      return new Response('0|Missing TradeInfo/TradeSha')
    }

    const config = getConfig()
    if (!config.hashKey || !config.hashIV) {
      console.error('[NEWEBPAY-NOTIFY] Newebpay not configured')
      return new Response('0|Not configured')
    }

    const expectedSha = genTradeSha(tradeInfo, config.hashKey, config.hashIV)
    if (tradeSha !== expectedSha) {
      console.error('[NEWEBPAY-NOTIFY] TradeSha MISMATCH')
      return new Response('0|TradeSha verification failed')
    }

    const decrypted = aesDecrypt(tradeInfo, config.hashKey, config.hashIV)
    const payload = JSON.parse(decrypted)
    const result = payload.Result || {}

    const merchantOrderNo = result.MerchantOrderNo || ''
    const tradeNo = result.TradeNo || ''
    const tradeAmt = String(result.Amt ?? '0')
    const paymentType = result.PaymentType || ''
    const isPaid = payload.Status === 'SUCCESS'

    console.log(`[NEWEBPAY-NOTIFY] OrderNo=${merchantOrderNo}, TradeNo=${tradeNo}, Status=${payload.Status}`)

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    if (isPaid) {
      const { error } = await supabase.from('store_orders')
        .update({
          status: 'paid',
          newebpay_trade_no: tradeNo,
          newebpay_status: payload.Status,
          updated_at: new Date().toISOString(),
        })
        .eq('merchant_trade_no', merchantOrderNo)

      if (error) {
        console.error('[NEWEBPAY-NOTIFY] DB error:', error)
        return new Response('0|Database error')
      }

      console.log(`[NEWEBPAY-NOTIFY] Order ${merchantOrderNo} PAID`)

      const { data: order } = await supabase
        .from('store_orders')
        .select('*, store_order_items(*, store_products(name, name_zh, merchant_stores(name, name_zh)))')
        .eq('merchant_trade_no', merchantOrderNo)
        .single()

      if (order) {
        await sendDiscordNotification(order, order.store_order_items || [], tradeNo, tradeAmt, paymentType)
      }
    } else {
      console.log(`[NEWEBPAY-NOTIFY] Payment not successful: ${merchantOrderNo} (Status: ${payload.Status})`)
      await supabase.from('store_orders')
        .update({ newebpay_status: payload.Status, updated_at: new Date().toISOString() })
        .eq('merchant_trade_no', merchantOrderNo)
    }

    // Newebpay expects a plain "1|OK"-style ack on the NotifyURL, same as ECPay.
    return new Response('1|OK')
  } catch (err: any) {
    console.error('[NEWEBPAY-NOTIFY] Fatal:', err)
    return new Response('0|Internal Error')
  }
})
