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
  alertController
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
  resetUserProfileState
} from '@/composables/userProfile'
import { useTheme } from '@/composables/useTheme'
import { keyOutline, trashOutline } from 'ionicons/icons'
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
</script>
