<template>
  <ion-page>
    <ion-content fullscreen class="auth-page">
      <div class="auth-container">

        <!-- Hero -->
        <div class="auth-hero">
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

          <div class="logo-badge">
            <img
                src="/android-chrome-512x512.png"
                alt="App logo"
                class="app-logo"
            />
          </div>

          <h1 class="hero-title">{{ $t('auth.signUp') }}</h1>
          <p class="hero-subtitle">{{ $t('auth.signUpSubtitle') }}</p>
        </div>

        <!-- Sheet -->
        <div class="auth-sheet">
          <form @submit.prevent="signup">
            <!-- Full Name -->
            <div class="input-card">
              <ion-input
                  fill="outline"
                  :label="$t('auth.displayName')"
                  label-placement="stacked"
                  type="text"
                  v-model="displayName"
                  class="pill-input"
                  shape="round"
                  required
              >
                <ion-icon :icon="personOutline" slot="start" class="input-leading-icon" />
              </ion-input>
            </div>

            <!-- Email -->
            <div class="input-card">
              <ion-input
                  fill="outline"
                  :label="$t('auth.email')"
                  label-placement="stacked"
                  type="email"
                  v-model="email"
                  class="pill-input"
                  shape="round"
                  required
              >
                <ion-icon :icon="mailOutline" slot="start" class="input-leading-icon" />
              </ion-input>
            </div>

            <!-- Password -->
            <div class="input-card">
              <ion-input
                  fill="outline"
                  :label="$t('auth.password')"
                  label-placement="stacked"
                  type="password"
                  v-model="password"
                  class="pill-input"
                  shape="round"
                  required
              >
                <ion-icon :icon="lockClosedOutline" slot="start" class="input-leading-icon" />
                <ion-input-password-toggle slot="end" />
              </ion-input>
            </div>

            <!-- Confirm Password -->
            <div class="input-card">
              <ion-input
                  fill="outline"
                  :label="$t('auth.confirmPassword')"
                  label-placement="stacked"
                  type="password"
                  v-model="confirmPassword"
                  class="pill-input"
                  shape="round"
                  required
              >
                <ion-icon :icon="lockClosedOutline" slot="start" class="input-leading-icon" />
                <ion-input-password-toggle slot="end" />
              </ion-input>
            </div>

            <!-- Consent -->
            <ion-item lines="none" class="consent-item">
              <ion-checkbox
                  :checked="agreedToTerms"
                  @ionChange="agreedToTerms = $event.detail.checked"
                  slot="start"
                  color="carrot"
              />
              <ion-label class="consent-label">
                <i18n-t keypath="auth.agreeToTerms" tag="span">
                  <template #privacy>
                    <a href="#" @click.prevent.stop="openLegal('https://halalformosa.com/privacy')">{{ $t('auth.privacyPolicy') }}</a>
                  </template>
                  <template #terms>
                    <a href="#" @click.prevent.stop="openLegal('https://halalformosa.com/terms')">{{ $t('auth.termsOfService') }}</a>
                  </template>
                </i18n-t>
              </ion-label>
            </ion-item>

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
                :disabled="loading || captchaLoading || !agreedToTerms"
            >
              <ion-icon :icon="personAddOutline" slot="start" v-if="!loading && !captchaLoading"></ion-icon>
              {{ captchaLoading ? 'Verifying...' : (loading ? $t('auth.signingUp') : $t('auth.signUp')) }}
            </ion-button>

            <!-- Divider -->
            <div class="divider">
              <span>{{ $t('common.or') }}</span>
            </div>

            <!-- Social sign-up -->
            <div class="social-row">
              <button type="button" class="social-circle" :disabled="!agreedToTerms" @click="signUpWithGoogle" :aria-label="$t('auth.continueWithGoogle')">
                <ion-icon :icon="logoGoogle" />
              </button>
              <button
                  v-if="showAppleSignIn"
                  type="button"
                  class="social-circle"
                  :disabled="!agreedToTerms"
                  @click="signUpWithApple"
                  :aria-label="$t('auth.continueWithApple')"
              >
                <ion-icon :icon="logoApple" />
              </button>
              <button type="button" class="social-circle" :disabled="!agreedToTerms" @click="signUpWithLine" :aria-label="$t('auth.continueWithLine')">
                <svg viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg" fill="#06C755">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                </svg>
              </button>
            </div>

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

          <!-- reCAPTCHA disclosure -->
          <p class="hcaptcha-disclosure" v-if="showDisclosure">
            This site is protected by reCAPTCHA and the Google
            <a href="https://policies.google.com/privacy" target="_blank">Privacy Policy</a> and
            <a href="https://policies.google.com/terms" target="_blank">Terms of Service</a> apply.
          </p>
        </div>

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
  IonModal,
  IonCheckbox, IonItem, IonLabel
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
    IonIcon,
    IonCheckbox,
    IonItem,
    IonLabel
  },
});
</script>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '@/plugins/supabaseClient';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { useI18n } from 'vue-i18n'
import LanguagePicker from '@/components/LanguagePicker.vue'
import { personAddOutline, personOutline, moonOutline, sunnyOutline, mailOutline, lockClosedOutline, logoGoogle, logoApple } from "ionicons/icons";
import { AppleSignIn, SignInScope } from '@capawesome/capacitor-apple-sign-in';
import { ActivityLogService } from '@/services/ActivityLogService'
import { useRecaptcha } from '@/composables/useRecaptcha'
import { startLineLogin } from '@/composables/useLineLogin'

