<template>
  <ion-page>
    <ion-header>
      <app-header
          :title="$t('profile.admin.scanLogs')"
          :icon="listOutline"
          :showBack="true"
          :contrast="true"
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
            :detail="false"
            @click="openDetails(log)"
            class="scan-log-item"
        >
          <!-- User Avatar -->
          <ion-avatar slot="start" class="user-avatar">
            <img v-if="log.avatar_url" :src="log.avatar_url" :alt="log.display_name" />
            <ion-icon v-else :icon="personOutline" class="placeholder-icon" />
          </ion-avatar>
        
          <ion-label>
            <div class="product-header">
              <h2 class="product-name">
                {{ log.product_name || $t('admin.unknownProduct') }}
              </h2>
              <ion-badge
                class="status-badge"
                :color="getStatusConfig(log.auto_status).color"
                mode="ios"
              >
                {{ log.auto_status || 'N/A' }}
              </ion-badge>
            </div>
          
            <div class="user-row">
              <span class="user-name">
                {{ log.full_name || log.display_name || log.email || $t('admin.unknownUser') }}
              </span>
            </div>

            <div class="metadata">
              <span class="time-stamp">
                <ion-icon :icon="timeOutline" class="inline-icon" />
                {{ fromNowToTaipei(log.created_at) }}
              </span>
              <span class="source-tag">
                <ion-icon :icon="getSourceIcon(log.source)" class="inline-icon" />
                {{ log.source }}
              </span>
            </div>
          </ion-label>
        </ion-item>
      </ion-list>

      <ion-modal :is-open="showModal" @didDismiss="closeModal" class="scan-details-modal">
        <ion-header>
          <app-header
            :title="$t('admin.scanDetails')"
            :icon="listOutline"
            :showBack="true"
            :useRouterBack="false"
            @back="closeModal"
            :contrast="true"
          />
        </ion-header>

        <ion-content class="ion-padding modal-content">
          <div v-if="selectedLog" class="details-container">
            <!-- Header Card -->
            <div class="header-section" :class="'status-' + getStatusConfig(selectedLog.auto_status).color">
              <div class="user-info">
                <ion-avatar class="modal-avatar">
                   <img v-if="selectedLog.avatar_url" :src="selectedLog.avatar_url" />
                   <ion-icon v-else :icon="personOutline" />
                </ion-avatar>
                <div class="user-text">
                  <h3>{{ selectedLog.display_name || $t('admin.unknownUser') }}</h3>
                  <p>{{ selectedLog.email }}</p>
                </div>
              </div>
              
              <div class="status-hero">
                <h1 class="product-name-hero">{{ selectedLog.product_name || $t('admin.unknownProduct') }}</h1>
                <div class="status-badge-hero">
                  <ion-icon :icon="getStatusConfig(selectedLog.auto_status).icon" />
                  <span>{{ selectedLog.auto_status || 'N/A' }}</span>
                </div>
                <p class="time-hero">{{ fromNowToTaipei(selectedLog.created_at) }}</p>
              </div>
            </div>

            <!-- Info Card -->
            <ion-card class="info-card">
              <ion-card-header>
                <ion-card-subtitle>{{ $t('admin.deviceInfo') }}</ion-card-subtitle>
              </ion-card-header>
              <ion-card-content>
                <div class="info-grid">
                  <div class="info-item">
                    <span class="label">{{ $t('admin.source') }}</span>
                    <span class="value">
                      <ion-icon :icon="getSourceIcon(selectedLog.source)" />
                      {{ selectedLog.source }}
                    </span>
                  </div>
                  <div class="info-item">
                    <span class="label">{{ $t('admin.device') }}</span>
                    <span class="value">{{ selectedLog.device_model || 'Unknown' }}</span>
                  </div>
                  <div class="info-item" v-if="selectedLog.processing_time_ms">
                    <span class="label">{{ $t('admin.processingTime') }}</span>
                    <span class="value">{{ selectedLog.processing_time_ms }} ms</span>
                  </div>
                  <div class="info-item">
                    <span class="label">{{ $t('admin.appVersion') }}</span>
                    <span class="value">v{{ selectedLog.app_version }}</span>
                  </div>
                </div>
              </ion-card-content>
            </ion-card>

            <!-- OCR Text Sections -->
            <div class="ocr-section">
              <div class="section-title">
                <ion-icon :icon="listOutline" />
                <h3>{{ $t('admin.ocrResults') }}</h3>
              </div>

              <div class="ocr-box" v-if="selectedLog.ingredients_text_zh">
                <label>{{ $t('admin.ocrChinese') }}</label>
                <div class="text-content">{{ selectedLog.ingredients_text_zh }}</div>
              </div>

              <div class="ocr-box" v-if="selectedLog.ingredients_text_en">
                <label>{{ $t('admin.ocrEnglish') }}</label>
                <div class="text-content">{{ selectedLog.ingredients_text_en }}</div>
              </div>
            </div>

            <!-- Highlights -->
            <div class="highlights-section" v-if="selectedLog.highlight_summary && selectedLog.highlight_summary.length">
              <div class="section-title">
                <ion-icon :icon="alertCircleOutline" />
                <h3>{{ $t('admin.detectedHighlights') }}</h3>
              </div>
              <div class="highlights-grid">
                <ion-chip 
                  v-for="(h, idx) in selectedLog.highlight_summary" 
                  :key="idx"
                  class="status-chip"
                  :class="['chip-' + extractIonColor(h.color)]"
                >
                  {{ h.keyword_zh || h.keyword }}
                  <template v-if="h.keyword && h.keyword_zh">
                    ({{ toProperCase(h.keyword) }})
                  </template>
                  — {{ colorMeaning(extractIonColor(h.color)) }}
                </ion-chip>
              </div>
            </div>

            <!-- Error Message -->
            <div class="error-section" v-if="selectedLog.error_message">
               <ion-item lines="none" color="danger" class="error-item">
                 <ion-icon slot="start" :icon="alertCircleOutline" />
                 <ion-label>
                   <h3>{{ $t('admin.error') }}</h3>
                   <p>{{ selectedLog.error_message }}</p>
                 </ion-label>
               </ion-item>
            </div>

            <!-- Raw OCR (Expandable) -->
            <ion-accordion-group class="raw-ocr-accordion">
              <ion-accordion value="raw">
                <ion-item slot="header" lines="none">
                  <ion-label>{{ $t('admin.rawOcrText') }}</ion-label>
                </ion-item>
                <div slot="content" class="raw-content">
                  <pre>{{ selectedLog.ocr_raw }}</pre>
                </div>
              </ion-accordion>
            </ion-accordion-group>
          </div>
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
  IonIcon,
  IonButton, IonModal, IonRefresher, IonInfiniteScroll, IonCard, IonCardContent, IonTextarea, IonNote, IonCardHeader, IonToolbar,IonCardTitle,IonInfiniteScrollContent, IonTitle, IonButtons,
    IonRefresherContent
} from "@ionic/vue";

