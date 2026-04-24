export interface Product {
    id: string
    barcode: string
    name: string
    status: string
    product_category_id: number | null
    ingredients: string
    description: string
    photo_front_url?: string | null
    photo_back_url?: string | null
    added_by?: string
    updated_by?: string
    created_at?: string
    updated_at?: string
    approved?: boolean

    // 🟢 new fields
    approved_by?: string | null   // uuid of the approver (admin/contributor)
    approved_at?: string | null   // ISO timestamp when approved

    // ✅ relation
    product_categories: { id: number; name: string }

    author?: {
        display_name: string | null;
        public_profile: boolean;
    } | null;

    // ✅ stores (flattened for UI use)
    stores?: { id: string; name: string; logo_url?: string | null }[]

    // ✅ partner relation
    partner?: {
        id: string;
        name: string;
        partner_tier: string | null;
        partner_type: string | null;
        logo_url: string | null;
        verified: boolean;
    } | null;

    partner_id?: string | null;
    partner_tier?: string | null;
    tags?: string[];
}
