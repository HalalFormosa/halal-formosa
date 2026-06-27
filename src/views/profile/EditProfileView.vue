<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <app-header :title="!wasComplete ? $t('profile.editProfile.mustCompleteTitle') : $t('profile.editProfile.title')" icon="none" :showBack="wasComplete" backRoute="/profile" />
    </ion-header>

    <ion-content class="ion-padding">
      <!-- ================= ONBOARDING WIZARD MODE ================= -->
      <template v-if="!wasComplete">
        <!-- Step Indicators / Progress bar -->
        <div class="step-progress-container ion-margin-bottom">
          <div class="step-progress-bar">
            <div class="step-progress-fill" :style="{ width: ((currentStep - 1) / 2 * 100) + '%' }"></div>
          </div>
          <div class="step-badges">
            <span :class="['step-badge', { 'active': currentStep >= 1 }]">1</span>
            <span :class="['step-badge', { 'active': currentStep >= 2 }]">2</span>
            <span :class="['step-badge', { 'active': currentStep >= 3 }]">3</span>
          </div>
          <div class="step-label text-center ion-margin-top">
            <span v-if="currentStep === 1">{{ $t('profile.editProfile.step1Label') || 'Step 1: Profile Picture & Bio' }}</span>
            <span v-else-if="currentStep === 2">{{ $t('profile.editProfile.step2Label') || 'Step 2: About Me (Optional)' }}</span>
            <span v-else-if="currentStep === 3">{{ $t('profile.editProfile.step3Label') || 'Step 3: Consent & Privacy' }}</span>
          </div>
        </div>

        <!-- STEP 1: Avatar & Bio -->
        <div v-if="currentStep === 1" class="fade-in">
          <!-- 👤 Beautiful Avatar Upload Section -->
          <div class="avatar-edit-container ion-text-center fade-in">
            <div class="avatar-wrapper" @click="presentUploadOptions">
              <img 
                :src="editAvatarUrl || currentUser?.user_metadata?.avatar_url || DEFAULT_AVATAR_PLACEHOLDER" 
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
            </ion-list>
            
            <div class="button-row-onboarding ion-padding">
              <ion-button expand="block" fill="clear" color="medium" @click="skipOnboarding">
                {{ $t('common.skip') || 'Skip' }}
              </ion-button>
              <ion-button expand="block" color="carrot" shape="round" @click="currentStep = 2">
                {{ $t('common.next') || 'Next' }}
              </ion-button>
            </div>
          </ion-card>
        </div>

        <!-- STEP 2: Optional Details (DOB, Nationality, Gender, Phone) -->
        <div v-if="currentStep === 2" class="fade-in">
          <ion-card class="fade-in">
            <ion-card-content class="ion-no-padding">
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
              </ion-list>
            </ion-card-content>
            
            <div class="button-row-onboarding ion-padding">
              <ion-button fill="outline" color="carrot" shape="round" @click="currentStep = 1">
                {{ $t('common.back') || 'Back' }}
              </ion-button>
              <ion-button color="carrot" shape="round" @click="currentStep = 3">
                {{ $t('common.next') || 'Next' }}
              </ion-button>
            </div>
          </ion-card>
        </div>

        <!-- STEP 3: Consent & Privacy -->
        <div v-if="currentStep === 3" class="fade-in">
          <ion-card class="fade-in ion-padding-bottom">
            <ion-list lines="inset">
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

            <ion-item lines="none" class="consent-item ion-margin-top">
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

            <div class="button-row-onboarding ion-padding ion-margin-top">
              <ion-button fill="outline" color="carrot" shape="round" @click="currentStep = 2">
                {{ $t('common.back') || 'Back' }}
              </ion-button>
              <ion-button
                  color="carrot"
                  shape="round"
                  @click="saveProfile"
                  :disabled="!acknowledged"
              >
                {{ $t('common.complete') }}
              </ion-button>
            </div>
          </ion-card>
        </div>
      </template>

      <!-- ================= STANDARD REGULAR EDIT MODE ================= -->
      <template v-else>
        <!-- 👤 Beautiful Avatar Upload Section -->
        <div class="avatar-edit-container ion-text-center fade-in">
          <div class="avatar-wrapper" @click="presentUploadOptions">
            <img 
              :src="editAvatarUrl || currentUser?.user_metadata?.avatar_url || DEFAULT_AVATAR_PLACEHOLDER" 
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
                :disabled="!acknowledged"
                style="--box-shadow: 0 4px 12px rgba(var(--ion-color-carrot-rgb), 0.3);"
            >
              {{ $t('profile.editProfile.save') }}
            </ion-button>
          </div>
        </ion-card>
      </template>

      <!-- Country Selection Modal (Used in both modes) -->
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

      <!-- DOB Date Picker Modal (Used in both modes) -->
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
  updateUserProfile, currentUser,
  profileSkipped
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
const currentStep = ref(1);
const DEFAULT_AVATAR_PLACEHOLDER = "https://placehold.co/150x150/e0e0e0/666666.png?text=No+Avatar";

