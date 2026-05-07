<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <ion-toolbar class="premium-toolbar">
        <ion-buttons slot="start">
          <ion-back-button default-href="/profile" />
        </ion-buttons>
        <ion-title class="premium-title">{{ $t('store.settings.title') }}</ion-title>
        <ion-buttons slot="end">
          <ion-button v-if="store" @click="saveSettings" :disabled="saving" class="save-header-btn">
            <ion-spinner v-if="saving" name="crescent" />
            <span v-else>{{ $t('common.save') }}</span>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div v-if="loading" class="loading-overlay">
        <ion-spinner name="dots" color="carrot" />
      </div>

      <div v-else-if="!store" class="error-state ion-padding">
        <div class="error-card">
          <ion-icon :icon="alertCircleOutline" class="error-icon" />
          <h3>{{ $t('store.errors.noStoreFound') }}</h3>
          <p>{{ $t('store.errors.contactAdmin') }}</p>
        </div>
      </div>

      <div v-else class="settings-wrapper">
        <!-- Identity Section: Banner & Logo -->
        <section class="identity-card material-card">
          <div class="banner-box" :style="store.banner_url ? { backgroundImage: `url(${store.banner_url})` } : {}">
            <div v-if="!store.banner_url" class="banner-empty">
              <ion-icon :icon="imageOutline" />
            </div>
            <div class="banner-glass-overlay"></div>
            <ion-button fill="clear" class="btn-circular banner-edit" @click="triggerBannerUpload">
              <ion-icon :icon="cameraOutline" />
            </ion-button>
          </div>
          
          <div class="logo-box-wrapper">
            <div class="logo-box">
              <img :src="store.logo_url || '/favicon-32x32.png'" class="store-logo-img" />
              <ion-button fill="clear" class="btn-circular logo-edit" @click="triggerLogoUpload">
                <ion-icon :icon="cameraOutline" />
              </ion-button>
            </div>
          </div>
          
          <div class="identity-info ion-text-center">
            <h2 class="store-name-display">{{ store.name_zh || store.name || $t('merchant.register.sectionTitle') }}</h2>
            <div class="status-toggle-wrapper">
              <span class="status-label" :class="{ 'is-active': store.is_active }">
                {{ store.is_active ? $t('master.active') : $t('master.inactive') }}
              </span>
              <ion-toggle v-model="store.is_active" color="carrot" />
            </div>
          </div>

          <input type="file" ref="bannerInput" style="display: none" accept="image/*" @change="handleBannerFile" />
          <input type="file" ref="logoInput" style="display: none" accept="image/*" @change="handleLogoFile" />
        </section>


        <!-- Details Section -->
        <section class="settings-group">
          <h3 class="group-title">{{ $t('store.settings.basicInfo') }}</h3>
          
          <!-- English Details -->
          <div class="settings-item card-item">
            <div class="field-group">
              <label>{{ $t('store.settings.storeName') }} (EN)</label>
              <ion-input v-model="store.name" :placeholder="$t('store.settings.storeNamePlaceholder')" class="premium-input" />
            </div>
            <div class="field-group" style="border-top: 1px solid rgba(0,0,0,0.05);">
              <label>{{ $t('store.settings.storeDescription') }} (EN)</label>
              <ion-textarea v-model="store.description" :rows="3" :placeholder="$t('store.settings.storeDescriptionPlaceholder')" class="premium-textarea" />
            </div>
          </div>

          <!-- Chinese Details -->
          <div class="settings-item card-item">
            <div class="field-group">
              <label>{{ $t('store.settings.storeNameZh') }} (ZH)</label>
              <ion-input v-model="store.name_zh" :placeholder="$t('store.settings.storeNameZhPlaceholder')" class="premium-input" />
            </div>
            <div class="field-group" style="border-top: 1px solid rgba(0,0,0,0.05);">
              <label>{{ $t('store.settings.storeDescriptionZh') }} (ZH)</label>
              <ion-textarea v-model="store.description_zh" :rows="3" :placeholder="$t('store.settings.storeDescriptionZhPlaceholder')" class="premium-textarea" />
            </div>
          </div>
        </section>
        <!-- Delivery Section -->
        <section class="settings-group">
          <div class="group-header">
            <h3 class="group-title">🚚 {{ $t('store.settings.logistics') }}</h3>
            <p class="group-subtitle">{{ $t('store.settings.deliveryHint') }}</p>
          </div>

          <div class="card-item delivery-list">
            <div v-for="method in deliveryMethods" :key="method.key" class="delivery-row">
              <div class="deliv-info">
                <div class="deliv-icon">
                  <ion-icon :icon="method.icon" />
                </div>
                <div class="deliv-text">
                  <h4>{{ $t('store.settings.deliveryMethods.' + method.key) }}</h4>
                  <p>{{ $t('store.settings.deliveryMethods.' + (method.key === '7eleven' || method.key === 'family_mart' || method.key === 'hi_life' || method.key === 'ok_mart' ? 'cvs_pickup' : (method.key === 'cod_meetup' ? 'in_person' : method.key + '_desc'))) }}</p>
                </div>
              </div>
              <ion-toggle 
                :checked="isDeliveryEnabled(method.key)" 
                @ionChange="toggleDelivery(method.key, $event)"
                color="carrot" 
              />
            </div>
          </div>

          <!-- Per-Provider ECPay Shipping Stores -->
          <div v-for="method in deliveryMethods.filter(m => ['7eleven', 'family_mart', 'hi_life', 'ok_mart'].includes(m.key) && isDeliveryEnabled(m.key))" 
               :key="method.key" 
               class="settings-item card-item cvs-store-group"
          >
            <div class="cvs-header">
              <label class="premium-label">{{ $t('store.settings.deliveryMethods.' + method.key) }} {{ $t('store.settings.shippingStoreTitle') || 'Shipping Store' }}</label>
              
              <ion-button 
                fill="outline" 
                size="small" 
                color="carrot" 
                @click="openCvsPicker(method.key)"
                class="cvs-picker-btn"
                :disabled="logisticsLoading"
              >
                <ion-spinner v-if="logisticsLoading" name="crescent" slot="start" />
                <ion-icon :icon="storefrontOutline" slot="start" />
                {{ store[`ecpay_${method.key}_store_id`] ? $t('store.settings.changeStore') || 'Change Store' : $t('store.settings.selectStore') || 'Select Store' }}
              </ion-button>
            </div>
            
            <div v-if="store[`ecpay_${method.key}_store_id`]" class="selected-cvs-info">
              <div class="cvs-branch-tag">
                <ion-badge color="carrot">{{ method.key.toUpperCase().replace('_', '') }}</ion-badge>
                <span class="branch-name">{{ store[`ecpay_${method.key}_store_name`] }} ({{ store[`ecpay_${method.key}_store_id`] }})</span>
              </div>
              <p class="branch-address">{{ store[`ecpay_${method.key}_store_address`] }}</p>
            </div>
          </div>

          <!-- Consistently shown hint if any CVS enabled -->
          <p v-if="hasCvsEnabled" class="field-hint ion-padding-horizontal" style="margin-top: -8px; margin-bottom: 24px;">
            {{ $t('store.settings.shippingHint') || 'Select the branch where you will drop off packages. This is required for shipping.' }}
          </p>
        </section>

        <!-- Store Location & Logistics Section -->
        <section class="settings-group">
          <div class="group-header">
            <h3 class="group-title">📍 {{ $t('store.settings.locationAndLogistics') || 'Location & Logistics' }}</h3>
            <p class="group-subtitle">{{ $t('store.settings.locationHint') || 'Specify where your products are shipped from' }}</p>
          </div>

          <div class="card-item">
            <!-- City Selection (Searchable Modal) -->
            <div class="field-group">
              <label>{{ $t('store.settings.city') }}</label>
              <div class="searchable-select-trigger" @click="isCityModalOpen = true">
                <span v-if="selectedCity" class="selected-value">
                  {{ locale === 'zh' ? selectedCity.name_zh : selectedCity.name }}
                </span>
                <span v-else class="placeholder-text">
                  {{ $t('store.settings.cityPlaceholder') }}
                </span>
                <ion-icon :icon="chevronDownOutline" class="trigger-icon" />
              </div>
            </div>

            <!-- City Search Modal -->
            <ion-modal 
              :is-open="isCityModalOpen" 
              @didDismiss="isCityModalOpen = false" 
              class="search-modal"
              :initial-breakpoint="0.8"
              :breakpoints="[0, 0.5, 0.8]"
            >
              <ion-header class="ion-no-border">
                <ion-toolbar class="premium-toolbar">
                  <ion-title>{{ $t('store.settings.city') }}</ion-title>
                  <ion-buttons slot="end">
                    <ion-button @click="isCityModalOpen = false">{{ $t('common.close') }}</ion-button>
                  </ion-buttons>
                </ion-toolbar>
                <ion-toolbar class="premium-toolbar">
                  <ion-searchbar 
                    v-model="citySearchQuery" 
                    :placeholder="$t('common.search')" 
                    class="premium-searchbar"
                    animated
                  />
                </ion-toolbar>
              </ion-header>
              <ion-content>
                <ion-list lines="full" class="city-list">
                  <ion-item 
                    v-for="city in filteredCities" 
                    :key="city.id" 
                    button 
                    @click="selectCity(city)"
                    class="city-item"
                  >
                    <ion-label>
                      <h2>{{ city.name_zh }}</h2>
                      <p>{{ city.name }}</p>
                    </ion-label>
                    <ion-icon v-if="store.city_id === city.id" :icon="checkmarkOutline" slot="end" color="carrot" />
                  </ion-item>
                  <div v-if="filteredCities.length === 0" class="no-results ion-padding ion-text-center">
                    <p>{{ $t('common.noResults') }}</p>
                  </div>
                </ion-list>
              </ion-content>
            </ion-modal>

            <!-- Sender Name (For Logistics) -->
            <div class="field-group" style="border-top: 1px solid rgba(0,0,0,0.05);">
              <label>{{ $t('store.settings.senderName') }}</label>
              <ion-input v-model="store.sender_name" :placeholder="$t('store.settings.senderNamePlaceholder')" class="premium-input" />
            </div>

            <!-- Sender Phone (For Logistics) -->
            <div class="field-group" style="border-top: 1px solid rgba(0,0,0,0.05);">
              <label>{{ $t('store.settings.senderPhone') }}</label>
              <ion-input v-model="store.sender_phone" type="tel" placeholder="09xx-xxx-xxx" class="premium-input" />
            </div>
          </div>
        </section>
        
        <div class="footer-action ion-padding">
           <ion-button expand="block" shape="round" color="carrot" @click="saveSettings" :disabled="saving" class="big-save-btn">
             <ion-spinner v-if="saving" name="crescent" slot="start" />
             {{ saving ? $t('common.saving') : $t('store.settings.saveProfile') }}
           </ion-button>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle,
  IonContent, IonSpinner, IonIcon, IonItem, IonLabel, IonInput,
  IonTextarea, IonToggle, IonButton, IonAvatar, IonSelect, IonSelectOption, IonBadge,
  IonModal, IonSearchbar, IonList, toastController
} from '@ionic/vue'
import {
  alertCircleOutline, imageOutline, cameraOutline,
  homeOutline, storefrontOutline, cartOutline, businessOutline, bagHandleOutline, peopleOutline,
  chevronDownOutline, checkmarkOutline
} from 'ionicons/icons'
import { supabase } from '@/plugins/supabaseClient'
import { useI18n } from 'vue-i18n'
import { useEcpayLogistics } from '@/composables/useEcpayLogistics'

