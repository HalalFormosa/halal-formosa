<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />

      <!-- Bottom tab bar -->
      <ion-tab-bar slot="bottom" id="footer-tabs" class="floating-tab-bar">
        <ion-tab-button tab="home" href="/home">
          <div class="tab-content">
            <div class="tab-icon-wrapper">
              <ion-icon :icon="homeOutline" />
              <div v-if="isAuthenticated && !claimedBonus" class="tab-dot"></div>
            </div>
            <ion-label>{{ $t('main.home') }}</ion-label>
          </div>
        </ion-tab-button>

        <ion-tab-button tab="search" href="/search">
          <div class="tab-content">
            <div class="tab-icon-wrapper">
              <ion-icon :icon="gridOutline" />
            </div>
            <ion-label>{{ $t('main.product') }}</ion-label>
          </div>
        </ion-tab-button>

        <ion-tab-button tab="explore" href="/explore">
          <div class="tab-content">
            <div class="tab-icon-wrapper">
              <ion-icon :icon="mapOutline" />
            </div>
            <ion-label>{{ $t('main.explore') }}</ion-label>
          </div>
        </ion-tab-button>

        <ion-tab-button tab="trip" href="/trip">
          <div class="tab-content">
            <div class="tab-icon-wrapper">
              <ion-icon :icon="compassOutline" />
            </div>
            <ion-label>{{ $t('main.trip') }}</ion-label>
          </div>
        </ion-tab-button>

        <ion-tab-button tab="store" href="/store">
          <div class="tab-content">
            <div class="tab-icon-wrapper">
              <ion-icon :icon="bagHandleOutline" />
            </div>
            <ion-label>{{ $t('main.store') }}</ion-label>
          </div>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import {
  IonTabBar, IonTabButton, IonTabs, IonLabel, IonIcon, IonRouterOutlet, IonPage
} from '@ionic/vue'
import {
  compassOutline,
  homeOutline,
  gridOutline, mapOutline,
  bagHandleOutline
} from 'ionicons/icons'
import { supabase } from '@/plugins/supabaseClient'
import { useDailyMissions } from '@/composables/useDailyMissions'

const { claimedBonus, fetchProgress } = useDailyMissions()

const isAuthenticated = ref(false)
const profilePic = ref<string | null>(null)

let authSub: any = null

async function syncSession(session?: any) {
  if (!session) {
    const res = await supabase.auth.getSession()
    session = res.data.session
  }

  isAuthenticated.value = !!session
  profilePic.value = session?.user?.user_metadata?.avatar_url ?? null

  if (isAuthenticated.value) {
    fetchProgress()
  }
}

onMounted(async () => {
  await syncSession()

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    syncSession(session)
  })

  authSub = data.subscription
})

onBeforeUnmount(() => {
  authSub?.unsubscribe()
})
</script>

<style scoped>
/* Let the router-outlet fill the whole ion-tabs area edge-to-edge, so page
   content runs the full height of the screen behind the floating tab bar
   instead of stopping above it. */
ion-tabs {
  position: relative;
}

ion-tabs > ion-router-outlet {
  position: absolute;
  inset: 0;
}

/* Floating, translucent tab bar — overlaid on top of content, not pushing it up */
.floating-tab-bar {
  --background: transparent;
  background: rgba(var(--card-bg-rgb), 0.88);
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  z-index: 10;
  margin: 0;
  padding: 6px;
  height: 64px;
  border-radius: 32px;
  border: 1px solid var(--card-border);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.14);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
}

ion-tab-button {
  --padding-top: 0;
  --padding-bottom: 0;
  flex: 0 0 auto;
  width: auto;
  margin: 0;
}

/* Active tab: a soft pill wraps the whole icon+label, not just the icon */
.tab-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 6px 4px;
  border-radius: 20px;
  transition: background-color 0.2s ease, transform 0.2s ease;
}

ion-tab-button.tab-selected .tab-content {
  background: rgba(var(--ion-color-carrot-rgb), 0.14);
  transform: translateY(-1px);
}

.tab-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 26px;
  border-radius: 999px;
}

.tab-icon-wrapper ion-icon {
  font-size: 19px;
  transition: color 0.2s ease;
}

ion-tab-button ion-label {
  font-size: 10.5px;
  font-weight: 600;
  margin-top: 3px;
}

.tab-dot {
  position: absolute;
  top: -2px;
  right: 2px;
  width: 8px;
  height: 8px;
  background-color: var(--ion-color-danger);
  border-radius: 50%;
  border: 2px solid var(--card-bg);
  box-shadow: 0 0 5px rgba(var(--ion-color-danger-rgb), 0.5);
  z-index: 10001; /* Stay above ion-modal sheet */
}
</style>