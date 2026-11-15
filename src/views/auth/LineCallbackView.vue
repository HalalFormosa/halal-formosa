<template>
  <ion-page>
    <ion-content class="ion-padding">
      <div class="line-callback">
        <template v-if="!errorMsg">
          <ion-spinner name="crescent"></ion-spinner>
          <p>{{ $t('auth.loggingIn') }}</p>
        </template>
        <template v-else>
          <p class="error">{{ errorMsg }}</p>
          <ion-button @click="goToLogin">{{ $t('auth.login') }}</ion-button>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonPage, IonContent, IonSpinner, IonButton } from '@ionic/vue';
import { completeLineLogin } from '@/composables/useLineLogin';
import { ActivityLogService } from '@/services/ActivityLogService';

const route = useRoute();
const router = useRouter();
const errorMsg = ref('');

onMounted(async () => {
  const code = route.query.code as string | undefined;
  const state = route.query.state as string | undefined;
  const lineError = route.query.error as string | undefined;

  if (lineError) {
    errorMsg.value = 'LINE login was cancelled.';
    return;
  }
  if (!code || !state) {
    errorMsg.value = 'Invalid LINE login response.';
    return;
  }

  try {
    const redirectPath = await completeLineLogin(code, state, { native: false });
    ActivityLogService.log('auth_login_success', { method: 'line' });
    router.replace(redirectPath);
  } catch (e: any) {
    errorMsg.value = e?.message ?? 'LINE login failed.';
    ActivityLogService.log('auth_login_failed', { error_message: errorMsg.value, method: 'line' });
  }
});

function goToLogin() {
  router.replace('/login');
}
</script>

<style scoped>
.line-callback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  text-align: center;
  padding: 24px;
}

.error {
  color: var(--ion-color-danger);
}
</style>
