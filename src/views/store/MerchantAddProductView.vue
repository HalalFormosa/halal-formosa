<template>
  <ion-page>
    <ion-header>
      <app-header
        :title="isEdit ? $t('store.adminEditProduct') : $t('store.adminAddProduct')"
        :showBack="true"
        icon="none"
      />
    </ion-header>

    <ion-content :fullscreen="true">
      <div v-if="isUnderConstruction" slot="fixed" class="under-construction-overlay">
        <div class="construction-card">
          <ion-icon :icon="constructOutline" class="construction-icon" />
          <h2>{{ $t('common.underConstruction') || 'Under Construction' }}</h2>
          <p>Product management is currently offline for maintenance.</p>
        </div>
      </div>

      <div class="form-wrapper" style="position: relative; min-height: 100%;">
        
        <!-- Basic Information -->
        <div class="section-title">{{ $t('master.basicInfo') }}</div>
        <div class="form-card">
          <div class="innovative-field">
            <ion-icon :icon="bagHandleOutline" class="field-icon" />
            <ion-item class="form-item" lines="none">
              <ion-input v-model="form.name" :label="$t('store.productName')" label-placement="stacked"
                :placeholder="$t('store.productName')" required />
            </ion-item>
          </div>

          <div class="innovative-field">
            <ion-icon :icon="languageOutline" class="field-icon" />
            <ion-item class="form-item" lines="none">
              <ion-input v-model="form.name_zh" :label="$t('store.productNameZh')" label-placement="stacked"
                :placeholder="$t('store.productNameZh')" />
            </ion-item>
          </div>
        </div>

        <!-- Category & Pricing -->
        <div class="section-title">{{ $t('store.categories') }} & {{ $t('store.price') }}</div>
        <div class="form-card">
          <div class="innovative-field">
            <ion-icon :icon="gridOutline" class="field-icon" />
            <ion-item class="form-item" lines="none">
              <ion-select v-model="form.category_id" :label="$t('store.categories')" label-placement="stacked"
                interface="action-sheet" :placeholder="$t('store.allCategories')">
                <ion-select-option v-for="cat in categories" :key="cat.id" :value="cat.id">
                  {{ cat.emoji }} {{ localized(cat.name_zh, cat.name) }}
                </ion-select-option>
              </ion-select>
            </ion-item>
          </div>

          <div class="innovative-field price-input-field">
            <div class="currency-prefix">NT$</div>
            <ion-item class="form-item" lines="none">
              <ion-input v-model.number="form.price" :label="$t('store.price')" label-placement="stacked"
                type="number" min="0" step="1" placeholder="0" required />
            </ion-item>
          </div>

          <!-- Earnings Calculator -->
          <div v-if="form.price > 0" class="earnings-card">
            <div class="calc-row">
              <span class="calc-label">{{ $t('merchant.products.pricingBreakdown') }}</span>
              <span class="calc-value">NT$ {{ form.price }}</span>
            </div>
            <div class="calc-row fee-row">
              <span class="calc-label">{{ $t('merchant.products.processingFee') }}</span>
              <span class="calc-value">- NT$ {{ (form.price * 0.1).toFixed(0) }}</span>
            </div>
            <div class="calc-divider"></div>
            <div class="calc-row total-row">
              <span class="calc-label">{{ $t('merchant.products.payoutAmount') }}</span>
              <span class="calc-value highlight">NT$ {{ (form.price * 0.9).toFixed(0) }}</span>
            </div>
            <p class="payout-hint">
              <ion-icon :icon="informationCircleOutline" />
              {{ $t('merchant.products.payoutHint') }}
            </p>
          </div>

          <div class="innovative-field">
            <ion-icon :icon="cubeOutline" class="field-icon" />
            <ion-item class="form-item" lines="none">
              <ion-input v-model.number="form.stock_quantity" :label="$t('store.stockQuantity')" label-placement="stacked"
                type="number" min="0" step="1" placeholder="0" />
            </ion-item>
          </div>
        </div>

        <!-- Halal Proof (Conditional) -->
        <transition name="fade">
          <div v-if="needsHalalProof" class="halal-section">
            <div class="section-title mandatory">{{ $t('merchant.products.halalProof') }}</div>
            <div class="form-card halal-proof-card">
              <p class="halal-hint">{{ $t('merchant.products.halalProofHint') }}</p>
              
              <div class="proof-grid">
                <div v-for="(img, i) in form.halal_proof" :key="i" class="image-thumb">
                  <img :src="img" :alt="`Proof ${i + 1}`" />
                  <ion-button fill="clear" size="small" class="remove-img" @click="form.halal_proof.splice(i, 1)">
                    <ion-icon :icon="closeCircleOutline" />
                  </ion-button>
                </div>
                <div v-if="form.halal_proof.length < 5" class="add-image-btn" @click="addHalalProof">
                  <ion-icon :icon="shieldCheckmarkOutline" />
                  <span>{{ $t('common.add') }}</span>
                </div>
              </div>

              <div class="halal-disclaimer">
                <ion-icon :icon="alertCircleOutline" />
                <span>{{ $t('merchant.products.halalProofPlaceholder') }}</span>
              </div>
            </div>
          </div>
        </transition>

        <!-- Media & Description -->
        <div class="section-title">{{ $t('store.images') }}</div>
        <div class="form-card media-card">
          <div class="images-grid">
            <div v-for="(img, i) in form.images" :key="i" class="image-thumb">
              <img :src="img" :alt="`Image ${i + 1}`" />
              <ion-button fill="clear" size="small" class="remove-img" @click="form.images.splice(i, 1)">
                <ion-icon :icon="closeCircleOutline" />
              </ion-button>
            </div>
            <div v-if="form.images.length < 8" class="add-image-btn" @click="addImageUrl">
              <ion-icon :icon="addOutline" />
              <span>Add URL</span>
            </div>
          </div>
        </div>

        <div class="section-title">{{ $t('store.description') }}</div>
        <div class="form-card">
          <ion-item class="form-item no-icon" lines="none">
            <ion-textarea v-model="form.description" :label="$t('store.description')" label-placement="stacked"
              :rows="4" placeholder="Product description in English" />
          </ion-item>

          <ion-item class="form-item no-icon" lines="none">
            <ion-textarea v-model="form.description_zh" :label="$t('store.descriptionZh')" label-placement="stacked"
              :rows="4" :placeholder="$t('store.descriptionZh')" />
          </ion-item>
        </div>

        <!-- Advanced -->
        <div class="section-title">{{ $t('master.advanced') }}</div>
        <div class="form-card toggle-card">
          <ion-item class="form-item" lines="none">
            <ion-toggle v-model="form.is_featured" justify="space-between">
              <div class="toggle-label">
                <ion-icon :icon="starOutline" />
                <span>{{ $t('store.isFeatured') }}</span>
              </div>
            </ion-toggle>
          </ion-item>
          <ion-item class="form-item" lines="none">
            <ion-toggle v-model="form.is_active" justify="space-between">
              <div class="toggle-label">
                <ion-icon :icon="eyeOutline" />
                <span>{{ $t('store.isActive') }}</span>
              </div>
            </ion-toggle>
          </ion-item>
        </div>

        <div class="section-title">{{ $t('store.tags') }}</div>
        <div class="form-card">
          <div class="innovative-field">
            <ion-icon :icon="pricetagOutline" class="field-icon" />
            <ion-item class="form-item" lines="none">
              <ion-input v-model="tagsInput" :label="$t('store.tags')" label-placement="stacked"
                placeholder="halal, ramadan, snack" />
            </ion-item>
          </div>
        </div>
        
        <!-- Safety Padding -->
        <div style="height: 100px;"></div>
      </div>
    </ion-content>

    <ion-footer v-if="!isUnderConstruction">
      <ion-toolbar class="save-footer" mode="md">
        <ion-button expand="block" color="carrot" class="save-btn" @click="saveProduct" :disabled="submitting">
          <ion-spinner v-if="submitting" name="crescent" slot="start" />
          {{ submitting ? $t('store.saving') : $t('store.saveProduct') }}
        </ion-button>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IonPage, IonHeader, IonContent, IonFooter, IonToolbar, IonButton, IonIcon,
  IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption, IonToggle,
  IonSpinner, IonBadge, toastController, alertController
} from '@ionic/vue'
import { 
  addOutline, closeCircleOutline, constructOutline, bagHandleOutline, 
  languageOutline, gridOutline, cubeOutline, informationCircleOutline,
  shieldCheckmarkOutline, alertCircleOutline, starOutline, eyeOutline,
  pricetagOutline
} from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import { supabase } from '@/plugins/supabaseClient'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()

