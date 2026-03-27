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
      <div v-if="isUnderConstruction" class="under-construction-overlay">
        <div class="construction-card">
          <ion-icon :icon="constructOutline" class="construction-icon" />
          <h2>{{ $t('common.underConstruction') || 'Under Construction' }}</h2>
          <p>Product management is currently offline for maintenance.</p>
        </div>
      </div>

      <div v-else class="form-wrapper">
        <!-- Product Name -->
        <div class="form-card">
          <ion-item class="form-item">
            <ion-input v-model="form.name" :label="$t('store.productName')" label-placement="stacked"
              :placeholder="$t('store.productName')" required />
          </ion-item>

          <ion-item class="form-item">
            <ion-input v-model="form.name_zh" :label="$t('store.productNameZh')" label-placement="stacked"
              :placeholder="$t('store.productNameZh')" />
          </ion-item>
        </div>

        <!-- Category & Price -->
        <div class="form-card">
          <ion-item class="form-item">
            <ion-select v-model="form.category_id" :label="$t('store.categories')" label-placement="stacked"
              interface="popover" :placeholder="$t('store.allCategories')">
              <ion-select-option v-for="cat in categories" :key="cat.id" :value="cat.id">
                {{ cat.emoji }} {{ localized(cat.name_zh, cat.name) }}
              </ion-select-option>
            </ion-select>
          </ion-item>

          <ion-item class="form-item">
            <ion-input v-model.number="form.price" :label="$t('store.price')" label-placement="stacked"
              type="number" min="0" step="1" :placeholder="$t('store.price')" required />
          </ion-item>

          <ion-item class="form-item">
            <ion-input v-model.number="form.stock_quantity" :label="$t('store.stockQuantity')" label-placement="stacked"
              type="number" min="0" step="1" :placeholder="$t('store.stockQuantity')" />
          </ion-item>
        </div>

        <!-- Description -->
        <div class="form-card">
          <ion-item class="form-item">
            <ion-textarea v-model="form.description" label="Description" label-placement="stacked"
              :rows="4" placeholder="Product description in English" />
          </ion-item>

          <ion-item class="form-item">
            <ion-textarea v-model="form.description_zh" :label="$t('store.descriptionZh')" label-placement="stacked"
              :rows="4" :placeholder="$t('store.descriptionZh')" />
          </ion-item>
        </div>

        <!-- Images -->
        <div class="form-card">
          <h3 class="card-title">{{ $t('store.images') }}</h3>
          <div class="images-grid">
            <div v-for="(img, i) in form.images" :key="i" class="image-thumb">
              <img :src="img" :alt="`Image ${i + 1}`" />
              <ion-button fill="clear" size="small" class="remove-img" @click="form.images.splice(i, 1)">
                <ion-icon :icon="closeCircleOutline" />
              </ion-button>
            </div>
            <div class="add-image-btn" @click="addImageUrl">
              <ion-icon :icon="addOutline" />
              <span>Add URL</span>
            </div>
          </div>
        </div>

        <!-- Toggles -->
        <div class="form-card">
          <ion-item class="form-item">
            <ion-toggle v-model="form.is_featured" :label="$t('store.isFeatured')" />
          </ion-item>
          <ion-item class="form-item">
            <ion-toggle v-model="form.is_active" :label="$t('store.isActive')" />
          </ion-item>
        </div>

        <!-- Tags -->
        <div class="form-card">
          <ion-item class="form-item">
            <ion-input v-model="tagsInput" :label="$t('store.tags')" label-placement="stacked"
              placeholder="halal, ramadan, snack (comma separated)" />
          </ion-item>
        </div>
      </div>
    </ion-content>

    <ion-footer v-if="!isUnderConstruction">
      <ion-toolbar class="save-footer">
        <ion-button expand="block" color="carrot" class="save-btn" @click="saveProduct" :disabled="submitting">
          <ion-spinner v-if="submitting" name="crescent" slot="start" />
          {{ submitting ? $t('store.saving') : $t('store.saveProduct') }}
        </ion-button>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IonPage, IonHeader, IonContent, IonFooter, IonToolbar, IonButton, IonIcon,
  IonItem, IonInput, IonTextarea, IonSelect, IonSelectOption, IonToggle,
  IonSpinner, toastController, alertController
} from '@ionic/vue'
import { addOutline, closeCircleOutline, constructOutline } from 'ionicons/icons'
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

