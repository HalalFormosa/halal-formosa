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
            const userIds = data.map((u: any) => u.id);

            // Fetch counts in parallel
            const [productResults, locationResults] = await Promise.all([
                Promise.all(userIds.map((id: string) => 
                    supabase.from("products").select("id", { count: "exact", head: true }).eq("added_by", id)
                )),
                Promise.all(userIds.map((id: string) => 
                    supabase.from("locations").select("id", { count: "exact", head: true }).eq("created_by", id)
                ))
            ]);

            leaderboard.value = data.map((u: any, idx: number) => ({
                ...u,
                display_name: u.public_profile ? u.display_name : `Anonymous #${idx + 1}`,
                avatar_url: u.public_profile ? u.avatar_url : "https://placehold.co/64x64",
                product_count: productResults[idx].count || 0,
                location_count: locationResults[idx].count || 0
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