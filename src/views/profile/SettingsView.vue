<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/profile" />
        </ion-buttons>
        <ion-title>{{ $t('settings.title')}}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- 🌙 Appearance -->
      <ion-list style="border-radius: 12px;">
        <ion-list-header>{{ $t('settings.appearance')}}</ion-list-header>
        <ion-item lines="full" style="--border-radius: 12px;">
          <ion-toggle
              :checked="paletteToggle"
              @ionChange="(e) => {paletteToggle = e.detail.checked; toggleDarkPalette(e.detail.checked);}"
          >
            {{ $t('settings.darkMode') }}
          </ion-toggle>
        </ion-item>
      </ion-list>

      <!-- 🔒 Privacy -->
      <ion-list
          v-if="currentUser"
          style="border-radius: 12px; margin-top: 20px;"
      >
        <ion-list-header>{{ $t('settings.privacy')}}</ion-list-header>
        <ion-item v-if="isPublicProfile !== null" lines="full" style="--border-radius: 12px;">
          <div style="width: 100%; padding: 8px 0;">
            <ion-toggle
                :checked="!!isPublicProfile"
                @ionChange="(e) => setPublicProfile(e.detail.checked)"
            >
              {{ $t('settings.publicProfile') }}
            </ion-toggle>
            <ion-note style="display: block; margin-top: 8px; font-size: 0.85rem;">
              {{ $t('settings.publicProfileNote') }}
            </ion-note>
          </div>
        </ion-item>
        <ion-item lines="full" style="--border-radius: 12px;">
          <div style="width: 100%; padding: 8px 0;">
            <ion-toggle
                :checked="showLastSeen"
                @ionChange="(e) => setShowLastSeen(e.detail.checked)"
            >
              {{ $t('settings.showLastSeen') }}
            </ion-toggle>
            <ion-note style="display: block; margin-top: 8px; font-size: 0.85rem;">
              {{ $t('settings.showLastSeenNote') }}
            </ion-note>
          </div>
        </ion-item>
        <ion-item lines="full" style="--border-radius: 12px;">
          <div style="width: 100%; padding: 8px 0;">
            <ion-toggle
                :checked="nearbyPromptsEnabled"
                @ionChange="(e) => setNearbyPromptsEnabled(e.detail.checked)"
            >
              {{ $t('settings.nearbyPrompts') }}
            </ion-toggle>
            <ion-note style="display: block; margin-top: 8px; font-size: 0.85rem;">
              {{ $t('settings.nearbyPromptsNote') }}
            </ion-note>
          </div>
        </ion-item>
        <ion-item lines="full" style="--border-radius: 12px;" v-if="nearbyPromptsEnabled">
          <div style="width: 100%; padding: 8px 0;">
            <ion-toggle
                :checked="backgroundTrackingEnabled"
                @ionChange="(e) => setBackgroundTrackingEnabled(e.detail.checked)"
            >
              {{ $t('settings.backgroundTracking') || 'Background Location Checking' }}
            </ion-toggle>
            <ion-note style="display: block; margin-top: 8px; font-size: 0.85rem; color: var(--ion-color-warning-shade, #b25e00);">
              ⚠️ {{ $t('settings.backgroundTrackingDisclaimer') || 'Enabling background location tracking allows detection even when the app is closed, but it may reduce battery life faster.' }}
            </ion-note>
          </div>
        </ion-item>
      </ion-list>

      <!-- 🛠️ Developer Options -->
      <ion-list v-if="isDev" style="border-radius: 12px; margin-top: 20px;">
        <ion-list-header style="color: var(--ion-color-tertiary)">🛠️ Developer Tools</ion-list-header>
        <ion-item button lines="full" @click="triggerTestPrompt" style="--border-radius: 12px;">
          <ion-icon :icon="sparkles" slot="start" style="margin-right: 12px; color: var(--ion-color-tertiary)" />
          <ion-label style="font-weight: 500;">Trigger Test Review Prompt Modal</ion-label>
        </ion-item>
        <ion-item button lines="full" @click="triggerTestPush" style="--border-radius: 12px;">
          <ion-icon :icon="chatboxEllipsesOutline" slot="start" style="margin-right: 12px; color: var(--ion-color-tertiary)" />
          <ion-label style="font-weight: 500;">Send Test Push Notification</ion-label>
        </ion-item>
      </ion-list>
      
      <!-- 👤 Account -->
      <ion-list v-if="currentUser" style="border-radius: 12px; margin-top: 20px;">
        <ion-list-header>{{ $t('profile.sections.account') }}</ion-list-header>
        <ion-item button lines="full" @click="router.push('/update-password?mode=change')" style="--border-radius: 12px;">
          <ion-icon :icon="keyOutline" slot="start" style="margin-right: 12px; color: var(--ion-color-carrot)" />
          <ion-label>{{ isSocialLogin ? $t('updatePassword.title') : $t('updatePassword.change') }}</ion-label>
        </ion-item>
        <ion-item button lines="full" @click="confirmDeleteAccount" style="--border-radius: 12px; --color: var(--ion-color-danger)">
          <ion-icon :icon="trashOutline" slot="start" style="margin-right: 12px; color: var(--ion-color-danger)" />
          <ion-label style="color: var(--ion-color-danger); font-weight: 500;">{{ $t('settings.deleteAccount') }}</ion-label>
        </ion-item>
      </ion-list>

      <!-- 🌐 Language -->
      <ion-list style="border-radius: 12px; margin-top: 20px;">
        <ion-list-header>{{ $t('settings.language')}}</ion-list-header>
        <LanguagePicker @update="changeLanguage">
          <template #trigger="{ openModal, currentLang }">
            <ion-item button lines="full" @click="openModal" style="--border-radius: 12px;">
              <div slot="start" style="width: 32px; height: 22px; border-radius: 4px; overflow: hidden; border: 1px solid rgba(0,0,0,0.1); margin-right: 12px;">
                <img v-if="currentLang?.flag" :src="currentLang.flag" :alt="currentLang.name" style="width: 100%; height: 100%; object-fit: cover;" />
              </div>
              <ion-label style="font-weight: 500;">{{ currentLang?.name }}</ion-label>
            </ion-item>
          </template>
        </LanguagePicker>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonList,
  IonListHeader,
  IonToggle,
  IonToolbar,
  IonTitle,
  IonPage,
  IonNote,
  IonLabel,
  IonIcon,
  alertController,
  toastController
} from '@ionic/vue'
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import LanguagePicker from '@/components/LanguagePicker.vue'
import {
  currentUser,
  isPublicProfile,
  setPublicProfile,
  showLastSeen,
  setShowLastSeen,
  resetUserProfileState,
  nearbyPromptsEnabled,
  setNearbyPromptsEnabled,
  backgroundTrackingEnabled,
  setBackgroundTrackingEnabled,
  donorType,
  userRole
} from '@/composables/userProfile'
import { useTheme } from '@/composables/useTheme'
import { useProximityPrompt } from '@/composables/useProximityPrompt'
import { useNotifier } from '@/composables/useNotifier'
import { keyOutline, trashOutline, sparkles, chatboxEllipsesOutline } from 'ionicons/icons'
import { useRouter } from 'vue-router'
import { supabase } from '@/plugins/supabaseClient'

