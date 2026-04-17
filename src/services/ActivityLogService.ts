import {supabase} from '@/plugins/supabaseClient'
import SessionService from '@/services/SessionService'

// ðŸ”§ TEMPORARY GLOBAL SWITCH
const ACTIVITY_LOG_ENABLED = true

/* -------------------------
   Types
-------------------------- */
type EntityResult = {
    entity_type: string | null
    entity_id: string | null
}

/* -------------------------
   Helpers
-------------------------- */
function normalizeDetail(detail: any): Record<string, any> {
    return detail && typeof detail === 'object' ? detail : {}
}

function resolveEntity(activity: string, rawDetail: any): EntityResult {
    const detail = normalizeDetail(rawDetail)

    switch (activity) {

        // ðŸŸ¢ PLACE interactions
        case 'home_location_click':
        case 'explore_share_place':
        case 'explore_place_detail_view':
        case 'explore_place_detail_open':
        case 'explore_detail_open_image':
        case 'explore_place_card_click':
        case 'explore_detail_open_maps':
        case 'explore_marker_click':
        case 'explore_detail_edit':
            return {
                entity_type: 'place',
                entity_id: detail.id ? String(detail.id) : null
            }

        // ðŸŸ¢ PRODUCT interactions
        case 'barcode_scan_success':
        case 'product_details_open':
        case 'search_product_click':
        case 'home_product_click':
        case 'product_image_open':
        case 'related_product_click': {
            const raw =
                detail.barcode ??
                detail.clicked_barcode ??
                null

            return {
                entity_type: 'product',
                entity_id: raw != null ? String(raw) : null
            }
        }

        // ðŸŸ¢ TRIP interactions
        case 'trip_open':
        case 'trip_click':
            return {
                entity_type: 'trip',
                entity_id: detail.trip_id
                    ? String(detail.trip_id)
                    : null
            }

        case 'trip_filter_category_add':
        case 'trip_filter_category_remove':
            return {
                entity_type: 'category',
                entity_id: detail.category_id
                    ? String(detail.category_id)
                    : null
            }

        case 'trip_filter_city_add':
        case 'trip_filter_city_remove':
            return {
                entity_type: 'city',
                entity_id: detail.city_slug
                    ? String(detail.city_slug)
                    : null
            }


        // ðŸŸ¢ NEWS interactions
        case 'home_news_click':
        case 'news_page_open':
        case 'news_detail_open':
        case 'news_share':
            return {
                entity_type: 'news',
                entity_id: detail.id
                    ? String(detail.id)
                    : detail.news_id
                        ? String(detail.news_id)
                        : null
            }

        // ðŸŸ¢ PARTNER interactions
        case 'partner_click':
        case 'partner_detail_open':
        case 'partner_logo_preview':
        case 'partner_website_click':
        case 'partner_trip_click':
        case 'partner_certified_product_click':
        case 'partner_certified_location_click':
            return {
                entity_type: 'partner',
                entity_id: detail.partner_id
                    ? String(detail.partner_id)
                    : null
            }

        case 'partners_page_open':
            return {
                entity_type: null,
                entity_id: null
            }

        case 'partner_search':
            return {
                entity_type: null,
                entity_id: null
            }

        case 'partner_filter_add':
        case 'partner_filter_remove':
            return {
                entity_type: 'partner_scope',
                entity_id: detail.category_id
                    ? String(detail.category_id)
                    : null
            }

        case 'partner_filter_clear':
            return {
                entity_type: null,
                entity_id: null
            }


        // ðŸŸ¢ SEARCH interactions
        case 'search_no_results':
             return {
                entity_type: 'search_query',
                entity_id: detail.query ? String(detail.query) : null
            }


        // ðŸŸ¢ SEARCH FILTER interactions
        case 'search_filter_category':
            return {
                entity_type: 'category',
                entity_id: detail.category_id
                    ? String(detail.category_id)
                    : (detail.category_ids && detail.category_ids.length > 0)
                        ? String(detail.category_ids[detail.category_ids.length - 1])
                        : null
            }

        case 'search_filter_store':
            return {
                entity_type: 'store',
                entity_id: detail.store_id
                    ? String(detail.store_id)
                    : (detail.store_ids && detail.store_ids.length > 0)
                        ? String(detail.store_ids[detail.store_ids.length - 1])
                        : null
            }

        // Optional: keep status as non-entity
        case 'search_filter_status':
            return {
                entity_type: null,
                entity_id: null
            }

        // ðŸŸ¢ CATEGORY interactions
        case 'explore_filter_category':
            return {
                entity_type: 'category',
                entity_id: detail.category_id
                    ? String(detail.category_id)
                    : (detail.category_ids && detail.category_ids.length > 0)
                        ? String(detail.category_ids[detail.category_ids.length - 1])
                        : null
            }

        // ðŸŸ¢ USER-to-USER interactions
        case 'home_leaderboard_profile':
            return {
                entity_type: 'user',
                entity_id: detail.user_id ?? null
            }

        // ðŸŸ¢ USER
        case 'profile_page_open':
        case 'profile_edit_open':
        case 'profile_logout':
            return {
                entity_type: 'user',
                entity_id: detail.user_id ?? null
            }

// ðŸŸ¢ MONETIZATION
        case 'pro_paywall_open':
        case 'pro_purchase_success':
            return {
                entity_type: 'entitlement',
                entity_id: detail.entitlement ?? 'Halal Formosa Pro'
            }

// ðŸŸ¢ DONATION
        case 'donation_click':
        case 'donation_success':
            return {
                entity_type: 'product',
                entity_id: detail.product ?? null
            }

        // ðŸŸ¢ SOCIAL
        case 'social_link_click':
            return {
                entity_type: 'external_link',
                entity_id: detail.platform ?? null
            }

        // ðŸŸ¢ STORE / MERCHANT
        case 'store_product_click':
        case 'store_product_detail_open':
        case 'store_add_to_cart':
        case 'store_buy_now':
        case 'store_chat_open':
            return {
                entity_type: 'store_product',
                entity_id: detail.product_id ? String(detail.product_id) : null
            }

        case 'store_merchant_click':
        case 'store_visit_merchant':
            return {
                entity_type: 'merchant_store',
                entity_id: detail.store_id ? String(detail.store_id) : null
            }

        case 'store_checkout_submit':
        case 'store_order_success':
            return {
                entity_type: 'store_order',
                entity_id: detail.order_id ? String(detail.order_id) : null
            }

        case 'merchant_application_submit':
        case 'merchant_application_approve':
        case 'merchant_application_reject':
            return {
                entity_type: 'merchant_application',
                entity_id: detail.application_id ? String(detail.application_id) : null
            }

        // ðŸŸ¢ REELS
        case 'reels_item_view':
        case 'reels_preview_limit_reached':
        case 'reels_view_original_click':
        case 'reels_restart_preview':
        case 'explore_reel_open':
        case 'home_media_partner_open':
        case 'reels_audio_toggle':
            return {
                entity_type: 'reel',
                entity_id: detail.reel_id ? String(detail.reel_id) : null
            }

        case 'reels_page_open':
        case 'reels_section_view_more':
            return {
                entity_type: null,
                entity_id: null
            }

        // ðŸŸ¢ AUTH interactions
        case 'auth_login_success':
        case 'auth_login_failed':
        case 'auth_signup_success':
        case 'auth_signup_failed':
            return {
                entity_type: 'auth_method',
                entity_id: detail.method ?? 'email'
            }

        // ðŸŸ¢ SETTINGS
        case 'settings_language_change':
            return {
                entity_type: 'language',
                entity_id: detail.language ?? null
            }

        case 'settings_theme_toggle':
            return {
                entity_type: 'theme',
                entity_id: detail.theme ?? null
            }

        // ðŸŸ¢ UTILITIES
        case 'utility_qibla_open':
            return {
                entity_type: null,
                entity_id: null
            }

        // ðŸŸ¢ CONTRIBUTIONS
        case 'add_product_start':
        case 'add_product_ocr_start':
        case 'add_product_submit_success':
            return {
                entity_type: 'product',
                entity_id: detail.barcode ? String(detail.barcode) : null
            }


        // âŒ Everything else
        default:
            return {
                entity_type: null,
                entity_id: null
            }
    }
}