const isUnderConstruction = computed(() => import.meta.env.VITE_STORE_UNDER_CONSTRUCTION === 'true')
const isEdit = computed(() => !!route.params.id)
const categories = ref<any[]>([])
const submitting = ref(false)
const tagsInput = ref('')
const storeId = ref<string | null>(null)

const form = reactive({
  name: '',
  name_zh: '',
  category_id: null as number | null,
  price: 0,
  stock_quantity: 0,
  description: '',
  description_zh: '',
  images: [] as string[],
  halal_proof: [] as string[],
  is_featured: false,
  is_active: true
})

const needsHalalProof = computed(() => {
  if (!form.category_id) return false
  const category = categories.value.find(c => c.id === form.category_id)
  if (!category) return false
  
  // IDs derived from research: 1/8 (Food), 2/9 (Beverages), 3/10 (Snacks), 4/11 (Spices)
  const restrictedIds = [1, 8, 2, 9, 3, 10, 4, 11]
  return restrictedIds.includes(form.category_id)
})

function localized(zh: string | null | undefined, en: string | null | undefined): string {
  if (locale.value === 'zh') return zh || en || ''
  return en || zh || ''
}

async function fetchCategories() {
  const { data } = await supabase
    .from('store_product_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  categories.value = data || []
}

async function fetchProduct() {
  if (!isEdit.value) return
  const { data } = await supabase
    .from('store_products')
    .select('*')
    .eq('id', route.params.id)
    .single()

  if (data) {
    form.name = data.name || ''
    form.name_zh = data.name_zh || ''
    form.category_id = data.category_id
    form.price = Number(data.price) || 0
    form.stock_quantity = data.stock_quantity || 0
    form.description = data.description || ''
    form.description_zh = data.description_zh || ''
    form.images = data.images || []
    form.halal_proof = data.halal_proof || []
    form.is_featured = data.is_featured || false
    form.is_active = data.is_active ?? true
    tagsInput.value = (data.tags || []).join(', ')
    if (data.store_id) storeId.value = data.store_id
  }
}

async function ensureStoreExists() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const { data: store } = await supabase
    .from('merchant_stores')
    .select('id')
    .eq('user_id', session.user.id)
    .single()

  if (store) {
    storeId.value = store.id
  }
}

