import { supabase } from '@/plugins/supabaseClient'

/**
 * Sensitive profile fields (email, phone, birth date, gender, nationality) are read through
 * server functions instead of selecting them from user_profiles, so they can be hidden from
 * other users' queries. See supabase/migrations/*profile_pii*.
 */
export interface PrivateProfile {
    email: string | null
    phone: string | null
    date_of_birth: string | null
    gender: string | null
    nationality: string | null
}

export interface AdminUserContact extends PrivateProfile {
    id: string
    last_sign_in_at: string | null
}

/** The signed-in user's own private profile fields, or null if unavailable. */
export async function getMyPrivateProfile(): Promise<PrivateProfile | null> {
    try {
        const { data, error } = await supabase.rpc('get_my_private_profile')
        if (error) {
            console.warn('⚠️ get_my_private_profile failed:', error.message)
            return null
        }
        return (Array.isArray(data) ? data[0] : data) ?? null
    } catch (err) {
        console.warn('⚠️ get_my_private_profile threw:', err)
        return null
    }
}

/** Admin-only: contact details for the given users, keyed by user id. */
export async function adminGetUserContacts(userIds: string[]): Promise<Map<string, AdminUserContact>> {
    const result = new Map<string, AdminUserContact>()
    if (userIds.length === 0) return result
    try {
        const { data, error } = await supabase.rpc('admin_get_user_contacts', { p_user_ids: userIds })
        if (error) {
            console.warn('⚠️ admin_get_user_contacts failed:', error.message)
            return result
        }
        for (const row of (data ?? []) as AdminUserContact[]) result.set(row.id, row)
    } catch (err) {
        console.warn('⚠️ admin_get_user_contacts threw:', err)
    }
    return result
}