type Theme = 'dark' | 'light'

const theme = ref<Theme>(getInitialTheme())

// Apply immediately
document.documentElement.classList.toggle(
    'ion-palette-dark',
    theme.value === 'dark'
)

const { locale, t } = useI18n()
const { loadScript, execute, isCaptchaEnabled, activeSiteKey } = useRecaptcha()
const showDisclosure = isCaptchaEnabled
const isDev = import.meta.env.DEV

// form fields
const displayName = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const errorMsg = ref('');
const loading = ref(false);
const captchaLoading = ref(false);
const agreedToTerms = ref(false);

async function openLegal(url: string) {
  await Browser.open({ url });
}
const showSuccessModal = ref(false);
const showAppleSignIn = computed(() => {
  return Capacitor.getPlatform() === 'ios';
});

const router = useRouter();
const route = useRoute();

// Initialize hCaptcha on mount
onMounted(async () => {
  if (isCaptchaEnabled) {
    await loadScript()
  }
})

async function signup() {
  if (!agreedToTerms.value) {
    errorMsg.value = t('auth.mustAgreeToTerms');
    return;
  }

  if (password.value !== confirmPassword.value) {
    errorMsg.value = t('updatePassword.mismatchError') || 'Passwords do not match';
    return;
  }

  errorMsg.value = ''

  // Step 1: Execute invisible reCAPTCHA
  if (isCaptchaEnabled) {
    try {
      captchaLoading.value = true
      const captchaToken = await execute('signup')

      // execute() resolves 'disabled' when there's no platform-appropriate check
      // to run (e.g. iOS, which has no native reCAPTCHA key yet) — skip verification
      // rather than sending that sentinel to the backend as if it were a real token.
      if (captchaToken !== 'disabled') {
        // Step 2: Verify captcha token with Edge Function
        const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-captcha', {
          body: { token: captchaToken, action: 'signup', siteKey: activeSiteKey }
        })

        if (verifyError || !verifyData?.success) {
          errorMsg.value = 'Verification failed. Please try again.'
          captchaLoading.value = false
          return
        }
      }
    } catch (err) {
      errorMsg.value = 'Captcha verification failed. Please try again.'
      captchaLoading.value = false
      return
    }
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

