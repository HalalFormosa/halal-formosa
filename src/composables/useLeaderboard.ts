import { ref } from "vue";
import { supabase } from "@/plugins/supabaseClient";

function getThemedAnonymousName(userId: string, index: number): string {
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

export function useLeaderboard() {
    const leaderboard = ref<any[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);

    async function fetchLeaderboard(limit = 10) {
        loading.value = true;
        error.value = null;

        const { data, error: err } = await supabase
            .from("leaderboard_view")
            .select("*")
            .order("points", { ascending: false })
            .limit(limit);

        if (!err && data) {
            leaderboard.value = data.map((u: any, idx: number) => ({
                ...u,
                display_name: u.public_profile ? u.display_name : getThemedAnonymousName(u.id, idx + 1),
                avatar_url: u.public_profile ? u.avatar_url : "https://placehold.co/64x64"
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