const deliveryMethods = [
  { key: 'home_delivery', icon: homeOutline },
  { key: '7eleven', icon: storefrontOutline },
  { key: 'family_mart', icon: cartOutline },
  { key: 'hi_life', icon: businessOutline },
  { key: 'ok_mart', icon: bagHandleOutline },
  { key: 'cod_meetup', icon: peopleOutline },
]

const { t, locale } = useI18n()
const user = ref<any>(null)
const store = ref<any>(null)
const cities = ref<any[]>([])
const isCityModalOpen = ref(false)
const citySearchQuery = ref('')
const loading = ref(true)
const saving = ref(false)

const { openCvsMapPicker, logisticsLoading } = useEcpayLogistics()

const hasCvsEnabled = computed(() => {
  if (!store.value?.delivery_options) return false
  const cvsMethods = ['7eleven', 'family_mart', 'hi_life', 'ok_mart']
  return store.value.delivery_options.some((m: string) => cvsMethods.includes(m))
})

async function openCvsPicker(method: string) {
  if (!store.value) return
  
  try {
    const result = await openCvsMapPicker(method)
    if (result) {
      store.value[`ecpay_${method}_store_id`] = result.storeId
      store.value[`ecpay_${method}_store_name`] = result.storeName
      store.value[`ecpay_${method}_store_address`] = result.storeAddress
    }
  } catch (err: any) {
    const toast = await toastController.create({
      message: 'Failed to open store map: ' + err.message,
      duration: 3000,
      color: 'danger'
    })
    toast.present()
  }
}

