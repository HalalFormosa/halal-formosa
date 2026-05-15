<template>
  <div class="conversation-container">
    <div class="messages-list" ref="messageListRef">
      <div v-if="loading" class="state-container">
        <ion-spinner name="crescent" />
      </div>

      <div v-else-if="messages.length === 0" class="state-container">
        <ion-icon :icon="chatbubblesOutline" class="empty-icon" />
        <p class="empty-text">{{ $t('profile.reports.noMessages') || 'No messages yet.' }}</p>
        <p class="empty-hint">Start the conversation below</p>
      </div>

      <template v-else>
        <!-- Date group separator could go here in future -->
        <div 
          v-for="(msg, idx) in messages" 
          :key="msg.id" 
          :class="['message-row', msg.sender_id === currentUserId ? 'mine' : 'theirs']"
        >
          <!-- Avatar for received messages -->
          <div v-if="msg.sender_id !== currentUserId" class="avatar-col">
            <div :class="['avatar', msg.is_admin ? 'avatar-admin' : 'avatar-user']">
              {{ msg.is_admin ? 'A' : getInitial(msg) }}
            </div>
          </div>

          <div class="bubble-col">
            <!-- Sender label (only for received, and only if different from previous) -->
            <div v-if="msg.sender_id !== currentUserId && showSenderLabel(idx)" class="sender-label">
              <span :class="['sender-name', { 'sender-admin': msg.is_admin }]">{{ msg.is_admin ? 'Admin' : (msg.profiles?.display_name || 'Unknown') }}</span>
            </div>

            <div :class="['bubble', msg.sender_id === currentUserId ? 'bubble-mine' : 'bubble-theirs']">
              <p class="bubble-text">
                <template v-for="(part, pIdx) in formatMessage(msg.message)" :key="pIdx">
                  <a v-if="part.type === 'link'" :href="part.content" target="_blank" class="bubble-link">{{ part.content }}</a>
                  <span v-else>{{ part.content }}</span>
                </template>
              </p>
              <span class="bubble-time">{{ formatTime(msg.created_at) }}</span>
            </div>

            <!-- Link Preview Section -->
            <div class="previews-container">
              <template v-for="(part, pIdx) in formatMessage(msg.message)" :key="'preview-'+pIdx">
                <link-preview v-if="part.type === 'link'" :url="part.content" @load="scrollToBottom" />
              </template>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Input area (only when reviewing) -->
    <div v-if="status === 'reviewing'" class="input-area">
      <div class="input-row">
        <textarea
          ref="textareaRef"
          v-model="newMessage"
          :placeholder="$t('profile.reports.typeMessage') || 'Type a message...'"
          rows="1"
          class="msg-input"
          @input="autoGrow"
          @keydown.enter.exact.prevent="sendMessage"
        />
        <button 
          class="send-btn" 
          :disabled="!newMessage.trim() || sending" 
          @click="sendMessage"
        >
          <ion-spinner v-if="sending" name="dots" class="send-spinner" />
          <ion-icon v-else :icon="sendOutline" />
        </button>
      </div>
    </div>

    <!-- Closed state -->
    <div v-else-if="status === 'resolved' || status === 'rejected'" class="chat-closed-bar">
      <ion-icon :icon="lockClosedOutline" />
      <span>This conversation is closed.</span>
    </div>

    <!-- Pending state -->
    <div v-else-if="status === 'pending'" class="chat-closed-bar chat-pending">
      <ion-icon :icon="timeOutline" />
      <span>Chat opens when admin starts reviewing.</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, onUnmounted } from 'vue'
import { IonSpinner, IonIcon } from '@ionic/vue'
import { sendOutline, chatbubblesOutline, lockClosedOutline, timeOutline } from 'ionicons/icons'
import { supabase } from '@/plugins/supabaseClient'
import LinkPreview from '@/components/LinkPreview.vue'

const props = defineProps<{
  productReportId?: string
  locationReportId?: number
  status?: string
}>()

const messages = ref<any[]>([])
const loading = ref(true)
const sending = ref(false)
const newMessage = ref('')
const currentUserId = ref<string | null>(null)
const messageListRef = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

let subscription: any = null

function getInitial(msg: any): string {
  const name = msg.profiles?.display_name || ''
  return name.charAt(0).toUpperCase() || (msg.is_admin ? 'A' : 'U')
}

function showSenderLabel(idx: number): boolean {
  if (idx === 0) return true
  const prev = messages.value[idx - 1]
  const curr = messages.value[idx]
  return prev.sender_id !== curr.sender_id
}

function formatMessage(text: string) {
  if (!text) return []
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)
  return parts.map(part => {
    if (part.match(urlRegex)) {
      return { type: 'link', content: part }
    }
    return { type: 'text', content: part }
  })
}

async function fetchMessages() {
  // Only show loading spinner on initial load to avoid flickering during realtime updates
  if (messages.value.length === 0) {
    loading.value = true
  }

  const query = supabase
    .from('report_comments')
    .select(`
      *,
      profiles:user_profiles!report_comments_sender_id_profiles_fkey (display_name),
      roles:user_roles!report_comments_sender_id_roles_fkey (role)
    `)
  
  if (props.productReportId) {
    query.eq('product_report_id', props.productReportId)
  } else if (props.locationReportId) {
    query.eq('location_report_id', props.locationReportId)
  }

  const { data, error } = await query.order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching messages:', error)
  } else {
    messages.value = data?.map(m => ({
      ...m,
      is_admin: m.roles?.role === 'admin'
    })) || []
    
    loading.value = false
    scrollToBottom()
  }
  loading.value = false
}