async function skipOnboarding() {
  profileSkipped.value = true;

  // 🔔 Send skipped notification to Discord
  if (userId) {
    const message = [
      '⏭️ User Skipped Onboarding',
      '',
      `📧 Email: ${currentUser.value?.email ?? 'unknown'}`,
      `👤 Name: ${currentUser.value?.user_metadata?.display_name || currentUser.value?.user_metadata?.full_name || 'Not provided'}`,
    ].join('\n');

    notifyEvent(
        'registration',
        '⏭️ Onboarding Skipped',
        message,
        undefined,
        {
          user_id: userId,
          email: currentUser.value?.email,
        },
        ['discord']
    ).catch(console.error);

    // Mark as completed/skipped so they don't trigger completion notifications later
    await supabase
        .from('user_profiles')
        .update({ profile_completed_notified: true })
        .eq('id', userId);
  }

  router.replace('/profile');
}



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
  profileSkipped.value = true;
  next();
})


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
      gender,
      phone,
      profile_completed_notified
    `)
      .eq('id', userId)
      .single();

  if (error || !profile) {
    console.warn('Failed to reload profile after save', error);
    router.back();
    return;
  }

  /* 3️⃣ Check completion state & Notify (ONCE) */
  if (!wasComplete.value && !profile.profile_completed_notified) {
    const genderName = editGender.value === 'Other' ? 'Prefer not to say' : (editGender.value || 'Not provided');
    const countryName = selectedCountry.value?.name.common || 'Not provided';

    const message = [
      '🎉 User Completed Onboarding',
      '',
      `📧 Email: ${currentUser.value?.email ?? 'unknown'}`,
      `👤 Name: ${profile.display_name || 'Not provided'}`,
      `🎂 Date of Birth: ${profile.date_of_birth || 'Not provided'}`,
      `🌍 Nationality: ${countryName}`,
      `👤 Gender: ${genderName}`,
      `📞 Phone: ${profile.phone || 'Not provided'}`,
      `📝 Bio: ${profile.bio || 'Not provided'}`,
    ].join('\n');

    notifyEvent(
        'registration',
        '🎉 User Completed Onboarding',
        message,
        undefined,
        {
          user_id: userId,
          email: currentUser.value?.email,
          name: profile.display_name,
          date_of_birth: profile.date_of_birth,
          nationality: countryName,
          gender: genderName,
          bio: profile.bio,
        },
        ['discord']
    ).catch(console.error);

    /* 4️⃣ Mark as notified (CRITICAL) */
    await supabase
        .from('user_profiles')
        .update({ profile_completed_notified: true })
        .eq('id', userId);
  }

  /* 5️⃣ Leave edit page (explicit navigation for native) */
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

/* Onboarding wizard styling */
.step-progress-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 16px 24px;
}

.step-progress-bar {
  width: 100%;
  height: 6px;
  background: var(--ion-color-step-200, #e0e0e0);
  border-radius: 3px;
  position: relative;
  overflow: hidden;
  margin-bottom: -15px;
  margin-top: 15px;
}

.step-progress-fill {
  height: 100%;
  background: var(--ion-color-carrot);
  transition: width 0.3s ease;
  width: 0%;
}

.step-badges {
  display: flex;
  justify-content: space-between;
  width: 100%;
  z-index: 2;
}

.step-badge {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--ion-card-background, #fff);
  border: 2px solid var(--ion-color-step-300, #ccc);
  color: var(--ion-color-step-600, #666);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.step-badge.active {
  background: var(--ion-color-carrot);
  border-color: var(--ion-color-carrot);
  color: #fff;
  box-shadow: 0 4px 10px rgba(var(--ion-color-carrot-rgb), 0.3);
}

.step-label {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--ion-text-color);
  margin-top: 12px;
}

.button-row-onboarding {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.button-row-onboarding ion-button {
  flex: 1;
  margin: 0;
  height: 44px;
}
</style>

