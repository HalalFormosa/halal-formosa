import { ref, computed } from 'vue'
import { supabase } from '@/plugins/supabaseClient'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { usePoints } from '@/composables/usePoints'

dayjs.extend(utc)
dayjs.extend(timezone)

export interface Mission {
    id: string
    label: string
    required: number
    current: number
    points: number
    completed: boolean
    icon: string
}

const missions = ref<Mission[]>([
    {
        id: 'open_app',
        label: 'Opening App',
        required: 1,
        current: 0,
        points: 5,
        completed: false,
        icon: 'home-outline'
    },
    {
        id: 'scan_ingredients',
        label: 'Scan Ingredients',
        required: 1,
        current: 0,
        points: 5,
        completed: false,
        icon: 'scan-outline'
    },
    {
        id: 'scan_barcode',
        label: 'Scan Barcode',
        required: 1,
        current: 0,
        points: 5,
        completed: false,
        icon: 'barcode-outline'
    },
    {
        id: 'find_muslim_friendly',
        label: 'Find Muslim-friendly product',
        required: 1,
        current: 0,
        points: 5,
        completed: false,
        icon: 'heart-outline'
    },
    {
        id: 'view_place_details',
        label: 'Check location details',
        required: 1,
        current: 0,
        points: 5,
        completed: false,
        icon: 'location-outline'
    },
    {
        id: 'add_product',
        label: 'Add A New Product',
        required: 1,
        current: 0,
        points: 10,
        completed: false,
        icon: 'add-circle-outline'
    }
])

const loading = ref(false)
const claimedBonus = ref(false)

const claimedMissions = ref<Record<string, boolean>>({})
const awardingMissions = new Set<string>() // 🛡️ Prevent double-awarding during rapid refresh

export function useDailyMissions() {
    const { awardAndCelebrate } = usePoints()

    const allCompleted = computed(() => {
        return missions.value.every(m => m.completed)
    })

    async function fetchProgress() {
        loading.value = true
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // 🕒 Calculate "Today" in Taipei (+8)
            const today = dayjs().tz('Asia/Taipei').startOf('day').toISOString()
            const tomorrow = dayjs().tz('Asia/Taipei').endOf('day').toISOString()

            // 1️⃣ Fetch activity logs (Source of Truth)
            const { data: logs, error } = await supabase
                .from('activity_log')
                .select('activity_type, activity_detail')
                .eq('user_id', user.id)
                .gte('created_at', today)
                .lt('created_at', tomorrow)

            if (error) {
                console.warn('[Missions] activity_log query error:', error.message)
                return
            }

            // Reset progress
            missions.value.forEach(m => {
                m.current = 0
                m.completed = false
            })

            // --- Process Logs ---
            logs?.forEach(log => {
                let detail = log.activity_detail
                if (typeof detail === 'string') {
                    try { detail = JSON.parse(detail) } catch { detail = {} }
                }

                switch (log.activity_type) {
                    case 'scan_ingredients_success': {
                        const mScan = missions.value.find(m => m.id === 'scan_ingredients')
                        if (mScan && mScan.current < mScan.required) mScan.current++

                        if (detail?.auto_status === 'Muslim-friendly') {
                            const mMF = missions.value.find(m => m.id === 'find_muslim_friendly')
                            if (mMF && mMF.current < mMF.required) mMF.current++
                        }
                        break
                    }

                    case 'explore_place_detail_open': {
                        const mView = missions.value.find(m => m.id === 'view_place_details')
                        if (mView && mView.current < mView.required) mView.current++
                        break
                    }

                    case 'home_page_open': {
                        const mOpen = missions.value.find(m => m.id === 'open_app')
                        if (mOpen && mOpen.current < mOpen.required) mOpen.current++
                        break
                    }

                    case 'barcode_scan_success': {
                        const mBarcode = missions.value.find(m => m.id === 'scan_barcode')
                        if (mBarcode && mBarcode.current < mBarcode.required) mBarcode.current++
                        break
                    }

                    case 'add_product_success':
                    case 'add_place_success': {
                        const mAddProd = missions.value.find(m => m.id === 'add_product')
                        if (mAddProd && mAddProd.current < mAddProd.required) mAddProd.current++
                        break
                    }
                }
            })

            // Fetch point logs to determine claimed status
            const { data: pointLogs } = await supabase
                .from('point_logs')
                .select('action')
                .eq('user_id', user.id)
                .gte('created_at', today)
                .lt('created_at', tomorrow)

            const logActions = pointLogs?.map(pl => pl.action) || []

            // Update completion status and claimed status
            missions.value.forEach(m => {
                const missionClaimAction = `mission_${m.id}`
                claimedMissions.value[m.id] = logActions.includes(missionClaimAction)

                // For add_product, it might have its own action
                if (m.id === 'add_product' && logActions.includes('add_product')) {
                    m.current = Math.max(m.current, 1)
                    claimedMissions.value[m.id] = true
                }

                if (m.current >= m.required) {
                    m.completed = true
                    // except for add_product which are awarded during submission
                    if (
                        !claimedMissions.value[m.id] &&
                        !awardingMissions.has(m.id) &&
                        m.id !== 'add_product'
                    ) {
                        console.log(`[Missions] Awarding points for: ${missionClaimAction}`)
                        awardingMissions.add(m.id)

                        awardAndCelebrate(missionClaimAction).finally(() => {
                            // We keep it in the set for a few seconds to let DB catch up
                            setTimeout(() => {
                                awardingMissions.delete(m.id)
                            }, 5000)
                        })

                        claimedMissions.value[m.id] = true
                    }
                }
            })

            claimedBonus.value = logActions.includes('daily_mission_bonus')

        } catch (err) {
            console.error('Error fetching mission progress:', err)
        } finally {
            loading.value = false
        }
    }

    async function checkAndAwardBonus() {
        if (allCompleted.value && !claimedBonus.value && !awardingMissions.has('daily_bonus')) {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            console.log('[Missions] Awarding daily bonus...')
            awardingMissions.add('daily_bonus')

            await awardAndCelebrate('daily_mission_bonus').finally(() => {
                setTimeout(() => {
                    awardingMissions.delete('daily_bonus')
                }, 5000)
            })

            claimedBonus.value = true
        }
    }

    return {
        missions,
        loading,
        claimedBonus,
        allCompleted,
        fetchProgress,
        checkAndAwardBonus
    }
}