import AppHeader from "@/components/AppHeader.vue";
import {
  listOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  helpCircleOutline,
  alertCircleOutline,
  cameraOutline,
  imageOutline,
  eyeOutline,
  personOutline,
  timeOutline,
  cubeOutline
} from "ionicons/icons";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import relativeTime from "dayjs/plugin/relativeTime";
import { extractIonColor, colorMeaning } from "@/utils/ingredientHelpers";

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

/** Status Helper */
function getStatusConfig(status?: string) {
  switch (status) {
    case "Halal":
      return { color: "success", icon: checkmarkCircleOutline };
    case "Haram":
      return { color: "danger", icon: closeCircleOutline };
    case "Syubhah":
      return { color: "warning", icon: helpCircleOutline };
    case "Muslim-friendly":
      return { color: "primary", icon: checkmarkCircleOutline };
    default:
      return { color: "medium", icon: alertCircleOutline };
  }
}

/** Source Icon Helper */
function getSourceIcon(source?: string) {
  switch (source) {
    case "camera":
      return cameraOutline;
    case "gallery":
      return imageOutline;
    case "auto":
      return eyeOutline;
    default:
      return cubeOutline;
  }
}

/** Utility for proper case */
function toProperCase(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
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
.scan-log-item {
  --padding-start: 16px;
  --padding-end: 16px;
  --inner-padding-end: 16px;
  --min-height: 80px;
}

.user-avatar {
  width: 44px;
  height: 44px;
}

.placeholder-icon {
  font-size: 24px;
  color: var(--ion-color-medium);
}

.product-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 4px;
}

.product-name {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: var(--ion-color-dark);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
}

.user-row {
  margin-bottom: 4px;
}

.user-name {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  display: flex;
  align-items: center;
  gap: 4px;
}

.metadata {
  display: flex;
  gap: 12px;
  font-size: 0.8rem;
  color: var(--ion-color-step-600);
}

.metadata span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.inline-icon {
  font-size: 12px;
  opacity: 0.7;
}

.status-badge {
  --padding-start: 6px;
  --padding-end: 6px;
  --padding-top: 2px;
  --padding-bottom: 2px;
  font-size: 0.65rem;
  font-weight: 600;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  /* Muted badges for dark mode */
  background: transparent;
  border: 1px solid currentColor;
  opacity: 0.8;
}