function resolveActivityGroup(activity: string): string | null {
    switch (activity) {

        /* -------------------------
           HOME SURFACE
        -------------------------- */
        case 'home_page_open':
        case 'home_scan_barcode':
        case 'home_product_click':
        case 'home_location_click':
            return 'home'

        /* -------------------------
           SEARCH SURFACE
        -------------------------- */
        case 'search_page_open':
        case 'search_product_click':
        case 'search_filter_category':
        case 'search_filter_store':
        case 'search_filter_status':
        case 'search_sort_change':
            return 'search'

        /* -------------------------
           PRODUCT EXPERIENCE
        -------------------------- */
        case 'barcode_scan_start':
        case 'barcode_scan_success':
        case 'product_details_open':
        case 'product_image_open':
        case 'related_product_click':
            return 'product'

        /* -------------------------
           EXPLORE / MAP EXPERIENCE
        -------------------------- */
        case 'explore_page_open':
        case 'explore_center_user':
        case 'explore_place_card_click':
        case 'explore_marker_click':
            return 'explore'

        /* -------------------------
           PLACE EXPERIENCE
        -------------------------- */
        case 'explore_place_detail_view':
        case 'explore_place_detail_open':
        case 'explore_detail_open_image':
        case 'explore_detail_open_maps':
        case 'explore_detail_edit':
        case 'explore_share_place':
            return 'place'

        /* -------------------------
           TRIP EXPERIENCE
        -------------------------- */
        case 'trip_page_open':
        case 'trip_open':
        case 'trip_click':
        case 'trip_search':
        case 'trip_sort_change':
        case 'trip_filter_category_add':
        case 'trip_filter_category_remove':
        case 'trip_filter_city_add':
        case 'trip_filter_city_remove':
        case 'trip_filter_clear':
            return 'trip'


        /* -------------------------
           NEWS
        -------------------------- */
        case 'home_news_click':
        case 'home_viewmore_news':
        case 'news_page_open':
        case 'news_detail_open':
        case 'news_share':
            return 'news'

        /* -------------------------
           PARTNER EXPERIENCE
        -------------------------- */
        case 'partners_page_open':
        case 'partner_click':
        case 'partner_detail_open':
        case 'partner_logo_preview':
        case 'partner_website_click':
        case 'partner_search':
        case 'partner_filter_add':
        case 'partner_filter_remove':
        case 'partner_filter_clear':
        case 'partner_trip_click':
        case 'partner_certified_product_click':
        case 'partner_certified_location_click':
            return 'partner'


        /* -------------------------
           PROFILE
        -------------------------- */
        case 'profile_page_open':
        case 'profile_edit_open':
        case 'profile_logout':
            return 'profile'

        /* -------------------------
           MONETIZATION
        -------------------------- */
        case 'pro_paywall_open':
        case 'pro_purchase_success':
        case 'pro_paywall_trigger':
        case 'donation_click':
        case 'donation_success':
            return 'monetization'

        /* -------------------------
           SOCIAL / OUTBOUND
        -------------------------- */
        case 'social_link_click':
            return 'social'

        /* -------------------------
           STORE / MERCHANT
        -------------------------- */
        case 'store_page_open':
        case 'store_search':
        case 'store_filter_category':
        case 'store_product_click':
        case 'store_banner_click':
        case 'store_cart_open':
        case 'store_checkout_click':
        case 'store_product_detail_open':
        case 'store_add_to_cart':
        case 'store_buy_now':
        case 'store_visit_merchant':
        case 'store_chat_open':
        case 'store_checkout_page_open':
        case 'store_order_submit':
        case 'store_order_success':
        case 'store_payment_failed':
            return 'store'

        case 'merchant_application_submit':
        case 'merchant_application_approve':
        case 'merchant_application_reject':
        case 'merchant_admin_view_applications':
        case 'merchant_registration_page_open':
        case 'merchant_registration_step_view':
            return 'merchant'

        /* -------------------------
           SOCIAL REELS
        -------------------------- */
        case 'reels_page_open':
        case 'reels_section_view_more':
        case 'reels_item_view':
        case 'reels_preview_limit_reached':
        case 'reels_view_original_click':
        case 'reels_restart_preview':
        case 'explore_reel_open':
        case 'home_media_partner_open':
        case 'reels_audio_toggle':
            return 'social_reels'

        /* -------------------------
           AUTH
        -------------------------- */
        case 'auth_login_success':
        case 'auth_login_failed':
        case 'auth_signup_success':
        case 'auth_signup_failed':
            return 'auth'

        /* -------------------------
           SETTINGS
        -------------------------- */
        case 'settings_language_change':
        case 'settings_theme_toggle':
            return 'settings'

        /* -------------------------
           UTILITIES
        -------------------------- */
        case 'utility_qibla_open':
            return 'utilities'

        /* -------------------------
           CONTRIBUTIONS
        -------------------------- */
        case 'add_product_start':
        case 'add_product_ocr_start':
        case 'add_product_submit_success':
            return 'contributions'

        /* -------------------------
           SEARCH NO RESULTS
        -------------------------- */
        case 'search_no_results':
            return 'search'

        /* -------------------------
           FALLBACK
        -------------------------- */
        default:
            return null
    }
}

/* -------------------------
   Service
-------------------------- */
export class ActivityLogService {
    static async log(activity: string, detail: any = {}) {

        // ðŸš« HARD STOP (no Supabase, no auth, no side effects)
        if (!ACTIVITY_LOG_ENABLED) {
            console.log("[ActivityLogService] Skipped")
            return
        }

        const user = (await supabase.auth.getUser()).data.user
        const session_id = SessionService.getSessionId()

        if (!user) {
            console.warn('[ActivityLogService] No user logged in')
            return
        }

        const { entity_type, entity_id } = resolveEntity(activity, detail)

        const skipWarn = activity === 'add_product_start' || activity === 'add_product_ocr_start'; if (entity_type && !entity_id && !skipWarn) {
            console.warn(
                `[ActivityLogService] Missing entity_id for activity "${activity}"`,
                detail
            )
        }

        const activity_group = resolveActivityGroup(activity)

        const payload = {
            user_id: user.id,
            session_id,
            activity_type: activity,
            activity_group,
            activity_detail: detail,
            entity_type,
            entity_id
        }

        const { error } = await supabase
            .from('activity_log')
            .insert(payload)

        if (error) {
            console.error('[ActivityLogService] Insert error:', error)
        }
    }
}
