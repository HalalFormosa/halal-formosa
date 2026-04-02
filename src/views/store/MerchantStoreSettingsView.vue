<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/profile" />
        </ion-buttons>
        <ion-title>{{ $t('store.settings.title') || 'Store Settings' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div v-if="loading" class="ion-padding ion-text-center">
        <ion-spinner />
      </div>

      <div v-else-if="!store" class="ion-padding ion-text-center">
        <ion-icon :icon="alertCircleOutline" size="large" color="warning" />
        <h3>{{ $t('store.errors.noStoreFound') || 'No store found.' }}</h3>
        <p>{{ $t('store.errors.contactAdmin') || 'Please contact an admin to set up your store.' }}</p>
      </div>

      <div v-else class="settings-container ion-padding">
        <!-- Banner Upload -->
        <div class="banner-upload-section">
          <div class="banner-preview" :style="store.banner_url ? { backgroundImage: `url(${store.banner_url})` } : {}">
            <div v-if="!store.banner_url" class="banner-placeholder">
              <ion-icon :icon="imageOutline" />
              <span>{{ $t('store.settings.noBanner') || 'No Banner' }}</span>
            </div>
            <ion-button fill="clear" class="upload-btn" @click="triggerBannerUpload">
              <ion-icon :icon="cameraOutline" />
            </ion-button>
          </div>
          <input type="file" ref="bannerInput" style="display: none" accept="image/*" @change="handleBannerFile" />
          <p class="upload-hint">{{ $t('store.settings.bannerHint') || 'Recommended ratio: 3:1' }}</p>
        </div>

        <!-- Logo Upload -->
        <div class="logo-upload-section">
          <ion-avatar class="settings-avatar">
            <img :src="store.logo_url || '/favicon-32x32.png'" />
            <ion-button fill="clear" class="avatar-upload-btn" @click="triggerLogoUpload">
              <ion-icon :icon="cameraOutline" />
            </ion-button>
          </ion-avatar>
          <input type="file" ref="logoInput" style="display: none" accept="image/*" @change="handleLogoFile" />
        </div>

        <ion-list lines="none">
          <ion-item class="custom-item">
            <ion-label position="stacked" color="primary">{{ $t('store.settings.storeName') }} (EN)</ion-label>
            <ion-input v-model="store.name" placeholder="English name" />
          </ion-item>

          <ion-item class="custom-item">
            <ion-label position="stacked" color="primary">{{ $t('store.settings.storeNameZh') }} (ZH)</ion-label>
            <ion-input v-model="store.name_zh" placeholder="中文名稱" />
          </ion-item>

          <ion-item class="custom-item">
            <ion-label position="stacked" color="primary">{{ $t('store.settings.storeDescription') }} (EN)</ion-label>
            <ion-textarea v-model="store.description" :rows="3" placeholder="English description" />
          </ion-item>

          <ion-item class="custom-item">
            <ion-label position="stacked" color="primary">{{ $t('store.settings.storeDescriptionZh') }} (ZH)</ion-label>
            <ion-textarea v-model="store.description_zh" :rows="3" placeholder="中文描述" />
          </ion-item>

          <ion-item class="custom-item">
            <ion-label color="medium">{{ $t('store.isActive') }}</ion-label>
            <ion-toggle slot="end" v-model="store.is_active" />
          </ion-item>
        </ion-list>

        <!-- Delivery Options -->
        <div class="delivery-section">
          <h3 class="section-title">🚚 {{ $t('store.settings.deliveryOptions') || 'Delivery Options' }}</h3>
          <p class="section-subtitle">{{ $t('store.settings.deliveryHint') || 'Select which delivery methods are available for your customers' }}</p>
          <ion-list lines="none">
            <ion-item v-for="method in deliveryMethods" :key="method.key" class="delivery-item">
              <ion-icon :icon="method.icon" slot="start" color="primary" />
              <ion-label>
                <h3>{{ method.label }}</h3>
                <p>{{ method.labelZh }}</p>
              </ion-label>
              <ion-toggle slot="end" :checked="isDeliveryEnabled(method.key)" @ionChange="toggleDelivery(method.key, $event)" />
            </ion-item>
          </ion-list>
        </div>

        <div class="ion-padding-top">
          <ion-button expand="block" @click="saveSettings" :disabled="saving" class="save-btn">
            <ion-spinner v-if="saving" name="crescent" slot="start" />
            {{ $t('store.settings.saveProfile') }}
          </ion-button>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle,
  IonContent, IonSpinner, IonIcon, IonList, IonItem, IonLabel, IonInput,
  IonTextarea, IonToggle, IonButton, IonAvatar, toastController
} from '@ionic/vue'
import {
  alertCircleOutline, imageOutline, cameraOutline,
  homeOutline, storefrontOutline, cartOutline, businessOutline, bagHandleOutline, peopleOutline
} from 'ionicons/icons'
import { supabase } from '@/plugins/supabaseClient'
import { useI18n } from 'vue-i18n'

const deliveryMethods = [
  { key: 'home_delivery', label: 'Home Delivery (Courier)', labelZh: '宅配到府', icon: homeOutline },
  { key: '7eleven', label: '7-Eleven Pickup', labelZh: '7-ELEVEN 取貨', icon: storefrontOutline },
  { key: 'family_mart', label: 'FamilyMart Pickup', labelZh: '全家取貨', icon: cartOutline },
  { key: 'hi_life', label: 'Hi-Life Pickup', labelZh: '萊爾富取貨', icon: businessOutline },
  { key: 'ok_mart', label: 'OK Mart Pickup', labelZh: 'OK超商取貨', icon: bagHandleOutline },
  { key: 'cod_meetup', label: 'Meet in Person', labelZh: '面交自取', icon: peopleOutline },
]

function isDeliveryEnabled(key: string): boolean {
  const opts = store.value?.delivery_options || []
  return Array.isArray(opts) && opts.includes(key)
}

function toggleDelivery(key: string, event: any) {
  if (!store.value) return
  const opts: string[] = Array.isArray(store.value.delivery_options) ? [...store.value.delivery_options] : []
  const checked = event.detail.checked
  if (checked && !opts.includes(key)) {
    opts.push(key)
  } else if (!checked) {
    const idx = opts.indexOf(key)
    if (idx >= 0) opts.splice(idx, 1)
  }
  store.value.delivery_options = opts
}

const { t } = useI18n()
const user = ref<any>(null)

const store = ref<any>(null)
const loading = ref(true)
const saving = ref(false)

const bannerInput = ref<HTMLInputElement | null>(null)
const logoInput = ref<HTMLInputElement | null>(null)

async function fetchStore() {
  const { data: authData } = await supabase.auth.getUser()
  user.value = authData.user
  if (!user.value) return
  
  loading.value = true
  const { data } = await supabase
    .from('merchant_stores')
    .select('*')
    .eq('user_id', user.value.id)
    .maybeSingle()
  
  if (data) store.value = data
  loading.value = false
}

function triggerBannerUpload() { bannerInput.value?.click() }
function triggerLogoUpload() { logoInput.value?.click() }

async function handleBannerFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    const url = await uploadImage(file, 'banners')
    if (url) store.value.banner_url = url
  }
}

