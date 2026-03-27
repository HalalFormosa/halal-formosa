<template>
  <ion-page>
    <ion-header>
      <app-header :title="headerTitle" :showBack="true" icon="none" />
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
          <!-- Date separator -->
          <div v-if="showDateSep(i)" class="date-separator">
            <span>{{ formatDateSep(msg.created_at) }}</span>
          </div>

          <div :class="['message-bubble', { 'mine': msg.sender_id === currentUserId }]">
            <p class="msg-text">{{ msg.message }}</p>
            <img v-if="msg.image_url" :src="msg.image_url" class="msg-image" @click="openImage(msg.image_url!)" />
            <span class="msg-time">{{ formatTime(msg.created_at) }}</span>
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
import { useRoute } from 'vue-router'
import {
  IonPage, IonHeader, IonContent, IonFooter, IonButton, IonIcon,
  IonTextarea, IonSpinner
} from '@ionic/vue'
import { sendOutline, chatbubblesOutline, constructOutline } from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import { supabase } from '@/plugins/supabaseClient'
import { useStoreChat } from '@/composables/useStoreChat'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()
const route = useRoute()

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
    .single()

  if (conv) {
    if (conv.store_products) {
      productContext.value = conv.store_products
    }
    // Set header: show other party's name context
    const isBuyer = session.user.id === conv.buyer_id
    headerTitle.value = isBuyer ? t('store.chat.title') : t('store.chat.customerChat')
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

async function handleSend() {
  if (!newMessage.value.trim() || sending.value) return
  const text = newMessage.value
  newMessage.value = ''
  await sendMessage(conversationId.value, text)
  await nextTick()
  scrollToBottom()
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
/* Under Construction */
.under-construction-overlay {
  padding: 16px;
}

.construction-card {
  padding: 24px;
  background: var(--ion-color-step-50, #f8f9fa);
  border-radius: 20px;
  text-align: center;
  border: 1px dashed var(--ion-color-carrot);
}

.construction-icon {
  font-size: 40px;
  color: var(--ion-color-carrot);
  margin-bottom: 12px;
}

.construction-card h2 {
  margin: 0 0 8px;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--ion-text-color);
}

.construction-card p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--ion-color-medium);
  line-height: 1.5;
}

/* Product context */
.product-context {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: var(--card-bg, #f9f9f9);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.ctx-image {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  object-fit: cover;
}

.ctx-info {
  display: flex;
  flex-direction: column;
}

.ctx-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ion-text-color);
}

.ctx-label {
  font-size: 0.7rem;
  color: var(--ion-color-medium);
}

/* Loading */
.chat-loading {
  display: flex;
  justify-content: center;
  padding: 40px;
}

/* Messages */
.messages-container {
  padding: 12px 16px 24px;
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.empty-chat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--ion-color-medium);
}

.empty-icon {
  font-size: 56px;
  margin-bottom: 12px;
  opacity: 0.4;
}

/* Date separator */
.date-separator {
  text-align: center;
  margin: 16px 0 8px;
}

.date-separator span {
  font-size: 0.7rem;
  color: var(--ion-color-medium);
  background: var(--card-bg, #f0f0f0);
  padding: 4px 12px;
  border-radius: 12px;
}

/* Message rows */
.message-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 4px;
}

.message-row.mine {
  align-items: flex-end;
}

/* Bubbles */
.message-bubble {
  max-width: 78%;
  padding: 10px 14px;
  border-radius: 18px 18px 18px 6px;
  background: var(--ion-color-step-100, #f0f0f5);
  color: var(--ion-text-color);
  position: relative;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.message-bubble.mine {
  background: var(--ion-color-carrot);
  color: #fff;
  border-radius: 18px 18px 6px 18px;
}

.msg-text {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}

.msg-image {
  max-width: 200px;
  max-height: 200px;
  border-radius: 12px;
  margin-top: 6px;
  cursor: pointer;
}

.msg-time {
  display: block;
  font-size: 0.62rem;
  margin-top: 4px;
  opacity: 0.6;
  text-align: right;
}

.message-bubble.mine .msg-time {
  color: rgba(255, 255, 255, 0.7);
}

/* Input bar */
.chat-footer {
  --background: var(--ion-background-color);
  border-top: 1px solid var(--ion-color-step-150, rgba(0, 0, 0, 0.08));
}

.input-bar {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  padding: 8px 12px;
}

.chat-input {
  flex: 1;
  --padding-start: 14px;
  --padding-end: 14px;
  --padding-top: 10px;
  --padding-bottom: 10px;
  --background: var(--ion-color-step-50, #f4f5f8);
  --border-radius: 20px;
  border-radius: 20px;
  border: 1px solid var(--ion-color-step-150, #e0e0e0);
  font-size: 0.95rem;
  max-height: 120px;
  margin: 0;
}

.send-btn {
  --padding-start: 8px;
  --padding-end: 8px;
  margin-bottom: 4px;
  font-size: 22px;
}

/* Dark mode */
.ion-palette-dark .product-context {
  background: var(--ion-color-step-50, #1e1e1e);
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.ion-palette-dark .message-bubble:not(.mine) {
  background: var(--ion-color-step-100, #2a2a2a);
}

.ion-palette-dark .chat-footer {
  border-top-color: rgba(255, 255, 255, 0.08);
}

.ion-palette-dark .chat-input {
  --background: var(--ion-color-step-100, #2a2a2a);
  border-color: rgba(255, 255, 255, 0.12);
}

.ion-palette-dark .date-separator span {
  background: var(--ion-color-step-100, #2a2a2a);
}
</style>
