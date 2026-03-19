<template>
  <ion-page>
    <ion-header>
      <app-header
          :title="$t('profile.admin.scanLogs')"
          :icon="listOutline"
          :showBack="true"
      />
    </ion-header>

    <ion-content class="ion-padding">
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <ion-list>
        <ion-item
            v-for="log in logs"
            :key="log.id"
            button
            detail
            @click="openDetails(log)"
        >

        <!-- Avatar -->
          <ion-avatar slot="start" v-if="log.avatar_url">
            <img :src="log.avatar_url" :alt="$t('admin.userAvatar')" />
          </ion-avatar>

          <!-- Label section -->
          <ion-label class="log-label">

            <!-- USER NAME -->
            <h2 class="log-user">
              {{ log.full_name || log.display_name || log.email || $t('admin.unknownUser') }}
            </h2>

            <!-- PRODUCT -->
            <p class="log-product">
              🛒 <strong>{{ log.product_name || $t('admin.unknownProduct') }}</strong>
            </p>

            <!-- STATUS + SOURCE -->
            <div class="log-action">
              <ion-text color="dark">
                <strong>{{ $t('admin.status') }}: {{ log.auto_status || "N/A" }}</strong>
              </ion-text>

              <ion-badge
                  :color="log.source === 'camera' ? 'primary' : 'secondary'"
              >
                {{ log.source }}
              </ion-badge>
            </div>

            <!-- TIME -->
            <p class="log-time">{{ fromNowToTaipei(log.created_at) }}</p>

          </ion-label>

        </ion-item>
      </ion-list>

      <!-- 🔍 Scan Log Details Modal -->
      <ion-modal :is-open="showModal" @didDismiss="closeModal">
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ $t('admin.scanDetails') }}</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="closeModal">{{ $t('admin.close') }}</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>

        <ion-content class="ion-padding">

          <ion-card v-if="selectedLog">
            <ion-card-header>
              <ion-card-title>
                {{ selectedLog.product_name || $t('admin.unknownProduct') }}
              </ion-card-title>
              <p class="log-time">
                {{ fromNowToTaipei(selectedLog.created_at) }}
              </p>
            </ion-card-header>

            <ion-card-content>

              <ion-list lines="none">

                <ion-item>
                  <ion-label>{{ $t('admin.status') }}</ion-label>
                  <ion-badge :color="selectedLog.auto_status === 'Haram' ? 'danger' :
                               selectedLog.auto_status === 'Syubhah' ? 'warning' :
                               selectedLog.auto_status === 'Halal' ? 'success' : 'primary'">
                    {{ selectedLog.auto_status }}
                  </ion-badge>
                </ion-item>

                <ion-item>
                  <ion-label>{{ $t('admin.source') }}</ion-label>
                  <ion-note slot="end">{{ selectedLog.source }}</ion-note>
                </ion-item>

                <ion-item>
                  <ion-label>{{ $t('admin.device') }}</ion-label>
                  <ion-note slot="end">
                    {{ selectedLog.device_model }} ({{ selectedLog.platform }})
                  </ion-note>
                </ion-item>

                <ion-item v-if="selectedLog.processing_time_ms">
                  <ion-label>{{ $t('admin.processingTime') }}</ion-label>
                  <ion-note slot="end">{{ selectedLog.processing_time_ms }} ms</ion-note>
                </ion-item>

                <ion-item v-if="selectedLog.error_message">
                  <ion-label>{{ $t('admin.error') }}</ion-label>
                  <ion-note slot="end" color="danger">
                    {{ selectedLog.error_message }}
                  </ion-note>
                </ion-item>

                <ion-item>
                  <ion-label>{{ $t('admin.appVersion') }}</ion-label>
                  <ion-note slot="end">{{ selectedLog.app_version }}</ion-note>
                </ion-item>

              </ion-list>

              <!-- OCR TEXT -->
              <h1 style="margin-top: 16px;">{{ $t('admin.ocrChinese') }}</h1>
              <ion-textarea
                  readonly
                  :auto-grow="true"
                  class="copy-area"
                  :value="selectedLog.ingredients_text_zh || '—'"
              ></ion-textarea>


              <h1>{{ $t('admin.ocrEnglish') }}</h1>
              <ion-textarea
                  readonly
                  :auto-grow="true"
                  class="copy-area"
                  :value="selectedLog.ingredients_text_en || '—'"
              ></ion-textarea>


              <!-- HIGHLIGHT SUMMARY (JSON pretty) -->
              <h1>{{ $t('admin.detectedHighlights') }}</h1>
              <ion-textarea
                  readonly
                  :auto-grow="true"
                  class="copy-area mono"
                  :value="JSON.stringify(selectedLog.highlight_summary, null, 2)"
              ></ion-textarea>


              <h1>{{ $t('admin.rawOcrText') }}</h1>
              <ion-textarea
                  readonly
                  :auto-grow="true"
                  class="copy-area mono"
                  :value="selectedLog.ocr_raw || '—'"
              ></ion-textarea>

            </ion-card-content>
          </ion-card>

        </ion-content>
      </ion-modal>

      <ion-infinite-scroll
          threshold="100px"
          @ionInfinite="loadMore"
          :disabled="noMoreData"
      >
        <ion-infinite-scroll-content
            loading-spinner="bubbles"
            :loading-text="$t('admin.loadingMoreLogs')"
        ></ion-infinite-scroll-content>
      </ion-infinite-scroll>

    </ion-content>

  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { supabase } from "@/plugins/supabaseClient";

