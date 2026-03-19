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
    <ion-title class="header-title">
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

    <!-- Actions as 3-dot menu (only if slot provided) -->
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

    <!-- Profile button (optional) -->
    <ion-buttons slot="end" v-if="showProfile">
      <ion-button @click="$router.push('/profile')" class="profile-button">
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
import { ref, onMounted } from 'vue'
import { IonToolbar, IonButton, IonTitle, IonButtons, IonIcon, IonBackButton, IonPopover, IonList, IonContent, isPlatform } from '@ionic/vue'
import {arrowBackOutline, ellipsisVerticalOutline, personCircle} from 'ionicons/icons'
import { supabase } from '@/plugins/supabaseClient'

withDefaults(defineProps<{
  title: string
  icon?: string
  showBack?: boolean
  backRoute?: string
  showProfile?: boolean
  useRouterBack?: boolean
  transparent?: boolean
  contrast?: boolean
}>(), {
  useRouterBack: true,
  transparent: false,
  contrast: false
})

const isAuthenticated = ref(false)
const profilePic = ref<string | null>(null)
const isIos = ref(isPlatform('ios'))

async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession()
  isAuthenticated.value = !!session
  profilePic.value = session?.user?.user_metadata?.avatar_url || null
}

onMounted(() => {
  checkSession()
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
  gap: 12px;
}

.header-logo {
  height: 28px;
  width: auto;
  border-radius: 6px;
}

.header-title-icon {
  font-size: 24px;
  color: var(--ion-color-carrot);
  display: flex;
  align-items: center;
}

.title-text {
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--ion-text-color);
}


.profile-button {
  margin-left: 8px;
}

.profile-img-wrapper {
  padding: 2px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--ion-color-carrot), var(--ion-color-carrot-tint));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.toolbar-profile-img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--ion-background-color);
}

.profile-placeholder {
  font-size: 34px;
  color: var(--ion-color-medium);
}

/* Dark Mode Overrides */
:host-context(.ion-palette-dark) .premium-header,
.ion-palette-dark .premium-header {
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
