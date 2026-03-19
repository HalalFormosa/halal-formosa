<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('credits.title')" back-route="/profile" icon="none" show-back/>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- 🔹 Logo at top, centered -->
      <div class="logo-wrapper">
        <img src="/android-chrome-512x512.png" alt="Halal Formosa Logo" class="logo-img" />
      </div>

      <!-- Founder -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ $t('credits.founder') }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p>Rakha Ramadhana A.B.</p>
        </ion-card-content>
      </ion-card>

      <!-- Co-Founder -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ $t('credits.coFounder') }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p>Sherlis Oktaviani</p>
        </ion-card-content>
      </ion-card>

      <!-- Co-Developer -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ $t('credits.coDeveloper') }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p>Fauzan Aqil</p>
        </ion-card-content>
      </ion-card>

      <!-- UI/UX -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ $t('credits.uiUx') }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p>Rachmad Zu</p>
        </ion-card-content>
      </ion-card>

      <!-- Database -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ $t('credits.database') }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ul>
            <li v-for="(name, idx) in sortedContributors" :key="idx">{{ name }}</li>
          </ul>
        </ion-card-content>
      </ion-card>

      <!-- Special Thanks -->
      <div class="special-thanks ion-padding-horizontal">
        <h3>{{ $t('credits.specialThanks') }}</h3>
        <p>{{ $t('credits.thankYou') }}</p>
      </div>

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonHeader,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent
} from '@ionic/vue'
import AppHeader from "@/components/AppHeader.vue"

// ✅ List of contributors
const contributors = [
  "Aisyah Nayan",
  "Damas Bariek",
  "Faqih Ilmi",
  "Fata Falih Hilmi",
  "Hadi",
  "Muslima",
  "Ogi Dani Sakarov",
  "Rosyid Shidiq",
  "Yusuf Rahmatullah"
]

// ✅ Sort alphabetically
const sortedContributors = [...contributors].sort()
</script>

<style scoped>
ion-card-content ul {
  padding-left: 20px;
  margin: 0;
}

ion-card-content li {
  margin-bottom: 6px;
}

.logo-wrapper {
  display: flex;
  justify-content: center;
  margin: 16px 0 24px;
}

.logo-img {
  max-width: 160px;   /* adjust size as needed */
  height: auto;
}

.special-thanks {
  margin-top: 24px;
  text-align: justify;
  font-size: 0.95rem;
  color: var(--ion-color-medium);
}

.special-thanks h3 {
  text-align: center;
  font-weight: 600;
  font-size: 1rem;
  margin-bottom: 6px;
  color: var(--ion-color-dark);
}

</style>