async function handleLogoFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    const url = await uploadImage(file, 'logos')
    if (url) store.value.logo_url = url
  }
}

async function uploadImage(file: File, folder: string) {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.value?.id}/${folder}/${Date.now()}.${fileExt}`
    
    const { error: uploadError } = await supabase.storage
      .from('store_assets')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    const { data } = supabase.storage
      .from('store_assets')
      .getPublicUrl(fileName)

    return data.publicUrl
  } catch (error: any) {
    showToast(error.message, 'danger')
    return null
  }
}

async function saveSettings() {
  if (!store.value) return
  saving.value = true
  const { error } = await supabase
    .from('merchant_stores')
    .update({
      name: store.value.name,
      name_zh: store.value.name_zh,
      description: store.value.description,
      description_zh: store.value.description_zh,
      logo_url: store.value.logo_url,
      banner_url: store.value.banner_url,
      is_active: store.value.is_active,
      delivery_options: store.value.delivery_options || ['home_delivery'],
      updated_at: new Date().toISOString()
    })
    .eq('id', store.value.id)

  if (error) {
    showToast(error.message, 'danger')
  } else {
    showToast(t('store.saveSuccess') || 'Settings saved!', 'success')
  }
  saving.value = false
}

async function showToast(message: string, color: string) {
  const toast = await toastController.create({
    message,
    duration: 2000,
    color
  })
  await toast.present()
}

onMounted(fetchStore)
</script>

<style scoped>
.settings-container {
  max-width: 600px;
  margin: 0 auto;
}

.banner-upload-section {
  margin-bottom: 24px;
}

.banner-preview {
  height: 150px;
  width: 100%;
  background-color: var(--ion-color-step-100);
  background-size: cover;
  background-position: center;
  border-radius: 12px;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.banner-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--ion-color-medium);
  gap: 8px;
}

.banner-placeholder ion-icon {
  font-size: 32px;
}

.upload-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  --background: rgba(0, 0, 0, 0.5);
  --color: white;
  --border-radius: 50%;
  width: 36px;
  height: 36px;
  margin: 0;
}

.upload-hint {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  margin-top: 6px;
  text-align: center;
}

.logo-upload-section {
  display: flex;
  justify-content: center;
  margin-top: -50px;
  margin-bottom: 24px;
}

.settings-avatar {
  width: 100px;
  height: 100px;
  border: 4px solid var(--ion-background-color);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  position: relative;
  background: white;
}

.avatar-upload-btn {
  position: absolute;
  bottom: 0;
  right: 0;
  --background: var(--ion-color-primary);
  --color: white;
  --border-radius: 50%;
  width: 32px;
  height: 32px;
  margin: 0;
}

.custom-item {
  --background: var(--ion-color-step-100, #f8f9fa);
  --border-radius: 16px;
  margin-bottom: 16px;
  --padding-start: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.custom-item ion-label {
  font-weight: 600;
  margin-bottom: 8px;
}

.custom-item ion-input,
.custom-item ion-textarea {
  --padding-top: 12px;
  --padding-bottom: 12px;
  font-size: 1rem;
}

.save-btn {
  --border-radius: 16px;
  height: 56px;
  font-weight: 700;
  font-size: 1.1rem;
  margin-top: 24px;
  --box-shadow: 0 8px 16px rgba(var(--ion-color-primary-rgb), 0.3);
}

/* Dark mode refinements */
.ion-palette-dark .settings-container {
  background: transparent;
}

.ion-palette-dark .custom-item {
  --background: var(--ion-color-step-150, #1e1e1e);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.ion-palette-dark .settings-avatar {
  background: var(--ion-color-step-100);
  border-color: var(--ion-background-color);
}

/* Delivery Options Section */
.delivery-section {
  margin-top: 24px;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0 0 4px;
}

.section-subtitle {
  font-size: 0.82rem;
  color: var(--ion-color-medium);
  margin: 0 0 12px;
}

.delivery-item {
  --background: var(--ion-color-step-100, #f8f9fa);
  --border-radius: 14px;
  margin-bottom: 10px;
  --padding-start: 14px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.delivery-item ion-icon {
  font-size: 22px;
  margin-right: 8px;
}

.delivery-item h3 {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0;
}

.delivery-item p {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  margin: 2px 0 0;
}

.ion-palette-dark .delivery-item {
  --background: var(--ion-color-step-150, #1e1e1e);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
</style>