import {
  IonPage,
  IonHeader,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonAvatar,
  IonBadge,
  IonText,
  IonButton, IonModal, IonRefresher, IonInfiniteScroll, IonCard, IonCardContent, IonTextarea, IonNote, IonCardHeader, IonToolbar,IonCardTitle,IonInfiniteScrollContent, IonTitle, IonButtons,
    IonRefresherContent
} from "@ionic/vue";

import AppHeader from "@/components/AppHeader.vue";
import { listOutline } from "ionicons/icons";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

const logs = ref<any[]>([])
const limit = 15
const loadingMore = ref(false)
const noMoreData = ref(false)

const showModal = ref(false)
const selectedLog = ref<any | null>(null)

function openDetails(log: any) {
  selectedLog.value = log
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  selectedLog.value = null
}

function handleRefresh(event: any) {
  fetchLogs(true).then(() => {
    event.target.complete()
  })
}

/** Format time in Taipei */
function fromNowToTaipei(dateString?: string) {
  if (!dateString) return "";
  return dayjs.utc(dateString).tz("Asia/Taipei").fromNow();
}

/** Fetch logs + user info */
async function fetchLogs(isRefresh = false) {
  if (isRefresh) {
    logs.value = []
    noMoreData.value = false
  }

  const offset = logs.value.length

  const { data, error } = await supabase
      .from("ingredient_scan_logs")
      .select(`
      *,
      user_profiles: user_id (
        display_name,
        avatar_url,
        email
      )
    `)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

  if (error) {
    console.error("❌ Error fetching logs:", error)
    return
  }

  if (!data || data.length < limit) {
    noMoreData.value = true
  }

  logs.value.push(
      ...data.map(row => ({
        ...row,
        display_name: row.user_profiles?.display_name,
        email: row.user_profiles?.email,
        avatar_url: row.user_profiles?.avatar_url
      }))
  )
}

async function loadMore(event: any) {
  if (loadingMore.value || noMoreData.value) {
    event.target.complete()
    return
  }

  loadingMore.value = true
  await fetchLogs()
  loadingMore.value = false

  event.target.complete()
}

onMounted(() => fetchLogs(true))

</script>

<style scoped>
.log-label h2.log-user {
  margin: 0 0 4px 0;
  font-weight: 600;
}

.log-product {
  margin: 4px 0;
  font-size: 0.9rem;
}

.log-action {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
}

.log-time {
  margin: 0;
  font-size: 0.85rem;
  color: var(--ion-color-medium);
}

.ocr-block {
  background: var(--ion-color-light);
  padding: 10px;
  border-radius: 8px;
  white-space: pre-wrap;
  font-size: 14px;
}

.json-block {
  background: #1e1e1e;
  color: #c4c4c4;
  padding: 12px;
  border-radius: 8px;
  font-size: 12px;
  overflow-x: auto;
}

.copy-area {
  background: var(--ion-color-light);
  border-radius: 8px;
  padding: 8px;
  font-size: 14px;
  white-space: pre-wrap;
  --highlight-color-focused: transparent; /* remove blue box on tap */
}

.copy-area.mono {
  font-family: monospace;
  font-size: 13px;
}

</style>


