<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ $t('profile.editProfile.title') }}</ion-title>
        <ion-buttons slot="start">
          <ion-back-button
              default-href="/profile"
              :disabled="!wasComplete && !isProfileComplete"
          />
        </ion-buttons>
      </ion-toolbar>
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


      <ion-list>
        <ion-item>
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
          <ion-label>{{ $t('profile.editProfile.nationality') }}</ion-label>
          <ion-text slot="end" style="color: var(--ion-color-dark)">
            <template v-if="!countries.length">
              <ion-skeleton-text animated style="width:100px;height:16px;" />
            </template>
            <template v-else-if="selectedCountry">
              <img :src="selectedCountry.flags.png" style="width:24px; height:16px; margin-right:8px;" alt="Country Flag" />
              {{ selectedCountry.name.common }}
            </template>
            <template v-else>
              {{ $t('profile.editProfile.selectCountry') }}
            </template>

          </ion-text>
        </ion-item>

        <ion-modal :is-open="showCountryModal" @didDismiss="showCountryModal = false">
          <ion-header>
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
            <ion-list>
              <ion-item
                  v-for="c in filteredCountries"
                  :key="c.cca2"
                  button
                  @click="selectCountry(c)"
              >
                <img :src="c.flags.png" style="width:24px; height:16px; margin-right:8px;"  alt="Country Flag"/>
                <ion-label>{{ c.name.common }}</ion-label>
              </ion-item>
            </ion-list>
          </ion-content>
        </ion-modal>

        <ion-item>
          <ion-label>{{ $t('profile.editProfile.gender') }}</ion-label>
          <ion-select v-model="editGender" interface="popover" slot="end" :placeholder="$t('profile.editProfile.selectGender')">
            <ion-select-option value="Male">{{ $t('profile.editProfile.genderMale') }}</ion-select-option>
            <ion-select-option value="Female">{{ $t('profile.editProfile.genderFemale') }}</ion-select-option>
            <ion-select-option value="Other">{{ $t('profile.editProfile.genderOther') }}</ion-select-option>
          </ion-select>
        </ion-item>


        <ion-item >
          <ion-label position="stacked">{{ $t('profile.editProfile.bio') }}</ion-label>
          <ion-textarea
              v-model="editBio"
              auto-grow
              :placeholder="$t('profile.editProfile.bioPlaceholder')"
          ></ion-textarea>
        </ion-item>
      </ion-list>

      <ion-item lines="none">
        <ion-checkbox
            :checked="acknowledged"
            @ionChange="acknowledged = $event.detail.checked"
            slot="start"
        />
        <ion-label>
          {{ $t('profile.editProfile.consentTitle') }}
          <ul style="margin: 0; padding-left: 1rem; font-size: 0.9rem;">
            <li>{{ $t('profile.editProfile.consentContent1') }}</li>
            <li>{{ $t('profile.editProfile.consentContent2') }}</li>
          </ul>
        </ion-label>
      </ion-item>

      <ion-button
          expand="block"
          color="carrot"
          @click="saveProfile"
          :disabled="!isProfileComplete"
      >
        {{ mustCompleteProfile ? $t('profile.editProfile.completeToContinue') : $t('profile.editProfile.save') }}
      </ion-button>


    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonBackButton, IonList, IonItem, IonLabel, IonDatetime,
  IonSelect, IonSelectOption, IonTextarea, IonButton, IonModal,
  IonNote, IonSearchbar, IonDatetimeButton, IonText, IonCheckbox,
    IonSkeletonText, IonCard, IonCardContent
} from "@ionic/vue";

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

