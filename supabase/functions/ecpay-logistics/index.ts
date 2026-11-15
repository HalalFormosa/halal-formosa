import { serve } from "https://deno.land/std/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { createHash } from "node:crypto"

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
  MERCHANT_ID: '2000933',
  HASH_KEY: 'XBERn1YOvpM9nfZc',
  HASH_IV: 'h1ONHk4P4yqbl5LK',
}

const STAGING_BASE = 'https://logistics-stage.ecpay.com.tw'
const PRODUCTION_BASE = 'https://logistics.ecpay.com.tw'

// Map our internal delivery method keys to ECPay LogisticsSubType (C2C)
const CVS_SUBTYPE_MAP: Record<string, string> = {
  '7eleven': 'UNIMARTC2C',
  'family_mart': 'FAMIC2C',
  'hi_life': 'HILIFEC2C',
  'ok_mart': 'OKMARTC2C',
}

// ECPay staging test store IDs
const TEST_STORE_IDS: Record<string, string> = {
  'UNIMARTC2C': '131386',
  'FAMIC2C': '006598',
  'HILIFEC2C': '006598',
  'OKMARTC2C': '1328',
}

// HOME delivery sub-type mapping
const HOME_SUBTYPE_MAP: Record<string, string> = {
  'TCAT': 'TCAT',
  'ECAN': 'ECAN',
  'POST': 'POST',
}

function getConfig() {
  const mode = (Deno.env.get('ECPAY_LOGISTICS_MODE') || 'sandbox').trim().toLowerCase()
  const isProduction = mode === 'production'
  const rawMerchantId = Deno.env.get('ECPAY_LOGISTICS_MERCHANT_ID')
  const rawHashKey = Deno.env.get('ECPAY_LOGISTICS_HASH_KEY')
  const rawHashIV = Deno.env.get('ECPAY_LOGISTICS_HASH_IV')

  const config = {
    merchantId: (isProduction
      ? rawMerchantId!
      : (rawMerchantId || SANDBOX_C2C.MERCHANT_ID)).trim(),
    hashKey: (isProduction
      ? rawHashKey!
      : (rawHashKey || SANDBOX_C2C.HASH_KEY)).trim(),
    hashIV: (isProduction
      ? rawHashIV!
      : (rawHashIV || SANDBOX_C2C.HASH_IV)).trim(),
    baseUrl: isProduction ? PRODUCTION_BASE : STAGING_BASE,
    isProduction,
  }
  console.log(`[ECPAY-LOGISTICS] Config resolved: mode=${mode}, merchantId=${config.merchantId}, keyLength=${config.hashKey?.length}, ivLength=${config.hashIV?.length}`)
  return config
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
  return createHash("md5").update(encodedStr).digest("hex").toUpperCase()
}

function generateTradeNo(): string {
  const rand = crypto.randomUUID().replace(/-/g, '').substring(0, 14).toUpperCase()
  return `HL${rand}`.substring(0, 20)
}

function formatDate(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('/') + ' ' + [
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
    String(d.getSeconds()).padStart(2, '0'),
  ].join(':')
}

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    SERVER_KEY
  )
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

// ============================================================
// ACTION: get_map_url — Generate ECPay CVS Map URL
// ============================================================
async function handleGetMapUrl(body: any) {
  const { deliveryMethod, orderId, clientOrigin } = body
  if (!deliveryMethod) return jsonResponse({ error: 'deliveryMethod is required' }, 400)

  const subType = CVS_SUBTYPE_MAP[deliveryMethod]
  if (!subType) return jsonResponse({ error: `Invalid delivery method: ${deliveryMethod}` }, 400)

  const config = getConfig()
  const tradeNo = generateTradeNo()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serverReplyURL = `${supabaseUrl}/functions/v1/ecpay-logistics?action=map_callback`

  const params: Record<string, any> = {
    MerchantID: config.merchantId,
    MerchantTradeNo: tradeNo,
    LogisticsType: 'CVS',
    LogisticsSubType: subType,
    IsCollection: 'N',
    ServerReplyURL: serverReplyURL,
    ExtraData: orderId || '',
    Device: 0,
  }

  console.log(`[ECPAY-LOGISTICS] get_map_url: subType=${subType}, tradeNo=${tradeNo}`)

  return jsonResponse({
    mapUrl: `${config.baseUrl}/Express/map`,
    params,
    tradeNo,
  })
}

