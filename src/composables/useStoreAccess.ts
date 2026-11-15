import { supabase } from '@/plugins/supabaseClient'

/**
 * True when the signed-in user is an admin or a listed owner/manager of this
 * store. UI guard only: every write is also checked on the server
 * (is_location_manager() / is_admin()), this just keeps everyone else off
 * store-management screens.
 */
export async function canManageLocation(locationId: number): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const [roleRes, ownerRes] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
    supabase.from('location_owners').select('role').eq('location_id', locationId).eq('user_id', user.id).maybeSingle(),
  ])
  return roleRes.data?.role === 'admin' || !!ownerRes.data
}
