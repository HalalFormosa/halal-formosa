import { ref, computed } from "vue";
import { supabase } from "@/plugins/supabaseClient";
import { isDonor } from "./useSubscriptionStatus";

export const profileLoaded = ref(false)

/* ---------------- Core donor/role ---------------- */
export const userRole = ref<string | null>(null);
export const isAdmin = computed(() => userRole.value === "admin");
export const isContributor = computed(() => userRole.value === "contributor");

// Leaderboard privacy
export const currentUser = ref<any | null>(null);
export const isPublicProfile = ref<boolean | null>(null);
export const showLastSeen = ref<boolean>(true);
export const hasReviewedApp = ref<boolean>(false);
export const nearbyPromptsEnabled = ref<boolean>(true);
export const backgroundTrackingEnabled = ref<boolean>(false);

/* ---------------- Profile fields ---------------- */
export const donorType = ref("Free");
export const editDOB = ref<string | null>(null);
export const editNationality = ref<string | null>(null);
export const editGender = ref<string | null>('Other');
export const editBio = ref<string | null>(null);
export const editPhone = ref<string | null>(null);
export const editAvatarUrl = ref<string | null>(null);
export const editDisplayName = ref<string | null>(null);

export const selectedCountry = ref<any | null>(null); // for display
export const acknowledged = ref(false);
export const profileSkipped = ref(false);

/** A display name is required: at least one non-whitespace character. */
export const hasValidDisplayName = computed(
    () => (editDisplayName.value?.trim().length ?? 0) >= 1
);

export const isProfileComplete = computed(() => {
    return (
        acknowledged.value && hasValidDisplayName.value
    );
});

const donorKey = (userId: string) => `donor_type:${userId}`
const roleKey = (userId: string) => `user_role:${userId}`
const pubKey = (userId: string) => `public_profile:${userId}`
const promptKey = (userId: string) => `nearby_prompts_enabled:${userId}`


/* ---------------- Types ---------------- */
type UserProfileRow = {
    donor_type: string;
    public_profile: boolean;
    date_of_birth: string | null;
    nationality: string | null;
    gender: string | null;
    bio: string | null;
    phone: string | null;
    show_last_seen: boolean;
    has_reviewed_app: boolean;
    consent_acknowledged: boolean;
    avatar_url: string | null;
    nearby_prompts_enabled: boolean;
    user_roles: {
        role: string;
    } | null;
};

/* ---------------- Leaderboard privacy ---------------- */
export async function setPublicProfile(value: boolean) {
    if (!currentUser.value?.id) return

    isPublicProfile.value = value
    localStorage.setItem(
        pubKey(currentUser.value.id),
        JSON.stringify(value)
    )

    await supabase
        .from("user_profiles")
        .update({ public_profile: value })
        .eq("id", currentUser.value.id)
}

export async function setShowLastSeen(value: boolean) {
    if (!currentUser.value?.id) return
    showLastSeen.value = value
    await supabase
        .from("user_profiles")
        .update({ show_last_seen: value })
        .eq("id", currentUser.value.id)
}

export async function updateLastSeen() {
    if (!currentUser.value?.id) return
    await supabase
        .from("user_profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", currentUser.value.id)
}

export async function setHasReviewedApp(value: boolean) {
    if (!currentUser.value?.id) return
    hasReviewedApp.value = value
    await supabase
        .from("user_profiles")
        .update({ has_reviewed_app: value })
        .eq("id", currentUser.value.id)
}

export async function setNearbyPromptsEnabled(value: boolean) {
    if (!currentUser.value?.id) return
    nearbyPromptsEnabled.value = value
    localStorage.setItem(
        promptKey(currentUser.value.id),
        JSON.stringify(value)
    )
    await supabase
        .from("user_profiles")
        .update({ nearby_prompts_enabled: value })
        .eq("id", currentUser.value.id)
}



/* ---------------- Donor helpers ---------------- */
export function setDonorType(userId: string, value: string) {
    donorType.value = value
    localStorage.setItem(donorKey(userId), value)

    const isProOrSupporter = ["pro", "supporter", "founding supporter", "developer", "contributor"].includes(
        value.toLowerCase()
    );
    isDonor.value = isProOrSupporter;
    localStorage.setItem("user_pro_status", String(isProOrSupporter));
}

export function loadDonorFromCache(userId: string) {
    const storedType = localStorage.getItem(donorKey(userId))
    const type = storedType ?? "Free"
    donorType.value = type

    const isProOrSupporter = ["pro", "supporter", "founding supporter", "developer", "contributor"].includes(
        type.toLowerCase()
    );
    isDonor.value = isProOrSupporter;
    localStorage.setItem("user_pro_status", String(isProOrSupporter));
}

export function loadUserRoleFromCache(userId: string) {
    const storedRole = localStorage.getItem(roleKey(userId))
    userRole.value = storedRole ?? null
}

export function loadPublicLeaderboardFromCache(userId: string) {
    const stored = localStorage.getItem(pubKey(userId))
    isPublicProfile.value = stored !== null ? JSON.parse(stored) : false
}