function localized(zh: string | null | undefined, en: string | null | undefined): string {
  if (locale.value === 'zh') return zh || en || ''
  return en || zh || ''
}

const form = reactive({
  name: '',
  name_zh: '',
  category_id: null as number | null,
  price: 0,
  stock_quantity: 0,
  description: '',
  description_zh: '',
  images: [] as string[],
  is_featured: false,
  is_active: true
})

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
    form.price = data.price || 0
    form.stock_quantity = data.stock_quantity || 0
    form.description = data.description || ''
    form.description_zh = data.description_zh || ''
    form.images = data.images || []
    form.is_featured = data.is_featured || false
    form.is_active = data.is_active ?? true
    tagsInput.value = (data.tags || []).join(', ')
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

async function saveProduct() {
  if (!form.name.trim()) {
    const toast = await toastController.create({
      message: `⚠️ ${t('store.errors.nameRequired')}`,
      duration: 2000,
      color: 'warning'
    })
    toast.present()
    return
  }

  if (!form.price || form.price <= 0) {
    const toast = await toastController.create({
      message: `⚠️ ${t('store.errors.priceRequired')}`,
      duration: 2000,
      color: 'warning'
    })
    toast.present()
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
      name: form.name.trim(),
      name_zh: form.name_zh.trim() || null,
      category_id: form.category_id,
      price: form.price,
      stock_quantity: form.stock_quantity || 0,
      description: form.description.trim() || null,
      description_zh: form.description_zh.trim() || null,
      images: form.images,
      is_featured: form.is_featured,
      is_active: form.is_active,
      tags: tags.length > 0 ? tags : null
    }

    if (isEdit.value) {
      const { error } = await supabase
        .from('store_products')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', route.params.id)

      if (error) throw error
    } else {
      const { error } = await supabase
        .from('store_products')
        .insert(payload)

      if (error) throw error
    }

    const toast = await toastController.create({
      message: `✅ ${t('store.saveSuccess')}`,
      duration: 2000,
      color: 'success'
    })
    toast.present()
    router.back()
  } catch (err: any) {
    const toast = await toastController.create({
      message: `❌ ${err.message || t('store.saveFailed')}`,
      duration: 3000,
      color: 'danger'
    })
    toast.present()
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  await fetchCategories()
  await fetchProduct()
})
</script>

<style scoped>

.form-wrapper {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 12px 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.card-title {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0 0 10px;
  color: var(--ion-text-color);
}

.form-item {
  --padding-start: 0;
  --inner-padding-end: 0;
  --background: transparent;
}

/* Images */
.images-grid {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.image-thumb {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 12px;
  overflow: hidden;
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
}

.add-image-btn {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  border: 2px dashed var(--ion-color-medium);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  gap: 4px;
  color: var(--ion-color-medium);
  font-size: 0.7rem;
  font-weight: 500;
  transition: all 0.2s;
}

.add-image-btn ion-icon {
  font-size: 22px;
}

.add-image-btn:hover {
  border-color: var(--ion-color-carrot);
  color: var(--ion-color-carrot);
}

/* Footer */
.save-footer {
  --background: var(--ion-background-color);
  --border-width: 0;
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.06);
}

.save-btn {
  margin: 8px 16px;
  --border-radius: 14px;
  font-weight: 600;
  font-size: 1rem;
  height: 50px;
}

/* Dark mode */
.ion-palette-dark .form-card {
  background: var(--ion-color-step-50, #1e1e1e);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
</style>
