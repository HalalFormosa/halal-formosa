<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('profile.myProducts.title')" show-back back-route="/profile" :icon="icons.bagHandleOutline" />
      <ion-toolbar class="search-row-toolbar">
        <div class="search-container">
          <ion-searchbar
            :placeholder="$t('search.placeholder')"
            :debounce="500"
            @ionInput="handleSearch($event)"
            :value="searchQuery"
            class="compact-searchbar"
            :animated="true"
          />
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div v-if="loading && products.length === 0" class="ion-text-center ion-margin-top">
        <ion-spinner />
      </div>

      <template v-else>
        <div v-if="products.length === 0" class="empty-state">
          <ion-icon :icon="icons.bagHandleOutline" class="empty-icon" />
          <h3>{{ $t('profile.myProducts.noProducts') }}</h3>
          <ion-button color="carrot" @click="$router.push('/add')">
            {{ $t('main.add') }}
          </ion-button>
        </div>

        <template v-else>
          <ion-list lines="none" class="contributions-list">
            <ion-item 
              v-for="product in products" 
              :key="product.id" 
              button 
              @click="goToItem(product.barcode)"
              class="contribution-item"
            >
              <ion-thumbnail slot="start">
                <img :src="product.photo_front_url || 'https://via.placeholder.com/80.webp'" alt="Product Image" />
              </ion-thumbnail>
              <ion-label>
                <h3 class="product-name">{{ product.name }}</h3>
                <div class="status-row">
                  <ion-chip 
                    size="small" 
                    :class="getStatusClass(product.status)"
                  >
                    {{ product.status || 'Unknown' }}
                  </ion-chip>
                  
                  <ion-badge 
                    :color="product.approved ? 'success' : 'warning'"
                    class="approval-badge"
                  >
                    {{ product.approved ? $t('master.published') : 'Pending' }}
                  </ion-badge>
                </div>
                <p class="date-text">{{ formatDate(product.created_at) }}</p>
              </ion-label>
            </ion-item>
          </ion-list>

          <ion-infinite-scroll 
            @ionInfinite="loadMore" 
            :disabled="infiniteDisabled"
          >
            <ion-infinite-scroll-content loading-spinner="bubbles" />
          </ion-infinite-scroll>

          <!-- FAB Add Button -->
          <ion-fab vertical="bottom" horizontal="end" slot="fixed">
            <ion-fab-button color="carrot" @click="router.push('/add')">
              <ion-icon :icon="icons.addOutline" />
            </ion-fab-button>
          </ion-fab>
        </template>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '@/plugins/supabaseClient';
import { 
  IonPage, IonHeader, IonContent, IonSpinner, IonList, IonItem, 
  IonThumbnail, IonLabel, IonChip, IonBadge, IonIcon, IonButton,
  IonInfiniteScroll, IonInfiniteScrollContent, IonToolbar, IonSearchbar,
  IonFab, IonFabButton
} from '@ionic/vue';
import { bagHandleOutline, checkmarkCircleOutline, timeOutline, searchOutline, closeCircle, addOutline } from 'ionicons/icons';
import AppHeader from '@/components/AppHeader.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const router = useRouter();
const loading = ref(true);
const products = ref<any[]>([]);
const infiniteDisabled = ref(false);
const pageSize = 15;
const currentPage = ref(0);
const searchQuery = ref('');

const icons = {
  bagHandleOutline,
  checkmarkCircleOutline,
  timeOutline,
  addOutline
};

async function loadMyProducts(reset = false) {
  if (reset) {
    currentPage.value = 0;
    products.value = [];
    infiniteDisabled.value = false;
  }

  loading.value = true;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    loading.value = false;
    return;
  }

  const start = currentPage.value * pageSize;
  const end = start + pageSize - 1;

  let query = supabase
    .from('products')
    .select('id, name, status, photo_front_url, approved, barcode, created_at')
    .eq('added_by', user.id);

  if (searchQuery.value) {
    query = query.ilike('name', `%${searchQuery.value}%`);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(start, end);

  if (!error && data) {
    products.value.push(...data);
    if (data.length < pageSize) {
      infiniteDisabled.value = true;
    }
  } else {
    infiniteDisabled.value = true;
  }
  
  loading.value = false;
}

async function loadMore(ev: any) {
  currentPage.value++;
  await loadMyProducts();
  ev.target.complete();
}

function handleSearch(ev: any) {
  searchQuery.value = ev.target.value;
  loadMyProducts(true);
}

function goToItem(barcode: string) {
  if (!barcode) return;
  router.push(`/item/${barcode}`);
}

function getStatusClass(status: string) {
  switch (status) {
    case 'Halal': return 'chip-success';
    case 'Muslim-friendly': return 'chip-primary';
    case 'Syubhah': return 'chip-warning';
    case 'Haram': return 'chip-danger';
    default: return 'chip-medium';
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

onMounted(() => {
  loadMyProducts(true);
});
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  text-align: center;
  color: var(--ion-color-medium);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.contributions-list {
  background: transparent;
}

.contribution-item {
  margin-bottom: 12px;
  --border-radius: 16px;
  --background: var(--ion-color-step-50);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.product-name {
  font-weight: 700;
  font-size: 1.1rem;
  margin-bottom: 8px;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.approval-badge {
  font-size: 0.7rem;
  padding: 4px 8px;
  border-radius: 8px;
  text-transform: uppercase;
}

.date-text {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

ion-thumbnail {
  --size: 80px;
  --border-radius: 12px;
}

/* Status Chips */
.chip-success { --background: rgba(var(--ion-color-success-rgb), 0.1); --color: var(--ion-color-success); }
.chip-primary { --background: rgba(var(--ion-color-primary-rgb), 0.1); --color: var(--ion-color-primary); }
.chip-warning { --background: rgba(var(--ion-color-warning-rgb), 0.1); --color: var(--ion-color-warning); }
.chip-danger { --background: rgba(var(--ion-color-danger-rgb), 0.1); --color: var(--ion-color-danger); }
.chip-medium { --background: rgba(var(--ion-color-medium-rgb), 0.1); --color: var(--ion-color-medium); }

.compact-searchbar {
  --padding-top: 0;
  --padding-bottom: 0;
  padding: 0;
}

.search-row-toolbar {
  --min-height: auto;
  --background: var(--ion-background-color);
}

.search-container {
  padding: 0 16px 12px;
}
</style>
