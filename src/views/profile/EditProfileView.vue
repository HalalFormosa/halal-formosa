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

      <!-- 👤 Beautiful Avatar Upload Section -->
      <div class="avatar-edit-container ion-text-center fade-in">
        <div class="avatar-wrapper" @click="presentUploadOptions">
          <img 
            :src="editAvatarUrl || currentUser?.user_metadata?.avatar_url || '/favicon-32x32.png'" 
            class="profile-avatar-img" 
            alt="Profile Avatar"
          />
          <div class="camera-badge">
            <ion-icon :icon="cameraOutline" />
          </div>
          <div v-if="uploadingAvatar" class="avatar-loading-overlay">
            <ion-spinner name="crescent" color="carrot" />
          </div>
        </div>
        <p class="click-hint">{{ $t('profile.editProfile.clickToChange') }}</p>
      </div>

      <ion-card class="fade-in">
        <ion-list lines="inset">
          <ion-item>
            <div class="icon-box" slot="start">
              <ion-icon :icon="calendarOutline" />
            </div>
            <ion-label>
              {{ $t('profile.editProfile.dob') }}
            </ion-label>
            <ion-note slot="end">
              <ion-datetime-button datetime="dobPicker" />
            </ion-note>
          </ion-item>

          <ion-item button @click="showCountryModal = true">
            <div class="icon-box" slot="start">
              <ion-icon :icon="globeOutline" />
            </div>
            <ion-label>
              {{ $t('profile.editProfile.nationality') }}
            </ion-label>
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
            <ion-label>
              {{ $t('profile.editProfile.gender') }}
            </ion-label>
            <ion-select v-model="editGender" interface="popover" slot="end" :placeholder="$t('profile.editProfile.selectGender')">
              <ion-select-option :value="null">{{ $t('common.clear') || 'Clear' }}</ion-select-option>
              <ion-select-option value="Male">{{ $t('profile.editProfile.genderMale') }}</ion-select-option>
              <ion-select-option value="Female">{{ $t('profile.editProfile.genderFemale') }}</ion-select-option>
              <ion-select-option value="Other">{{ $t('profile.editProfile.genderOther') }}</ion-select-option>
            </ion-select>
          </ion-item>

          <ion-item>
            <div class="icon-box" slot="start">
              <ion-icon :icon="callOutline" />
            </div>
            <ion-input
                v-model="editPhone"
                type="tel"
                label-placement="stacked"
                :label="$t('profile.editProfile.phone') || 'Phone Number'"
                :placeholder="$t('profile.editProfile.phonePlaceholder') || '09xxxxxxxx'"
                :helper-text="$t('profile.editProfile.phoneHint') || 'Used for store delivery notifications, never shared publicly.'"
            ></ion-input>
          </ion-item>

          <ion-item>
            <div class="icon-box" slot="start" style="align-self: flex-start; margin-top: 12px;">
              <ion-icon :icon="createOutline" />
            </div>
            <ion-textarea
                v-model="editBio"
                auto-grow
                label-placement="stacked"
                :label="$t('profile.editProfile.bio')"
                :placeholder="$t('profile.editProfile.bioPlaceholder')"
            ></ion-textarea>
          </ion-item>

          <ion-item>
            <div class="icon-box" slot="start">
              <ion-icon :icon="trophyOutline" />
            </div>
            <ion-label class="ion-text-wrap" style="font-size: 0.85rem;">
              {{ $t('settings.publicProfile') }}
              <p style="margin: 4px 0 0; font-size: 0.8rem; color: var(--ion-color-medium);">
                {{ $t('settings.publicProfileNote') }}
              </p>
            </ion-label>
            <ion-toggle
                slot="end"
                :checked="isPublicProfile ?? false"
                @ionChange="setPublicProfile($event.detail.checked)"
                color="carrot"
            ></ion-toggle>
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
            <ion-item button @click="clearNationality">
              <ion-label style="color: var(--ion-color-medium)">
                {{ $t('profile.editProfile.clearNationality') || 'Clear Nationality' }}
              </ion-label>
            </ion-item>
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

      <!-- DOB Date Picker Modal -->
      <ion-modal :keep-contents-mounted="true" class="dob-modal">
        <ion-datetime
            id="dobPicker"
            color="carrot"
            v-model="editDOB"
            presentation="date"
            :prefer-wheel="true"
            :show-default-buttons="true"
            :done-text="$t('common.ok')"
            :cancel-text="$t('common.cancel')"
        ></ion-datetime>
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
              <li>{{ $t('profile.editProfile.consentContentPhone') }}</li>
              <li>{{ $t('profile.editProfile.consentContentStats') }}</li>
              <li>{{ $t('profile.editProfile.consentContentBio') }}</li>
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
  IonSkeletonText, IonCard, IonCardContent, IonIcon, IonInput, IonToggle,
  actionSheetController, IonSpinner
} from "@ionic/vue";
import AppHeader from "@/components/AppHeader.vue";

