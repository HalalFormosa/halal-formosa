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

          <h1 class="hero-title">{{ $t('auth.login') }}</h1>
          <p class="hero-subtitle">{{ $t('auth.loginSubtitle') }}</p>
        </div>

        <!-- Sheet -->
        <div class="auth-sheet">
          <form @submit.prevent="login">
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
              <div class="forgot-password-link" @click="handleForgotPassword">
                {{ $t('auth.forgotPassword') }}
              </div>
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
                :disabled="loading || captchaLoading"
            >
              <ion-icon :icon="logInOutline" slot="start" v-if="!loading && !captchaLoading"></ion-icon>
              {{ captchaLoading ? 'Verifying...' : (loading ? $t('auth.loggingIn') : $t('auth.login')) }}
            </ion-button>

            <!-- Divider -->
            <div class="divider">
              <span>{{ $t('common.or') }}</span>
            </div>

            <!-- Social login -->
            <div class="social-row">
              <button type="button" class="social-circle" @click="loginWithGoogle" :aria-label="$t('auth.continueWithGoogle')">
                <ion-icon :icon="logoGoogle" />
              </button>
              <button
                  v-if="showAppleSignIn"
                  type="button"
                  class="social-circle"
                  @click="loginWithApple"
                  :aria-label="$t('auth.continueWithApple')"
              >
                <ion-icon :icon="logoApple" />
              </button>
            </div>

            <!-- Sign Up -->
            <div class="signup-prompt">
              {{ $t('auth.noAccount') }}
              <span class="signup-link" @click="goToSignUp">{{ $t('auth.signUp') }}</span>
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
  </ion-page>
</template>


<script lang="ts">
import {
  IonPage,
  IonInput,
  IonButton,
  IonText,
  IonInputPasswordToggle,
  IonContent, IonIcon, alertController
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
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '@/plugins/supabaseClient';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { useI18n } from 'vue-i18n'
import LanguagePicker from '@/components/LanguagePicker.vue'
import {logoGoogle, logoApple, logInOutline, moonOutline, sunnyOutline, mailOutline, lockClosedOutline} from "ionicons/icons";
import { AppleSignIn, SignInScope } from '@capawesome/capacitor-apple-sign-in';
import { ActivityLogService } from '@/services/ActivityLogService'
import { useRecaptcha } from '@/composables/useRecaptcha'

type Theme = 'dark' | 'light'

const theme = ref<Theme>(getInitialTheme())

// 2️⃣ Apply immediately (before first render)
document.documentElement.classList.toggle(
    'ion-palette-dark',
    theme.value === 'dark'
)

const { locale, t } = useI18n()
const { loadScript, execute, isExecuting, isCaptchaEnabled } = useRecaptcha()
const showDisclosure = isCaptchaEnabled
const isDev = import.meta.env.DEV

// form fields
const email = ref('');
const password = ref('');
const errorMsg = ref('');
const loading = ref(false);
const captchaLoading = ref(false);
const showAppleSignIn = computed(() => {
  return Capacitor.getPlatform() === 'ios';
});

// router helpers
const router = useRouter();
const route = useRoute();

// Initialize hCaptcha on mount
onMounted(async () => {
  if (isCaptchaEnabled) {
    await loadScript()
  }
})

// email/password login
async function login() {
  errorMsg.value = ''

  // Step 1: Execute invisible reCAPTCHA
  if (isCaptchaEnabled) {
    try {
      captchaLoading.value = true
      const captchaToken = await execute('login')

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
  }

  captchaLoading.value = false
  loading.value = true

  // Step 3: Proceed with Supabase login
  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })

  loading.value = false

  if (error) {
    errorMsg.value = error.message
    ActivityLogService.log('auth_login_failed', { error_message: error.message, method: 'email' })
  } else {
    ActivityLogService.log('auth_login_success', { method: 'email' })
  }
}

async function handleForgotPassword() {
  if (loading.value || captchaLoading.value) return;

  if (!email.value) {
    errorMsg.value = 'Please enter your email address first.';
    return;
  }

  errorMsg.value = '';

  // Step 1: Execute invisible reCAPTCHA
  if (isCaptchaEnabled) {
    try {
      captchaLoading.value = true;
      const captchaToken = await execute('forgot_password');

      // Step 2: Verify captcha token with Edge Function
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-captcha', {
        body: { token: captchaToken }
      });

      if (verifyError || !verifyData?.success) {
        errorMsg.value = 'Verification failed. Please try again.';
        captchaLoading.value = false;
        return;
      }
    } catch (err) {
      errorMsg.value = 'Captcha verification failed. Please try again.';
      captchaLoading.value = false;
      return;
    }
  }

  captchaLoading.value = false;
  loading.value = true;

  const { error } = await supabase.auth.resetPasswordForEmail(email.value, {
    redirectTo: window.location.origin + '/update-password',
  });

  loading.value = false;

  if (error) {
    errorMsg.value = error.message;
  } else {
    const alert = await alertController.create({
      header: t('auth.forgotPassword'),
      message: t('auth.resetEmailSent'),
      buttons: ['OK'],
    });
    await alert.present();
    ActivityLogService.log('auth_password_reset_requested', { email: email.value });
  }
}

function setLanguage(lang: 'en' | 'id' | 'ms' | 'zh') {
  locale.value = lang
  localStorage.setItem('lang', lang)
  ActivityLogService.log('settings_language_change', { language: lang })
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
  const newTheme = theme.value === 'dark' ? 'light' : 'dark'
  applyTheme(newTheme)
  ActivityLogService.log('settings_theme_toggle', { theme: newTheme })
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
    ActivityLogService.log('auth_login_failed', { error_message: error.message, method: 'google' })
    return;
  }

  if (isNative && data?.url) {
    await Browser.open({ url: data.url });
  }

  // Note: Google success is usually handled via redirect,
  // but we can log the attempt start here.
  ActivityLogService.log('auth_login_success', { method: 'google' })
}

async function loginWithApple() {
  errorMsg.value = '';
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

    ActivityLogService.log('auth_login_success', { method: 'apple' });

    const r = route.query.redirect;
    const safeRedirect = typeof r === 'string' ? r : '/';
    router.push(safeRedirect);
  } catch (err: any) {
    // If the user cancelled, do not show error message
    if (err.message && err.message.includes('SIGN_IN_CANCELED')) {
      return;
    }
    errorMsg.value = err.message || 'Apple sign-in failed.';
    ActivityLogService.log('auth_login_failed', { error_message: err.message, method: 'apple' });
  } finally {
    loading.value = false;
  }
}

function goHome() {
  router.push('/');
}

function goToSignUp() {
  router.push('/signup');
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
  margin-bottom: 0;
}

.input-card + .input-card {
  margin-top: 16px;
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

.theme-btn ion-icon {
  transition: transform 0.25s ease;
}

html.ion-palette-dark .theme-btn ion-icon {
  transform: rotate(180deg);
}

.forgot-password-link {
  text-align: right;
  margin-top: 8px;
  font-size: 13px;
  color: var(--ion-color-carrot);
  cursor: pointer;
  font-weight: 500;
  opacity: 0.9;
}

.forgot-password-link:hover {
  opacity: 1;
  text-decoration: underline;
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
</style>
