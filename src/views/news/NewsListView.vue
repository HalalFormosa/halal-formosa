<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('news.title')" show-back icon='none' back-route="/home"/>
      <ion-toolbar style="padding: 8px;">
        <div style="display: flex; align-items: center; width: 100%; gap: 8px;">
          <ion-searchbar
              :placeholder="$t('news.placeholder')"
              :debounce="800"
              v-model="searchQuery"
              @ionInput="handleSearch"
              class="rounded"
              style="flex: 1;"
          ></ion-searchbar>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-refresher style="margin-top: 15px;" slot="fixed" @ionRefresh="refreshNews">
        <ion-refresher-content
            :pulling-icon="chevronDownCircleOutline"
            :pullingText="$t('search.pullToRefresh')"
            refreshingSpinner="circles"
        >
        </ion-refresher-content>
      </ion-refresher>

      <!-- ✅ Skeleton loader -->
      <template v-if="loadingNews">
        <ion-card v-for="n in 5" :key="'skeleton-' + n">
          <ion-skeleton-text
              animated
              style="width:100%; height:140px; border-radius:8px; margin-bottom:8px;"
          />
          <ion-card-header>
            <ion-skeleton-text
                animated
                style="width:70%; height:18px; margin-bottom:6px;"
            />
            <ion-skeleton-text
                animated
                style="width:40%; height:14px;"
            />
          </ion-card-header>
          <ion-card-content>
            <ion-skeleton-text
                animated
                style="width:100%; height:12px; margin-bottom:4px;"
            />
            <ion-skeleton-text
                animated
                style="width:80%; height:12px;"
            />
          </ion-card-content>
        </ion-card>
      </template>

      <!-- ✅ Actual news after loading -->
      <template v-else>
        <div
            v-for="(item, index) in filteredNews"
            :key="index"
            @click="openNews(item)"
            class="news-card"
        >
          <ion-card>
            <img :src="item.thumbnail" alt="news-thumbnail" class="news-thumbnail" />

            <ion-card-header>
              <ion-card-title>{{ item.title }}</ion-card-title>
              <ion-card-subtitle>{{ fromNowToTaipei(item.created_at) }}</ion-card-subtitle>
            </ion-card-header>

            <ion-card-content>
              <p class="news-summary">{{ item.summary }}</p>
            </ion-card-content>
          </ion-card>
        </div>
      </template>

      <ion-infinite-scroll ref="infiniteScroll" @ionInfinite="loadMore" threshold="100px">
        <ion-infinite-scroll-content
            loading-spinner="bubbles"
            :loading-text="$t('news.loadingMoreNews')">
        </ion-infinite-scroll-content>
      </ion-infinite-scroll>

      <!-- ✅ FAB for Admin Only -->
      <ion-fab v-if="isAdmin || isContributor" vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button color="carrot" @click="goToAddNews">
          <ion-icon :icon="addOutline" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage, IonHeader, IonToolbar, IonSearchbar, IonContent, IonRefresherContent, IonRefresher, IonInfiniteScroll,
  IonInfiniteScrollContent, IonCard, IonCardTitle, IonCardContent, IonCardSubtitle, IonCardHeader, IonIcon, IonFabButton, IonFab, IonSkeletonText
} from '@ionic/vue';
import { supabase } from '@/plugins/supabaseClient';
import {addOutline, chevronDownCircleOutline} from 'ionicons/icons';


interface NewsItem {
  id: number;
  title: string;
  summary: string;
  thumbnail: string;
  created_at: string;
}


const router = useRouter();
const loadingNews = ref(true)

const allNews = ref<NewsItem[]>([]);
const displayedNews = ref<NewsItem[]>([]);
const searchQuery = ref('');
const allLoaded = ref(false);
const pageSize = 5;
let currentOffset = 0;

import relativeTime from 'dayjs/plugin/relativeTime'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import AppHeader from "@/components/AppHeader.vue";

// 🟢 import role state from userProfile composable
import { isAdmin, isContributor } from '@/composables/userProfile'

// Extend dayjs
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(relativeTime)

function fromNowToTaipei(dateString?: string) {
  if (!dateString) return ''
  return dayjs.utc(dateString).tz('Asia/Taipei').fromNow()
}


onMounted(async () => {
  await loadInitialNews()
})

async function loadInitialNews() {
  loadingNews.value = true
  currentOffset = 0;
  allNews.value = [];
  displayedNews.value = [];
  allLoaded.value = false;
  await fetchNewsBatch();
  loadingNews.value = false
}

async function fetchNewsBatch() {
  const { data, error } = await supabase
      .from('news')
      .select('id, title, header_image, content, created_at')
      .order('created_at', { ascending: false })
      .range(currentOffset, currentOffset + pageSize - 1);

  if (!error && data) {
    const mappedData = data.map((item: any) => ({
      id: item.id,
      title: truncateText(item.title, 12),
      summary: generateSummary(item.content, item.title, 20),
      thumbnail: item.header_image || 'https://placehold.co/600x400',
      created_at: item.created_at
    }));

    allNews.value.push(...mappedData);
    displayedNews.value = allNews.value;
    currentOffset += pageSize;

    if (mappedData.length < pageSize) {
      allLoaded.value = true;
    }
  }
}

async function loadMore(event: any) {
  await fetchNewsBatch();
  event.target.complete();
}

async function refreshNews(event: any) {
  await loadInitialNews();
  event.detail.complete();
}

function truncateText(text: string, wordLimit = 10) {
  const words = text.trim().split(/\s+/);
  return words.slice(0, wordLimit).join(' ') + (words.length > wordLimit ? '…' : '');
}

function generateSummary(content: string, title: string, wordLimit = 20) {
  const text = content.replace(/<[^>]+>/g, '').trim();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const filtered = lines.filter(line => !line.includes(title)).join(' ');
  const allWords = filtered.split(/\s+/);
  return allWords.slice(0, wordLimit).join(' ') + (allWords.length > wordLimit ? '…' : '');
}

function handleSearch() {
  // Computed handles filtering
}

const filteredNews = computed(() => {
  if (!searchQuery.value) return displayedNews.value;
  return displayedNews.value.filter(item =>
      item.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchQuery.value.toLowerCase())
  );
});

function openNews(item: NewsItem) {
  router.push(`/news/${item.id}`);
}

function goToAddNews() {
  router.push('/news/add'); // ✅ define route to Write News page
}
</script>

<style scoped>
.news-card ion-card {
  margin: 6px 0;              /* 🔹 reduce gap between cards */
  padding: 8px;               /* 🔹 smaller padding inside */
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
}

.news-thumbnail {
  width: 100%;
  height: 140px;              /* 🔹 smaller image height */
  object-fit: cover;
  border-radius: 6px;
}

ion-card-title {
  font-size: 16px;            /* 🔹 smaller font for compact look */
  font-weight: 600;
}

ion-card-subtitle {
  font-size: 12px;
  color: var(--ion-color-medium);
}

.news-summary {
  font-size: 13px;
  line-height: 1.3;
  color: var(--ion-background-color-step-800);
}


ion-searchbar.rounded {
  --border-radius: 8px;
  --box-shadow: 0 1px 3px rgba(41, 40, 40, 0.1);
}
</style>
