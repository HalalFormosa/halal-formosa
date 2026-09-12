<template>
  <ion-toolbar :class="['premium-header', { 'is-transparent': transparent, 'ios-native-header': isIos }]">
    <!-- Back button -->
    <ion-buttons slot="start" v-if="showBack">
      <ion-back-button
          v-if="useRouterBack"
          :default-href="backRoute || '/home'"
          :class="['custom-back-button', { 'contrast': contrast }]"
          text=""
      />
      <ion-button v-else @click="$emit('back')" :class="['header-action-button', { 'contrast': contrast }]">
        <ion-icon :icon="arrowBackOutline" />
      </ion-button>
    </ion-buttons>

    <!-- Title + Icon -->
    <ion-title :class="['header-title', { 'is-centered': centerTitle }]">
      <div class="title-content">
        <template v-if="icon === 'none'"></template>
        <template v-else-if="!icon">
          <img src="/favicon-32x32.png" alt="Halal Formosa" class="header-logo" />
        </template>
        <template v-else>
          <ion-icon :icon="icon" class="header-title-icon" />
        </template>
        <span :class="['title-text', { 'contrast': contrast }]">{{ title }}</span>
      </div>
    </ion-title>

    <!-- Custom end actions -->
    <ion-buttons slot="end">
      <slot name="end"></slot>
    </ion-buttons>

    <ion-buttons slot="end" v-if="$slots.actions">
      <ion-button id="actions-trigger" :class="['header-action-button', { 'contrast': contrast }]">
        <ion-icon :icon="ellipsisVerticalOutline" />
      </ion-button>

      <ion-popover trigger="actions-trigger" size="auto" dismiss-on-select class="width-190">
        <ion-content>
          <ion-list lines="none">
            <slot name="actions"></slot>
          </ion-list>
        </ion-content>
      </ion-popover>
    </ion-buttons>

    <!-- Notifications bell (optional, follows showProfile unless overridden) -->
    <ion-buttons slot="end" v-if="isAuthenticated && showNotifications && showProfile">
      <ion-button fill="clear" class="header-notif-button" @click="navigateToNotifications">
        <div class="header-notif-icon-wrapper">
          <ion-icon :icon="notificationsOutline" />
          <div v-if="displayBadgeCount > 0" class="header-notif-badge">{{ displayBadgeCount > 9 ? '9+' : displayBadgeCount }}</div>
        </div>
      </ion-button>
    </ion-buttons>

    <!-- Profile button (optional) -->
    <ion-buttons slot="end" v-if="showProfile">
      <ion-button fill="clear" @click="navigateToProfile" class="profile-button">
        <template v-if="isAuthenticated && profilePic">
          <div class="profile-img-wrapper">
            <img :src="profilePic" alt="Profile" class="toolbar-profile-img" />
          </div>
        </template>
        <template v-else>
          <ion-icon :icon="personCircle" class="profile-placeholder" />
        </template>
      </ion-button>
    </ion-buttons>
  </ion-toolbar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { IonToolbar, IonButton, IonTitle, IonButtons, IonIcon, IonBackButton, IonPopover, IonList, IonContent, isPlatform } from '@ionic/vue'
import { useRouter } from 'vue-router'
import {arrowBackOutline, ellipsisVerticalOutline, personCircle, notificationsOutline} from 'ionicons/icons'
import { supabase } from '@/plugins/supabaseClient'
import { useNotifications } from '@/composables/useNotifications'
import { useDailyMissions } from '@/composables/useDailyMissions'

withDefaults(defineProps<{
  title: string
  icon?: string
  showBack?: boolean
  backRoute?: string
  showProfile?: boolean
  showNotifications?: boolean
  useRouterBack?: boolean
  transparent?: boolean
  contrast?: boolean
  centerTitle?: boolean
}>(), {
  useRouterBack: true,
  transparent: false,
  contrast: false,
  centerTitle: false,
  showNotifications: true
})

const isAuthenticated = ref(false)
const profilePic = ref<string | null>(null)
const isIos = ref(isPlatform('ios'))
const router = useRouter()
const { totalUnreadCount } = useNotifications()
const { allCompleted: dailyMissionsCompleted } = useDailyMissions()

// Daily missions aren't real notification rows, so they don't add to
// totalUnreadCount itself — just fold a "+1" into the bell badge shown here
// as a nudge while any mission is still outstanding today (MainView.vue
// keeps the underlying mission state fresh app-wide via fetchProgress()).
const displayBadgeCount = computed(() => totalUnreadCount.value + (dailyMissionsCompleted.value ? 0 : 1))

function navigateToProfile() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  router.push('/profile')
}

function navigateToNotifications() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  router.push('/notifications')
}

async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession()
  isAuthenticated.value = !!session
  profilePic.value = session?.user?.user_metadata?.avatar_url || null
}

onMounted(async () => {
  await checkSession()
  supabase.auth.onAuthStateChange((_event, session) => {
    isAuthenticated.value = !!session
    profilePic.value = session?.user?.user_metadata?.avatar_url || null
  })
})
</script>

