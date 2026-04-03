<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/profile" />
        </ion-buttons>
        <ion-title>{{ $t('store.admin.products') }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="$router.push('/admin/store/add-product')">
            <ion-icon :icon="addOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div v-if="loading" class="ion-padding ion-text-center">
        <ion-spinner />
      </div>

      <div v-else-if="products.length === 0" class="empty-state">
        <ion-icon :icon="bagHandleOutline" class="empty-icon" />
        <h3>{{ $t('store.noProducts') }}</h3>
        <ion-button @click="$router.push('/admin/store/add-product')">
          {{ $t('store.adminAddProduct') }}
        </ion-button>
      </div>

      <ion-list v-else>
        <ion-item-sliding v-for="product in products" :key="product.id">
          <ion-item class="product-list-item">
            <ion-thumbnail slot="start" class="product-thumb">
              <img :src="product.images?.[0] || '/favicon-32x32.png'" />
            </ion-thumbnail>
            <ion-label>
              <h2 class="product-name">{{ localized(product.name_zh, product.name) }}</h2>
              <p class="product-price">{{ $t('store.twd') }}{{ product.price }} • {{ product.stock_quantity }} {{ $t('store.inStockShort') }}</p>
              <div class="product-tags">
                <ion-badge v-if="product.is_featured" color="warning" class="featured-badge">
                  {{ $t('store.isFeatured') }}
                </ion-badge>
                <ion-badge v-if="!product.is_active" color="medium">
                  {{ $t('master.inactive') }}
                </ion-badge>
              </div>
            </ion-label>
            <ion-buttons slot="end">
                <ion-button @click="toggleFeatured(product)">
                    <ion-icon :icon="product.is_featured ? star : starOutline" :color="product.is_featured ? 'warning' : 'medium'" />
                </ion-button>
                <ion-button @click="$router.push(`/admin/store/edit-product/${product.id}`)">
                    <ion-icon :icon="createOutline" color="primary" />
                </ion-button>
            </ion-buttons>
          </ion-item>

          <ion-item-options side="end">
            <ion-item-option color="danger" @click="confirmDelete(product)">
              <ion-icon slot="icon-only" :icon="trashOutline" />
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle,
  IonContent, IonSpinner, IonIcon, IonList, IonItem, IonThumbnail,
  IonLabel, IonBadge, IonButton, IonItemSliding, IonItemOptions,
  IonItemOption, alertController, toastController
} from '@ionic/vue'
import {
  addOutline, bagHandleOutline, createOutline, trashOutline, star, starOutline
} from 'ionicons/icons'
import { supabase } from '@/plugins/supabaseClient'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()
const user = ref<any>(null)

const products = ref<any[]>([])
const loading = ref(true)

function localized(zh: string | null | undefined, en: string | null | undefined): string {
  return locale.value === 'zh' ? (zh || en || '') : (en || zh || '')
}

async function fetchProducts() {
  const { data: authData } = await supabase.auth.getUser()
  user.value = authData.user
  if (!user.value) return
  
  loading.value = true
  
  // Get store_id first
  const { data: store } = await supabase
    .from('merchant_stores')
    .select('id')
    .eq('user_id', user.value.id)
    .maybeSingle()

  if (store) {
    const { data } = await supabase
      .from('store_products')
      .select('*')
      .eq('store_id', store.id)
      .order('created_at', { ascending: false })
    
    products.value = data || []
  }
  loading.value = false
}

async function toggleFeatured(product: any) {
  const newValue = !product.is_featured
  const { error } = await supabase
    .from('store_products')
    .update({ is_featured: newValue })
    .eq('id', product.id)

  if (!error) {
    product.is_featured = newValue
  }
}

async function confirmDelete(product: any) {
  const alert = await alertController.create({
    header: t('common.confirm'),
    message: t('store.deleteConfirm'),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('common.delete'),
        role: 'destructive',
        handler: () => deleteProduct(product)
      }
    ]
  })
  await alert.present()
}

async function deleteProduct(product: any) {
  const { error } = await supabase
    .from('store_products')
    .delete()
    .eq('id', product.id)

  if (!error) {
    products.value = products.value.filter(p => p.id !== product.id)
    const toast = await toastController.create({
      message: t('store.deleteSuccess'),
      duration: 2000,
      color: 'success'
    })
    await toast.present()
  }
}

onMounted(fetchProducts)
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--ion-color-medium);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 20px;
  opacity: 0.3;
}

.product-thumb {
  --border-radius: 8px;
  width: 56px;
  height: 56px;
}

.product-name {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 4px;
}

.product-price {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  margin-bottom: 6px;
}

.product-tags {
  display: flex;
  gap: 6px;
}

.featured-badge {
  --padding-start: 6px;
  --padding-end: 6px;
  font-size: 0.7rem;
}
</style>
