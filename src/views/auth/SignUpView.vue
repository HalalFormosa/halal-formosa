<template>
  <ion-page>
    <ion-content fullscreen class="auth-page">
      <div class="auth-container">

        <div class="top-bar">
          <div class="lang-wrapper">
            <LanguagePicker @update="setLanguage" />
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
        <h1 class="auth-title">{{ $t('auth.signUp') }}</h1>
        <p class="auth-subtitle">
          {{ $t('auth.signUpSubtitle') }}
        </p>

        <!-- Form -->
        <form @submit.prevent="signup">
          <!-- Full Name -->
          <div class="input-card">
            <ion-input
                fill="outline"
                :label="$t('auth.displayName')"
                label-placement="floating"
                type="text"
                v-model="displayName"
                required
            />
          </div>

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

          <!-- Confirm Password -->
          <div class="input-card">
            <ion-input
                fill="outline"
                :label="$t('auth.confirmPassword')"
                label-placement="floating"
                type="password"
                v-model="confirmPassword"
                required
            >
              <ion-input-password-toggle slot="end" />
            </ion-input>
          </div>

          <!-- hCaptcha container -->
          <div id="hcaptcha-signup" style="display: none;"></div>

          <!-- hCaptcha disclosure -->
          <p class="hcaptcha-disclosure">
            This site is protected by hCaptcha and its
            <a href="https://www.hcaptcha.com/privacy" target="_blank">Privacy Policy</a> and
            <a href="https://www.hcaptcha.com/terms" target="_blank">Terms of Service</a> apply.
          </p>

          <!-- Error -->
          <ion-text color="danger" v-if="errorMsg" class="error-text">
            {{ errorMsg }}
          </ion-text>

          <!-- Signup button -->
          <ion-button
              type="submit"
              expand="block"
              color="carrot"
              class="primary-btn"
              :disabled="loading || captchaLoading"
          >
            <ion-icon :icon="personAddOutline" slot="start" v-if="!loading && !captchaLoading"></ion-icon>
            {{ captchaLoading ? 'Verifying...' : (loading ? $t('auth.signingUp') : $t('auth.signUp')) }}
          </ion-button>

          <!-- Back to login -->
          <div class="signup-prompt">
            {{ $t('auth.alreadyHaveAccount') }}
            <span class="signup-link" @click="goToLogin">{{ $t('auth.login') }}</span>
          </div>

          <!-- Back -->
          <div class="back-divider" @click="goHome">
            <span>{{ $t('common.backToHome') }}</span>
          </div>

        </form>

      </div>
    </ion-content>

    <!-- Success Modal -->
    <ion-modal :is-open="showSuccessModal" class="success-modal" @didDismiss="goToLogin">
      <div class="modal-content">
        <div class="modal-icon-wrapper">
          <ion-icon :icon="mailOutline" />
        </div>
        <h2 class="modal-title">{{ $t('auth.signUpSuccessTitle') }}</h2>
        <p class="modal-message">{{ $t('auth.signUpSuccessMessage') }}</p>
        
        <ion-button expand="block" color="carrot" class="modal-btn" @click="goToLogin">
          {{ $t('auth.login') }}
        </ion-button>
      </div>
    </ion-modal>
  </ion-page>
</template>

<script lang="ts">
import {
  IonPage,
  IonInput,
  IonButton,
  IonText,
  IonInputPasswordToggle,
  IonContent, 
  IonIcon,
  alertController,
  IonModal
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
    IonIcon
  },
});
</script>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '@/plugins/supabaseClient';
import { useI18n } from 'vue-i18n'
import LanguagePicker from '@/components/LanguagePicker.vue'
import { personAddOutline, moonOutline, sunnyOutline, mailOutline } from "ionicons/icons";
import { ActivityLogService } from '@/services/ActivityLogService'
import { useHCaptcha } from '@/composables/useHCaptcha'

type Theme = 'dark' | 'light'

const theme = ref<Theme>(getInitialTheme())

