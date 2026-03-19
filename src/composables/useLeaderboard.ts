import { ref } from "vue";
import { supabase } from "@/plugins/supabaseClient";

export function useLeaderboard() {
    const leaderboard = ref<any[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);

    async function fetchLeaderboard(limit = 10) {
        loading.value = true;
        error.value = null;

        const { data, error: err } = await supabase
            .from("user_profiles")
            .select("id, display_name, avatar_url, points, donor_type, public_profile, bio")
            .gt("points", 0)
            .order("points", { ascending: false })
            .limit(limit);

        if (!err && data) {
            leaderboard.value = data.map((u, idx) => ({
                ...u,
                display_name: u.public_profile ? u.display_name : `Anonymous #${idx + 1}`,
                avatar_url: u.public_profile ? u.avatar_url : "https://placehold.co/64x64"
            }));
        }

        if (err) {
            console.error("❌ Error fetching leaderboard:", err);
            error.value = err.message;
            leaderboard.value = [];
        } else {
            leaderboard.value = data ?? [];
        }

        loading.value = false;
    }

    return { leaderboard, loading, error, fetchLeaderboard };
}