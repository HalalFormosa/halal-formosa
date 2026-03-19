<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title class="title-large">
          <ion-icon :icon="personCircleOutline" style="vertical-align: middle;"/>
          {{ $t('profile.title') }}
        </ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">{{ $t('profile.title') }}</ion-title>
        </ion-toolbar>
      </ion-header>

      <!-- ================= PROFILE / PRO / ABOUT / XP ================= -->
      <template v-if="loadingProfile">

        <!-- Profile Skeleton -->
        <ion-card class="profile-card ion-text-center">
          <ion-skeleton-text animated style="width:120px;height:120px;border-radius:50%;margin:0 auto"/>
          <ion-skeleton-text animated style="width:60%;height:20px;margin:1rem auto"/>
          <ion-skeleton-text animated style="width:80px;height:20px;margin:0 auto"/>
          <ion-skeleton-text animated style="width:70%;height:16px;margin:.5rem auto"/>
          <ion-skeleton-text animated style="width:100%;height:36px;margin:1.5rem auto"/>
        </ion-card>

        <!-- Pro Skeleton -->
        <ion-card v-if="userEmail && isNative" class="profile-card ion-text-center">
          <ion-card-header>
            <ion-skeleton-text animated style="width:60%;height:20px;margin:0 auto"/>
          </ion-card-header>
          <ion-card-content>
            <ion-skeleton-text animated style="width:100%;height:40px"/>
          </ion-card-content>
        </ion-card>

        <!-- About Skeleton -->
        <ion-card class="profile-card">
          <ion-card-header>
            <ion-toolbar class="profile-toolbar">
              <ion-skeleton-text animated style="width:40%;height:18px"/>
              <ion-skeleton-text slot="end" animated style="width:60px;height:28px"/>
            </ion-toolbar>
          </ion-card-header>
          <ion-card-content>
            <ion-skeleton-text animated style="width:80%;height:14px;margin-bottom:8px"/>
            <ion-skeleton-text animated style="width:60%;height:14px"/>
          </ion-card-content>
        </ion-card>

        <!-- XP Skeleton -->
        <ion-card class="profile-card ion-text-center">
          <ion-card-header>
            <ion-skeleton-text animated style="width:50%;height:20px;margin:0 auto"/>
          </ion-card-header>
          <ion-card-content>
            <ion-skeleton-text animated style="width:40%;height:32px;margin:0 auto 8px"/>
            <ion-skeleton-text animated style="width:30%;height:14px;margin:0 auto 12px"/>
            <ion-skeleton-text animated style="width:100%;height:10px"/>
            <ion-skeleton-text animated style="width:50%;height:12px;margin:8px auto 0"/>
          </ion-card-content>
        </ion-card>

      </template>

      <template v-else>

        <!-- Profile -->
        <ion-card class="profile-card ion-text-center">
          <div v-if="userAvatar" class="avatar-wrapper">
            <img :src="userAvatar" class="avatar"/>
          </div>

          <ion-text v-if="userDisplayName" class="profile-name">
            <h2>{{ userDisplayName }}</h2>
            <ion-badge v-if="isSubscribed" color="warning">{{ $t('profile.proMember') }}</ion-badge>
            <ion-badge v-else :color="donorBadge.color">
              {{ donorBadge.emoji }} {{ $t('profile.donors.' + donorBadge.label) }}
            </ion-badge>
          </ion-text>

          <ion-text v-if="userEmail" class="profile-email">
            <p>{{ userEmail }}</p>
          </ion-text>

          <ion-button v-if="userEmail" color="danger" expand="block" @click="handleLogout">
            {{ $t('profile.logout') }}
          </ion-button>

          <div v-else class="login-prompt">
            <p>{{ $t('profile.noUserLogged') }}</p>
            <ion-button color="carrot" expand="block" @click="goToLogin">
              {{ $t('profile.login') }}
            </ion-button>
          </div>
        </ion-card>

        <!-- Pro -->
        <ion-card v-if="userEmail && isNative" class="profile-card ion-text-center">
          <ion-card-header>
            <ion-card-title>{{ $t('profile.pro.title') }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-button v-if="!isSubscribed" color="carrot" expand="block" @click="openProPaywall">
              {{ $t('profile.pro.upgrade') }}
            </ion-button>

            <div v-else>
              <p style="font-weight:600;color:var(--ion-color-success)">{{ $t('profile.pro.active') }}</p>
              <p style="font-size:14px">{{ renewalMessage }}</p>
              <p style="font-size:14px;color:var(--ion-color-medium)">
                {{ $t('profile.pro.accessUntil') }}
                <strong>{{ formattedExpirationDate }}</strong>
              </p>
              <ion-button fill="outline" size="small" @click="openManageSubscription">
                {{ $t('profile.pro.manage') }}
              </ion-button>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- About -->
        <ion-card v-if="userEmail" class="profile-card">
          <ion-card-header>
            <ion-toolbar class="profile-toolbar">
              <ion-title class="profile-title">{{ $t('profile.aboutMe') }}</ion-title>
              <ion-buttons slot="end">
                <ion-button color="carrot" size="small" @click="goToEditProfile">
                  <ion-icon :icon="createOutline" slot="start"/>
                  {{ $t('profile.edit') }}
                </ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-card-header>
          <ion-card-content>
            <ion-list lines="none">
              <ion-item>
                <ion-label>{{ $t('profile.bio') }}</ion-label>
                <ion-note slot="end">{{ userBio || $t('profile.noBio') }}</ion-note>
              </ion-item>
            </ion-list>
          </ion-card-content>
        </ion-card>

        <!-- XP -->
        <ion-card v-if="userEmail" class="profile-card ion-text-center">
          <ion-card-header>
            <ion-card-title>{{ $t('profile.experiencePoints') }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <h2 style="font-size: 2rem; margin: 0; color: var(--ion-color-primary);">
              {{ currentPoints }}
            </h2>
            <p>{{ $t('profile.level', { level: level }) }}</p>
            <ion-progress-bar
                :value="progressPercent / 100"
                color="success"
                style="margin-top: 10px; border-radius: 8px;"
            ></ion-progress-bar>
            <small>{{ currentPoints }} / {{ nextLevelXp }} XP</small>
          </ion-card-content>
        </ion-card>

      </template>

      <!-- ================= ADMIN ================= -->
      <template v-if="isAdmin">
        <ion-list v-if="loadingAdmin" class="profile-menu">
          <ion-item v-for="i in 5" :key="i">
            <ion-skeleton-text animated style="width:70%;height:16px"/>
          </ion-item>
        </ion-list>

        <ion-list v-else class="profile-menu" style="border-radius: 10px; margin-top: 20px">
          <ion-item button @click="goToReviewSubmissions">
            <ion-icon :icon="listOutline"/>&nbsp;
            <ion-label>{{ $t('profile.review') }}</ion-label>

            <!-- ✅ Put badge at end slot -->
            <ion-badge
                v-if="pendingCount > 0"
                color="danger"
                slot="end"
            >
              {{ pendingCount }}
            </ion-badge>
          </ion-item>

          <ion-item button @click="goToReviewLocations">
            <ion-icon :icon="listOutline" />&nbsp;
            <ion-label>{{ $t('profile.admin.locationsReview') }}</ion-label>

            <ion-badge
                v-if="pendingLocationsCount > 0"
                color="danger"
                slot="end"
            >
              {{ pendingLocationsCount }}
            </ion-badge>
          </ion-item>

          <ion-item button @click="goToPointsLogs">
            <ion-icon :icon="listOutline"/>&nbsp;
            <ion-label>{{ $t('profile.admin.pointsLogs') }}</ion-label>
          </ion-item>

          <ion-item button @click="goToScanLogs">
            <ion-icon :icon="listOutline"/>&nbsp;
            <ion-label>{{ $t('profile.admin.scanLogs') }}</ion-label>
          </ion-item>

          <ion-item button @click="goToUsersList">
            <ion-icon :icon="peopleOutline" />&nbsp;
            <ion-label>{{ $t('profile.admin.users') }}</ion-label>
          </ion-item>

          <ion-item button @click="goToAnalyticsDashboard">
            <ion-icon :icon="listOutline"/>&nbsp;
            <ion-label>{{ $t('profile.admin.analytics') }}</ion-label>
          </ion-item>

          <ion-item button @click="goToMasterData" lines="none">
            <ion-icon :icon="constructOutline"/>&nbsp;
            <ion-label>{{ $t('profile.admin.masterData') }}</ion-label>
          </ion-item>


        </ion-list>
      </template>


      <!-- Menu -->
      <ion-list class="profile-menu" style="border-radius: 10px; margin-top: 20px">
        <ion-item button @click="goToSavedItems">
          <ion-icon :icon="bookmarkOutline" />&nbsp;
          <ion-label>{{ $t('profile.savedItems') }}</ion-label>
        </ion-item>
        <ion-item button @click="goToSettings">
          <ion-icon :icon="settingsOutline"/>&nbsp;
          <ion-label>{{ $t('profile.settings') }}</ion-label>
        </ion-item>
        <ion-item button @click="goToLegal">
          <ion-icon :icon="documentTextOutline"/>&nbsp;
          <ion-label>{{ $t('profile.legal') }}</ion-label>
        </ion-item>
        <ion-item button @click="goToCredits" style="--inner-border-width: 0">
          <ion-icon :icon="peopleOutline"/>&nbsp;
          <ion-label>{{ $t('profile.credits') }}</ion-label>
        </ion-item>
      </ion-list>

      <!-- Support -->
      <ion-card v-if="donationProduct" class="profile-card ion-text-center">
        <ion-card-header>
          <ion-card-title>{{ $t('profile.support') }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <ion-item button @click="donate">
            <ion-label>
              <strong>{{ donationProduct.title }}</strong>
              <br/>
              {{ donationProduct.description }}
            </ion-label>
            <ion-note slot="end">{{ donationProduct.priceString }}</ion-note>
          </ion-item>
        </ion-card-content>
      </ion-card>


      <ion-card v-else class="profile-card ion-text-center">
        <ion-card-header>
          <ion-card-title>{{ $t('profile.support') }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p>{{ $t('profile.supportDescription') }}</p>
          <a href="https://halalformosa.bobaboba.me" target="_blank" class="boba-button">
            <img
                src="https://s3.ap-southeast-1.amazonaws.com/media.anyonelab.com/images/boba/boba-embed-icon.png"
                alt="boba-icon"
                style="height: 100%; margin-right: 8px;"
            />
            {{ $t('profile.bobaMe') }}
          </a>
          <p class="support-thank">{{ $t('profile.supportThank') }}</p>
          <p><small>{{ $t('profile.voluntary') }}</small></p>
        </ion-card-content>
      </ion-card>

      <!-- ✅ Social Media / Follow Us -->
      <ion-card class="profile-card ion-text-center">
        <ion-card-header>
          <ion-card-title>{{ $t('profile.followUs') }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div class="social-links">

            <!-- Instagram -->
            <a
                class="social-button instagram"
                @click.prevent="logAndOpen('instagram', 'https://www.instagram.com/halalformosa/')"
            >
              <ion-icon :icon="logoInstagram" class="social-icon"></ion-icon>
              <span>Instagram</span>
            </a>

            <!-- LINE -->
            <a
                class="social-button line"
                @click.prevent="logAndOpen('line', 'https://line.me/R/ti/p/@975schpu')"
            >
              <img src="/social-logo/line-logo.png" alt="LINE" class="social-icon"/>
              <span>LINE</span>
            </a>

            <!-- Official Website -->
            <a
                class="social-button website"
                @click.prevent="logAndOpen('web', 'https://halalformosa.com')"
            >
              <ion-icon :icon="globeOutline" class="social-icon"></ion-icon>
              <span>Website</span>
            </a>


          </div>

        </ion-card-content>
      </ion-card>

      <!-- App Info -->
      <ion-card class="profile-card ion-text-center">
        <ion-card-header>
          <ion-card-title>{{ $t('profile.appInfo') }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list lines="inset" class="info-list">
            <ion-item>
              <ion-label>{{ $t('profile.appNameTitle') }}</ion-label>
              <ion-note slot="end" class="info-note">{{ $t('profile.appName') }}</ion-note>
            </ion-item>
            <ion-item lines="none">
              <ion-label>{{ $t('profile.appVersion') }}</ion-label>
              <ion-note slot="end" class="info-note">{{ appVersion || '1.0.0' }}</ion-note>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref, watch} from "vue";
import {useRouter} from "vue-router";
import {supabase} from "@/plugins/supabaseClient";

// ✅ Ionic components
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonProgressBar,
  IonSkeletonText,
  IonText,
  IonTitle,
  IonToolbar,
  onIonViewWillEnter,
  onIonViewDidEnter
} from "@ionic/vue";

import {
  constructOutline,
  createOutline,
  documentTextOutline, globeOutline,
  listOutline,
  logoInstagram,
  peopleOutline,
  personCircleOutline,
  settingsOutline, bookmarkOutline
} from "ionicons/icons";

// ✅ Composables
import {
  donorBadge, 
  isAdmin, 
  loadUserProfile, 
  resetUserProfileState, 
  loadDonorFromCache, 
  editBio, 
  editDOB, 
  editGender, 
  editNationality
} from "@/composables/userProfile";
import {Subscription} from "@supabase/supabase-js";
import {usePoints} from "@/composables/usePoints";
import {xpForLevel} from "@/utils/xp"
import {Capacitor} from "@capacitor/core";

// Services
import {CustomerInfo, Purchases} from "@revenuecat/purchases-capacitor";
import {RevenueCatUI, PAYWALL_RESULT} from '@revenuecat/purchases-capacitor-ui';
import {refreshSubscriptionStatus} from "@/composables/useSubscriptionStatus";
import {toastController} from "@ionic/vue";
import { ActivityLogService } from '@/services/ActivityLogService'
import { useI18n } from 'vue-i18n'
import { useNotifier } from "@/composables/useNotifier";

const { t } = useI18n()
const { notifyEvent } = useNotifier();
const pendingLocationsCount = ref(0)

interface RcProduct {
  identifier: string;
  price: number;
  priceString: string;
  title: string;
  description: string;
  currencyCode?: string;
}


// @ts-expect-error – injected global
const appVersion = __APP_VERSION__;
const isNative = Capacitor.isNativePlatform();
const userEmail = ref("");
const userDisplayName = ref("");
const userAvatar = ref("");
const pendingCount = ref(0);

const loadingProfile = ref(true)     // avatar, name, email
const loadingAdmin = ref(false)      // admin-only data

const user = ref<any | null>(null);
const router = useRouter();

const userBio = editBio;
const userNationality = editNationality;
const donationProduct = ref<RcProduct | null>(null);
const paywallOpening = ref(false);

// ✅ Points composable
const {currentPoints, fetchCurrentPoints} = usePoints();

const customerInfo = ref<CustomerInfo | null>(null)

const entitlement = computed(() =>
    customerInfo.value?.entitlements?.active?.['Halal Formosa Pro'] ?? null
)

const isSubscribed = computed(() => Boolean(entitlement.value))

const willRenew = computed(() => entitlement.value?.willRenew ?? false)

const expirationDate = computed(() => {
  return (
      entitlement.value?.expirationDate ??
      customerInfo.value?.latestExpirationDate ??
      null
  )
})

const needsProfileCompletion = ref(false)

watch(needsProfileCompletion, (v) => {
  if (!v) return

  router.replace({ name: 'EditProfile' })
})


let authSubscription: Subscription | null = null;

const level = computed(() => {
  const points = currentPoints.value || 0
  let lvl = 1

  // ✅ Safety cap to prevent infinite loop if points data is corrupted
  while (points >= xpForLevel(lvl + 1) && lvl < 2000) {
    lvl++
  }
  return lvl
})

const nextLevelXp = computed(() => xpForLevel(level.value + 1))
const prevLevelXp = computed(() => xpForLevel(level.value))

const progressPercent = computed(() => {
  const points = currentPoints.value || 0
  return ((points - prevLevelXp.value) / (nextLevelXp.value - prevLevelXp.value)) * 100
})

const countriesList = ref<any[]>([]);
const resolvedNationality = ref<string | null>(null);
const resolvedFlag = ref<string | null>(null);

const refreshCustomerInfo = async () => {
  const result = await Purchases.getCustomerInfo()
  customerInfo.value = result.customerInfo
}

async function fetchCountries() {
  if (countriesList.value.length > 0) return; // ✅ Cache check
  try {
    const response = await fetch("https://restcountries.com/v3.1/all?fields=name,cca2,flags");
    if (!response.ok) throw new Error("Failed to fetch countries");
    countriesList.value = await response.json();
  } catch (err) {
    console.error("fetchCountries failed:", err);
  }
}

// ✅ Resolve flag when countries list arrives
watch(countriesList, () => {
  if (userNationality.value && countriesList.value.length > 0) {
    const match = countriesList.value.find(c => c.cca2 === userNationality.value);
    if (match) {
      resolvedNationality.value = match.name.common;
      resolvedFlag.value = match.flags.png;
    }
  }
}, { immediate: true });


async function fetchPendingCount() {
  if (!isAdmin.value) {
    pendingCount.value = 0;
    return;
  }

  const {count, error} = await supabase
      .from("products")
      .select("*", {count: "exact", head: true})
      .eq("approved", false);

  if (!error && count !== null) {
    pendingCount.value = count;
  }
}

async function fetchPendingLocationsCount() {
  if (!isAdmin.value) return

  const { count } = await supabase
      .from('locations')
      .select('*', { count: 'exact', head: true })
      .eq('approved', false)

  pendingLocationsCount.value = count || 0
}

const renewalMessage = computed(() => {
  if (!entitlement.value) return ''

  return willRenew.value
      ? t('profile.pro.renew')
      : t('profile.pro.noRenew')
})

const formattedExpirationDate = computed(() => {
  if (!expirationDate.value) return '—'

  return new Date(expirationDate.value).toLocaleDateString(useI18n().locale.value, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

const openManageSubscription = () => {
  const url = customerInfo.value?.managementURL
  if (url) {
    window.open(url, '_blank')
  }
}

const isSyncing = ref(false);

async function refreshAllData(userId: string) {
  if (isSyncing.value) return;
  isSyncing.value = true;
  try {
    // Authorized profile and points fetch in parallel
    await Promise.all([
      loadUserProfile(userId),
      fetchCurrentPoints(userId)
    ]);

    // Check for profile completion
    if (!editDOB.value || !editNationality.value || !editGender.value) {
      needsProfileCompletion.value = true;
    }
  } finally {
    isSyncing.value = false;
    loadingProfile.value = false;
  }
}

// ✅ Always refresh when ProfileView becomes active
onIonViewWillEnter(async () => {
  const { data } = await supabase.auth.getUser()
  if (!data?.user) return
  
  refreshAllData(data.user.id);
})

onIonViewDidEnter(async () => {
  const { data } = await supabase.auth.getUser()
  if (!data?.user) return

  if (isNative) {
    refreshCustomerInfo().catch(() => {});
  }

  ActivityLogService.log('profile_page_open', {
    user_id: data.user.id
  }).catch(() => {});
})


async function logRevenueCatStatus() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    console.log("[RC] Fetching customer info...");
    const {customerInfo} = await Purchases.getCustomerInfo();

    const entitlement = customerInfo.entitlements.active["Halal Formosa Pro"];

    if (entitlement) {
      console.log("[RC] Entitlement ACTIVE:", entitlement);
    } else {
      console.log("[RC] Entitlement NOT active");
    }
  } catch (err) {
    console.error("[RC] Error fetching customer info:", err);
  }
}


onMounted(async () => {
  try {
    fetchCountries();

    const {data} = await supabase.auth.getUser();
    if (data?.user) {
      user.value = data.user;
      userEmail.value = user.value.email || "";
      userDisplayName.value = user.value.user_metadata?.full_name || user.value.user_metadata?.display_name || "";
      userAvatar.value = user.value.user_metadata?.avatar_url || "";
      
      refreshAllData(user.value.id);
    }

    const {
      data: {subscription: authSub},
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session?.user) {
        resetUserProfileState();
        userEmail.value = "";
        userDisplayName.value = "";
        userAvatar.value = "";
        currentPoints.value = null;
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const u = session.user;
        userEmail.value = u.email || "";
        userDisplayName.value = u.user_metadata?.full_name || u.user_metadata?.display_name || "";
        userAvatar.value = u.user_metadata?.avatar_url || "";

        loadDonorFromCache(u.id);
        refreshAllData(u.id);

        if (isAdmin.value) {
          fetchPendingCount();
          fetchPendingLocationsCount();
        }
      }
    });

    authSubscription = authSub;
    logRevenueCatStatus();
  } catch (err) {
    console.error("Error in onMounted:", err);
  } finally {
    loadingProfile.value = false;
    loadingAdmin.value = false;
  }
});

async function donate() {
  ActivityLogService.log('donation_click', {
    product: donationProduct.value?.identifier ?? null
  })

  const offerings = await Purchases.getOfferings();

  if (!offerings.current) return;

  const pkg = offerings.current.availablePackages.find(
      (p) => p.identifier === "small_support"
  );

  if (!pkg) return;

  try {
    await Purchases.purchasePackage({aPackage: pkg});
    alert(t('profile.supportSuccess'));

    ActivityLogService.log('donation_success', {
      product: donationProduct.value?.identifier ?? null
    })

  } catch (err) {
    console.error("Donation failed:", err);
  }
}

async function presentPaywall(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.warn("[RC] Paywall can only run on native (Android/iOS).");
    return false;
  }

  try {
    console.log("[RC] Presenting Paywall...");

    const {result} = await RevenueCatUI.presentPaywall();

    console.log("[RC] Paywall Result:", result);

    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
        console.log("[RC] 🎉 User purchased subscription!");
        return true;

      case PAYWALL_RESULT.RESTORED:
        console.log("[RC] 🔄 Subscription restored!");
        return true;

      case PAYWALL_RESULT.CANCELLED:
        console.log("[RC] User cancelled paywall.");
        return false;

      case PAYWALL_RESULT.ERROR:
        console.log("[RC] Paywall error.");
        return false;

      case PAYWALL_RESULT.NOT_PRESENTED:
      default:
        console.log("[RC] Paywall not presented.");
        return false;
    }

  } catch (e) {
    console.error("[RC] Paywall failed:", e);
    return false;
  }
}

async function ensureRevenueCatLoggedIn() {
  if (!Capacitor.isNativePlatform()) return

  const {data} = await supabase.auth.getUser()
  if (!data?.user) return

  await Purchases.logIn({
    appUserID: data.user.id
  })

  console.log("🔐 RevenueCat logged in as:", data.user.id)
}

function logAndOpen(platform: string, url: string) {
  // 🔓 Open immediately (keeps browser happy)
  window.open(url, '_blank')

  // 🧾 Log asynchronously (no await)
  ActivityLogService.log('social_link_click', {
    platform
  }).catch(() => {
    /* silent */
  })
}

function goToSavedItems() {
  router.push('/profile/saved-items')
}

async function openProPaywall() {
  ActivityLogService.log('pro_paywall_open')

  // ⛔ Web / PWA guard
  if (!Capacitor.isNativePlatform()) {
    const toast = await toastController.create({
      message: t('profile.pro.nativeOnly'),
      duration: 2000,
      color: "medium",
      position: "bottom",
    });
    await toast.present();
    return;
  }

  if (paywallOpening.value) return;
  paywallOpening.value = true;

  try {
    // 🔐 Safe to continue (native only)
    await ensureRevenueCatLoggedIn();

    const purchased = await presentPaywall();
    if (!purchased) return; // ✅ safe now

    // 🔄 Refresh subscription state
    await refreshCustomerInfo();
    await refreshSubscriptionStatus({syncToServer: true});

    // 🔓 Yield back to Ionic
    await new Promise(resolve => setTimeout(resolve, 300));

    // 🔁 Soft app "restart"
    await router.replace('/profile'); // 👈 see note below

    // ✅ Success feedback
    const toast = await toastController.create({
      message: t('profile.pro.purchaseSuccess'),
      duration: 2500,
      color: "success",
      position: "bottom",
    });
    await toast.present();

    ActivityLogService.log('pro_purchase_success', {
      entitlement: 'Halal Formosa Pro'
    })

    await notifyEvent(
      'pro_purchase_success',
      '💎 New Pro Member!',
      `User ${userEmail.value} has just subscribed to Halal Formosa Pro!`,
      undefined,
      {
        source: 'profile_view',
        email: userEmail.value,
        user_id: user.value?.id
      },
      ['discord']
    ).catch(console.error);

  } finally {
    // 🔓 ALWAYS release the lock
    paywallOpening.value = false;
  }
}

onBeforeUnmount(() => {
  if (authSubscription) {
    authSubscription.unsubscribe();
    authSubscription = null;
  }
});

// Actions
const handleLogout = async () => {
  ActivityLogService.log('profile_logout')

  const {error} = await supabase.auth.signOut();
  if (!error) {
    userEmail.value = "";
    currentPoints.value = null; // reset points
    router.push("/login");
  }
};
const goToReviewSubmissions = () => router.push("/admin/review-products");
const goToReviewLocations = () => router.push('/admin/review-locations')
const goToLogin = () => router.push("/login");
const goToSettings = () => router.push("/settings");
const goToLegal = () => router.push("/legal");
const goToCredits = () => router.push("/credits");
const goToPointsLogs = () => router.push("/admin/points-logs");
const goToUsersList = () => router.push("/admin/users");

const goToAnalyticsDashboard = () => router.push("/admin/analytics");
const goToScanLogs = () => router.push("/admin/scan-logs");

const goToEditProfile = () => {
  ActivityLogService.log('profile_edit_open')
  router.push({ name: "EditProfile" })
}

const goToMasterData = () => router.push('/admin/master-data')

</script>


<style scoped>
ion-toast {
  transform: translateY(-55px);
}

.profile-card {
  margin: 1rem auto;
  padding: 1rem 1rem;
  border-radius: 10px;
}

.avatar-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
}

.avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--ion-color-tertiary);
}

.profile-name h2 {
  margin: 0 0 0.25rem;
  font-weight: 700;
  color: var(--ion-color-tertiary);
}

.profile-email p {
  margin: 0 0 1.5rem;
  font-size: 1rem;
  color: var(--ion-color-medium);
}

.logout-button,
.login-prompt ion-button {
  margin-top: 1rem;
}

.login-prompt p {
  margin-bottom: 1rem;
  font-size: 1rem;
  color: var(--ion-color-medium);
}

.boba-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 200px;
  height: 44px;
  margin: 1rem auto;
  padding: 8px 16px;
  background-color: #ad5138;
  color: #f8e0be;
  border-radius: 12px;
  text-decoration: none;
  font-weight: bold;
}

.support-thank {
  font-size: 0.9rem;
  color: var(--ion-color-medium);
}

.profile-toolbar {
  --padding-start: 0;
  --padding-end: 0;
  --min-height: 40px;
}

.profile-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--ion-color-dark);
}

.social-links {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

.social-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 10px;
  font-weight: 600;
  text-decoration: none;
  transition: transform 0.2s ease;
  color: #fff;
}

.social-icon {
  font-size: 24px;
  width: 24px;
  height: 24px;
}


.social-button:hover {
  transform: translateY(-2px);
}

.social-button.instagram {
  background: linear-gradient(45deg, #f58529, #dd2a7b, #8134af, #515bd4);
}

.social-button.line {
  background-color: #06c755;
}

.social-button.website {
  background: linear-gradient(135deg, #334155 0%, #1e293b 100%);
  color: #ffffff;
  border: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.social-button.website:hover {
  transform: translateY(-2px);
  background: linear-gradient(135deg, #475569 0%, #334155 100%);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.info-list {
  background: transparent;
  padding: 0;
}

.info-note {
  font-weight: 600;
  color: var(--ion-color-dark);
}



</style>
