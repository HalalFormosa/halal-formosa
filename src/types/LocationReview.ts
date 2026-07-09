export type TriState = 'yes' | 'no' | 'unsure';

export interface LocationReview {
  id?: string;
  location_id: number;
  user_id: string;
  rating: number | null;
  comment: string | null;
  facilities: Record<string, TriState>;
  created_at?: string;
  updated_at?: string;
  user_profiles?: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface FacilitySummaryCount {
  yes?: number;
  no?: number;
  unsure?: number;
}

export type FacilitySummary = Record<string, FacilitySummaryCount>;

export interface LocationVisit {
  id: string;
  user_id: string;
  location_id: number;
  first_seen_at: string;
  last_seen_at: string;
  dwell_confirmed: boolean;
  prompt_sent_at: string | null;
  dismissed: boolean;
  reviewed: boolean;
}
