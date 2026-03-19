<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />

      <!-- Bottom tab bar -->
      <ion-tab-bar slot="bottom" id="footer-tabs">
        <ion-tab-button tab="home" href="/home">
          <div class="tab-icon-wrapper">
            <ion-icon :icon="homeOutline" />
            <div v-if="isAuthenticated && !claimedBonus" class="tab-dot"></div>
          </div>
          <ion-label>{{ $t('main.home') }}</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="search" href="/search">
          <div class="tab-icon-wrapper">
            <ion-icon :icon="gridOutline" />
          </div>
          <ion-label>{{ $t('main.product') }}</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="explore" href="/explore">
          <div class="tab-icon-wrapper">
            <ion-icon :icon="mapOutline" />
          </div>
          <ion-label>{{ $t('main.explore') }}</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="trip" href="/trip">
          <div class="tab-icon-wrapper">
            <ion-icon :icon="compassOutline" />
          </div>
          <ion-label>{{ $t('main.trip') }}</ion-label>
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
  gridOutline, mapOutline
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
.tab-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-icon-wrapper ion-icon {
  font-size: 21px;
}

.tab-dot {
  position: absolute;
  top: -2px;
  right: -4px;
  width: 9px;
  height: 9px;
  background-color: var(--ion-color-danger);
  border-radius: 50%;
  border: 2px solid var(--ion-tab-bar-background, #fff);
  box-shadow: 0 0 5px rgba(var(--ion-color-danger-rgb), 0.5);
  z-index: 10001; /* Stay above ion-modal sheet */
}

/* Ensure tab buttons have enough vertical space */
ion-tab-button {
  --padding-top: 8px;
  --padding-bottom: 8px;
}
</style>