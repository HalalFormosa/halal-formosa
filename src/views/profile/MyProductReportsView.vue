<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('profile.myProductReports.title')" show-back back-route="/profile" :icon="icons.flagOutline" />
      <ion-toolbar class="actions-toolbar">
        <div class="header-main-actions">
          <div style="flex: 1;"></div>
          <ion-segment v-model="viewMode" mode="ios" style="width: 200px;">
            <ion-segment-button value="active">
              <ion-label>{{ $t('profile.activeReports') }}</ion-label>
            </ion-segment-button>
            <ion-segment-button value="history">
              <ion-label>{{ $t('profile.historyReports') }}</ion-label>
            </ion-segment-button>
          </ion-segment>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div v-if="loading && reports.length === 0" class="ion-text-center ion-margin-top">
        <ion-spinner />
      </div>

      <template v-else>
        <div v-if="reports.length === 0" class="empty-state">
          <ion-icon :icon="viewMode === 'active' ? icons.flagOutline : icons.checkmarkDoneOutline" class="empty-icon" />
          <h3>{{ viewMode === 'active' ? $t('profile.myProductReports.noReports') : 'No report history' }}</h3>
          <p v-if="viewMode === 'active'">Thank you for helping us keep the database accurate!</p>
        </div>

        <template v-else>
          <ion-list lines="none" class="contributions-list">
            <ion-item 
              v-for="report in reports" 
              :key="report.id" 
              button 
              @click="openReport(report)"
              class="contribution-item"
            >
              <ion-thumbnail slot="start" v-if="report.image_url || report.products?.photo_front_url">
                <img :src="report.image_url || report.products?.photo_front_url" alt="Product" />
              </ion-thumbnail>
              <ion-icon v-else slot="start" :icon="icons.cubeOutline" class="item-icon-placeholder" />
              
              <ion-label>
                <h3 class="product-name">{{ report.products?.name || 'Unknown Product' }}</h3>
                <p class="description-preview">{{ truncate(report.description, 60) }}</p>
                <div class="status-row">
                  <ion-chip 
                    size="small" 
                    :color="getStatusColor(report.status)"
                    class="status-chip"
                  >
                    {{ $t(`admin.reportStatus.${report.status}`) }}
                  </ion-chip>
                  <span class="date-text">{{ formatDate(report.created_at) }}</span>
                </div>
              </ion-label>
            </ion-item>
          </ion-list>

          <ion-infinite-scroll 
            @ionInfinite="loadMore" 
            :disabled="infiniteDisabled"
          >
            <ion-infinite-scroll-content loading-spinner="bubbles" />
          </ion-infinite-scroll>
        </template>
      </template>

      <!-- Report Detail Modal -->
      <ion-modal :is-open="!!selectedReport" @didDismiss="selectedReport = null">
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ $t('profile.reportDetail') }}</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="selectedReport = null">
                <ion-icon slot="icon-only" :icon="icons.closeOutline" />
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding" v-if="selectedReport">
          <div class="modal-body">
            <!-- Product summary card -->
            <div class="summary-card">
              <ion-thumbnail v-if="selectedReport.products?.photo_front_url" class="summary-thumb">
                <img :src="selectedReport.products.photo_front_url" alt="Product" />
              </ion-thumbnail>
              <ion-icon v-else :icon="icons.cubeOutline" class="summary-icon-fallback" />

              <div class="summary-info">
                <h2 class="summary-name">{{ selectedReport.products?.name || 'Unknown Product' }}</h2>
                <p v-if="selectedReport.barcode" class="summary-barcode">Barcode: {{ selectedReport.barcode }}</p>
                <div class="summary-meta-row">
                  <ion-chip size="small" :color="getStatusColor(selectedReport.status)" class="summary-status-chip">
                    {{ $t(`admin.reportStatus.${selectedReport.status}`) }}
                  </ion-chip>
                  <span class="summary-date">{{ formatDate(selectedReport.created_at) }}</span>
                </div>
              </div>
            </div>

            <!-- Report reason -->
            <div class="section-block">
              <label class="section-label">
                <ion-icon :icon="icons.documentTextOutline" />
                Report reason
              </label>
              <p class="report-desc">{{ selectedReport.description || 'No description provided' }}</p>
              <div v-if="selectedReport.image_url" class="report-image-container">
                <img :src="selectedReport.image_url" class="report-image" />
              </div>
            </div>

            <!-- Conversation -->
            <div class="section-block conversation-section">
              <label class="section-label">
                <ion-icon :icon="icons.chatbubblesOutline" />
                Conversation
              </label>
              <div class="conversation-wrapper">
                <report-conversation :product-report-id="selectedReport.id" :status="selectedReport.status" />
              </div>
            </div>
          </div>
        </ion-content>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { supabase } from '@/plugins/supabaseClient';
import { 
  IonPage, IonHeader, IonContent, IonSpinner, IonList, IonItem, 
  IonThumbnail, IonLabel, IonChip, IonIcon, IonButton,
  IonInfiniteScroll, IonInfiniteScrollContent, IonToolbar,
  IonSegment, IonSegmentButton, IonModal, IonTitle, IonButtons
} from '@ionic/vue';
import { flagOutline, checkmarkDoneOutline, cubeOutline, chatbubblesOutline, closeOutline, documentTextOutline } from 'ionicons/icons';
import AppHeader from '@/components/AppHeader.vue';
import ReportConversation from '@/components/ReportConversation.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const loading = ref(true);
const reports = ref<any[]>([]);
const infiniteDisabled = ref(false);
const pageSize = 15;
const currentPage = ref(0);
const viewMode = ref<'active' | 'history'>('active');
const selectedReport = ref<any>(null);

