<template>
  <ion-page>
    <ion-content fullscreen class="auth-page">
      <div class="auth-container">

        <div class="top-bar">
          <div class="lang-wrapper">
            <LanguagePicker @update="setLanguage" />
          </div>
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
        <h1 class="auth-title">{{ $t('updatePassword.title') }}</h1>
        <p class="auth-subtitle">
          {{ $t('updatePassword.subtitle') }}
        </p>

        <!-- Form -->
        <form @submit.prevent="handleUpdatePassword">
          <!-- Old Password (Optional) -->
          <div class="input-card" v-if="mode === 'change' && !isSocialLogin">
            <ion-input
                fill="outline"
                :label="$t('updatePassword.oldPassword')"
                label-placement="floating"
                type="password"
                v-model="oldPassword"
                required
            >
              <ion-input-password-toggle slot="end" />
            </ion-input>
          </div>
          <!-- Password -->
          <div class="input-card">
            <ion-input
                fill="outline"
                :label="$t('updatePassword.newPassword')"
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
                :label="$t('updatePassword.confirmPassword')"
                label-placement="floating"
                type="password"
                v-model="confirmPassword"
                required
            >
              <ion-input-password-toggle slot="end" />
            </ion-input>
          </div>

          <!-- Error -->
          <ion-text color="danger" v-if="errorMsg" class="error-text">
            {{ errorMsg }}
          </ion-text>

          <!-- Update button -->
          <ion-button
              type="submit"
              expand="block"
              color="carrot"
              class="primary-btn"
              :disabled="loading"
          >
            <ion-icon :icon="saveOutline" slot="start" v-if="!loading"></ion-icon>
            {{ loading ? $t('updatePassword.updating') : $t('updatePassword.update') }}
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
  IonContent, 
  IonIcon
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
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '@/plugins/supabaseClient';
import { useI18n } from 'vue-i18n'
import LanguagePicker from '@/components/LanguagePicker.vue'
import { saveOutline } from "ionicons/icons";
import { ActivityLogService } from '@/services/ActivityLogService'
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';

const { locale, t } = useI18n()

// form fields
const oldPassword = ref('');
const password = ref('');
const confirmPassword = ref('');
const errorMsg = ref('');
const loading = ref(false);

const router = useRouter();
const route = useRoute();
const mode = ref(route.query.mode as string || 'reset');

const currentUser = ref<any>(null);
const isSocialLogin = ref(false);

onMounted(async () => {
  const { data } = await supabase.auth.getUser();
  if (data?.user) {
    currentUser.value = data.user;
    isSocialLogin.value = data.user.app_metadata?.provider !== 'email';
  }
});

async function handleUpdatePassword() {
  if (password.value !== confirmPassword.value) {
    errorMsg.value = t('updatePassword.mismatchError') || 'Passwords do not match';
    return;
  }

  loading.value = true
  errorMsg.value = ''

  // 🔐 Verify old password if in "change" mode for email users
  if (mode.value === 'change' && !isSocialLogin.value) {
    if (!oldPassword.value) {
      errorMsg.value = 'Please enter your current password.';
      loading.value = false;
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: currentUser.value?.email,
      password: oldPassword.value,
    });

    if (authError) {
      errorMsg.value = 'Incorrect current password.';
      loading.value = false;
      return;
    }
  }

  const { error } = await supabase.auth.updateUser({
    password: password.value,
  })

  loading.value = false

  if (error) {
    errorMsg.value = error.message
    ActivityLogService.log('auth_password_update_failed', { error_message: error.message })
  } else {
    ActivityLogService.log('auth_password_update_success', {})
    // Redirect to home or profile
    router.push('/home');
  }
}

function setLanguage(lang: 'en' | 'id' | 'ms' | 'zh') {
  locale.value = lang
  localStorage.setItem('lang', lang)
}

function goHome() {
  router.push('/');
}
</script>

<style scoped>
/* Reuse styles from LoginView or global auth styles */
</style>

<style>
/* Simplified copy of LoginView styles for demonstration */
.auth-page {
  --background: radial-gradient(
      120% 120% at 50% -10%,
      #2a2a2a 0%,
      #1e1e1e 55%,
      #181818 100%
  );
}

html:not(.ion-palette-dark) .auth-page {
  --background: linear-gradient(
      180deg,
      #ffffff 0%,
      #f3f4f6 100%
  );
}

.auth-container {
  min-height: 100%;
  max-width: 420px;
  margin: auto;
  padding: calc(36px + var(--safe-area-inset-top, env(safe-area-inset-top))) 22px 32px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.logo-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 18px;
}

.app-logo {
  width: 120px;
  height: 120px;
  border-radius: 24px;
}

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
  color: #8f8f8f;
}

.input-card {
  margin-bottom: 16px;
}

.primary-btn {
  margin-top: 22px;
  font-weight: 600;
}

.back-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 22px;
  font-size: 12px;
  color: #8f8f8f;
  cursor: pointer;
}

.top-bar {
  position: absolute;
  top: calc(12px + var(--safe-area-inset-top, env(safe-area-inset-top)));
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 18px;
}

.lang-select {
  min-width: 110px;
}
</style>
