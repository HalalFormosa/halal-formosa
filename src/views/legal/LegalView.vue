<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/profile" />
        </ion-buttons>
        <ion-title>{{ $t('legal.title') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">

      <!-- Terms of Service -->
      <ion-item
          button
          detail
          @click="openExternal('https://halalformosa.com/terms')"
      >
        <ion-label>{{ $t('legal.terms') }}</ion-label>
      </ion-item>

      <!-- Privacy Policy -->
      <ion-item
          button
          detail
          @click="openExternal('https://halalformosa.com/privacy')"
      >
        <ion-label>{{ $t('legal.privacy') }}</ion-label>
      </ion-item>

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonItem,
  IonLabel,
} from "@ionic/vue";
import { Browser } from '@capacitor/browser';

const openExternal = async (url: string) => {
  await Browser.open({ url });
};
</script>

<style scoped>
ion-item {
  --padding-start: 0;
  --inner-padding-end: 8px;
  margin-bottom: 12px;
  border-radius: 12px;
  border: 1px solid var(--ion-color-light);
}
</style>