// Apply immediately
document.documentElement.classList.toggle(
    'ion-palette-dark',
    theme.value === 'dark'
)

const { locale, t } = useI18n()
const { loadScript, initInvisible, execute } = useHCaptcha()

// form fields
const displayName = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const errorMsg = ref('');
const loading = ref(false);
const captchaLoading = ref(false);
const showSuccessModal = ref(false);

const router = useRouter();

// Initialize hCaptcha on mount
onMounted(async () => {
  await loadScript()
  await initInvisible('hcaptcha-signup')
})

async function signup() {
  if (password.value !== confirmPassword.value) {
    errorMsg.value = t('updatePassword.mismatchError') || 'Passwords do not match';
    return;
  }

  errorMsg.value = ''

  // Step 1: Execute invisible hCaptcha
  try {
    captchaLoading.value = true
    const captchaToken = await execute()

    // Step 2: Verify captcha token with Edge Function
    const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-captcha', {
      body: { token: captchaToken }
    })

    if (verifyError || !verifyData?.success) {
      errorMsg.value = 'Verification failed. Please try again.'
      captchaLoading.value = false
      return
    }
  } catch (err) {
    errorMsg.value = 'Captcha verification failed. Please try again.'
    captchaLoading.value = false
    return
  }

  captchaLoading.value = false
  loading.value = true

  const { error } = await supabase.auth.signUp({
    email: email.value,
    password: password.value,
    options: {
      data: {
        display_name: displayName.value,
        full_name: displayName.value,
      }
    }
  })

  loading.value = false

  if (error) {
    errorMsg.value = error.message
    ActivityLogService.log('auth_signup_failed', { error_message: error.message })
  } else {
    ActivityLogService.log('auth_signup_success', {})
    showSuccessModal.value = true
  }
}

function setLanguage(lang: 'en' | 'id' | 'ms' | 'zh') {
  locale.value = lang
  localStorage.setItem('lang', lang)
}

function getInitialTheme(): Theme {
  const saved = localStorage.getItem('theme') as Theme | null
  if (saved === 'dark' || saved === 'light') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(t: Theme) {
  document.documentElement.classList.toggle('ion-palette-dark', t === 'dark')
  localStorage.setItem('theme', t)
  theme.value = t
}

function toggleTheme() {
  const newTheme = theme.value === 'dark' ? 'light' : 'dark'
  applyTheme(newTheme)
}

function goToLogin() {
  showSuccessModal.value = false;
  router.push('/login');
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
  text-align: center;
}

.auth-subtitle {
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 40px;
  text-align: center;
}

/* =========================
   INPUTS
========================= */
.input-card {
  margin-bottom: 16px;
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

.signup-prompt {
  text-align: center;
  margin-top: 32px;
  font-size: 14px;
  color: #8f8f8f;
}

.signup-link {
  color: var(--ion-color-carrot);
  font-weight: 700;
  cursor: pointer;
  margin-left: 4px;
  text-decoration: underline;
}

.signup-link:hover {
  opacity: 0.8;
}

html:not(.ion-palette-dark) .signup-prompt {
  color: #6b7280;
}

/* =========================
   SUCCESS MODAL STYLES
========================= */
.success-modal {
  --height: auto;
  --width: 90%;
  --max-width: 400px;
  --border-radius: 24px;
  --background: #ffffff;
}

html.ion-palette-dark .success-modal {
  --background: #1e1e1e;
}

.modal-content {
  padding: 40px 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.modal-icon-wrapper {
  width: 80px;
  height: 80px;
  background: rgba(229, 126, 34, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.modal-icon-wrapper ion-icon {
  font-size: 40px;
  color: var(--ion-color-carrot);
}

.modal-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 12px;
  color: var(--ion-color-step-900);
}

.modal-message {
  font-size: 16px;
  color: var(--ion-color-step-600);
  line-height: 1.6;
  margin: 0 0 32px;
}

.modal-btn {
  width: 100%;
  margin: 0;
  font-weight: 600;
  --border-radius: 14px;
  height: 56px;
}
</style>