async function sendMessage() {
  if (!newMessage.value.trim() || !currentUserId.value) return

  sending.value = true
  const payload: any = {
    sender_id: currentUserId.value,
    message: newMessage.value.trim()
  }

  if (props.productReportId) {
    payload.product_report_id = props.productReportId
  } else if (props.locationReportId) {
    payload.location_report_id = props.locationReportId
  }

  const { error } = await supabase.from('report_comments').insert(payload)

  if (error) {
    console.error('Error sending message:', error)
  } else {
    newMessage.value = ''
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
    }
    fetchMessages()
  }
  sending.value = false
}

function autoGrow(e: Event) {
  const el = e.target as HTMLTextAreaElement
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 100) + 'px'
}

function scrollToBottom() {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    }
  })
}

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function setupRealtime() {
  const filter = props.productReportId 
    ? `product_report_id=eq.${props.productReportId}` 
    : `location_report_id=eq.${props.locationReportId}`

  subscription = supabase
    .channel('report_comments')
    .on('postgres_changes', { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'report_comments',
      filter: filter
    }, () => {
      fetchMessages()
    })
    .subscribe()
}

onMounted(async () => {
  const { data } = await supabase.auth.getUser()
  currentUserId.value = data?.user?.id || null
  fetchMessages()
  setupRealtime()
})

onUnmounted(() => {
  if (subscription) {
    supabase.removeChannel(subscription)
  }
})
</script>

<style scoped>
.conversation-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ion-background-color);
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--ion-color-step-100, rgba(0,0,0,0.08));
}

/* ── Messages area ── */
.messages-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* ── Empty / loading state ── */
.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 8px;
}

.empty-icon {
  font-size: 48px;
  color: var(--ion-color-step-300, #bbb);
}

.empty-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--ion-color-step-500, #888);
  margin: 0;
}

.empty-hint {
  font-size: 13px;
  color: var(--ion-color-step-400, #999);
  margin: 0;
}

/* ── Message row ── */
.message-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin-bottom: 2px;
}

.message-row.mine {
  flex-direction: row-reverse;
}

/* ── Avatar ── */
.avatar-col {
  flex-shrink: 0;
  width: 32px;
  margin-bottom: 2px;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
}

.avatar-admin {
  background: var(--ion-color-carrot, #e67e22);
}

.avatar-user {
  background: var(--ion-color-step-400, #999);
}

/* ── Bubble column ── */
.bubble-col {
  max-width: 78%;
  display: flex;
  flex-direction: column;
}

/* ── Sender label ── */
.sender-label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  margin-top: 10px;
  padding-left: 4px;
}

.sender-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--ion-color-step-600, #666);
}

.sender-admin {
  color: var(--ion-color-carrot, #e67e22) !important;
}

/* ── Bubbles ── */
.bubble {
  padding: 10px 14px 6px 14px;
  border-radius: 18px;
  position: relative;
  word-break: break-word;
}

.bubble-mine {
  background: var(--ion-background-color, #fff);
  color: var(--ion-text-color, #1a1a1a);
  border: 1.5px solid var(--ion-color-carrot, #e67e22);
  border-bottom-right-radius: 6px;
  margin-left: auto;
}

.bubble-theirs {
  background: var(--ion-color-carrot, #e67e22);
  color: #fff;
  border-bottom-left-radius: 6px;
}

.bubble-text {
  margin: 0;
  font-size: 14.5px;
  line-height: 1.45;
  padding-bottom: 14px;
}

.bubble-link {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
  font-weight: 500;
  word-break: break-all;
}

.bubble-mine .bubble-link {
  color: var(--ion-color-carrot, #e67e22);
}

.bubble-theirs .bubble-link {
  color: #fff;
  opacity: 0.9;
}

.previews-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bubble-time {
  position: absolute;
  bottom: 5px;
  right: 12px;
  font-size: 10px;
  opacity: 0.55;
  white-space: nowrap;
}

.bubble-mine .bubble-time {
  color: var(--ion-color-step-500, #888);
}

.bubble-theirs .bubble-time {
  color: rgba(255,255,255,0.7);
}

/* ── Input area ── */
.input-area {
  border-top: 1px solid var(--ion-color-step-100, rgba(0,0,0,0.08));
  padding: 10px 14px;
  background: var(--ion-background-color);
}

.input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: var(--ion-color-step-100, #f0f0f0);
  border-radius: 24px;
  padding: 4px 4px 4px 16px;
  border: 1.5px solid var(--ion-color-step-150, rgba(0,0,0,0.1));
  transition: all 0.2s ease;
}

.input-row:focus-within {
  border-color: var(--ion-color-carrot, #e67e22);
  background: var(--ion-background-color);
  box-shadow: 0 0 0 3px rgba(var(--ion-color-carrot-rgb, 230, 126, 34), 0.1);
}

.msg-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14.5px;
  line-height: 1.4;
  padding: 10px 0;
  resize: none;
  max-height: 100px;
  color: var(--ion-text-color, #1a1a1a);
  font-family: inherit;
}

.msg-input::placeholder {
  color: var(--ion-color-step-450, #999);
}

.send-btn {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: none;
  background: var(--ion-color-carrot, #e67e22);
  color: #fff !important;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 18px;
  margin: 2px;
}

.send-btn ion-icon {
  color: #fff !important;
}

.send-btn:hover:not(:disabled) {
  opacity: 0.85;
  transform: scale(1.05);
}

.send-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.send-spinner {
  width: 18px;
  height: 18px;
  color: #fff;
}

/* ── Closed / Pending bar ── */
.chat-closed-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 16px;
  background: var(--ion-background-color);
  border-top: 1px solid var(--ion-color-step-100, rgba(0,0,0,0.08));
  color: var(--ion-color-step-500, #888);
  font-size: 13px;
  font-weight: 500;
}

.chat-closed-bar ion-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.chat-pending {
  color: var(--ion-color-carrot, #e67e22);
}
</style>
