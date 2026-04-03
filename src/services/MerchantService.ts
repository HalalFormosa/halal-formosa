import { supabase } from '@/plugins/supabaseClient'
import { ActivityLogService } from '@/services/ActivityLogService'

export interface MerchantApplication {
  id?: string
  user_id?: string
  status?: 'pending' | 'approved' | 'rejected'
  store_name: string
  store_name_zh?: string
  store_address?: string
  store_description?: string
  contact_phone: string
  unified_business_number?: string
  rejection_reason?: string
  created_at?: string
  updated_at?: string
}

export class MerchantService {
  /**
   * Submit a new merchant application
   */
  static async submitApplication(application: Omit<MerchantApplication, 'id' | 'user_id' | 'status' | 'created_at' | 'updated_at'>) {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      throw new Error('User must be logged in to submit an application')
    }

    const payload = {
      ...application,
      user_id: user.id,
      status: 'pending',
      rejection_reason: null,
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('merchant_applications')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) {
      console.error('[MerchantService] Submit/Upsert error:', error)
      throw error
    }

    ActivityLogService.log('merchant_application_submit', { application_id: data.id, store_name: data.store_name })

    return data
  }

  /**
   * Get the current user's application status
   */
  static async getUserApplication() {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return null
    }

    const { data, error } = await supabase
      .from('merchant_applications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[MerchantService] Fetch error:', error)
      return null
    }

    return data
  }

  /**
   * Admin: Get all pending applications
   */
  static async getPendingApplications() {
    const { data, error } = await supabase
      .from('merchant_applications')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[MerchantService] Fetch pending applications error:', error)
      throw error
    }

    return data as MerchantApplication[]
  }

  /**
   * Admin: Count pending applications for badge
   */
  static async getPendingApplicationsCount() {
    const { count, error } = await supabase
      .from('merchant_applications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    if (error) {
      console.error('[MerchantService] Count pending applications error:', error)
      return 0
    }

    return count || 0
  }

  /**
   * Admin: Update application status (Approve/Reject)
   */
  static async updateApplicationStatus(id: string, status: 'approved' | 'rejected', rejectionReason?: string) {
    const { data, error } = await supabase
      .from('merchant_applications')
      .update({ 
        status, 
        rejection_reason: rejectionReason,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[MerchantService] Update status error:', error)
      throw error
    }

    ActivityLogService.log(
      status === 'approved' ? 'merchant_application_approve' : 'merchant_application_reject',
      { application_id: data.id, store_name: data.store_name, reason: rejectionReason }
    )

    return data
  }
}
