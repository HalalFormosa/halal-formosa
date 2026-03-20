<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <app-header :title="$t('profile.editProfile.title')" icon="none" :showBack="true" backRoute="/profile" />
    </ion-header>

    <ion-content class="ion-padding">
      <!-- 🔔 Mandatory profile completion notice -->
      <ion-card
          v-if="mustCompleteProfile"
          color="warning"
          class="ion-margin-bottom"
      >
        <ion-card-content>
          <strong>{{ $t('profile.editProfile.mustCompleteTitle') }}</strong>
          <p style="margin-top: 6px;">
            {{ $t('profile.editProfile.mustCompleteDesc') }}
          </p>
        </ion-card-content>
      </ion-card>


      <ion-card class="fade-in">
        <ion-list lines="inset">
          <ion-item>
            <div class="icon-box" slot="start">
              <ion-icon :icon="calendarOutline" />
            </div>
            <ion-label>{{ $t('profile.editProfile.dob') }}</ion-label>
            <ion-note slot="end">
              <ion-datetime-button
                  datetime="dobPicker"
              />
            </ion-note>

            <!-- Hidden datetime controlled by the button -->
            <ion-modal keep-contents-mounted="true">
              <ion-datetime
                  id="dobPicker"
                  color="carrot"
                  v-model="editDOB"
                  presentation="date"
                  :show-default-buttons="true"
                  :done-text="$t('common.ok')"
                  :cancel-text="$t('common.cancel')"
              ></ion-datetime>
            </ion-modal>
          </ion-item>

          <ion-item button @click="showCountryModal = true">
            <div class="icon-box" slot="start">
              <ion-icon :icon="globeOutline" />
            </div>
            <ion-label>{{ $t('profile.editProfile.nationality') }}</ion-label>
            <ion-text slot="end" style="color: var(--ion-color-dark)">
              <template v-if="!countries.length">
                <ion-skeleton-text animated style="width:100px;height:16px;" />
              </template>
              <template v-else-if="selectedCountry">
                <img :src="selectedCountry.flags.png" style="width:24px; height:16px; margin-right:8px; border-radius: 2px;" alt="Country Flag" />
                {{ selectedCountry.name.common }}
              </template>
              <template v-else>
                {{ $t('profile.editProfile.selectCountry') }}
              </template>
            </ion-text>
          </ion-item>

          <ion-item>
            <div class="icon-box" slot="start">
              <ion-icon :icon="personOutline" />
            </div>
            <ion-label>{{ $t('profile.editProfile.gender') }}</ion-label>
            <ion-select v-model="editGender" interface="popover" slot="end" :placeholder="$t('profile.editProfile.selectGender')">
              <ion-select-option value="Male">{{ $t('profile.editProfile.genderMale') }}</ion-select-option>
              <ion-select-option value="Female">{{ $t('profile.editProfile.genderFemale') }}</ion-select-option>
              <ion-select-option value="Other">{{ $t('profile.editProfile.genderOther') }}</ion-select-option>
            </ion-select>
          </ion-item>

          <ion-item >
            <div class="icon-box" slot="start" style="align-self: flex-start; margin-top: 12px;">
              <ion-icon :icon="createOutline" />
            </div>
            <ion-label position="stacked">{{ $t('profile.editProfile.bio') }}</ion-label>
            <ion-textarea
                v-model="editBio"
                auto-grow
                :placeholder="$t('profile.editProfile.bioPlaceholder')"
                style="margin-top: 8px;"
            ></ion-textarea>
          </ion-item>
        </ion-list>
      </ion-card>

      <ion-modal :is-open="showCountryModal" @didDismiss="showCountryModal = false">
        <ion-header class="ion-no-border">
          <ion-toolbar>
            <ion-title>{{ $t('profile.editProfile.selectNationality') }}</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="showCountryModal = false">{{ $t('common.close') }}</ion-button>
            </ion-buttons>
          </ion-toolbar>
          <ion-toolbar>
            <ion-searchbar v-model="searchQuery" :placeholder="$t('profile.editProfile.searchCountry')"></ion-searchbar>
          </ion-toolbar>
        </ion-header>

        <ion-content>
          <ion-list lines="inset">
            <ion-item
                v-for="c in filteredCountries"
                :key="c.cca2"
                button
                @click="selectCountry(c)"
            >
              <img :src="c.flags.png" style="width:24px; height:16px; margin-right:8px; border-radius: 2px;"  alt="Country Flag"/>
              <ion-label>{{ c.name.common }}</ion-label>
            </ion-item>
          </ion-list>
        </ion-content>
      </ion-modal>

      <ion-card class="fade-in ion-padding-bottom">
        <ion-item lines="none" class="consent-item">
          <ion-checkbox
              :checked="acknowledged"
              @ionChange="acknowledged = $event.detail.checked"
              slot="start"
              color="carrot"
          />
          <ion-label class="ion-text-wrap" style="font-size: 0.85rem;">
            {{ $t('profile.editProfile.consentTitle') }}
            <ul style="margin: 8px 0 0; padding-left: 1.2rem; font-size: 0.8rem; color: var(--ion-color-medium);">
              <li>{{ $t('profile.editProfile.consentContent1') }}</li>
              <li>{{ $t('profile.editProfile.consentContent2') }}</li>
            </ul>
          </ion-label>
        </ion-item>

        <div style="padding: 16px;">
          <ion-button
              expand="block"
              color="carrot"
              shape="round"
              @click="saveProfile"
              :disabled="!isProfileComplete"
              style="--box-shadow: 0 4px 12px rgba(var(--ion-color-carrot-rgb), 0.3);"
          >
            {{ mustCompleteProfile ? $t('profile.editProfile.completeToContinue') : $t('profile.editProfile.save') }}
          </ion-button>
        </div>
      </ion-card>


    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonBackButton, IonList, IonItem, IonLabel, IonDatetime,
  IonSelect, IonSelectOption, IonTextarea, IonButton, IonModal,
  IonNote, IonSearchbar, IonDatetimeButton, IonText, IonCheckbox,
  IonSkeletonText, IonCard, IonCardContent, IonIcon
} from "@ionic/vue";
import AppHeader from "@/components/AppHeader.vue";

