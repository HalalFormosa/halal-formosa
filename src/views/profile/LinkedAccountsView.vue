<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/profile" />
        </ion-buttons>
        <ion-title>{{ $t('profile.linkedAccounts.title') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <p class="linked-accounts-intro">{{ $t('profile.linkedAccounts.subtitle') }}</p>

      <ion-list v-if="!loading" style="border-radius: 12px;">
        <ion-item lines="full" style="--border-radius: 12px;">
          <div class="provider-icon-box" slot="start">
            <ion-icon :icon="mailOutline" />
          </div>
          <ion-label>
            <h3>{{ $t('profile.linkedAccounts.email') }}</h3>
            <p v-if="hasEmail">{{ userEmail }}</p>
          </ion-label>
          <ion-badge :color="hasEmail ? 'success' : 'medium'" slot="end">
            {{ hasEmail ? $t('profile.linkedAccounts.connected') : $t('profile.linkedAccounts.notConnected') }}
          </ion-badge>
        </ion-item>

        <ion-item lines="full" style="--border-radius: 12px;">
          <div class="provider-icon-box" slot="start">
            <ion-icon :icon="logoGoogle" />
          </div>
          <ion-label>
            <h3>{{ $t('profile.linkedAccounts.google') }}</h3>
          </ion-label>
          <ion-badge :color="hasGoogle ? 'success' : 'medium'" slot="end">
            {{ hasGoogle ? $t('profile.linkedAccounts.connected') : $t('profile.linkedAccounts.notConnected') }}
          </ion-badge>
        </ion-item>

        <ion-item lines="full" style="--border-radius: 12px;">
          <div class="provider-icon-box" slot="start">
            <ion-icon :icon="logoApple" />
          </div>
          <ion-label>
            <h3>{{ $t('profile.linkedAccounts.apple') }}</h3>
          </ion-label>
          <ion-badge :color="hasApple ? 'success' : 'medium'" slot="end">
            {{ hasApple ? $t('profile.linkedAccounts.connected') : $t('profile.linkedAccounts.notConnected') }}
          </ion-badge>
        </ion-item>

        <ion-item lines="full" style="--border-radius: 12px;">
          <div class="provider-icon-box" slot="start">
            <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" fill="#06C755">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
            </svg>
          </div>
          <ion-label>
            <h3>{{ $t('profile.linkedAccounts.line') }}</h3>
            <p v-if="hasLine && lineDisplayName">{{ lineDisplayName }}</p>
          </ion-label>
          <ion-badge :color="hasLine ? 'success' : 'medium'" slot="end">
            {{ hasLine ? $t('profile.linkedAccounts.connected') : $t('profile.linkedAccounts.notConnected') }}
          </ion-badge>
        </ion-item>
      </ion-list>

      <div v-else class="linked-accounts-loading">
        <ion-spinner name="crescent" />
      </div>

      <p class="linked-accounts-note">{{ $t('profile.linkedAccounts.note') }}</p>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle,
  IonContent, IonList, IonItem, IonLabel, IonIcon, IonBadge, IonSpinner
} from '@ionic/vue';
import { mailOutline, logoGoogle, logoApple } from 'ionicons/icons';
import { supabase } from '@/plugins/supabaseClient';

const loading = ref(true);
const userEmail = ref('');
const hasEmail = ref(false);
const hasGoogle = ref(false);
const hasApple = ref(false);
const hasLine = ref(false);
const lineDisplayName = ref<string | null>(null);

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    loading.value = false;
    return;
  }

  userEmail.value = user.email ?? '';
  const providers = (user.identities ?? []).map(i => i.provider);
  hasEmail.value = providers.includes('email');
  hasGoogle.value = providers.includes('google');
  hasApple.value = providers.includes('apple');

  const { data: lineRow } = await supabase
    .from('line_identities')
    .select('display_name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (lineRow) {
    hasLine.value = true;
    lineDisplayName.value = lineRow.display_name;
  }

  loading.value = false;
});
</script>

<style scoped>
.linked-accounts-intro {
  color: var(--ion-color-medium);
  font-size: 0.9rem;
  margin: 0 4px 16px;
}

.linked-accounts-note {
  color: var(--ion-color-medium);
  font-size: 0.78rem;
  margin: 16px 4px 0;
}

.linked-accounts-loading {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.provider-icon-box {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--ion-color-light);
  font-size: 20px;
  margin-right: 4px;
}
</style>
