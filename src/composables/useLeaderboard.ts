import { ref } from "vue";
import { supabase } from "@/plugins/supabaseClient";

export function getThemedAnonymousName(userId: string, index: number): string {
    const names = [
        "Boba",
        "Mochi",
        "Tofu",
        "Oolong",
        "Taroko",
        "Alishan",
        "Formosa",
        "Foodie",
        "Traveler",
        "Wanderer",
        "Gourmet",
        "Taipei",
        "Kaohsiung",
        "Jiufen",
        "Lotus"
    ];

    if (!userId) return "Explorer";

    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const choice = Math.abs(hash) % names.length;
    return names[choice];
}

export interface LeaderboardUser {
    id: string
    display_name: string
    avatar_url: string
    points: number
    total_points?: number
    donor_type: string
    public_profile: boolean
    bio?: string
    product_count?: number
    location_count?: number
    equipped_cosmetics?: Array<{
        slug: string
        category: string
        css_value: Record<string, any>
        tier: string
    }> | null
}

export function useLeaderboard() {
    const leaderboard = ref<LeaderboardUser[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);

    async function fetchLeaderboard(type: 'daily' | 'weekly' | 'monthly' | 'all_time' = 'daily', limit = 10) {
        loading.value = true;
        error.value = null;

        let table = 'leaderboard_view';
        if (type === 'daily') {
            table = 'leaderboard_daily_view';
        } else if (type === 'weekly') {
            table = 'leaderboard_weekly_view';
        } else if (type === 'monthly') {
            table = 'leaderboard_monthly_view';
        }

        const { data, error: err } = await supabase
            .from(table)
            .select("*")
            .order("points", { ascending: false })
            .limit(limit);

        if (!err && data) {
            leaderboard.value = data.map((u: any, idx: number) => ({
                ...u,
                display_name: u.public_profile ? u.display_name : getThemedAnonymousName(u.id, idx + 1),
                avatar_url: u.public_profile ? u.avatar_url : "https://placehold.co/64x64",
                equipped_cosmetics: u.equipped_cosmetics || null,
                total_points: u.total_points ?? u.points
            }));
        }

        if (err) {
            console.error("❌ Error fetching leaderboard:", err);
            error.value = err.message;
            leaderboard.value = [];
        }

        loading.value = false;
    }

    return { leaderboard, loading, error, fetchLeaderboard };
}