const filteredCities = computed(() => {
  if (!citySearchQuery.value) return cities.value
  const query = citySearchQuery.value.toLowerCase()
  return cities.value.filter(city => 
    city.name.toLowerCase().includes(query) || 
    city.name_zh.includes(query)
  )
})

const selectedCity = computed(() => {
  return cities.value.find(c => c.id === store.value?.city_id)
})

function selectCity(city: any) {
  if (store.value) {
    store.value.city_id = city.id
  }
  isCityModalOpen.value = false
  citySearchQuery.value = ''
}

const bannerInput = ref<HTMLInputElement | null>(null)
const logoInput = ref<HTMLInputElement | null>(null)

async function fetchStore() {
  const { data: authData } = await supabase.auth.getUser()
  user.value = authData.user
  if (!user.value) return
  
  loading.value = true
  try {
    const { data: storeData } = await supabase
      .from('merchant_stores')
      .select('*')
      .eq('user_id', user.value.id)
      .maybeSingle()
    
    // Fetch user profile for auto-filling sender info
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('display_name, phone')
      .eq('id', user.value.id)
      .maybeSingle()

    if (storeData) {
      store.value = storeData
      // Ensure defaults
      if (!store.value.delivery_options) store.value.delivery_options = ['home_delivery']
      
      // Auto-fill sender info if not already set
      if (!store.value.sender_name && profileData?.display_name) {
        store.value.sender_name = profileData.display_name
      }
      if (!store.value.sender_phone && profileData?.phone) {
        store.value.sender_phone = profileData.phone
      }
    }
  } catch (err) {
    console.error('Fetch error:', err)
  }
  loading.value = false
}

