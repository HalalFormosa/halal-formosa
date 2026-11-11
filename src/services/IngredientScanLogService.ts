import { supabase } from '@/plugins/supabaseClient'
import { Device } from '@capacitor/device'

export interface LogIngredientScanParams {
    source: 'camera' | 'gallery'
    productName?: string
    ingredientsTextZh?: string
    ingredientsTextEn?: string
    ocrRaw?: string
    autoStatus?: string
    highlightSummary?: any
    errorMessage?: string | null
    startTime?: number | null
}

// Shared with ScanIngredientsView's manual-flow logger — this is the source of
// truth for both the "Today Scans" counter (rows here with success=true) and
// the ingredient_scan_logs audit trail, so anywhere a scan actually completes
// (manual crop-and-analyze, or a live Auto Scan detection) should call this.
// `id` is the new ingredient_scan_logs row's id (null when nothing was stored), so a later event
// such as the scan-decision card can point back at its scan.
export async function logIngredientScan(
    params: LogIngredientScanParams
): Promise<{ success: boolean; id: string | number | null }> {
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            console.warn('⏩ No user logged in, skipping log')
            return { success: false, id: null }
        }

        const success = !!params.ingredientsTextZh?.trim() || !!params.ingredientsTextEn?.trim()
        const duration = params.startTime ? Date.now() - params.startTime : null
        const { model, platform } = await Device.getInfo()

        const { data: inserted, error } = await supabase.from('ingredient_scan_logs').insert([
            {
                user_id: user.id,
                product_name: params.productName || 'Unknown Product',
                ingredients_text_zh: params.ingredientsTextZh,
                ingredients_text_en: params.ingredientsTextEn,
                ocr_raw: params.ocrRaw,
                auto_status: params.autoStatus,
                highlight_summary: params.highlightSummary,
                source: params.source,
                error_message: params.errorMessage ?? null,
                success,
                // @ts-expect-error – injected global
                app_version: __APP_VERSION__,
                processing_time_ms: duration,
                device_model: model,
                platform
            }
        ]).select('id').maybeSingle()

        if (error) {
            console.error('❌ Log insert failed:', error)
            return { success: false, id: null }
        }

        console.log(params.errorMessage ? '⚠️ Logged failed scan' : '✅ Logged successful scan')
        return { success, id: inserted?.id ?? null }
    } catch (err) {
        console.error('Error logging scan:', err)
        return { success: false, id: null }
    }
}