.status-badge[color="success"] { color: var(--ion-color-success); }
.status-badge[color="danger"] { color: var(--ion-color-danger); }
.status-badge[color="warning"] { color: var(--ion-color-warning); }
.status-badge[color="primary"] { color: var(--ion-color-primary); }
.status-badge[color="medium"] { color: var(--ion-color-medium); }

/* Modal Styles */
.modal-content {
  --background: var(--ion-background-color);
}

.header-section {
  padding: 24px;
  border-radius: 16px;
  margin-bottom: 20px;
  text-align: center;
  color: white;
  position: relative;
  overflow: hidden;
}

.header-section.status-success { background: linear-gradient(135deg, var(--ion-color-success), var(--ion-color-success-shade)); }
.header-section.status-danger { background: linear-gradient(135deg, var(--ion-color-danger), var(--ion-color-danger-shade)); }
.header-section.status-warning { background: linear-gradient(135deg, var(--ion-color-warning), var(--ion-color-warning-shade)); }
.header-section.status-primary { background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade)); }
.header-section.status-medium { background: linear-gradient(135deg, var(--ion-color-medium), var(--ion-color-medium-shade)); }

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: center;
  margin-bottom: 20px;
}

.modal-avatar {
  width: 50px;
  height: 50px;
  border: 2px solid rgba(255,255,255,0.8);
}

.user-text h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.user-text p {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.9;
}

.status-hero {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: white;
  text-align: center;
  padding: 10px 0;
}

.product-name-hero {
  font-size: 1.5rem;
  font-weight: 800;
  margin: 0 0 16px 0;
  line-height: 1.25;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
  max-width: 90%;
}

.status-badge-hero {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.25);
  padding: 10px 24px;
  border-radius: 99px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  margin-bottom: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.status-badge-hero ion-icon {
  font-size: 28px;
  margin: 0;
}

.status-badge-hero span {
  font-size: 1.3rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.5px;
}

.time-hero {
  font-size: 0.95rem;
  opacity: 0.85;
  margin: 0;
  font-weight: 500;
}

.info-card {
  margin: 0 0 20px 0;
  border-radius: 12px;
  background: var(--ion-card-background, var(--ion-item-background));
  border: 1px solid var(--ion-color-step-150);
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
}

.info-item .label {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  margin-bottom: 4px;
}

.info-item .value {
  font-size: 0.9rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}

.ocr-section, .highlights-section {
  margin-bottom: 24px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: var(--ion-color-dark);
}

.section-title h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
}

.ocr-box {
  background: var(--ion-item-background);
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 12px;
  border: 1px solid var(--ion-color-step-150);
}

.ocr-box label {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--ion-color-carrot);
  text-transform: uppercase;
  display: block;
  margin-bottom: 8px;
}

.text-content {
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--ion-color-dark);
}

.highlights-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Status Chips Soft Style (local version for modal) */
.status-chip {
  --background: transparent;
  --color: inherit;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  height: auto;
  padding: 4px 10px;
}

.chip-success {
  background: rgba(var(--ion-color-success-rgb), 0.15) !important;
  color: var(--ion-color-success) !important;
  border: 1px solid rgba(var(--ion-color-success-rgb), 0.5);
}

.chip-primary {
  background: rgba(var(--ion-color-primary-rgb), 0.15) !important;
  color: var(--ion-color-primary) !important;
  border: 1px solid rgba(var(--ion-color-primary-rgb), 0.5);
}

.chip-warning {
  background: rgba(var(--ion-color-warning-rgb), 0.18) !important;
  color: var(--ion-color-warning) !important;
  border: 1px solid rgba(var(--ion-color-warning-rgb), 0.6);
}

.chip-danger {
  background: rgba(var(--ion-color-danger-rgb), 0.15) !important;
  color: var(--ion-color-danger) !important;
  border: 1px solid rgba(var(--ion-color-danger-rgb), 0.6);
}

.chip-medium {
  background: rgba(127, 140, 141, 0.15) !important;
  color: var(--ion-color-medium) !important;
  border: 1px solid rgba(127, 140, 141, 0.4);
}

.error-item {
  border-radius: 12px;
  margin-bottom: 20px;
}

.raw-ocr-accordion {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--ion-color-step-150);
}

.raw-content {
  padding: 16px;
  background: var(--ion-color-step-50);
}

.raw-content pre {
  margin: 0;
  font-size: 0.8rem;
  white-space: pre-wrap;
  font-family: monospace;
}
</style>