async function fetchCities() {
  try {
    const { data } = await supabase
      .from('cities')
      .select('*')
      .order('sort_order')
    if (data) cities.value = data
  } catch (err) {
    console.error('Fetch cities error:', err)
  }
}

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
      delivery_options: store.value.delivery_options,
      sender_name: store.value.sender_name || null,
      sender_phone: store.value.sender_phone || null,
      city_id: store.value.city_id || null,
      ecpay_7eleven_store_id: store.value.ecpay_7eleven_store_id || null,
      ecpay_7eleven_store_name: store.value.ecpay_7eleven_store_name || null,
      ecpay_7eleven_store_address: store.value.ecpay_7eleven_store_address || null,
      ecpay_family_mart_store_id: store.value.ecpay_family_mart_store_id || null,
      ecpay_family_mart_store_name: store.value.ecpay_family_mart_store_name || null,
      ecpay_family_mart_store_address: store.value.ecpay_family_mart_store_address || null,
      ecpay_hi_life_store_id: store.value.ecpay_hi_life_store_id || null,
      ecpay_hi_life_store_name: store.value.ecpay_hi_life_store_name || null,
      ecpay_hi_life_store_address: store.value.ecpay_hi_life_store_address || null,
      ecpay_ok_mart_store_id: store.value.ecpay_ok_mart_store_id || null,
      ecpay_ok_mart_store_name: store.value.ecpay_ok_mart_store_name || null,
      ecpay_ok_mart_store_address: store.value.ecpay_ok_mart_store_address || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', store.value.id)

  if (error) {
    showToast(error.message, 'danger')
  } else {
    showToast(t('common.success'), 'success')
  }
  saving.value = false
}

