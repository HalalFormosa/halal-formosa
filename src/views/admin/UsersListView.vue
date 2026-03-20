<template>
  <ion-page>
    <ion-header>
      <app-header
          :title="$t('profile.admin.users')"
          :icon="peopleOutline"
          :showBack="true"
          :contrast="true"
      />
    </ion-header>

    <ion-content class="ion-padding content-background">

      <!-- Pull to refresh -->
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh">
        <ion-refresher-content />
      </ion-refresher>

      <ion-list lines="none" class="users-list">
        <ion-item
            v-for="user in users"
            :key="user.user_id"
            button
            class="user-item"
            :class="{ 'high-activity': user.total_activities > 1000 }"
            @click="openUser(user)"
        >
          <!-- User Profile -->
          <div class="user-row">
            <ion-avatar class="user-avatar">
              <img v-if="user.avatar_url" :src="user.avatar_url" />
              <div v-else class="avatar-placeholder">
                {{ (user.display_name || user.email || '?').charAt(0).toUpperCase() }}
              </div>
            </ion-avatar>
            
            <div class="user-info-main">
              <div class="name-row">
                <h2 class="display-name">{{ user.display_name || user.email || $t('admin.unknownUser') }}</h2>
                <div 
                  class="activity-badge"
                  :class="user.total_activities > 1000 ? 'badge-hot' : 'badge-normal'"
                >
                  {{ $t('admin.activitiesCount', { count: user.total_activities }) }}
                </div>
              </div>
              
              <p class="email-text">{{ user.email }}</p>
              
              <div class="metadata-row">
                <div class="last-active">
                  <ion-icon :icon="timeOutline" class="meta-icon" />
                  <span>{{ $t('admin.lastActive', { time: fromNow(user.last_active) }) }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <ion-icon slot="end" :icon="chevronForwardOutline" class="item-chevron" />
        </ion-item>
      </ion-list>

      <!-- Infinite scroll -->
      <ion-infinite-scroll
          threshold="100px"
          @ionInfinite="loadMore"
          :disabled="noMoreData"
      >
        <ion-infinite-scroll-content
            loading-spinner="bubbles"
            :loading-text="$t('admin.loadingUsers')"
        />
      </ion-infinite-scroll>

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
import { useRouter } from "vue-router"
import { supabase } from "@/plugins/supabaseClient"

import {
  IonPage,
  IonHeader,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonAvatar,
  IonBadge,
  IonRefresher,
  IonRefresherContent,
  IonInfiniteScroll,
  IonInfiniteScrollContent
} from "@ionic/vue"

import AppHeader from "@/components/AppHeader.vue"
import { peopleOutline, timeOutline, chevronForwardOutline } from "ionicons/icons"
import { useI18n } from 'vue-i18n'

import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
dayjs.extend(relativeTime)

const router = useRouter()
const { t } = useI18n()

const users = ref<any[]>([])
const limit = 15
const loadingMore = ref(false)
const noMoreData = ref(false)

/** Relative time */
function fromNow(date?: string) {
  if (!date) return t('admin.neverActive')
  return dayjs(date).fromNow()
}

/** Navigate to user activity */
function openUser(user: any) {
  router.push(`/admin/users/${user.user_id}`)
}

/** Pull-to-refresh */
async function handleRefresh(event: any) {
  await fetchUsers(true)
  event.target.complete()
}

/** Fetch users (admin_user_list view) */
async function fetchUsers(isRefresh = false) {
  if (isRefresh) {
    users.value = []
    noMoreData.value = false
  }

  const offset = users.value.length

  const { data, error } = await supabase.rpc(
      'get_admin_user_list',
      {
        p_limit: limit,
        p_offset: offset
      }
  )

  if (error) {
    console.error("❌ Failed to load users:", error)
    return
  }

  if (!data || data.length < limit) {
    noMoreData.value = true
  }

  users.value.push(...data)
}

/** Infinite scroll */
async function loadMore(event: any) {
  if (loadingMore.value || noMoreData.value) {
    event.target.complete()
    return
  }

  loadingMore.value = true
  await fetchUsers()
  loadingMore.value = false
  event.target.complete()
}

onMounted(() => fetchUsers(true))
</script>

<style scoped>
.content-background {
  --background: var(--ion-background-color);
}

.users-list {
  background: transparent;
  padding: 0;
}

.user-item {
  --padding-start: 12px;
  --padding-end: 12px;
  --inner-padding-end: 0;
  --background: var(--ion-background-color);
  margin-bottom: 12px;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  border: 1px solid var(--ion-color-step-100);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.user-item:active {
  transform: scale(0.98);
}

.user-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 0;
  width: 100%;
}

.user-avatar {
  width: 48px;
  height: 48px;
  border: 2px solid var(--ion-color-step-200);
}

.high-activity .user-avatar {
  border-color: var(--ion-color-carrot-tint, #ffb380);
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ion-color-step-150);
  color: var(--ion-color-step-600);
  font-weight: 700;
  font-size: 1.25rem;
}

.user-info-main {
  flex: 1;
  min-width: 0;
}

.name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}

.display-name {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--ion-text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.email-text {
  margin: 0 0 8px 0;
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.activity-badge {
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 800;
  white-space: nowrap;
}

.badge-normal {
  background: rgba(var(--ion-color-primary-rgb), 0.12);
  color: var(--ion-color-primary);
  border: 1px solid rgba(var(--ion-color-primary-rgb), 0.3);
}

.badge-hot {
  background: rgba(var(--ion-color-carrot-rgb), 0.15);
  color: var(--ion-color-carrot);
  border: 1px solid rgba(var(--ion-color-carrot-rgb), 0.4);
}

.metadata-row {
  display: flex;
  align-items: center;
}

.last-active {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  font-weight: 500;
}

.meta-icon {
  font-size: 14px;
}

.item-chevron {
  color: var(--ion-color-step-300);
  font-size: 18px;
  margin-left: 8px;
}

/* Dark Mode Adjustments */
.ion-palette-dark .user-item {
  background: var(--ion-color-step-50);
  border-color: var(--ion-color-step-150);
}

.ion-palette-dark .activity-badge.badge-normal {
  background: rgba(255, 255, 255, 0.08);
  color: var(--ion-color-step-600);
  border-color: var(--ion-color-step-200);
}

.ion-palette-dark .badge-hot {
  background: rgba(var(--ion-color-carrot-rgb), 0.2);
  border-color: rgba(var(--ion-color-carrot-rgb), 0.4);
}
</style>
