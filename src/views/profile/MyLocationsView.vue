<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('profile.myLocations.title')" show-back back-route="/profile" :icon="icons.locationOutline" />
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
      <div v-if="loading && locations.length === 0" class="ion-text-center ion-margin-top">
        <ion-spinner />
      </div>

      <template v-else>
        <div v-if="locations.length === 0" class="empty-state">
          <ion-icon :icon="icons.locationOutline" class="empty-icon" />
          <h3>{{ $t('profile.myLocations.noLocations') }}</h3>
          <ion-button color="carrot" @click="$router.push('/explore/add')">
            {{ $t('main.add') }}
          </ion-button>
        </div>

        <template v-else>
          <ion-list lines="none" class="contributions-list">
            <ion-item 
              v-for="location in locations" 
              :key="location.id" 
              button 
              @click="goToLocation(location.id)"
              class="contribution-item"
            >
              <ion-thumbnail slot="start">
                <img :src="location.image || 'https://via.placeholder.com/80.webp'" alt="Location Image" />
              </ion-thumbnail>
              <ion-label>
                <h3 class="location-name">{{ location.name }}</h3>
                <div class="status-row">
                  <ion-chip v-if="location.location_types?.name" size="small" class="chip-primary">
                    {{ location.location_types.name }}
                  </ion-chip>
                  
                  <ion-badge 
                    :color="location.approved ? 'success' : 'warning'"
                    class="approval-badge"
                  >
                    {{ location.approved ? $t('master.published') : 'Pending' }}
                  </ion-badge>
                </div>
                <p class="address-text">{{ location.address }}</p>
                <p class="date-text">{{ formatDate(location.created_at) }}</p>
              </ion-label>
            </ion-item>
          </ion-list>

          <ion-infinite-scroll 
            @ionInfinite="loadMore" 
            :disabled="infiniteDisabled"
          >
            <ion-infinite-scroll-content loading-spinner="bubbles"></ion-infinite-scroll-content>
          </ion-infinite-scroll>
        </template>
      </template>

      <!-- FAB Add Button -->
      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button color="carrot" @click="router.push('/explore/add')">
          <ion-icon :icon="icons.addOutline" />
        </ion-fab-button>
      </ion-fab>
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
import { locationOutline, checkmarkCircleOutline, timeOutline, addOutline } from 'ionicons/icons';
import AppHeader from '@/components/AppHeader.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const router = useRouter();
const loading = ref(true);
const locations = ref<any[]>([]);
const infiniteDisabled = ref(false);
const pageSize = 15;
const currentPage = ref(0);
const searchQuery = ref('');

const icons = {
  locationOutline,
  checkmarkCircleOutline,
  timeOutline,
  addOutline
};

async function loadMyLocations(reset = false) {
  if (reset) {
    currentPage.value = 0;
    locations.value = [];
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
    .from('locations')
    .select('id, name, location_types(name), image, approved, address, created_at')
    .eq('created_by', user.id);

  if (searchQuery.value) {
    query = query.ilike('name', `%${searchQuery.value}%`);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(start, end);

  if (!error && data) {
    locations.value.push(...data);
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
  await loadMyLocations();
  ev.target.complete();
}

function handleSearch(ev: any) {
  searchQuery.value = ev.target.value;
  loadMyLocations(true);
}

function goToLocation(id: string) {
  if (!id) return;
  router.push(`/place/${id}`);
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
  loadMyLocations(true);
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

.location-name {
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

.address-text {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.date-text {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

ion-thumbnail {
  --size: 80px;
  --border-radius: 12px;
}

.chip-primary { --background: rgba(var(--ion-color-primary-rgb), 0.1); --color: var(--ion-color-primary); }

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
