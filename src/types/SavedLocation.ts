export interface SavedLocationFolder {
  id: string;
  user_id?: string;
  name: string;
  created_at: string;
  updated_at: string;
  saved_locations?: SavedLocation[];
}

export interface SavedLocation {
  id: string;
  user_id?: string;
  folder_id: string;
  location_id: number;
  created_at: string;
  locations?: Location;
}

export interface Location {
  id: number;
  name: string;
  address?: string | null;
  lat?: number;
  lng?: number;
  image?: string | null;
  type?: string;
  type_id?: number | null;
  location_types?: { name: string } | null;
  partner_tier?: string | null;
  description?: string | null;
  view_count?: number;
  created_at?: string;
  tags?: string[];
}