async function addImageUrl() {
  const alert = await alertController.create({
    header: 'Add Image URL',
    inputs: [{ name: 'url', type: 'url', placeholder: 'https://...' }],
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('common.add'),
        handler: (data) => {
          if (data.url?.trim()) {
            form.images.push(data.url.trim())
          }
        }
      }
    ]
  })
  alert.present()
}

async function addHalalProof() {
  const alert = await alertController.create({
    header: t('merchant.products.halalProof'),
    message: t('merchant.products.halalProofPlaceholder'),
    inputs: [{ name: 'url', type: 'url', placeholder: 'Image URL or Document link' }],
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('common.add'),
        handler: (data) => {
          if (data.url?.trim()) {
            form.halal_proof.push(data.url.trim())
          }
        }
      }
    ]
  })
  alert.present()
}

async function saveProduct() {
  // Validations
  if (!form.name.trim()) {
    showToast(t('store.errors.nameRequired'), 'warning')
    return
  }

  if (!form.price || form.price <= 0) {
    showToast(t('store.errors.priceRequired'), 'warning')
    return
  }

  if (needsHalalProof.value && form.halal_proof.length === 0) {
    showToast(t('merchant.products.halalProofError'), 'danger')
    return
  }

  submitting.value = true

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    const tags = tagsInput.value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    const payload = {
      user_id: session.user.id,
      store_id: storeId.value,
      name: form.name.trim(),
      name_zh: form.name_zh.trim() || null,
      category_id: form.category_id,
      price: form.price,
      stock_quantity: form.stock_quantity || 0,
      description: form.description.trim() || null,
      description_zh: form.description_zh.trim() || null,
      images: form.images,
      halal_proof: form.halal_proof,
      is_featured: form.is_featured,
      is_active: form.is_active,
      tags: tags.length > 0 ? tags : null,
      updated_at: new Date().toISOString()
    }

    if (isEdit.value) {
      const { error } = await supabase
        .from('store_products')
        .update(payload)
        .eq('id', route.params.id)

      if (error) throw error
    } else {
      const { error } = await supabase
        .from('store_products')
        .insert(payload)

      if (error) throw error
    }

    showToast(`✅ ${t('store.saveSuccess')}`, 'success')
    router.back()
  } catch (err: any) {
    showToast(`❌ ${err.message || t('store.saveFailed')}`, 'danger')
  } finally {
    submitting.value = false
  }
}

