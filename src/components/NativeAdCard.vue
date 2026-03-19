<template>
  <ion-card v-if="ad">
    <img
        v-if="ad.images?.length"
        :src="ad.images[0].url"
        style="width:100%; border-radius:10px; object-fit:cover;"
    />

    <ion-card-header>
      <ion-card-title>{{ ad.headline }}</ion-card-title>
      <ion-card-subtitle v-if="ad.advertiser">{{ ad.advertiser }}</ion-card-subtitle>
    </ion-card-header>

    <ion-card-content>
      <p v-if="ad.body">{{ ad.body }}</p>

      <ion-button
          v-if="ad.callToAction"
          expand="block"
          color="carrot"
      >
        {{ ad.callToAction }}
      </ion-button>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
defineProps({
  ad: { type: Object, required: true }
});
</script>