async function showToast(message: string, color: string) {
  const toast = await toastController.create({
    message,
    duration: 2000,
    color,
    position: 'bottom'
  })
  await toast.present()
}

onMounted(() => {
  fetchStore()
  fetchCities()
})
</script>

<style scoped>
/* (Styles are the same, omitting for brevity in thought, but I'll include them in the write_to_file) */
.settings-wrapper {
  max-width: 600px;
  margin: 0 auto;
  padding-bottom: 40px;
}

.premium-toolbar {
  --background: var(--ion-background-color);
  --color: var(--ion-text-color);
}

.premium-title {
  font-weight: 800;
  font-size: 1.1rem;
}

.save-header-btn {
  --color: var(--ion-color-carrot);
  font-weight: 700;
  font-size: 0.95rem;
}

/* Material Card Style */
.material-card {
  background: var(--ion-card-background, #fff);
  border-radius: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  margin-bottom: 24px;
  overflow: hidden;
}

/* Identity Card */
.identity-card {
  margin: 16px;
  position: relative;
}

.banner-box {
  height: 160px;
  width: 100%;
  background-color: var(--ion-color-step-100);
  background-size: cover;
  background-position: center;
  position: relative;
}

.banner-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ion-color-step-300);
}

.banner-empty ion-icon {
  font-size: 48px;
}

.banner-glass-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.2));
}

.banner-edit {
  position: absolute;
  top: 12px;
  right: 12px;
  --background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(8px);
  --color: white;
}

.logo-box-wrapper {
  display: flex;
  justify-content: center;
  margin-top: -50px;
  margin-bottom: 12px;
  position: relative;
  z-index: 2;
}

.logo-box {
  width: 100px;
  height: 100px;
  border-radius: 24px;
  background: #fff;
  border: 4px solid var(--ion-card-background, #fff);
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.store-logo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 20px;
}

.logo-edit {
  position: absolute;
  bottom: -6px;
  right: -6px;
  --background: var(--ion-color-carrot);
  --color: white;
  width: 32px;
  height: 32px;
  --padding-start: 0;
  --padding-end: 0;
}

.btn-circular {
  --border-radius: 50%;
  margin: 0;
  --box-shadow: none;
}

.identity-info {
  padding: 0 16px 20px;
}

.store-name-display {
  margin: 0 0 8px;
  font-weight: 800;
  font-size: 1.4rem;
  color: var(--ion-text-color);
}

.status-toggle-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.status-label {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--ion-color-medium);
}

.status-label.is-active {
  color: var(--ion-color-success);
}

/* Settings Group */
.settings-group {
  padding: 0 16px;
  margin-bottom: 24px;
}

.group-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  margin: 0 0 12px 8px;
  letter-spacing: 0.8px;
}

.group-header {
  margin-bottom: 12px;
  padding-left: 8px;
}

.group-subtitle {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  margin: 4px 0 0;
}

