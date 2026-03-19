<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ $t('admin.masterData') }}</ion-title>

        <ion-buttons slot="start">
          <ion-back-button default-href="/profile" />
        </ion-buttons>
      </ion-toolbar>

    </ion-header>

    <ion-content class="ion-padding">
      <ion-list>
        <ion-item button @click="go('product_categories')">
          <ion-label>{{ $t('admin.productCategories') }}</ion-label>
        </ion-item>

        <ion-item button @click="go('ingredient_highlights')">
          <ion-label>{{ $t('admin.ingredientHighlights') }}</ion-label>
        </ion-item>

        <ion-item button @click="go('location_types')">
          <ion-label>{{ $t('admin.locationTypes') }}</ion-label>
        </ion-item>

        <ion-item button @click="go('stores')">
          <ion-label>{{ $t('admin.stores') }}</ion-label>
        </ion-item>

        <ion-item button @click="go('category_rules')">
          <ion-label>{{ $t('admin.categoryRules') }}</ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
    IonButtons,
    IonBackButton
} from '@ionic/vue'

const router = useRouter()

const go = (table: string) => {
  router.push(`/admin/master-data/${table}`)
}
</script>
