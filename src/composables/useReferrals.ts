import { ref, computed } from 'vue';
import { supabase } from '@/plugins/supabaseClient';

export interface ReferralSummary {
  my_code: string | null;
  referred_by: { display_name: string | null; redeemed_at: string } | null;
  referrals: Array<{
    referred_user_id: string;
    display_name: string | null;
    status: 'signed_up' | 'converted' | 'canceled';
    redeemed_at: string;
    converted_at: string | null;
  }>;
  rewards: {
    reward_type: 'commission_ntd' | 'free_days' | null;
    total_ntd: number;
    pending_ntd: number;
    paid_ntd: number;
    total_days_granted: number;
  };
  active_campaign: ReferralCampaignProgress | null;
}

export interface ReferralCampaignProgress {
  id: string;
  starts_at: string;
  ends_at: string;
  my_valid_conversions: number;
  tiers: Array<{ threshold: number; amount_ntd: number; days_granted: number }>;
}

export interface ReferralConfig {
  mode: 'commission' | 'free_days';
  commission_amount_ntd: number;
  discount_days_referrer: number;
  discount_days_referred: number;
  commission_deadline: string | null;
}

const config = ref<ReferralConfig | null>(null);
const summary = ref<ReferralSummary | null>(null);
const loading = ref(false);

// Menu label reflects whichever reward mode is currently active.
const inviteMenuLabel = computed(() =>
  config.value?.mode === 'free_days' ? 'Invite & Earn Pro' : 'Invite & Earn NT$'
);

async function loadReferralConfig() {
  const { data, error } = await supabase
    .from('referral_config')
    .select('mode, commission_amount_ntd, discount_days_referrer, discount_days_referred, commission_deadline')
    .eq('id', true)
    .maybeSingle();
  if (!error && data) config.value = data as ReferralConfig;
  return config.value;
}

async function loadMyReferralSummary() {
  loading.value = true;
  try {
    const { data, error } = await supabase.rpc('get_my_referral_summary');
    if (!error && data) summary.value = data as ReferralSummary;
    return summary.value;
  } finally {
    loading.value = false;
  }
}

export function useReferrals() {
  return {
    config,
    summary,
    loading,
    inviteMenuLabel,
    loadReferralConfig,
    loadMyReferralSummary,
  };
}
