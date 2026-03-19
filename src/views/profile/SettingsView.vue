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
      </ion-list>

      <!-- 🌐 Language -->
      <ion-list style="border-radius: 12px; margin-top: 20px;">
        <ion-list-header>{{ $t('settings.language')}}</ion-list-header>
        <ion-radio-group :value="lang" @ionChange="(e) => changeLanguage(e.detail.value)">
          <ion-item v-for="l in languages" :key="l.code" lines="full">
            <div slot="start" style="width: 32px; height: 22px; border-radius: 4px; overflow: hidden; border: 1px solid rgba(0,0,0,0.1); margin-right: 12px;">
              <img :src="l.flag" :alt="l.name" style="width: 100%; height: 100%; object-fit: cover;" />
            </div>
            <ion-label style="font-weight: 500;">{{ l.name }}</ion-label>
            <ion-radio slot="end" :value="l.code"></ion-radio>
          </ion-item>
        </ion-radio-group>
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
  IonRadio,
  IonRadioGroup,
  IonNote,
  IonLabel
} from '@ionic/vue'
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  currentUser,
  isPublicProfile,
  setPublicProfile,
} from '@/composables/userProfile'
import { useTheme } from '@/composables/useTheme'

const { locale } = useI18n()
const lang = ref(locale.value)

const languages = [
  { code: 'en', name: 'English', flag: 'https://flagcdn.com/w80/us.png' },
  { code: 'zh', name: '繁體中文', flag: 'https://flagcdn.com/w80/tw.png' },
  { code: 'id', name: 'Bahasa Indonesia', flag: 'https://flagcdn.com/w80/id.png' },
  { code: 'ms', name: 'Bahasa Melayu', flag: 'https://flagcdn.com/w80/my.png' }
]

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
</script>
