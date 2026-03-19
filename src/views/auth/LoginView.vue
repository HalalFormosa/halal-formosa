<template>
  <ion-page>
    <ion-content fullscreen class="auth-page">
      <div class="auth-container">

        <div class="top-bar">
          <div class="lang-wrapper">
            <ion-select
                interface="popover"
                :value="locale"
                @ionChange="setLanguage($event.detail.value)"
                class="lang-select"
            >
              <ion-select-option value="en">English</ion-select-option>
              <ion-select-option value="id">Bahasa Indonesia</ion-select-option>
              <ion-select-option value="ms">Bahasa Melayu</ion-select-option>
              <ion-select-option value="zh">繁體中文</ion-select-option>
            </ion-select>
          </div>

          <ion-button
              fill="clear"
              class="theme-btn"
              style="border-radius: 50px"
              @click="toggleTheme"
          >
            <ion-icon
                :icon="theme === 'dark' ? sunnyOutline : moonOutline"
                slot="icon-only"
            />
          </ion-button>
        </div>



        <!-- Logo -->
        <div class="logo-wrapper">
          <img
              src="/android-chrome-512x512.png"
              alt="App logo"
              class="app-logo"
          />
        </div>

        <!-- Title -->
        <h1 class="auth-title">{{ $t('auth.login') }}</h1>
        <p class="auth-subtitle">
          {{ $t('auth.loginSubtitle') }}
        </p>


        <!-- Form -->
        <form @submit.prevent="login">
          <!-- Email -->
          <div class="input-card">
            <ion-input
                fill="outline"
                :label="$t('auth.email')"
                label-placement="floating"
                type="email"
                v-model="email"
                required
            />

          </div>

          <!-- Password -->
          <div class="input-card">
            <ion-input
                fill="outline"
                :label="$t('auth.password')"
                label-placement="floating"
                type="password"
                v-model="password"
                required
            >
              <ion-input-password-toggle slot="end" />
            </ion-input>

          </div>

          <!-- Error -->
          <ion-text color="danger" v-if="errorMsg" class="error-text">
            {{ errorMsg }}
          </ion-text>

          <!-- Login button -->
          <ion-button
              type="submit"
              expand="block"
              color="carrot"
              class="primary-btn"
              :disabled="loading"
          >
            {{ loading ? $t('auth.loggingIn') : $t('auth.login') }}
          </ion-button>


          <!-- Divider -->
          <div class="divider">
            <span>{{ $t('common.or') }}</span>
          </div>


          <!-- Google -->
          <ion-button
              expand="block"
              fill="outline"
              color="carrot"
              @click="loginWithGoogle"
          >
            {{ $t('auth.continueWithGoogle') }}
          </ion-button>


          <!-- Back -->
          <div class="back-divider" @click="goHome">
            <span>{{ $t('common.backToHome') }}</span>
          </div>


        </form>

      </div>
    </ion-content>
  </ion-page>
</template>


<script lang="ts">
import {
  IonPage,
  IonInput,
  IonButton,
  IonText,
  IonInputPasswordToggle,
  IonContent, IonSelectOption, IonSelect, IonIcon
} from '@ionic/vue';
import { defineComponent } from 'vue';

export default defineComponent({
  components: {
    IonPage,
    IonInput,
    IonButton,
    IonText,
    IonInputPasswordToggle,
    IonContent,
    IonSelectOption,
    IonSelect,
    IonIcon
  },
});
</script>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '@/plugins/supabaseClient';
import { Capacitor } from '@capacitor/core';
import { useI18n } from 'vue-i18n'
import {moonOutline, sunnyOutline} from "ionicons/icons";

type Theme = 'dark' | 'light'

const theme = ref<Theme>(getInitialTheme())

// 2️⃣ Apply immediately (before first render)
document.documentElement.classList.toggle(
    'ion-palette-dark',
    theme.value === 'dark'
)

const { locale } = useI18n()

// form fields
const email = ref('');
const password = ref('');
const errorMsg = ref('');
const loading = ref(false);

// router helpers
const router = useRouter();
const route = useRoute();

// email/password login
async function login() {
  loading.value = true
  errorMsg.value = ''

  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })

  loading.value = false

  if (error) {
    errorMsg.value = error.message
  }
}

function setLanguage(lang: 'en' | 'id' | 'ms' | 'zh') {
  locale.value = lang
  localStorage.setItem('lang', lang)
}

// 1️⃣ Determine initial theme synchronously
function getInitialTheme(): Theme {
  const saved = localStorage.getItem('theme') as Theme | null
  if (saved === 'dark' || saved === 'light') return saved

  // fallback to system preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
}

function applyTheme(t: Theme) {
  document.documentElement.classList.toggle('ion-palette-dark', t === 'dark')
  localStorage.setItem('theme', t)
  theme.value = t
}

function toggleTheme() {
  applyTheme(theme.value === 'dark' ? 'light' : 'dark')
}

async function loginWithGoogle() {
  errorMsg.value = '';

  const r = route.query.redirect;
  const safeRedirect: string =
      typeof r === 'string'
          ? r
          : Array.isArray(r) && r.length > 0
              ? r[0] ?? '/'
              : '/';

  const redirectUrl = Capacitor.isNativePlatform()
      ? 'myapp://callback'
      : window.location.origin + safeRedirect;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      queryParams: { next: safeRedirect },
    },
  });

  if (error) {
    errorMsg.value = error.message;
  }
}