<style scoped>
.header-title {
  padding: 0;
}

.title-content {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  height: 100%;
  gap: 10px;
}

/* Opt-in centered title (no icon/logo) for pages like Product Details that
   want a plain centered title instead of the default left-aligned icon+text. */
.header-title.is-centered {
  padding-inline: 0;
}

.header-title.is-centered .title-content {
  justify-content: center !important;
}

.header-logo {
  height: 26px;
  width: auto;
  border-radius: var(--radius-sm);
}

.header-title-icon {
  font-size: 22px;
  color: var(--ion-color-carrot);
  display: flex;
  align-items: center;
}

.title-text {
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--ion-text-color);
}

/* Back button / secondary action buttons: soft circular chip instead of a bare icon.
   :slotted() reaches buttons individual views pass into the #end slot (e.g. a
   history/theme-toggle icon) so every header button matches this chip style
   without each view having to opt in with a class. */
/* !important is necessary here: ion-buttons ships its own shadow-scoped rule
   (.sc-ion-buttons-*-s .button-has-icon-only.button-clear) with higher
   specificity than a plain :slotted()/:deep() selector, which otherwise wins
   over our width/height/--background and silently no-ops this whole rule. */
:deep(.custom-back-button),
:deep(.header-action-button),
:slotted(ion-button) {
  --border-radius: 50% !important;
  --background: var(--card-inner-bg) !important;
  --background-hover: var(--card-inner-bg) !important;
  --background-activated: var(--card-inner-bg) !important;
  --background-focused: var(--card-inner-bg) !important;
  --box-shadow: none !important;
  width: 36px !important;
  min-width: 36px !important;
  max-width: 36px !important;
  height: 36px !important;
  min-height: 36px !important;
  max-height: 36px !important;
  margin: 0 2px !important;
  border: 1px solid var(--card-border);
  border-radius: 50%;
}

/* Bare bell icon, no circular chip behind it (matches the unauthenticated
   profile placeholder icon, which also has no background box). */
:deep(.header-notif-button) {
  --background: transparent !important;
  --background-hover: transparent !important;
  --background-activated: transparent !important;
  --background-focused: transparent !important;
  --box-shadow: none !important;
  --padding-start: 0 !important;
  --padding-end: 0 !important;
  width: 38px !important;
  min-width: 38px !important;
  max-width: 38px !important;
  height: 38px !important;
  min-height: 38px !important;
  max-height: 38px !important;
  margin: 0 !important;
  border: none !important;
}

:deep(.header-notif-button) ion-icon {
  font-size: 24px;
  color: var(--ion-text-color);
}

:deep(.custom-back-button.contrast),
:deep(.header-action-button.contrast) {
  --background: rgba(0, 0, 0, 0.28);
  --background-hover: rgba(0, 0, 0, 0.28);
  --background-activated: rgba(0, 0, 0, 0.28);
  border-color: transparent;
}

/* Same Ionic default-solid-fill trap as the chip buttons above: without
   these overrides ion-button renders its own solid background box around
   the (smaller) avatar ring, making the photo look tiny inside a dark
   square. fill="clear" on the element plus these !importants close it out. */
.profile-button {
  --background: transparent !important;
  --background-hover: transparent !important;
  --background-activated: transparent !important;
  --background-focused: transparent !important;
  --box-shadow: none !important;
  --padding-start: 0 !important;
  --padding-end: 0 !important;
  width: 38px !important;
  min-width: 38px !important;
  max-width: 38px !important;
  height: 38px !important;
  min-height: 38px !important;
  max-height: 38px !important;
  margin: 0 0 0 6px !important;
}

.profile-img-wrapper {
  width: 38px;
  height: 38px;
  padding: 2px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--ion-color-carrot), var(--ion-color-carrot-tint));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--card-shadow);
}

.toolbar-profile-img {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--ion-background-color);
}

.profile-placeholder {
  font-size: 38px;
  color: var(--ion-color-medium);
}

.header-notif-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-notif-badge {
  box-sizing: border-box;
  position: absolute;
  top: -9px;
  right: -10px;
  min-width: 20px;
  height: 20px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--ion-color-danger);
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  border-radius: 999px;
  border: 2px solid var(--card-bg);
  box-shadow: 0 0 5px rgba(var(--ion-color-danger-rgb), 0.5);
}

/* Dark Mode Overrides */
:host-context(.ion-palette-dark) .premium-header:not(.is-transparent),
.ion-palette-dark .premium-header:not(.is-transparent) {
  --background: var(--ion-background-color);
  border-bottom: none !important;
  box-shadow: none !important;
}

/* iOS Native Specific: Left Align and Shift */
.ios-native-header .header-title,
.ios .premium-header .header-title {
  --text-align: left;
  display: flex !important;
  justify-content: flex-start !important;
  padding-inline-start: 60px !important; /* Pushed more from the left */
}

.ios-native-header .title-content,
.ios .premium-header .title-content {
  justify-content: flex-start !important;
}
</style>
