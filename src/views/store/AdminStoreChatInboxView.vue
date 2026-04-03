<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('store.chat.storeMessages')" :showBack="true" icon="none" />
    </ion-header>

    <ion-content :fullscreen="true">
      <div v-if="isUnderConstruction" class="under-construction-overlay">
        <div class="construction-card">
          <ion-icon :icon="constructOutline" class="construction-icon" />
          <h2>{{ $t('common.underConstruction') || 'Under Construction' }}</h2>
          <p>Store admin messages are being migrated. Check back later!</p>
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
            <img v-if="conv.buyer_profile?.avatar_url" :src="conv.buyer_profile.avatar_url" class="buyer-avatar-img" />
            <ion-icon v-else :icon="personCircleOutline" />
            <!-- Unread badge on avatar -->
            <div v-if="conv.store_unread > 0" class="unread-dot-modern"></div>
          </div>
          <div class="conv-body">
            <div class="conv-top">
              <span class="conv-name">{{ conv.buyer_profile?.display_name || conv.buyer_profile?.email || $t('store.chat.customer') }}</span>
              <span class="conv-time">{{ formatTime(conv.last_message_at) }}</span>
            </div>
            <div class="conv-bottom">
              <p :class="['conv-preview', { 'unread': conv.store_unread > 0 }]">{{ conv.last_message || $t('store.chat.noMessages') }}</p>
              <span v-if="conv.store_unread > 0" class="unread-count-label">{{ conv.store_unread }}</span>
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
  IonRefresher, IonRefresherContent, IonSkeletonText,
  onIonViewWillEnter
} from '@ionic/vue'
import { personCircleOutline, chatbubblesOutline, constructOutline } from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import { supabase } from '@/plugins/supabaseClient'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useI18n } from 'vue-i18n'
import { onUnmounted } from 'vue'

const { t, locale } = useI18n()
const router = useRouter()

const isUnderConstruction = computed(() => import.meta.env.VITE_STORE_UNDER_CONSTRUCTION === 'true')
const loading = ref(true)
const conversations = ref<any[]>([])

const merchantStoreId = ref<string | null>(null)
const isGlobalAdmin = ref(false)

async function resolvePermissions() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  // Check if role is admin
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', session.user.id)
    .maybeSingle()
  
  isGlobalAdmin.value = roleData?.role === 'admin'

  // If not admin, or even if admin but we want store-specific view
  const { data: storeData } = await supabase
    .from('merchant_stores')
    .select('id')
    .eq('user_id', session.user.id)
    .maybeSingle()
  
  if (storeData) {
    merchantStoreId.value = storeData.id
  }
}

function localized(zh: string | null | undefined, en: string | null | undefined): string {
  if (locale.value === 'zh') return zh || en || ''
  return en || zh || ''
}

function formatTime(d: string) {
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

async function fetchConversations(silent = false) {
  if (!silent) loading.value = true

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    loading.value = false
    return
  }

  let query = supabase
    .from('store_chat_conversations')
    .select(`
      *,
      store_products(name, name_zh)
    `)
    .order('last_message_at', { ascending: false })

  if (!isGlobalAdmin.value && merchantStoreId.value) {
    query = query.eq('store_id', merchantStoreId.value)
  } else if (!isGlobalAdmin.value && !merchantStoreId.value) {
    conversations.value = []
    loading.value = false
    return
  }

  const { data } = await query

  const convs = data || []
  
  // Extract unique buyer IDs
  const buyerIds = [...new Set(convs.map((c: any) => c.buyer_id).filter(Boolean))]
  
  let profiles: any[] = []
  if (buyerIds.length > 0) {
    const { data: profs } = await supabase
      .from('user_profiles')
      .select('id, email, display_name, avatar_url')
      .in('id', buyerIds)
    profiles = profs || []
  }

  // Flatten buyer info
  conversations.value = convs.map((c: any) => {
    const p = profiles.find((prof: any) => prof.id === c.buyer_id)
    return {
      ...c,
      buyer_profile: p || null
    }
  })

  loading.value = false
}

function openChat(conversationId: string) {
  router.push(`/store/chat/${conversationId}`)
}

async function doRefresh(event: any) {
  await fetchConversations()
  event.target.complete()
}

let convChannel: RealtimeChannel | null = null

function subscribeToConversations() {
  if (convChannel) supabase.removeChannel(convChannel)

  convChannel = supabase
    .channel('admin-chat-inbox')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'store_chat_conversations',
        filter: merchantStoreId.value ? `store_id=eq.${merchantStoreId.value}` : undefined
      },
      () => {
        fetchConversations()
      }
    )
    .subscribe()
}

onIonViewWillEnter(async () => {
  await resolvePermissions()
  await fetchConversations(conversations.value.length > 0) // Silent if we have data
  subscribeToConversations()
})

onUnmounted(() => {
  if (convChannel) {
    supabase.removeChannel(convChannel)
  }
})
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

.unread-dot-modern {
  position: absolute;
  top: 0;
  right: 0;
  width: 12px;
  height: 12px;
  background-color: var(--ion-color-danger);
  border-radius: 50%;
  border: 2px solid #ffffff;
  box-shadow: 0 0 4px rgba(0,0,0,0.2);
  z-index: 2;
}

.conv-preview.unread {
  color: var(--ion-text-color);
  font-weight: 600;
}

.unread-count-label {
  background: var(--ion-color-danger);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

.conv-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--ion-color-light);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: visible;
  position: relative;
}

.buyer-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
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

.conv-product-tag {
  font-size: 0.7rem;
  color: var(--ion-color-carrot);
  margin-top: 4px;
  font-weight: 500;
}


/* Admin Chat */

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
