/**
 * Columns of `merchant_stores` that are safe to show to any user.
 *
 * The merchant's personal sender details (sender_name, sender_phone, sender_zipcode, sender_address) are
 * deliberately left out: read them only through the owner-only server function `get_my_merchant_sender()`
 * (see getMyMerchantSender below). Select this list instead of `select('*')`, because `*` will stop
 * working once those columns are hidden from other users (supabase/pending/PENDING_merchant_sender_lockdown.sql).
 *
 * New columns added to merchant_stores must be appended here (and granted in the lockdown script).
 */
import { supabase } from '@/plugins/supabaseClient'

export const MERCHANT_STORE_PUBLIC_COLUMNS = [
    'id', 'user_id', 'name', 'description', 'logo_url', 'is_active', 'created_at', 'updated_at',
    'name_zh', 'description_zh', 'banner_url', 'delivery_options', 'city_id',
    'ecpay_store_id', 'ecpay_store_name', 'ecpay_store_address', 'ecpay_store_type',
    'ecpay_7eleven_store_id', 'ecpay_7eleven_store_name', 'ecpay_7eleven_store_address',
    'ecpay_family_mart_store_id', 'ecpay_family_mart_store_name', 'ecpay_family_mart_store_address',
    'ecpay_hi_life_store_id', 'ecpay_hi_life_store_name', 'ecpay_hi_life_store_address',
    'ecpay_ok_mart_store_id', 'ecpay_ok_mart_store_name', 'ecpay_ok_mart_store_address',
    'cvs_7eleven_store_id', 'cvs_7eleven_store_name', 'cvs_7eleven_store_address',
    'cvs_family_mart_store_id', 'cvs_family_mart_store_name', 'cvs_family_mart_store_address',
    'cvs_hi_life_store_id', 'cvs_hi_life_store_name', 'cvs_hi_life_store_address',
    'cvs_ok_mart_store_id', 'cvs_ok_mart_store_name', 'cvs_ok_mart_store_address',
].join(', ')

export interface MerchantSenderInfo {
    sender_name: string | null
    sender_phone: string | null
    sender_zipcode: string | null
    sender_address: string | null
}

/** The signed-in merchant's own sender details, or null if they have no store / the call fails. */
export async function getMyMerchantSender(): Promise<MerchantSenderInfo | null> {
    try {
        const { data, error } = await supabase.rpc('get_my_merchant_sender')
        if (error) {
            console.warn('⚠️ get_my_merchant_sender failed:', error.message)
            return null
        }
        return (Array.isArray(data) ? data[0] : data) ?? null
    } catch (err) {
        console.warn('⚠️ get_my_merchant_sender threw:', err)
        return null
    }
}
