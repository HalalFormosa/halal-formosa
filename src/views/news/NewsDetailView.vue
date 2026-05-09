<template>
  <ion-page>
    <ion-header class="ion-no-border immersive-header" :class="{ 'is-scrolled': isScrolled, 'has-ads': isNative && showAds }">
      <div v-if="isNative && showAds" id="ad-space-news-detail" :style="{ height: '65px', paddingTop: 'var(--ion-safe-area-top, 0)' }"></div>
      <app-header 
        :title="newsItem?.title || ''" 
        show-back 
        back-route="/news" 
        icon="none" 
        :transparent="!isScrolled"
        :contrast="!isScrolled"
      />
    </ion-header>



    <ion-content :scroll-events="true" @ionScroll="handleScroll" fullscreen="true">
      <div v-if="loading" class="ion-text-center">
      </div>

      <div v-else-if="newsItem">
        <img
            v-if="newsItem.header_image"
            :src="newsItem.header_image"
            class="news-header-img"
            alt="header-image"
        />

        <div class="details-container">
          <div class="ion-padding" style="padding-top: 20px;">
            <h1>{{ newsItem.title }}</h1>
            <p style="margin: 4px 0 8px 0; font-size: 13px; color: var(--ion-color-medium);">
              <template v-if="authorProfile?.public_profile">
                {{ $t('home.addedBy', { author: authorProfile.display_name }) }} - {{ fromNowToTaipei(newsItem.created_at) }}
              </template>
              <template v-else>
                {{ $t('home.added') }} {{ fromNowToTaipei(newsItem.created_at) }}
              </template>
            </p>
            <div class="article-content" v-html="newsItem.content"></div>
            <p
                class="ion-text-end ion-margin-top"
                style="color: var(--ion-color-shade); font-size: 0.8rem;"
            >
              <template v-if="authorProfile?.public_profile">
                {{ $t('home.addedBy', { author: authorProfile.display_name }) }} •
              </template>
              <template v-else>
                {{ $t('home.added') }} •
              </template>
              {{ new Date(newsItem.created_at).toLocaleDateString() }}
            </p>
          </div>
        </div>
      </div>

      <p v-else class="ion-text-center ion-margin-top">
        ❌ News not found.
      </p>

      <ion-fab
          v-if="newsItem && user?.id === newsItem.author_id"
          vertical="bottom"
          horizontal="end"
          slot="fixed"
      >
        <ion-fab-button color="carrot" :router-link="`/news/edit/${newsItem.id}`">
          <ion-icon :icon="createOutline" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {ref, onMounted, nextTick, computed} from 'vue';
import {
  IonPage,
  IonHeader,
  IonContent,
  IonFab, IonFabButton, IonIcon,
  onIonViewDidEnter
} from '@ionic/vue';
import { useRoute } from 'vue-router';
import { supabase } from '@/plugins/supabaseClient';
import type { User } from '@supabase/supabase-js'
import relativeTime from 'dayjs/plugin/relativeTime'
import {createOutline } from "ionicons/icons";
import { isDonor } from "@/composables/useSubscriptionStatus";

const user = ref<User | null>(null)

const route = useRoute();
const newsItem = ref<any>(null);
const authorProfile = ref<{ display_name: string | null; public_profile: boolean } | null>(null);
const loading = ref(true);
const isNative = ref(Capacitor.isNativePlatform())

const isScrolled = ref(false)
const handleScroll = (ev: any) => {
  isScrolled.value = ev.detail.scrollTop > 80
}

const showAds = computed(() => !isDonor.value)

onIonViewDidEnter(() => {
  (window as any).scheduleBannerUpdate?.()
})

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import {Capacitor} from "@capacitor/core";
import AppHeader from "@/components/AppHeader.vue";

// Extend dayjs
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(relativeTime)

function fromNowToTaipei(dateString?: string) {
  if (!dateString) return ''
  return dayjs.utc(dateString).tz('Asia/Taipei').fromNow()
}

onMounted(async () => {
  const id = route.params.id;

  const { data: userData } = await supabase.auth.getUser()
  user.value = userData.user;

  const { data, error } = await supabase
      .from('news')
      .select('*')
      .eq('id', id)
      .single();

  if (!error && data) {
    newsItem.value = data;

    // 🔹 Fetch author details separately
    if (data.author_id) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('display_name, public_profile')
        .eq('id', data.author_id)
        .maybeSingle()
      if (profile) {
        authorProfile.value = profile
      }
    }
  }

  loading.value = false;
  await nextTick()
  setTimeout(() => (window as any).scheduleBannerUpdate?.(), 50)
});
</script>

<style>
.article-content {
  line-height: 1.7;
  font-size: 1rem;
  color: var(--ion-color-dark);
}

.article-content h2 {
  margin-top: 1.5rem;
  font-size: 1.3rem;
  font-weight: bold;
}

.article-content p {
  margin-bottom: 1rem;
}

.news-header-img {
  width: 100%;
  height: 300px;
  object-fit: cover;
  display: block;
}
</style>