export function loadNearbyPromptsFromCache(userId: string) {
    const stored = localStorage.getItem(promptKey(userId))
    nearbyPromptsEnabled.value = stored !== null ? JSON.parse(stored) : true
}

const bgTrackingKey = (uid: string) => `hf_bg_tracking_${uid}`

export function loadBackgroundTrackingFromCache(userId: string) {
    const stored = localStorage.getItem(bgTrackingKey(userId))
    backgroundTrackingEnabled.value = stored !== null ? JSON.parse(stored) : false
}

export async function setBackgroundTrackingEnabled(value: boolean) {
    if (!currentUser.value?.id) return
    backgroundTrackingEnabled.value = value
    localStorage.setItem(
        bgTrackingKey(currentUser.value.id),
        JSON.stringify(value)
    )
}


export const donorBadge = computed(() => {
    const map: Record<string, { label: string; color: string; emoji: string }> = {
        Free: { label: "Free", color: "medium", emoji: "🙌" },
        "Founding Supporter": { label: "Founding Supporter", color: "tertiary", emoji: "💖" },
        Supporter: { label: "Supporter", color: "primary", emoji: "💖" },
        Developer: { label: "Developer", color: "tertiary", emoji: "🛠️" },
        Contributor: { label: "Contributor", color: "primary", emoji: "⭐️" }
    };
    return map[donorType.value] || map.Free;
});

/* ---------------- Role helpers ---------------- */
export function setUserRole(userId: string, value: string | null) {
    userRole.value = value
    if (value) localStorage.setItem(roleKey(userId), value)
    else localStorage.removeItem(roleKey(userId))
}

/* ---------------- Profile load/save ---------------- */
export async function loadUserProfile(userId: string) {
    profileLoaded.value = false // ⬅️ NEW (start)

    const { data, error } = await supabase
        .from("user_profiles")
        .select(`
          donor_type,
          public_profile,
          display_name,
          date_of_birth,
          nationality,
          gender,
          bio,
          phone,
          show_last_seen,
          has_reviewed_app,
          consent_acknowledged,
          avatar_url,
          nearby_prompts_enabled,
          user_roles (
            role
          )
        `)
        .eq("id", userId)
        .maybeSingle<UserProfileRow & { display_name: string | null }>();

    if (!error && data) {
        setDonorType(userId, data.donor_type || "Free")
        setUserRole(userId, data.user_roles?.role ?? null)

        isPublicProfile.value = data.public_profile ?? false;
        localStorage.setItem(pubKey(userId), JSON.stringify(isPublicProfile.value));

        editDOB.value = data.date_of_birth;
        editNationality.value = data.nationality;
        editGender.value = data.gender ?? 'Other';
        editBio.value = data.bio;
        editPhone.value = data.phone;
        editAvatarUrl.value = data.avatar_url;
        editDisplayName.value = data.display_name;
        showLastSeen.value = data.show_last_seen ?? true;
        hasReviewedApp.value = data.has_reviewed_app ?? false;
        acknowledged.value = data.consent_acknowledged ?? false;
        nearbyPromptsEnabled.value = data.nearby_prompts_enabled ?? true;
        localStorage.setItem(promptKey(userId), JSON.stringify(nearbyPromptsEnabled.value));
    } else {
        console.warn("⚠️ No profile found, resetting defaults");

        isPublicProfile.value = false;
        localStorage.setItem(pubKey(userId), JSON.stringify(false));

        setDonorType(userId, "Free");
        setUserRole(userId, null);

        editDOB.value = null;
        editNationality.value = null;
        editGender.value = 'Other';
        editBio.value = null;
        editPhone.value = null;
        editAvatarUrl.value = null;
        editDisplayName.value = null;
        nearbyPromptsEnabled.value = true;
        localStorage.setItem(promptKey(userId), JSON.stringify(true));
    }

    profileLoaded.value = true // ⬅️ NEW (end)
}

export async function updateUserProfile(userId: string) {
    const { error } = await supabase
        .from("user_profiles")
        .update({
            display_name: editDisplayName.value?.trim() || null,
            date_of_birth: editDOB.value,
            nationality: editNationality.value,
            gender: editGender.value,
            bio: editBio.value,
            phone: editPhone.value,
            show_last_seen: showLastSeen.value,
            consent_acknowledged: acknowledged.value
        })
        .eq("id", userId);

    if (error) {
        console.error("❌ updateUserProfile failed", error);
    }
    return error;
}

export function resetUserProfileState() {
    userRole.value = null
    donorType.value = "Free"
    isPublicProfile.value = false
    currentUser.value = null

    // Reset donor status and clear cached pro entitlement
    isDonor.value = false
    localStorage.removeItem("user_pro_status")

    editDOB.value = null
    editNationality.value = null
    editGender.value = 'Other'
    editBio.value = null
    editPhone.value = null
    editAvatarUrl.value = null
    editDisplayName.value = null

    selectedCountry.value = null
    hasReviewedApp.value = false
    acknowledged.value = false
    profileSkipped.value = false
    nearbyPromptsEnabled.value = true
    backgroundTrackingEnabled.value = false
}