const { locale, t } = useI18n()
const lang = ref(locale.value)
const router = useRouter()

const isSocialLogin = computed(() => {
  return currentUser.value?.app_metadata?.provider !== 'email'
})

const changeLanguage = (newLang: string) => {
  if (!newLang) return
  lang.value = newLang
  locale.value = newLang
  localStorage.setItem('lang', newLang)
}

// Dark Mode logic
const { isDark: paletteToggle, toggleDarkPalette, initTheme } = useTheme()

onMounted(() => {
  initTheme()
})

const confirmDeleteAccount = async () => {
  const alert = await alertController.create({
    header: t('settings.deleteAccountConfirmTitle'),
    message: t('settings.deleteAccountConfirmMessage'),
    buttons: [
      {
        text: t('common.cancel'),
        role: 'cancel',
      },
      {
        text: t('settings.deleteAccountConfirmBtn'),
        role: 'destructive',
        handler: async () => {
          await executeDeleteAccount()
        }
      }
    ]
  })
  await alert.present()
}

const executeDeleteAccount = async () => {
  try {
    const { error } = await supabase.rpc('delete_user_account')
    if (error) throw error

    await supabase.auth.signOut()
    resetUserProfileState()

    const alert = await alertController.create({
      header: t('settings.deleteAccount'),
      message: t('settings.deleteAccountSuccess') || 'Your account has been successfully deleted.',
      buttons: ['OK']
    })
    await alert.present()

    router.push('/')
  } catch (err: any) {
    const alert = await alertController.create({
      header: 'Error',
      message: err.message || 'Failed to delete account. Please try again.',
      buttons: ['OK']
    })
    await alert.present()
  }
}

const { currentPrompt } = useProximityPrompt()
const { notifyEvent } = useNotifier()

const isDev = computed(() => {
  return import.meta.env.DEV || donorType.value === 'Developer' || userRole.value === 'admin'
})

const triggerTestPrompt = () => {
  currentPrompt.value = {
    id: 1,
    name: 'Siraya Tourist Center (Dev Test)',
    lat: 23.136,
    lng: 120.365,
    type_id: 1,
    distance_m: 12,
    category_name: 'Visitor Center',
    address: '720, Taiwan, Tainan City, Guantian District, 福田路99號',
    image: null
  }
}

const triggerTestPush = async () => {
  try {
    const { success } = await notifyEvent(
      'test_visit_prompt',
      'Did you visit Siraya Tourist Center?',
      'Mind sharing its Muslim facilities? It really helps other travelers.',
      undefined,
      {
        link: 'myapp://place/1?review=1'
      },
      ['onesignal']
    )
    if (success) {
      const toast = await toastController.create({
        message: '✅ Test push notification triggered!',
        duration: 2000,
        color: 'success'
      })
      toast.present()
    } else {
      throw new Error('Push notification service returned failure status')
    }
  } catch (err: any) {
    const toast = await toastController.create({
      message: `❌ Failed to trigger push: ${err.message || 'Error'}`,
      duration: 3000,
      color: 'danger'
    })
    toast.present()
  }
}
</script>