// Google/Apple OAuth creates the account automatically if it doesn't exist
// yet, so signup and login share the exact same flow here.
async function signUpWithGoogle() {
  errorMsg.value = '';

  if (!agreedToTerms.value) {
    errorMsg.value = t('auth.mustAgreeToTerms');
    return;
  }

  const r = route.query.redirect;
  const safeRedirect: string =
      typeof r === 'string'
          ? r
          : Array.isArray(r) && r.length > 0
              ? r[0] ?? '/'
              : '/';

  const isNative = Capacitor.isNativePlatform();
  const redirectUrl = isNative
      ? 'myapp://callback'
      : window.location.origin + safeRedirect;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      queryParams: { next: safeRedirect },
      skipBrowserRedirect: isNative,
    },
  });

  if (error) {
    errorMsg.value = error.message;
    ActivityLogService.log('auth_signup_failed', { error_message: error.message, method: 'google' })
    return;
  }

  if (isNative && data?.url) {
    await Browser.open({ url: data.url });
  }

  ActivityLogService.log('auth_signup_success', { method: 'google' })
}

// Google/Apple/LINE OAuth creates the account automatically if it doesn't
// exist yet, so signup and login share the exact same flow here.
async function signUpWithLine() {
  errorMsg.value = '';

  if (!agreedToTerms.value) {
    errorMsg.value = t('auth.mustAgreeToTerms');
    return;
  }

  const r = route.query.redirect;
  const safeRedirect: string =
      typeof r === 'string'
          ? r
          : Array.isArray(r) && r.length > 0
              ? r[0] ?? '/'
              : '/';

  try {
    await startLineLogin(safeRedirect);
  } catch (e: any) {
    errorMsg.value = e?.message ?? 'Failed to start LINE login.';
    ActivityLogService.log('auth_signup_failed', { error_message: errorMsg.value, method: 'line' })
  }
}

async function signUpWithApple() {
  errorMsg.value = '';

  if (!agreedToTerms.value) {
    errorMsg.value = t('auth.mustAgreeToTerms');
    return;
  }

  loading.value = true;

  try {
    const result = await AppleSignIn.signIn({
      scopes: [SignInScope.Email, SignInScope.FullName],
    });

    if (!result.idToken) {
      throw new Error('Apple authorization did not return an identity token.');
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: result.idToken,
    });

    if (error) throw error;

    ActivityLogService.log('auth_signup_success', { method: 'apple' });

    const r = route.query.redirect;
    const safeRedirect = typeof r === 'string' ? r : '/';
    router.push(safeRedirect);
  } catch (err: any) {
    if (err.message && err.message.includes('SIGN_IN_CANCELED')) {
      return;
    }
    errorMsg.value = err.message || 'Apple sign-in failed.';
    ActivityLogService.log('auth_signup_failed', { error_message: err.message, method: 'apple' });
  } finally {
    loading.value = false;
  }
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
  --background: var(--ion-background-color);
}

.auth-container {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

/* =========================
   HERO (brand gradient, same in both themes)
========================= */
.auth-hero {
  flex-shrink: 0;
  padding: calc(20px + var(--safe-area-inset-top, env(safe-area-inset-top))) 24px 56px;
  background: linear-gradient(155deg, var(--ion-color-carrot) 0%, #a8500f 48%, #241206 100%);
  text-align: center;
  overflow: hidden;
}

.logo-badge {
  width: 96px;
  height: 96px;
  margin: 12px auto 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.35);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

.app-logo {
  width: 68px;
  height: 68px;
  border-radius: 18px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.hero-title {
  margin: 0 0 6px;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #ffffff;
}

.hero-subtitle {
  margin: 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
}

/* =========================
   SHEET (overlaps the hero, holds the form)
========================= */
.auth-sheet {
  flex: 1;
  margin-top: -32px;
  background: var(--card-bg);
  border-radius: 32px 32px 0 0;
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.06);
  padding: 44px 32px calc(24px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom)));
}

/* =========================
   INPUTS
========================= */
.input-card {
  margin-bottom: 16px;
}

.pill-input {
  --min-height: 54px;
  --padding-start: 4px;
  --padding-end: 16px;

  --border-radius: var(--radius-pill);
  --border-color: var(--card-border);
  --border-width: 1.5px;
  --highlight-color-focused: var(--ion-color-carrot);

  --color: var(--ion-text-color);
  --placeholder-color: var(--ion-color-medium);

  background: var(--card-inner-bg);
  border-radius: var(--radius-pill);
  transition: box-shadow 0.15s ease;
}