import {
  editDOB,
  editNationality,
  editGender,
  editBio,
  acknowledged,
  isProfileComplete,
  loadUserProfile,
  updateUserProfile, currentUser
} from "@/composables/userProfile";

import {
  calendarOutline,
  createOutline,
  globeOutline,
  personOutline
} from "ionicons/icons";

import { countries, loadCountries } from "@/composables/useCountries"
import { onBeforeMount, ref, computed } from "vue";
import { supabase } from "@/plugins/supabaseClient";
import { useRouter, onBeforeRouteLeave } from "vue-router";
import { useNotifier } from "@/composables/useNotifier";

const { notifyEvent } = useNotifier();

const router = useRouter();
const mustCompleteProfile = computed(() => !isProfileComplete.value)

interface Country {
  cca2: string;
  name: { common: string };
  flags: { png: string; svg: string };
}


let userId: string | null = null;

const wasComplete = ref(false);

// country modal state
const showCountryModal = ref(false);
const searchQuery = ref("");
const selectedCountry = ref<Country | null>(null);
const loadingProfile = ref(true);

const filteredCountries = computed(() =>
    countries.value.filter(c =>
        c.name.common.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
)

function selectCountry(c: Country) {
  editNationality.value = c.cca2;
  selectedCountry.value = c;
  showCountryModal.value = false;
}



onBeforeMount(async () => {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) {
    router.push("/login")
    return
  }

  userId = userData.user.id
  await loadUserProfile(userId)

  // If countries already in memory, skip fetch
  if (!countries.value.length) {
    await loadCountries()
  }

  if (editNationality.value) {
    selectedCountry.value =
        countries.value.find(c => c.cca2 === editNationality.value) || null
  }

  loadingProfile.value = false
})

onBeforeRouteLeave((to, from, next) => {
  if (!wasComplete.value && !isProfileComplete.value) {
    next(false);
  } else {
    next();
  }
});

async function saveProfile() {
  if (!userId) return;

  /* 1️⃣ Save profile fields */
  await updateUserProfile(userId);

  /* 2️⃣ Re-fetch profile (authoritative state after save) */
  const { data: profile, error } = await supabase
      .from('user_profiles')
      .select(`
      display_name,
      bio,
      date_of_birth,
      nationality,
      profile_completed_notified
    `)
      .eq('id', userId)
      .single();

  if (error || !profile) {
    console.warn('Failed to reload profile after save', error);
    router.back();
    return;
  }

  /* 3️⃣ Check completion state */
  const isProfileCompleteNow =
      !!profile.bio &&
      !!profile.date_of_birth &&
      !!profile.nationality;

  /* 4️⃣ Fire Option 2 notification (ONCE) */
  if (isProfileCompleteNow && !profile.profile_completed_notified) {

    // 🌍 Convert nationality code → country name
    const countryName =
        countries.value.find(c => c.cca2 === profile.nationality)?.name.common
        ?? profile.nationality;

    const message = [
      'A user has completed their profile and is now active.',
      '',
      `📧 Email: ${currentUser.value?.email ?? 'unknown'}`,
      `👤 Name: ${profile.display_name || 'Not provided'}`,
      `🎂 Date of Birth: ${profile.date_of_birth}`,
      `🌍 Nationality: ${countryName}`,
    ].join('\n');

    notifyEvent(
        'user_activated',
        '🎉 User Activated',
        message,
        undefined,
        {
          user_id: userId,
          email: currentUser.value?.email,
          name: profile.display_name,
          date_of_birth: profile.date_of_birth,
          nationality: countryName,
        },
        ['discord']
    ).catch(console.error);

    /* 5️⃣ Mark as notified (CRITICAL) */
    await supabase
        .from('user_profiles')
        .update({ profile_completed_notified: true })
        .eq('id', userId);
  }

  /* 6️⃣ Leave edit page (explicit navigation for native) */
  router.replace('/profile');
}
</script>

<style scoped>
ion-card {
  margin: 16px 0 24px;
  border-radius: 20px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.icon-box {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  background: rgba(var(--ion-color-carrot-rgb), 0.1);
  border: 1px solid rgba(var(--ion-color-carrot-rgb), 0.1);
}

.icon-box ion-icon {
  font-size: 20px;
  color: var(--ion-color-carrot);
}

ion-item {
  --padding-start: 16px;
  --padding-end: 16px;
  --inner-padding-top: 12px;
  --inner-padding-bottom: 12px;
}

.consent-item {
  --background: transparent;
  padding: 8px 16px;
}

/* Animations */
.fade-in {
  animation: fadeIn 0.6s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

ion-toolbar {
  --background: transparent;
  --border-width: 0;
}
</style>