.card-item {
  background: var(--ion-card-background, #fff);
  border-radius: 18px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  margin-bottom: 16px;
  overflow: hidden;
}

.field-group {
  padding: 16px;
}

.field-group label {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--ion-color-carrot);
  margin-bottom: 6px;
  text-transform: uppercase;
}

.premium-input {
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 4px;
  --padding-bottom: 4px;
  font-size: 1rem;
  font-weight: 600;
  --placeholder-color: var(--ion-color-step-400);
}

.premium-textarea {
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 4px;
  font-size: 0.95rem;
  font-weight: 500;
  --placeholder-color: var(--ion-color-step-400);
}

.premium-select {
  --padding-start: 0;
  --padding-end: 0;
  font-weight: 600;
  font-size: 1rem;
}

/* Delivery Row */
.delivery-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
}

.delivery-row:not(:last-child) {
  border-bottom: 1px solid rgba(0,0,0,0.03);
}

.deliv-info {
  display: flex;
  align-items: center;
  gap: 14px;
}

.deliv-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(var(--ion-color-carrot-rgb), 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ion-color-carrot);
  font-size: 20px;
}

.deliv-text h4 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
}

.deliv-text p {
  margin: 2px 0 0;
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.footer-action {
  margin-top: 12px;
}

.big-save-btn {
  height: 56px;
  font-weight: 800;
  font-size: 1.1rem;
  --box-shadow: 0 8px 24px rgba(var(--ion-color-carrot-rgb), 0.35);
}

/* Searchable Select Trigger */
.searchable-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  cursor: pointer;
}

.selected-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--ion-text-color);
}

.placeholder-text {
  font-size: 1rem;
  color: var(--ion-color-step-400);
}

.trigger-icon {
  font-size: 1.2rem;
  color: var(--ion-color-medium);
}

/* Search Modal */
.search-modal {
  --border-radius: 24px 24px 0 0;
  --background: var(--ion-background-color);
}

.search-modal ion-content {
  --background: var(--ion-background-color);
}

.premium-searchbar {
  --background: var(--ion-color-step-50);
  --border-radius: 12px;
  padding: 0 16px 12px;
}

.city-list {
  background: transparent;
}

.city-item {
  --padding-start: 16px;
  --padding-end: 16px;
  --inner-padding-top: 12px;
  --inner-padding-bottom: 12px;
}

.city-item h2 {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
}

.city-item p {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  margin: 2px 0 0;
}

.no-results {
  color: var(--ion-color-medium);
  font-size: 0.95rem;
}

/* Loading state */
.loading-overlay {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Error state */
.error-card {
  background: var(--ion-card-background);
  padding: 40px 20px;
  border-radius: 20px;
  text-align: center;
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
}

.error-icon {
  font-size: 64px;
  color: var(--ion-color-warning);
  margin-bottom: 16px;
}

/* Dark Palette refinements */
.ion-palette-dark .card-item,
.ion-palette-dark .material-card {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.ion-palette-dark .logo-box {
  background: var(--ion-color-step-100);
}

.ion-palette-dark .field-group {
  border-top-color: rgba(255, 255, 255, 0.05) !important;
}

.ion-palette-dark .delivery-row {
  border-bottom-color: rgba(255, 255, 255, 0.05);
}

.cvs-store-group {
  padding: 16px;
}

.cvs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 12px;
}

.cvs-header .premium-label {
  margin-bottom: 0;
  flex: 1;
}

.cvs-picker-btn {
  margin: 0;
  height: 32px;
  font-size: 0.75rem;
}

.selected-cvs-info {
  background: var(--ion-color-step-50);
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 12px;
  border: 1px solid var(--ion-color-step-150);
}

.cvs-branch-tag {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.branch-name {
  font-weight: 600;
  font-size: 0.95rem;
}

.branch-address {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  margin: 0;
}

.cvs-picker-btn {
  margin-top: 4px;
}
</style>
