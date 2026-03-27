<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('store.chat.title')" :showBack="true" icon="none" />
    </ion-header>

    <ion-content :fullscreen="true">
      <div v-if="isUnderConstruction" class="under-construction-overlay">
        <div class="construction-card">
          <ion-icon :icon="constructOutline" class="construction-icon" />
          <h2>{{ $t('common.underConstruction') || 'Under Construction' }}</h2>
          <p>The messaging feature is currently being tuned. See you soon!</p>
        </div>

        <!-- Skeleton -->
        <div class="conv-list">
          <div v-for="n in 4" :key="n" class="conv-card skeleton-card">
            <ion-skeleton-text animated style="width: 44px; height: 44px; border-radius: 50%;" />
            <div class="conv-body">
              <ion-skeleton-text animated style="width: 60%; height: 14px;" />
              <ion-skeleton-text animated style="width: 80%; height: 12px; margin-top: 6px;" />
            </div>
          </div>
        </div>
      </div>

      <template v-else>
        <ion-refresher slot="fixed" @ionRefresh="doRefresh($event)">
          <ion-refresher-content />
        </ion-refresher>

      <!-- Conversations list -->
      <div class="conv-list" v-if="!loading && conversations.length > 0">
        <div
          v-for="conv in conversations"
          :key="conv.id"
          class="conv-card"
          @click="openChat(conv.id)"
        >
          <div class="conv-avatar">
            <ion-icon :icon="personCircleOutline" />
          </div>
          <div class="conv-body">
            <div class="conv-top">
              <span class="conv-name">{{ $t('store.title') }}</span>
              <span class="conv-time">{{ formatTime(conv.last_message_at) }}</span>
            </div>
            <div class="conv-bottom">
              <p class="conv-preview">{{ conv.last_message || $t('store.chat.noMessages') }}</p>
              <ion-badge v-if="conv.buyer_unread > 0" color="danger" class="unread-badge">
                {{ conv.buyer_unread }}
              </ion-badge>
            </div>
            <div v-if="conv.store_products" class="conv-product-tag">
              📦 {{ localized(conv.store_products.name_zh, conv.store_products.name) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Skeleton -->
      <div v-if="loading" class="conv-list">
        <div v-for="n in 4" :key="n" class="conv-card skeleton-card">
          <ion-skeleton-text animated style="width: 44px; height: 44px; border-radius: 50%;" />
          <div class="conv-body">
            <ion-skeleton-text animated style="width: 60%; height: 14px;" />
            <ion-skeleton-text animated style="width: 80%; height: 12px; margin-top: 6px;" />
          </div>
        </div>
      </div>

        <!-- Empty -->
        <div v-if="!loading && conversations.length === 0" class="empty-state">
          <ion-icon :icon="chatbubblesOutline" class="empty-icon" />
          <p>{{ $t('store.chat.noConversations') }}</p>
        </div>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  IonPage, IonHeader, IonContent, IonBadge, IonIcon,
  IonRefresher, IonRefresherContent, IonSkeletonText
} from '@ionic/vue'
import { personCircleOutline, chatbubblesOutline, constructOutline } from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import { supabase } from '@/plugins/supabaseClient'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()
const router = useRouter()

const isUnderConstruction = computed(() => import.meta.env.VITE_STORE_UNDER_CONSTRUCTION === 'true')
const loading = ref(true)
const conversations = ref<any[]>([])

function localized(zh: string | null | undefined, en: string | null | undefined): string {
  if (locale.value === 'zh') return zh || en || ''
  return en || zh || ''
}

function formatTime(d: string) {
  if (!d) return ''
  const date = new Date(d)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHrs = diffMs / (1000 * 60 * 60)

  if (diffHrs < 24 && date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }
  if (diffHrs < 48) return t('store.chat.yesterday')
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

async function fetchConversations() {
  loading.value = true

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    loading.value = false
    return
  }

  const { data } = await supabase
    .from('store_chat_conversations')
    .select(`
      *,
      store_products(name, name_zh)
    `)
    .eq('buyer_id', session.user.id)
    .order('last_message_at', { ascending: false })

  conversations.value = data || []
  loading.value = false
}

function openChat(conversationId: string) {
  router.push(`/store/chat/${conversationId}`)
}

async function doRefresh(event: any) {
  await fetchConversations()
  event.target.complete()
}

onMounted(fetchConversations)
</script>

<style scoped>
.conv-list {
  padding: 8px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.conv-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: #ffffff;
  border-radius: 16px;
  padding: 14px 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  transition: transform 0.15s;
}

.conv-card:active { transform: scale(0.98); }

.conv-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--ion-color-light);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.conv-avatar ion-icon {
  font-size: 32px;
  color: var(--ion-color-medium);
}

.conv-body {
  flex: 1;
  min-width: 0;
}

.conv-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.conv-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ion-text-color);
}

.conv-time {
  font-size: 0.7rem;
  color: var(--ion-color-medium);
  flex-shrink: 0;
}

.conv-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 2px;
}

.conv-preview {
  margin: 0;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.unread-badge {
  font-size: 10px;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  padding: 0 5px;
  font-weight: 700;
  flex-shrink: 0;
}

.conv-product-tag {
  font-size: 0.7rem;
  color: var(--ion-color-carrot);
  margin-top: 4px;
  font-weight: 500;
}


/* Empty */
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
  margin-bottom: 16px;
  opacity: 0.4;
}

/* Skeleton */
.skeleton-card { pointer-events: none; }

/* Dark mode */
.ion-palette-dark .conv-card {
  background: var(--ion-color-step-100, #1e1e1e);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
</style>