function goHome() {
  router.push('/');
}
</script>


<style>
/* =========================
   AUTH PAGE BASE
========================= */
.auth-page {
  --background: radial-gradient(
      120% 120% at 50% -10%,
      #2a2a2a 0%,
      #1e1e1e 55%,
      #181818 100%
  );
}

/* =========================
   LIGHT THEME OVERRIDES
========================= */
html:not(.ion-palette-dark) .auth-page {
  --background: linear-gradient(
      180deg,
      #ffffff 0%,
      #f3f4f6 100%
  );
}

html:not(.ion-palette-dark) .auth-title {
  color: #111827;
}

html:not(.ion-palette-dark) .auth-subtitle {
  color: #4b5563;
}

html:not(.ion-palette-dark) ion-input {
  background: #ffffff;
  --border-color: #d1d5db;
  --color: #111827;
  --placeholder-color: #6b7280;
}

html:not(.ion-palette-dark) ion-input::part(label) {
  color: #6b7280;
}

html:not(.ion-palette-dark) ion-input.has-focus::part(label),
html:not(.ion-palette-dark) ion-input.has-value::part(label) {
  color: var(--ion-color-carrot);
}

html:not(.ion-palette-dark) .divider::before,
html:not(.ion-palette-dark) .divider::after {
  background: #e5e7eb;
}

html:not(.ion-palette-dark) .back-divider {
  color: #6b7280;
}

html:not(.ion-palette-dark) .lang-select {
  --border-color: #d1d5db;
  --color: #374151;
}


/* =========================
   CONTAINER
========================= */
.auth-container {
  min-height: 100%;
  max-width: 420px;
  margin: auto;
  padding: calc(36px + var(--safe-area-inset-top, env(safe-area-inset-top))) 22px 32px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* =========================
   LOGO
========================= */
.logo-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 18px;
}

.app-logo {
  width: 150px;
  height: 150px;
  border-radius: 28px;
}


/* =========================
   TYPOGRAPHY
========================= */
.auth-title {
  margin-top: 6px;
  margin-bottom: 6px;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 0.2px;
}

.auth-subtitle {
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 40px;
}

/* =========================
   INPUTS
========================= */
.input-card {
  margin-bottom: 0;
}

.input-card + .input-card {
  margin-top: 16px;
}

ion-input {
  --min-height: 56px;
  --padding-start: 16px;
  --padding-end: 16px;

  --border-radius: 14px;
  --border-color: #3a3a3a;
  --highlight-color-focused: var(--ion-color-carrot);

  --color: #ffffff;
  --placeholder-color: #9a9a9a;

  background: rgba(255, 255, 255, 0.015);
}

/* Floating label */
ion-input::part(label) {
  font-size: 14px;
  color: #b5b5b5;
  transition: color 0.15s ease;
}

ion-input.has-focus::part(label),
ion-input.has-value::part(label) {
  color: var(--ion-color-carrot);
}

/* =========================
   ERROR MESSAGE
========================= */
.error-text {
  display: block;
  margin-top: 12px;
  margin-bottom: 6px;
  font-size: 13px;
}

/* =========================
   PRIMARY BUTTON
========================= */
.primary-btn {
  margin-top: 22px;
  font-weight: 600;
  letter-spacing: 0.4px;
}

.primary-btn::part(native):active {
  transform: scale(0.98);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.45);
}

/* =========================
   DIVIDER
========================= */
.divider {
  display: flex;
  align-items: center;
  margin: 28px 0 24px;
  font-size: 11px;
  letter-spacing: 1px;
  color: #8f8f8f;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #2f2f2f;
}

.divider span {
  padding: 0 12px;
  opacity: 0.7;
}

/* =========================
   SMALL SCREEN ADJUSTMENTS
========================= */
@media (max-height: 620px) {
  .logo-wrapper {
    margin-bottom: 10px;
  }

  .app-logo {
    width: 96px;
    height: 96px;
    border-radius: 20px;
  }

  .auth-subtitle {
    margin-bottom: 28px;
  }
}

.back-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 22px;
  font-size: 12px;
  letter-spacing: 1px;
  color: #8f8f8f;
  cursor: pointer;
}

.back-divider span {
  opacity: 0.7;
  transition: opacity 0.15s ease;
}

.back-divider:hover span {
  opacity: 1;
}

.top-bar {
  position: absolute;
  top: calc(12px + var(--safe-area-inset-top, env(safe-area-inset-top)));
  left: 0;
  right: 0;

  display: flex;
  align-items: center;
  justify-content: space-between;

  padding: 0 18px;
  pointer-events: auto;
}

.lang-wrapper {
  display: flex;
  align-items: center;
}

.lang-select {
  min-width: 110px;
}

.theme-btn {
  --padding-start: 6px;
  --padding-end: 6px;
  --color: #b8b8b8;
}

.theme-btn:hover {
  --color: var(--ion-color-carrot);
}

.theme-btn {
  --padding-start: 8px;
  --padding-end: 8px;
  --color: #b8b8b8;
  font-size: 18px;
  transition: color 0.2s ease, transform 0.15s ease;
}

.theme-btn:hover {
  --color: var(--ion-color-carrot);
}

.theme-btn:active {
  transform: scale(0.9);
}

.theme-btn ion-icon {
  transition: transform 0.25s ease;
}

html.ion-palette-dark .theme-btn ion-icon {
  transform: rotate(180deg);
}

</style>