.pill-input.has-focus {
  box-shadow: 0 0 0 3px rgba(var(--ion-color-carrot-rgb), 0.15);
}

.input-leading-icon {
  font-size: 19px;
  color: var(--ion-color-carrot);
  margin-inline-start: 16px;
  margin-inline-end: 4px;
}

/* Stacked label */
.pill-input::part(label) {
  font-size: 13px;
  font-weight: 600;
  color: var(--ion-color-medium);
  margin-bottom: 6px;
}

.pill-input.has-focus::part(label) {
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
  height: 52px;
  font-weight: 700;
  letter-spacing: -0.01em;
  --border-radius: var(--radius-pill);
  --box-shadow: 0 8px 20px rgba(var(--ion-color-carrot-rgb), 0.3);
}

.primary-btn::part(native):active {
  transform: scale(0.98);
  box-shadow: var(--card-shadow-hover);
}

/* =========================
   CONSENT CHECKBOX
========================= */
.consent-item {
  --padding-start: 0;
  --inner-padding-end: 0;
  --background: transparent;
  --min-height: 0;
  margin: 4px 0 12px;
}

.consent-item ion-checkbox {
  --size: 15px;
  margin-inline-end: 6px;
}

ion-label.consent-label {
  font-size: 0.72rem !important;
  line-height: 1.3;
  color: var(--ion-color-medium);
  white-space: nowrap;
}

.consent-label a {
  color: var(--ion-color-carrot);
  font-weight: 600;
  text-decoration: underline;
}

/* =========================
   DIVIDER
========================= */
.divider {
  display: flex;
  align-items: center;
  margin: 24px 0 20px;
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--ion-color-medium);
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--card-border);
}

.divider span {
  padding: 0 12px;
  opacity: 0.7;
}

/* =========================
   SOCIAL LOGIN (circular icon buttons)
========================= */
.social-row {
  display: flex;
  justify-content: center;
  gap: 14px;
}

.social-circle {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--card-inner-bg);
  border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow);
  font-size: 22px;
  color: var(--ion-text-color);
  cursor: pointer;
  padding: 0;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.social-circle:hover {
  box-shadow: var(--card-shadow-hover);
}

.social-circle:active {
  transform: scale(0.94);
}

.social-circle:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* =========================
   SMALL SCREEN ADJUSTMENTS
========================= */
@media (max-height: 620px) {
  .auth-hero {
    padding-bottom: 44px;
  }

  .logo-badge {
    width: 76px;
    height: 76px;
    margin: 4px auto 14px;
  }

  .app-logo {
    width: 52px;
    height: 52px;
    border-radius: 14px;
  }
}

.back-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 22px;
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--ion-color-medium);
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  z-index: 1;
}

.lang-wrapper {
  display: flex;
  align-items: center;
  --color: #ffffff;
  color: #ffffff;
}

.lang-wrapper .flag-icon {
  border-color: rgba(255, 255, 255, 0.35);
}

.theme-btn {
  --padding-start: 8px;
  --padding-end: 8px;
  --color: #ffffff;
  --border-radius: 50%;
  --background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 50%;
  font-size: 18px;
  transition: transform 0.15s ease;
}

.theme-btn:active {
  transform: scale(0.9);
}

.signup-prompt {
  text-align: center;
  margin-top: 24px;
  font-size: 14px;
  color: var(--ion-color-medium);
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

.hcaptcha-disclosure {
  font-size: 11px;
  line-height: 1.4;
  color: var(--ion-color-medium);
  text-align: center;
  margin: 16px 0 0;
  opacity: 0.7;
}

.hcaptcha-disclosure a {
  color: var(--ion-color-medium);
  text-decoration: underline;
  opacity: 0.8;
}

.hcaptcha-disclosure a:hover {
  opacity: 1;
}

/* =========================
   SUCCESS MODAL STYLES
========================= */
.success-modal {
  --height: auto;
  --width: 90%;
  --max-width: 400px;
  --border-radius: var(--radius-xl);
  --background: var(--card-bg);
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
  font-weight: 700;
  --border-radius: var(--radius-lg);
  height: 54px;
}
</style>