async function showToast(message: string, color: string) {
  const toast = await toastController.create({
    message,
    duration: color === 'danger' ? 3000 : 2000,
    color
  })
  toast.present()
}

onMounted(async () => {
  await fetchCategories()
  await ensureStoreExists()
  await fetchProduct()
})
</script>

<style scoped>
.form-wrapper {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--ion-color-medium);
  margin: 16px 4px 8px;
  letter-spacing: 0.05em;
}

.section-title.mandatory::after {
  content: ' *';
  color: var(--ion-color-danger);
}

.form-card {
  background: #ffffff;
  border-radius: 20px;
  padding: 8px 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
  margin-bottom: 8px;
}

.innovative-field {
  display: flex;
  align-items: center;
  padding: 4px 12px;
}

.field-icon {
  font-size: 20px;
  margin-right: 12px;
  color: var(--ion-color-carrot);
  opacity: 0.8;
}

.form-item {
  --background: transparent;
  --padding-start: 0;
  --inner-padding-end: 0;
  width: 100%;
}

.form-item.no-icon {
    padding-left: 12px;
    padding-right: 12px;
}

/* Price breakdown */
.price-input-field {
  position: relative;
}

.currency-prefix {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(0);
  font-weight: 700;
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}

.earnings-card {
  background: var(--ion-color-success-tint, #f0fff4);
  margin: 12px;
  padding: 16px;
  border-radius: 16px;
  border: 1px dashed var(--ion-color-success);
}

.calc-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 0.9rem;
}

.fee-row {
  color: var(--ion-color-danger);
  font-size: 0.85rem;
}

.calc-divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.06);
  margin: 8px 0;
}

.total-row {
  font-weight: 700;
  font-size: 1rem;
}

.highlight {
  color: var(--ion-color-success-shade, #2f855a);
}

.payout-hint {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  margin: 8px 0 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Halal Proof */
.halal-proof-card {
  border: 2px solid var(--ion-color-carrot-tint, #fff3e0);
}

.halal-hint {
  font-size: 0.85rem;
  padding: 0 12px;
  margin: 8px 0 16px;
  color: var(--ion-color-medium);
}

.proof-grid, .images-grid {
  display: flex;
  gap: 12px;
  padding: 0 12px 12px;
  flex-wrap: wrap;
}

.image-thumb {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.image-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-img {
  position: absolute;
  top: -4px;
  right: -4px;
  --padding-start: 2px;
  --padding-end: 2px;
  color: var(--ion-color-danger);
  background: white;
  border-radius: 50%;
}

.add-image-btn {
  width: 80px;
  height: 80px;
  border-radius: 14px;
  border: 2px dashed var(--ion-color-medium);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--ion-color-medium);
  font-size: 0.7rem;
  transition: all 0.2s;
}

.add-image-btn:active {
  background: rgba(0,0,0,0.05);
}

.halal-disclaimer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--ion-color-light);
  border-radius: 0 0 20px 20px;
  font-size: 0.75rem;
  color: var(--ion-color-step-600);
}

/* Toggles */
.toggle-label {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 500;
}

.toggle-label ion-icon {
  color: var(--ion-color-carrot);
  font-size: 20px;
}

/* Transitions */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Footer */
.save-footer {
  --background: var(--ion-background-color);
  --border-width: 0;
  padding: 8px 16px 24px;
}

.save-btn {
  --border-radius: 16px;
  height: 52px;
  font-weight: 700;
  margin: 0;
}

/* Dark mode */
.ion-palette-dark .form-card {
  background: var(--ion-color-step-100);
}

.ion-palette-dark .earnings-card {
  background: rgba(45, 161, 110, 0.1);
  border-color: var(--ion-color-success);
}
</style>