const icons = {
  flagOutline,
  checkmarkDoneOutline,
  cubeOutline,
  chatbubblesOutline,
  closeOutline,
  documentTextOutline
};

async function loadMyReports(reset = false) {
  if (reset) {
    currentPage.value = 0;
    reports.value = [];
    infiniteDisabled.value = false;
  }

  loading.value = true;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    loading.value = false;
    return;
  }

  const start = currentPage.value * pageSize;
  const end = start + pageSize - 1;

  let query = supabase
    .from('product_reports')
    .select(`
      *,
      products!barcode (name, photo_front_url)
    `)
    .eq('reported_by', user.id);

  // Filter by view mode
  if (viewMode.value === 'active') {
    query = query.in('status', ['pending', 'reviewing']);
  } else {
    query = query.in('status', ['resolved', 'rejected']);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(start, end);

  if (!error && data) {
    reports.value.push(...data);
    if (data.length < pageSize) {
      infiniteDisabled.value = true;
    }
  } else {
    infiniteDisabled.value = true;
  }
  
  loading.value = false;
}

async function loadMore(ev: any) {
  currentPage.value++;
  await loadMyReports();
  ev.target.complete();
}

function openReport(report: any) {
  selectedReport.value = report;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'pending': return 'warning';
    case 'reviewing': return 'primary';
    case 'resolved': return 'success';
    case 'rejected': return 'danger';
    default: return 'medium';
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function truncate(text: string, length: number) {
  if (!text) return '';
  return text.length > length ? text.substring(0, length) + '...' : text;
}

let subscription: any = null

function setupRealtime() {
  subscription = supabase
    .channel('my_product_reports')
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'product_reports',
      // We can't use filter with currentUserId directly here as it might change, 
      // but for "My" views it's generally safe once loaded.
    }, (payload: any) => {
      // Refresh list
      loadMyReports()
      
      // Update selected report if it's open and matches the changed record
      if (selectedReport.value && selectedReport.value.id === payload.new?.id) {
        selectedReport.value = { ...selectedReport.value, ...payload.new }
      }
    })
    .subscribe()
}

async function openReportById(reportId: string) {
  const { data } = await supabase
    .from('product_reports')
    .select(`*, products!barcode (name, photo_front_url)`)
    .eq('id', reportId)
    .maybeSingle();
  if (data) selectedReport.value = data;
}

onMounted(async () => {
  await loadMyReports(true);
  setupRealtime();

  const reportId = route.query.reportId as string | undefined;
  if (reportId) await openReportById(reportId);
});

onUnmounted(() => {
  if (subscription) {
    supabase.removeChannel(subscription);
  }
});

watch(viewMode, () => {
  loadMyReports(true);
});
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  text-align: center;
  color: var(--ion-color-medium);
  padding: 20px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.contributions-list {
  background: transparent;
}

.contribution-item {
  margin-bottom: 12px;
  --border-radius: 16px;
  --background: var(--ion-color-step-50);
  box-shadow: var(--card-shadow);
}

.product-name {
  font-weight: 700;
  font-size: 1rem;
  margin-bottom: 4px;
}

.description-preview {
  font-size: 0.85rem;
  color: var(--ion-color-step-600);
  margin-bottom: 8px;
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.status-chip {
  font-size: 0.7rem;
  height: 24px;
  margin: 0;
}

.date-text {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

ion-thumbnail {
  --size: 60px;
  --border-radius: 12px;
}

.item-icon-placeholder {
  font-size: 32px;
  color: var(--ion-color-medium);
  margin-right: 16px;
  opacity: 0.3;
}

/* Modal Styles */
.modal-body {
  padding-bottom: 32px;
}

/* Product summary card */
.summary-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: var(--card-inner-bg, var(--ion-color-step-50));
  border: 1px solid var(--card-border, rgba(0,0,0,0.06));
  border-radius: 16px;
  padding: 14px;
  margin-bottom: 16px;
}

.summary-thumb {
  width: 56px;
  height: 56px;
  --border-radius: 10px;
  flex-shrink: 0;
}

.summary-icon-fallback {
  width: 56px;
  height: 56px;
  font-size: 28px;
  color: var(--ion-color-medium);
  background: rgba(0, 0, 0, 0.06);
  border-radius: 10px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ion-palette-dark .summary-icon-fallback {
  background: rgba(255, 255, 255, 0.1);
}

.summary-info {
  flex: 1;
  min-width: 0;
}

.summary-name {
  font-size: 1.05rem;
  font-weight: 800;
  margin: 0 0 2px 0;
}

.summary-barcode {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  margin: 0 0 8px 0;
}

.summary-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.summary-status-chip {
  margin: 0;
  font-weight: 700;
}

.summary-date {
  font-size: 0.78rem;
  color: var(--ion-color-medium);
}

/* Section blocks (report reason / conversation) */
.section-block {
  margin-bottom: 16px;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ion-color-medium);
  font-weight: 700;
  margin-bottom: 8px;
}

.section-label ion-icon {
  font-size: 16px;
  color: var(--ion-color-carrot);
}

.report-desc {
  white-space: pre-wrap;
  line-height: 1.5;
  background: rgba(0, 0, 0, 0.06);
  padding: 12px;
  border-radius: 12px;
  margin: 0;
}

.ion-palette-dark .report-desc {
  background: rgba(255, 255, 255, 0.1);
}

.report-image-container {
  margin-top: 8px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--card-shadow);
}

.report-image {
  width: 100%;
  display: block;
}

/* Header Action Styles */
.header-main-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 16px;
  width: 100%;
}

.actions-toolbar {
  --background: var(--ion-background-color);
  --border-width: 0;
  --min-height: auto;
}

.conversation-wrapper {
  height: 420px;
}
</style>
