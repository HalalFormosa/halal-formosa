// composables/usePointRules.ts
import { supabase } from "@/plugins/supabaseClient";
import { ref } from "vue";

export interface PointRule {
    action: string;
    points: number;
    label: string;
}

const rules = ref<Record<string, PointRule>>({});

export function usePointRules() {
    async function fetchRules() {
        const { data, error } = await supabase.from("point_rules").select("*");
        if (!error && data) {
            rules.value = Object.fromEntries(
                data.map((r) => [r.action, r as PointRule])
            );
        }
    }

    return { rules, fetchRules };
}
