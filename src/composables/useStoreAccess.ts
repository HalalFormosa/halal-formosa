import { supabase } from '@/plugins/supabaseClient'

// Owner invites (an admin added this email to a store) are applied once per
// signed-in user per page session. Web and mobile behave the same: the invite
// only needs the person to be logged in with that (confirmed) email.
let invitesCheckedFor: string | null = null

export async function acceptPendingOwnerInvites(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || invitesCheckedFor === user.id) return 0
  invitesCheckedFor = user.id
  const { data, error } = await supabase.rpc('accept_my_pending_owner_invites')
  if (error) {
    invitesCheckedFor = null // try again next time
    console.warn('[useStoreAccess] accept_my_pending_owner_invites', error)
    return 0
  }
  return Number(data ?? 0)
}

async function check(locationId: number, userId: string): Promise<boolean> {
  const [roleRes, ownerRes] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
    supabase.from('location_owners').select('role').eq('location_id', locationId).eq('user_id', userId).maybeSingle(),
  ])
  return roleRes.data?.role === 'admin' || !!ownerRes.data
}

/**
 * True when the signed-in user is an admin or a listed owner/manager of this
 * store. UI guard only: every write is also checked on the server
 * (is_location_manager() / is_admin()), this just keeps everyone else off
 * store-management screens. Applies any pending owner invite for the user's
 * email first, so a newly added owner can open the Redeem page straight away.
 */
export async function canManageLocation(locationId: number): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  if (await check(locationId, user.id)) return true
  if ((await acceptPendingOwnerInvites()) > 0) return check(locationId, user.id)
  return false
}
