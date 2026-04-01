<template>
  <ion-page>
    <ion-header class="ion-no-border chat-header-modern">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/store/chat-inbox" />
        </ion-buttons>
        <div class="chat-header-content" @click="handleHeaderClick" style="cursor: pointer;">
          <ion-avatar v-if="otherUser" class="header-avatar">
            <img :src="otherUser.avatar_url || otherUser.logo_url || '/favicon-32x32.png'" />
          </ion-avatar>
          <div v-else class="header-avatar-skeleton"></div>
          <div class="header-text">
            <h2 class="header-name">{{ otherUser?.display_name || otherUser?.name || headerTitle }}</h2>
            <p v-if="otherUser" class="header-status">{{ $t('store.chat.online').charAt(0).toUpperCase() + $t('store.chat.online').slice(1) }}</p>
          </div>
        </div>
        <ion-buttons slot="end">
          <ion-button fill="clear">
            <ion-icon :icon="ellipsisVertical" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" ref="contentRef">
      <div v-if="isUnderConstruction" class="under-construction-overlay">
        <div class="construction-card">
          <ion-icon :icon="constructOutline" class="construction-icon" />
          <h2>{{ $t('common.underConstruction') || 'Under Construction' }}</h2>
          <p>Our chat system is being upgraded. We'll be back online shortly!</p>
        </div>

        <div class="chat-loading" style="padding-top: 20px;">
          <ion-spinner name="crescent" color="carrot" />
        </div>
      </div>

      <template v-else>
        <!-- Product context card -->
      <div v-if="productContext" class="product-context">
        <img v-if="productContext.images?.[0]" :src="productContext.images[0]" class="ctx-image" />
        <div class="ctx-info">
          <span class="ctx-name">{{ localized(productContext.name_zh, productContext.name) }}</span>
          <span class="ctx-label">{{ $t('store.chat.aboutProduct') }}</span>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="chat-loading">
        <ion-spinner name="crescent" color="carrot" />
      </div>

      <!-- Messages -->
      <div class="messages-container" v-if="!loading">
        <div v-if="messages.length === 0" class="empty-chat">
          <ion-icon :icon="chatbubblesOutline" class="empty-icon" />
          <p>{{ $t('store.chat.noMessages') }}</p>
        </div>

        <div
          v-for="(msg, i) in messages"
          :key="msg.id"
          :class="['message-row', { 'mine': msg.sender_id === currentUserId }]"
        >
          <div v-if="showDateSep(i)" class="date-separator">
            <span>{{ formatDateSep(msg.created_at) }}</span>
          </div>
          
          <div :class="['message-content-row', { 'mine': msg.sender_id === currentUserId }, { 'grouped': isGrouped(i) }]">
            <ion-avatar v-if="msg.sender_id !== currentUserId" class="msg-avatar" :style="{ opacity: isGrouped(i) ? 0 : 1 }">
              <img :src="otherUser?.avatar_url || '/favicon-32x32.png'" />
            </ion-avatar>
            <div :class="['message-bubble', { 'mine': msg.sender_id === currentUserId }, { 'grouped': isGrouped(i) }]">
              <p class="msg-text">{{ msg.message }}</p>
              <img v-if="msg.image_url" :src="msg.image_url" class="msg-image" @click="openImage(msg.image_url!)" />
              <div class="msg-footer">
                <span class="msg-time">{{ formatTime(msg.created_at) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      </template>
    </ion-content>

    <!-- Input bar -->
    <ion-footer class="chat-footer" v-if="!isUnderConstruction">
      <div class="input-bar">
        <ion-textarea
          v-model="newMessage"
          :placeholder="$t('store.chat.typeMessage')"
          :rows="1"
          auto-grow
          class="chat-input"
          @keydown.enter.exact.prevent="handleSend"
        />
        <ion-button
          fill="clear"
          color="carrot"
          class="send-btn"
          :disabled="!newMessage.trim() || sending"
          @click="handleSend"
        >
          <ion-icon :icon="sendOutline" />
        </ion-button>
      </div>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IonPage, IonHeader, IonContent, IonFooter, IonButton, IonIcon,
  IonTextarea, IonSpinner, IonAvatar, IonBackButton, IonToolbar, IonButtons, IonTitle,
  toastController
} from '@ionic/vue'
import { sendOutline, chatbubblesOutline, constructOutline, ellipsisVertical } from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import { supabase } from '@/plugins/supabaseClient'
import { useStoreChat } from '@/composables/useStoreChat'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()

const isUnderConstruction = computed(() => import.meta.env.VITE_STORE_UNDER_CONSTRUCTION === 'true')
const {
  messages, loading, sending,
  fetchMessages, sendMessage, subscribeToMessages, markAsRead, unsubscribe
} = useStoreChat()

const contentRef = ref<InstanceType<typeof IonContent> | null>(null)
const newMessage = ref('')
const currentUserId = ref('')
const headerTitle = ref(t('store.chat.title'))
const productContext = ref<any>(null)
const conversationId = ref('')
const otherUser = ref<any>(null)

function localized(zh: string | null | undefined, en: string | null | undefined): string {
  if (locale.value === 'zh') return zh || en || ''
  return en || zh || ''
}

async function init() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  currentUserId.value = session.user.id

  conversationId.value = route.params.conversationId as string

  // Fetch conversation details for header
  const { data: conv } = await supabase
    .from('store_chat_conversations')
    .select('*, store_products(name, name_zh, images)')
    .eq('id', conversationId.value)
    .maybeSingle()

  if (conv) {
    if (conv.store_products) {
      productContext.value = conv.store_products
    }
    // Set header: show other party's name context
    // Set header: show other party's name context
    const isBuyer = session.user.id === conv.buyer_id
    headerTitle.value = isBuyer ? t('store.chat.title') : t('store.chat.customerChat')
    
    // Fetch other party info
    if (isBuyer) {
      // Buyer sees the Store
      const { data: store } = await supabase
        .from('merchant_stores')
        .select('*')
        .eq('user_id', conv.store_user_id)
        .maybeSingle()
      if (store) otherUser.value = store
    } else {
      // Merchant sees the Buyer's profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', conv.buyer_id)
        .maybeSingle()
      if (profile) otherUser.value = profile
    }
  }

  await fetchMessages(conversationId.value)
  subscribeToMessages(conversationId.value)
  await markAsRead(conversationId.value)
  scrollToBottom()
}

