<template>
  <ion-page>
    <ion-header>
      <app-header
          :title="$t('profile.admin.users')"
          :icon="peopleOutline"
          :showBack="true"
      />
    </ion-header>

    <ion-content class="ion-padding">

      <!-- Pull to refresh -->
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh">
        <ion-refresher-content />
      </ion-refresher>

      <ion-list>
        <ion-item
            v-for="user in users"
            :key="user.user_id"
            button
            detail
            :class="{ inactive: user.total_activities === 0 }"
            @click="openUser(user)"
        >

        <!-- Avatar -->
          <ion-avatar slot="start">
            <img
                v-if="user.avatar_url"
                :src="user.avatar_url"
                :alt="$t('admin.userAvatar')"
            />
            <div v-else class="avatar-placeholder">
              👤
            </div>
          </ion-avatar>

          <!-- Info -->
          <ion-label>
            <h2 class="user-name">
              {{ user.display_name || user.email || $t('admin.unknownUser') }}
            </h2>

            <p class="user-email">
              {{ user.email }}
            </p>

            <div class="user-meta">
              <ion-badge :color="user.total_activities > 1000 ? 'warning' : 'primary'">
              {{ $t('admin.activitiesCount', { count: user.total_activities }) }}
              </ion-badge>

              <span class="last-active">
                {{ $t('admin.lastActive', { time: fromNow(user.last_active) }) }}
              </span>
            </div>
          </ion-label>

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
import { peopleOutline } from "ionicons/icons"
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
.user-name {
  font-weight: 600;
  margin: 0 0 4px 0;
}

.user-email {
  font-size: 0.9rem;
  color: var(--ion-color-medium);
  margin: 0 0 6px 0;
}

.user-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.last-active {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

.avatar-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--ion-color-light);
  display: flex;
  align-items: center;
  justify-content: center;
}

.inactive {
  opacity: 0.6;
}
</style>