// ============================================================
// ACTION: map_callback — Receive store selection from ECPay Map
// ============================================================
async function handleMapCallback(req: Request) {
  try {
    // ECPay Map API often uses Big5 encoding for store names and addresses.
    // We need to read the raw body and decode it carefully.
    const buffer = await req.arrayBuffer()
    
    // Try UTF-8 first, fallback to Big5 if needed
    let text = new TextDecoder('utf-8').decode(buffer)
    
    // Simple heuristic: if we see common garbled patterns, try Big5
    if (text.includes('CVSStoreName=') && (text.includes('æ') || text.includes('å') || text.includes('ç'))) {
       console.log('[ECPAY-LOGISTICS] Detected potential Big5 encoding, re-decoding...')
       text = new TextDecoder('big5').decode(buffer)
    }

    const params = new URLSearchParams(text)
    const allParams: Record<string, string> = {}
    params.forEach((value, key) => { allParams[key] = value })

    console.log('[ECPAY-LOGISTICS] map_callback decoded:', JSON.stringify(allParams))

    const storeId = allParams['CVSStoreID'] || ''
    const storeName = allParams['CVSStoreName'] || ''
    const storeAddress = allParams['CVSAddress'] || ''
    const extraData = allParams['ExtraData'] || ''
    const subType = allParams['LogisticsSubType'] || ''

    // If ExtraData contains an orderId, update the order directly
    if (extraData && extraData.length > 10) {
      const supabase = getSupabase()
      await supabase.from('store_orders').update({
        cvs_store_id: storeId,
        cvs_store_name: storeName,
        cvs_store_address: storeAddress,
      }).eq('id', extraData)
      console.log(`[ECPAY-LOGISTICS] Updated order ${extraData} with store: ${storeName} (${storeId})`)
    }

    // Return HTML page that posts message to opener window
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
      <script>
        const data = ${JSON.stringify({ storeId, storeName, storeAddress, subType })};
        if (window.opener) {
          window.opener.postMessage({ type: 'ecpay_cvs_store_selected', ...data }, '*');
          window.close();
        } else {
          document.body.innerHTML = '<h3>Store selected: ' + data.storeName + '</h3><p>You can close this window.</p>';
        }
      </script>
      <p>Processing store selection...</p>
    </body></html>`

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (err: any) {
    console.error('[ECPAY-LOGISTICS] map_callback error:', err)
    return new Response(`<html><body><p>Error: ${err.message}</p></body></html>`, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}

function sanitizeErrorMessage(msg: string): string {
  if (msg.includes('綠界帳戶可提領餘額為負數或不足支付物流運費')) {
    return '出貨單建立失敗（款項結算處理中）。請聯絡平台客服協助處理。 / Shipment creation failed (Payment settlement pending). Please contact platform support.'
  }
  return msg
}

// ============================================================
// ACTION: create_order — Create CVS logistics order at ECPay
// ============================================================
async function handleCreateOrder(body: any) {
  const { orderId } = body
  if (!orderId) return jsonResponse({ error: 'orderId is required' }, 400)

  const supabase = getSupabase()
  const config = getConfig()

  // Fetch order with merchant store info
  const { data: order, error: orderErr } = await supabase
    .from('store_orders')
    .select('*, merchant_stores(name, name_zh, user_id, description)')
    .eq('id', orderId)
    .single()

  if (orderErr || !order) return jsonResponse({ error: 'Order not found' }, 404)
  if (order.logistics_id) return jsonResponse({ error: 'Logistics order already created', logistics_id: order.logistics_id }, 400)

  const deliveryMethod = order.delivery_method
  const subType = CVS_SUBTYPE_MAP[deliveryMethod]
  if (!subType) return jsonResponse({ error: `Not a CVS delivery method: ${deliveryMethod}` }, 400)

  // Get sender info from merchant store
  let senderName = 'HalalFormosa'
  let senderPhone = '0912345678'
  let returnStoreId = ''
  if (order.store_id) {
    const { data: store } = await supabase
      .from('merchant_stores')
      .select('name, name_zh, user_id, sender_name, sender_phone, ecpay_7eleven_store_id, ecpay_family_mart_store_id, ecpay_hi_life_store_id, ecpay_ok_mart_store_id')
      .eq('id', order.store_id)
      .single()
    if (store) {
      // Use sender name (truncated to 10 chars for ECPay)
      const rawName = store.sender_name || store.name_zh || store.name || 'HalalFormosa'
      senderName = rawName.substring(0, 10)
      senderPhone = store.sender_phone || '0912345678'

      if (subType === 'UNIMARTC2C') {
        returnStoreId = store.ecpay_7eleven_store_id || ''
      } else if (subType === 'FAMIC2C') {
        returnStoreId = store.ecpay_family_mart_store_id || ''
      } else if (subType === 'HILIFEC2C') {
        returnStoreId = store.ecpay_hi_life_store_id || ''
      } else if (subType === 'OKMARTC2C') {
        returnStoreId = store.ecpay_ok_mart_store_id || ''
      }
    }
  }

  const tradeNo = generateTradeNo()
  const receiverStoreId = order.cvs_store_id || TEST_STORE_IDS[subType] || '131386'

  // Receiver info from order
  let receiverName = order.buyer_name || 'Buyer'
  receiverName = receiverName.substring(0, 10)
  const receiverPhone = order.buyer_phone || '0912345678'
  const receiverEmail = order.buyer_email || ''

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serverReplyURL = `${supabaseUrl}/functions/v1/ecpay-logistics-status`

  const params: Record<string, any> = {
    MerchantID: config.merchantId,
    MerchantTradeNo: tradeNo,
    MerchantTradeDate: formatDate(new Date()),
    LogisticsType: 'CVS',
    LogisticsSubType: subType,
    GoodsAmount: Math.floor(Number(order.total_amount)),
    GoodsName: 'HalalFormosa Order',
    IsCollection: 'N',
    SenderName: senderName,
    SenderCellPhone: senderPhone,
    ReceiverName: receiverName,
    ReceiverCellPhone: receiverPhone.startsWith('09') ? receiverPhone : '0912345678',
    ReceiverEmail: receiverEmail,
    ServerReplyURL: serverReplyURL,
    ReceiverStoreID: receiverStoreId,
  }

  // 7-Eleven C2C supports ReturnStoreID to specify return store
  if (subType === 'UNIMARTC2C' && returnStoreId) {
    params.ReturnStoreID = returnStoreId
  }

  params.CheckMacValue = await generateCheckMac(params, config.hashKey, config.hashIV)

  console.log(`[ECPAY-LOGISTICS] create_order: orderId=${orderId}, tradeNo=${tradeNo}, subType=${subType}, store=${receiverStoreId}`)

  try {
    // POST to ECPay Express/Create
    const formBody = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&')

    const resp = await fetch(`${config.baseUrl}/Express/Create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody,
    })

    const responseText = await resp.text()
    console.log(`[ECPAY-LOGISTICS] ECPay response: ${responseText}`)

    // Parse response: "1|key=value&key=value..." or "0|ErrorMessage"
    if (responseText.startsWith('1|')) {
      const dataStr = responseText.substring(2)
      const respParams: Record<string, string> = {}
      dataStr.split('&').forEach(pair => {
        const [k, v] = pair.split('=')
        if (k) respParams[decodeURIComponent(k.trim())] = decodeURIComponent((v || '').trim())
      })

      const logisticsId = respParams['AllPayLogisticsID'] || ''
      const cvsPaymentNo = respParams['CVSPaymentNo'] || ''
      const cvsValidationNo = respParams['CVSValidationNo'] || ''

      // Update order in DB
      await supabase.from('store_orders').update({
        logistics_id: logisticsId,
        logistics_trade_no: tradeNo,
        cvs_payment_no: cvsPaymentNo,
        cvs_validation_no: cvsValidationNo,
        logistics_status: respParams['RtnCode'] || '',
        logistics_status_msg: respParams['RtnMsg'] || '',
      }).eq('id', orderId)

      console.log(`[ECPAY-LOGISTICS] Order ${orderId} logistics created: ID=${logisticsId}, PaymentNo=${cvsPaymentNo}`)

      return jsonResponse({
        success: true,
        logistics_id: logisticsId,
        cvs_payment_no: cvsPaymentNo,
        cvs_validation_no: cvsValidationNo,
      })
    } else {
      const errorMsg = responseText.startsWith('0|') ? responseText.substring(2) : responseText
      console.error(`[ECPAY-LOGISTICS] ECPay error: ${errorMsg}`)
      return jsonResponse({ error: sanitizeErrorMessage(errorMsg) }, 400)
    }
  } catch (err: any) {
    console.error('[ECPAY-LOGISTICS] create_order fetch error:', err)
    return jsonResponse({ error: err.message }, 500)
  }
}

