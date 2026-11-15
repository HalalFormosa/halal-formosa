<template>
  <ion-page>
    <ion-content class="ion-padding">
      <div class="line-callback">
        <ion-spinner name="crescent"></ion-spinner>
        <p>{{ $t('auth.loggingIn') }}</p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
// Native-only bounce page: LINE's callback URL must be http(s), so native
// logins land here (opened in the in-app browser) and this page immediately
// forwards the code/state to the app's myapp:// custom scheme, which the OS
// intercepts and hands back to main.ts's deep-link handler inside the app.
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { IonPage, IonContent, IonSpinner } from '@ionic/vue';

const route = useRoute();

onMounted(() => {
  const code = route.query.code as string | undefined;
  const state = route.query.state as string | undefined;
  const lineError = route.query.error as string | undefined;

  const params = new URLSearchParams();
  if (code) params.set('code', code);
  if (state) params.set('state', state);
  if (lineError) params.set('error', lineError);

  window.location.href = `myapp://callback?${params.toString()}`;
});
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
</style>