import {
  editDOB,
  editNationality,
  editGender,
  editBio,
  editPhone,
  editAvatarUrl,
  acknowledged,
  isProfileComplete,
  isPublicProfile,
  setPublicProfile,
  loadUserProfile,
  updateUserProfile, currentUser
} from "@/composables/userProfile";

import {
  calendarOutline,
  createOutline,
  globeOutline,
  personOutline,
  callOutline,
  trophyOutline,
  cameraOutline
} from "ionicons/icons";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { useImageResizer } from "@/composables/useImageResizer";
import { useI18n } from "vue-i18n";

import { countries, loadCountries } from "@/composables/useCountries"
import { onBeforeMount, ref, computed } from "vue";
import { supabase } from "@/plugins/supabaseClient";
import { useRouter, onBeforeRouteLeave } from "vue-router";
import { useNotifier } from "@/composables/useNotifier";

const { notifyEvent } = useNotifier();
const { t } = useI18n();
const { resizeImage } = useImageResizer();

const router = useRouter();
const mustCompleteProfile = computed(() => !isProfileComplete.value)

const uploadingAvatar = ref(false);

async function presentUploadOptions() {
  const actionSheet = await actionSheetController.create({
    header: t("profile.editProfile.avatarOptionsTitle"),
    buttons: [
      {
        text: t("addProduct.photoActions.takePhoto"),
        handler: () => {
          captureImage(CameraSource.Camera);
        }
      },
      {
        text: t("addProduct.photoActions.uploadPhoto"),
        handler: () => {
          captureImage(CameraSource.Photos);
        }
      },
      {
        text: t("common.cancel"),
        role: "cancel"
      }
    ]
  });
  await actionSheet.present();
}

async function captureImage(source: CameraSource) {
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source
    });

    if (image.webPath) {
      uploadingAvatar.value = true;
      try {
        const resizedFile = await resizeImage(image.webPath, 500, 0.8);
        const url = await uploadAvatarToSupabase(resizedFile);
        if (url) {
          editAvatarUrl.value = url;
        }
      } catch (err) {
        console.error("❌ Failed to process/upload image:", err);
      } finally {
        uploadingAvatar.value = false;
      }
    }
  } catch (error) {
    console.error("Error capturing photo:", error);
  }
}

async function uploadAvatarToSupabase(file: File): Promise<string | null> {
  if (!userId) return null;

  // 🧹 Clean up the old avatar if it exists in Supabase Storage
  const oldUrl = editAvatarUrl.value;
  if (oldUrl && oldUrl.includes("/storage/v1/object/public/avatars/")) {
    const oldPath = oldUrl.split("/storage/v1/object/public/avatars/")[1];
    if (oldPath) {
      try {
        await supabase.storage.from("avatars").remove([oldPath]);
        console.log("🧹 Cleaned up old avatar:", oldPath);
      } catch (err) {
        console.warn("⚠️ Failed to clean up old avatar:", err);
      }
    }
  }

  try {
    const fileExt = "jpg";
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, file, {
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(fileName);

    return data.publicUrl;
  } catch (error: any) {
    console.error("❌ uploadAvatarToSupabase failed:", error);
    return null;
  }
}

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

function clearNationality() {
  editNationality.value = null;
  selectedCountry.value = null;
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
  wasComplete.value = isProfileComplete.value

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

  /* Update auth metadata for avatar */
  const { error: authUpdateError } = await supabase.auth.updateUser({
    data: {
      avatar_url: editAvatarUrl.value
    }
  });
  if (authUpdateError) {
    console.error('Failed to update auth metadata for avatar_url', authUpdateError);
  }

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

.required-star {
  color: var(--ion-color-danger);
  margin-left: 4px;
}

/* Avatar edit styling */
.avatar-edit-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 24px 0 16px;
}

.avatar-wrapper {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.profile-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  border: 4px solid var(--ion-card-background, #fff);
  background: var(--ion-color-step-100);
}

.camera-badge {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--ion-color-carrot);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(var(--ion-color-carrot-rgb), 0.35);
  border: 2px solid var(--ion-card-background, #fff);
}

.camera-badge ion-icon {
  font-size: 18px;
}

.avatar-loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(var(--ion-card-background-rgb, 255, 255, 255), 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.click-hint {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  margin-top: 8px;
  margin-bottom: 0;
}
</style>