// ============================================================
// ACTION: create_home_order — Create HOME delivery logistics order (TCAT)
// ============================================================
async function handleCreateHomeOrder(body: any) {
  const { orderId, courierSubType } = body
  if (!orderId) return jsonResponse({ error: 'orderId is required' }, 400)

  const subType = HOME_SUBTYPE_MAP[courierSubType || 'TCAT'] || 'TCAT'

  const supabase = getSupabase()
  const config = getConfig()

  // Fetch order with merchant store info
  const { data: order, error: orderErr } = await supabase
    .from('store_orders')
    .select('*, merchant_stores(name, name_zh, user_id, sender_name, sender_phone, sender_zipcode, sender_address)')
    .eq('id', orderId)
    .single()

  if (orderErr || !order) return jsonResponse({ error: 'Order not found' }, 404)
  if (order.logistics_id) return jsonResponse({ error: 'Logistics order already created', logistics_id: order.logistics_id }, 400)
  if (order.delivery_method !== 'home_delivery') return jsonResponse({ error: 'Not a home delivery order' }, 400)

  // Validate receiver address
  if (!order.shipping_address) return jsonResponse({ error: 'Shipping address is required for home delivery' }, 400)
  if (!order.buyer_phone) return jsonResponse({ error: 'Buyer phone is required for home delivery' }, 400)

  // Get sender info from merchant store
  const merchantStore = order.merchant_stores
  const senderName = (merchantStore?.sender_name || merchantStore?.name_zh || merchantStore?.name || 'HalalFormosa').substring(0, 10)
  const senderPhone = merchantStore?.sender_phone || '0912345678'
  const senderZipcode = merchantStore?.sender_zipcode || '106' // Default Taipei Da'an
  const senderAddress = merchantStore?.sender_address || '台北市大安區'

  // Receiver info from order
  const receiverName = (order.buyer_name || 'Buyer').substring(0, 10)
  const receiverPhone = order.buyer_phone.startsWith('09') ? order.buyer_phone : '0912345678'
  const receiverEmail = order.buyer_email || ''

  // Parse zipcode from shipping address (first 3 or 5 digits) or use default
  const zipcodeMatch = order.shipping_address.match(/^(\d{3,5})/)
  const receiverZipcode = zipcodeMatch ? zipcodeMatch[1] : '100'

  const tradeNo = generateTradeNo()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serverReplyURL = `${supabaseUrl}/functions/v1/ecpay-logistics-status`

  // Determine COD
  const isCollection = order.is_cod ? 'Y' : 'N'

  // Calculate goods amount (total + shipping fee for COD, or just total)
  const goodsAmount = Math.floor(Number(order.total_amount) + Number(order.shipping_fee || 0))

  const params: Record<string, any> = {
    MerchantID: config.merchantId,
    MerchantTradeNo: tradeNo,
    MerchantTradeDate: formatDate(new Date()),
    LogisticsType: 'HOME',
    LogisticsSubType: subType,
    GoodsAmount: goodsAmount,
    GoodsName: 'HalalFormosa Order',
    IsCollection: isCollection,
    SenderName: senderName,
    SenderPhone: senderPhone.length >= 10 ? senderPhone : '',
    SenderCellPhone: senderPhone,
    SenderZipCode: senderZipcode,
    SenderAddress: senderAddress,
    ReceiverName: receiverName,
    ReceiverPhone: receiverPhone.length >= 10 ? receiverPhone : '',
    ReceiverCellPhone: receiverPhone,
    ReceiverZipCode: receiverZipcode,
    ReceiverAddress: order.shipping_address,
    ReceiverEmail: receiverEmail,
    Temperature: '0001', // Room temperature
    Distance: '00',      // Same city default
    Specification: '0001', // 60cm
    ScheduledPickupTime: '4',  // Anytime
    ScheduledDeliveryTime: '4', // Anytime
    ServerReplyURL: serverReplyURL,
  }

  // COD specific: CollectionAmount
  if (isCollection === 'Y') {
    params.CollectionAmount = goodsAmount
  }

  params.CheckMacValue = await generateCheckMac(params, config.hashKey, config.hashIV)

  console.log(`[ECPAY-LOGISTICS] create_home_order: orderId=${orderId}, tradeNo=${tradeNo}, subType=${subType}, COD=${isCollection}`)

  try {
    const formBody = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&')

    const resp = await fetch(`${config.baseUrl}/Express/Create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody,
    })

    const responseText = await resp.text()
    console.log(`[ECPAY-LOGISTICS] ECPay HOME response: ${responseText}`)

    if (responseText.startsWith('1|')) {
      const dataStr = responseText.substring(2)
      const respParams: Record<string, string> = {}
      dataStr.split('&').forEach(pair => {
        const [k, v] = pair.split('=')
        if (k) respParams[decodeURIComponent(k.trim())] = decodeURIComponent((v || '').trim())
      })

      const logisticsId = respParams['AllPayLogisticsID'] || ''
      const bookingNote = respParams['BookingNote'] || ''

      // Update order in DB with tracking info
      await supabase.from('store_orders').update({
        logistics_id: logisticsId,
        logistics_trade_no: tradeNo,
        tracking_number: logisticsId, // For HOME delivery, LogisticsID is the tracking number
        courier_name: subType === 'TCAT' ? 'Black Cat 黑貓宅急便' : subType,
        logistics_status: respParams['RtnCode'] || '',
        logistics_status_msg: respParams['RtnMsg'] || bookingNote || '',
        status: 'shipped',
        shipped_at: new Date().toISOString(),
      }).eq('id', orderId)

      console.log(`[ECPAY-LOGISTICS] Home delivery order ${orderId} created: LogisticsID=${logisticsId}`)

      return jsonResponse({
        success: true,
        logistics_id: logisticsId,
        tracking_number: logisticsId,
        booking_note: bookingNote,
      })
    } else {
      const errorMsg = responseText.startsWith('0|') ? responseText.substring(2) : responseText
      console.error(`[ECPAY-LOGISTICS] ECPay HOME error: ${errorMsg}`)
      return jsonResponse({ error: sanitizeErrorMessage(errorMsg) }, 400)
    }
  } catch (err: any) {
    console.error('[ECPAY-LOGISTICS] create_home_order fetch error:', err)
    return jsonResponse({ error: err.message }, 500)
  }
}

// ============================================================
// ACTION: print_label — Get print label URL
// ============================================================
async function handlePrintLabel(body: any) {
  const { orderId } = body
  if (!orderId) return jsonResponse({ error: 'orderId is required' }, 400)

  const supabase = getSupabase()
  const config = getConfig()

  const { data: order } = await supabase
    .from('store_orders')
    .select('logistics_id, cvs_payment_no, cvs_validation_no, delivery_method, logistics_trade_no')
    .eq('id', orderId)
    .single()

  if (!order?.logistics_id) return jsonResponse({ error: 'No logistics order found' }, 400)

  // HOME delivery print label
  if (order.delivery_method === 'home_delivery') {
    const params: Record<string, any> = {
      MerchantID: config.merchantId,
      AllPayLogisticsID: order.logistics_id,
    }
    params.CheckMacValue = await generateCheckMac(params, config.hashKey, config.hashIV)

    const printUrl = `${config.baseUrl}/Express/PrintTradeDoc`
    console.log(`[ECPAY-LOGISTICS] print_label HOME: orderId=${orderId}, url=${printUrl}`)

    return jsonResponse({ printUrl, params })
  }

  // CVS print label (existing logic)
  const subType = CVS_SUBTYPE_MAP[order.delivery_method] || ''

  let printUrl = ''
  const params: Record<string, any> = {
    MerchantID: config.merchantId,
    AllPayLogisticsID: order.logistics_id,
    CVSPaymentNo: order.cvs_payment_no || '',
    CVSValidationNo: order.cvs_validation_no || '',
  }

  // C2C print endpoints differ by brand
  if (subType === 'UNIMARTC2C') {
    printUrl = `${config.baseUrl}/Express/PrintUniMartC2COrderInfo`
  } else if (subType === 'FAMIC2C') {
    printUrl = `${config.baseUrl}/Express/PrintFAMIC2COrderInfo`
  } else if (subType === 'HILIFEC2C') {
    printUrl = `${config.baseUrl}/Express/PrintHILIFEC2COrderInfo`
  } else if (subType === 'OKMARTC2C') {
    printUrl = `${config.baseUrl}/Express/PrintOKMARTC2COrderInfo`
  } else {
    return jsonResponse({ error: `Unsupported subtype for printing: ${subType}` }, 400)
  }

  params.CheckMacValue = await generateCheckMac(params, config.hashKey, config.hashIV)

  console.log(`[ECPAY-LOGISTICS] print_label: orderId=${orderId}, url=${printUrl}`)

  return jsonResponse({
    printUrl,
    params,
  })
}

// ============================================================
// Main Router
// ============================================================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const url = new URL(req.url)
    const actionParam = url.searchParams.get('action')

    // map_callback comes as form POST from ECPay
    if (actionParam === 'map_callback') {
      return await handleMapCallback(req)
    }

    // All other actions come as JSON POST
    const body = await req.json()
    const action = body.action || actionParam

    switch (action) {
      case 'get_map_url':
        return await handleGetMapUrl(body)
      case 'create_order':
        return await handleCreateOrder(body)
      case 'create_home_order':
        return await handleCreateHomeOrder(body)
      case 'print_label':
        return await handlePrintLabel(body)
      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400)
    }
  } catch (err: any) {
    console.error('[ECPAY-LOGISTICS] Fatal error:', err)
    return jsonResponse({ error: err.message }, 500)
  }
})