function showDateSep(index: number): boolean {
  if (index === 0) return true
  const prev = new Date(messages.value[index - 1].created_at).toDateString()
  const curr = new Date(messages.value[index].created_at).toDateString()
  return prev !== curr
}

function isGrouped(index: number): boolean {
  if (index === 0) return false
  if (showDateSep(index)) return false
  return messages.value[index].sender_id === messages.value[index - 1].sender_id
}

function formatDateSep(d: string) {
  const date = new Date(d)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return t('store.chat.today')
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return t('store.chat.yesterday')
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function openImage(url: string) {
  window.open(url, '_blank')
}

function handleHeaderClick() {
  if (!otherUser.value) return
  // If it's a store (it has a name but maybe no display_name)
  if (otherUser.value.id && (otherUser.value.name || otherUser.value.logo_url)) {
    router.push(`/store/merchant/${otherUser.value.id}`)
  }
}

async function handleSend() {
  if (!newMessage.value.trim() || sending.value) return
  const text = newMessage.value
  
  const result = await sendMessage(conversationId.value, text)
  
  if (result?.success) {
    newMessage.value = ''
    await nextTick()
    scrollToBottom()
  } else {
    // Show error toast
    const toast = await toastController.create({
      message: result?.error || 'Failed to send message',
      duration: 3000,
      color: 'danger',
      position: 'top'
    })
    await toast.present()
  }
}

function scrollToBottom() {
  setTimeout(() => {
    contentRef.value?.$el?.scrollToBottom?.(300)
  }, 100)
}

// Auto-scroll when new messages arrive
watch(() => messages.value.length, () => {
  nextTick(scrollToBottom)
})

onMounted(init)
onUnmounted(unsubscribe)
</script>

<style scoped>

/* Product context */

/* Product context */
.chat-header-modern {
  --background: var(--ion-background-color);
  border-bottom: 1px solid var(--ion-color-step-100, rgba(0, 0, 0, 0.05));
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.chat-header-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.header-avatar {
  width: 36px;
  height: 36px;
  border: 1px solid var(--ion-color-step-150, #eee);
}

.header-avatar-skeleton {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--ion-color-step-100, #eee);
}

.header-text {
  display: flex;
  flex-direction: column;
}

.header-name {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--ion-text-color);
}

.header-status {
  margin: 0;
  font-size: 0.7rem;
  color: var(--ion-color-success);
  font-weight: 600;
  text-transform: capitalize;
}

/* Product context */
.product-context {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--ion-background-color);
  border-bottom: 1px solid var(--ion-color-step-150, rgba(0, 0, 0, 0.05));
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}

.ctx-image {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  object-fit: cover;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.ctx-info {
  display: flex;
  flex-direction: column;
}

.ctx-name {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--ion-text-color);
}

.ctx-label {
  font-size: 0.65rem;
  color: var(--ion-color-medium);
  letter-spacing: 0.02em;
}

/* Messages */
.messages-container {
  padding: 8px 14px 24px;
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: var(--ion-background-color);
}

.message-row {
  display: flex;
  flex-direction: column;
  margin-bottom: 4px;
}

.date-separator {
  display: flex;
  justify-content: center;
  margin: 20px 0 12px;
}

.date-separator span {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--ion-color-medium);
  background: var(--ion-color-step-100, #f0f0f0);
  padding: 4px 14px;
  border-radius: 20px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.message-content-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  max-width: 82%;
  margin-top: 8px;
}

.message-content-row.mine {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message-content-row.grouped {
  margin-top: 2px;
}

.msg-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

/* Bubbles */
.message-bubble {
  padding: 10px 14px;
  border-radius: 18px 18px 18px 4px;
  background: var(--ion-color-step-150, #f0f0f5);
  color: var(--ion-text-color);
  position: relative;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}

.message-bubble.mine {
  background: var(--ion-color-carrot);
  color: #fff;
  border-radius: 18px 18px 4px 18px;
  box-shadow: 0 2px 4px rgba(230, 126, 34, 0.2);
}

.message-bubble.grouped:not(.mine) {
  border-top-left-radius: 4px;
}

.message-bubble.grouped.mine {
  border-top-right-radius: 4px;
}

.msg-text {
  margin: 0;
  font-size: 0.94rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}

.msg-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}

.msg-time {
  font-size: 0.64rem;
  opacity: 0.65;
  font-weight: 500;
}

.message-bubble.mine .msg-time {
  color: rgba(255, 255, 255, 0.85);
}

/* Input bar */
.chat-footer {
  --background: var(--ion-background-color);
  border-top: 1px solid var(--ion-color-step-150, rgba(0, 0, 0, 0.08));
  padding-bottom: var(--ion-safe-area-bottom, 0);
}

.input-bar {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 14px;
}

.chat-input {
  flex: 1;
  --padding-start: 16px;
  --padding-end: 16px;
  --padding-top: 12px;
  --padding-bottom: 12px;
  --background: var(--ion-color-step-100, #f5f6f7);
  --border-radius: 24px;
  --placeholder-color: var(--ion-color-medium);
  --placeholder-opacity: 0.7;
  border-radius: 24px;
  border: 1px solid var(--ion-color-step-200, #e0e0e0);
  font-size: 0.95rem;
  max-height: 150px;
  margin: 0;
  transition: border-color 0.2s;
}

.chat-input:focus-within {
  border-color: var(--ion-color-carrot);
}

.send-btn {
  --padding-start: 8px;
  --padding-end: 8px;
  margin-bottom: 4px;
  font-size: 24px;
  height: 40px;
}

/* Dark mode overrides */
.ion-palette-dark .chat-header-modern {
  border-bottom-color: var(--ion-color-step-200, #333);
}

.ion-palette-dark .product-context {
  background: var(--ion-color-step-150, #1e1e1e);
  border-bottom-color: var(--ion-color-step-250);
}

.ion-palette-dark .date-separator span {
  background: var(--ion-color-step-300, #333);
  color: var(--ion-color-step-700);
}

.ion-palette-dark .message-bubble:not(.mine) {
  background: var(--ion-color-step-300, #3a3a3c);
  color: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.ion-palette-dark .chat-footer {
  border-top-color: var(--ion-color-step-250, #333);
}

.ion-palette-dark .chat-input {
  --background: var(--ion-color-step-200, #2c2c2e);
  border-color: var(--ion-color-step-350, #48484a);
  color: #fff;
}

.ion-palette-dark .header-avatar {
  border-color: var(--ion-color-step-300);
}
</style>
