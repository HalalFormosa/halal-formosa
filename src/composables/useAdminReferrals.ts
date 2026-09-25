import { ref } from 'vue';
import { supabase } from '@/plugins/supabaseClient';

export interface ReferralFunnel {
  codes_generated: number;
  redeemed: number;
  converted: number;
  conversion_rate: number;
}

export interface ReferralListRow {
  redemption_id: string;
  referrer_user_id: string | null;
  referrer_name: string | null;
  referred_user_id: string;
  referred_name: string | null;
  code: string | null;
  status: 'no_code' | 'signed_up' | 'converted' | 'canceled';
  redeemed_at: string;
  converted_at: string | null;
  reward_id: string | null;
  reward_type: 'commission_ntd' | 'free_days' | null;
  reward_amount_ntd: number | null;
  reward_days: number | null;
  reward_status: 'pending' | 'approved' | 'paid' | 'granted' | 'failed' | null;
}

export interface AdminReferralConfig {
  mode: 'commission' | 'free_days';
  commission_amount_ntd: number;
  discount_days_referrer: number;
  discount_days_referred: number;
  commission_deadline: string | null;
}

const funnel = ref<ReferralFunnel | null>(null);
const rows = ref<ReferralListRow[]>([]);
const config = ref<AdminReferralConfig | null>(null);
const loading = ref(false);

async function loadFunnel(start?: string, end?: string) {
  const { data, error } = await supabase.rpc('admin_referral_funnel', { p_start: start ?? null, p_end: end ?? null });
  if (!error && data) funnel.value = data as ReferralFunnel;
  return funnel.value;
}

async function loadReferralList() {
  loading.value = true;
  try {
    const { data, error } = await supabase.rpc('admin_referral_list');
    if (!error && data) rows.value = data as ReferralListRow[];
    return rows.value;
  } finally {
    loading.value = false;
  }
}

async function loadConfig() {
  const { data, error } = await supabase
    .from('referral_config')
    .select('mode, commission_amount_ntd, discount_days_referrer, discount_days_referred, commission_deadline')
    .eq('id', true)
    .maybeSingle();
  if (!error && data) config.value = data as AdminReferralConfig;
  return config.value;
}

async function updateConfig(patch: Partial<AdminReferralConfig>, options?: { clearDeadline?: boolean }) {
  const { error } = await supabase.rpc('admin_update_referral_config', {
    p_mode: patch.mode ?? null,
    p_commission_amount_ntd: patch.commission_amount_ntd ?? null,
    p_discount_days_referrer: patch.discount_days_referrer ?? null,
    p_discount_days_referred: patch.discount_days_referred ?? null,
    p_commission_deadline: patch.commission_deadline ?? null,
    p_clear_deadline: options?.clearDeadline ?? false,
  });
  if (!error) await loadConfig();
  return error;
}

async function markCommissionPaid(rewardId: string) {
  const { error } = await supabase.rpc('admin_mark_commission_paid', { p_reward_id: rewardId });
  if (!error) await loadReferralList();
  return error;
}

export function useAdminReferrals() {
  return {
    funnel,
    rows,
    config,
    loading,
    loadFunnel,
    loadReferralList,
    loadConfig,
    updateConfig,
    markCommissionPaid,
  };
}
