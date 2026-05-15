<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('profile.myLocationReports.title')" show-back back-route="/profile" :icon="icons.flagOutline" />
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
          <h3>{{ viewMode === 'active' ? $t('profile.myLocationReports.noReports') : 'No report history' }}</h3>
          <p v-if="viewMode === 'active'">Thank you for helping us keep the map accurate!</p>
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
              <ion-icon slot="start" :icon="icons.locationOutline" class="item-icon-placeholder" />
              
              <ion-label>
                <h3 class="product-name">{{ report.locations?.name || 'Unknown Location' }}</h3>
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
              <ion-button @click="selectedReport = null">{{ $t('master.close') }}</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding" v-if="selectedReport">
          <div class="modal-body">
            <div class="detail-section">
              <label>Location</label>
              <div class="detail-value">
                <strong>{{ selectedReport.locations?.name }}</strong>
              </div>
            </div>

            <div class="detail-section">
              <label>Status</label>
              <div class="detail-value">
                <ion-chip :color="getStatusColor(selectedReport.status)">
                  {{ $t(`admin.reportStatus.${selectedReport.status}`) }}
                </ion-chip>
              </div>
            </div>

            <div class="detail-section">
              <label>Description</label>
              <div class="detail-value report-desc">
                {{ selectedReport.description || 'No description provided' }}
              </div>
            </div>

            <div class="detail-section">
              <label>Submitted On</label>
              <div class="detail-value">
                {{ formatDate(selectedReport.created_at) }}
              </div>
            </div>

            <div class="conversation-section">
              <div class="conversation-header">
                <ion-icon :icon="icons.chatbubblesOutline" />
                <span>Conversation</span>
              </div>
              <div class="conversation-wrapper">
                <report-conversation :location-report-id="selectedReport.id" :status="selectedReport.status" />
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
import { useRouter } from 'vue-router';
import { supabase } from '@/plugins/supabaseClient';
import { 
  IonPage, IonHeader, IonContent, IonSpinner, IonList, IonItem, 
  IonLabel, IonChip, IonIcon, IonButton,
  IonInfiniteScroll, IonInfiniteScrollContent, IonToolbar,
  IonSegment, IonSegmentButton, IonModal, IonTitle, IonButtons
} from '@ionic/vue';
import { flagOutline, checkmarkDoneOutline, locationOutline, chatbubblesOutline } from 'ionicons/icons';
import AppHeader from '@/components/AppHeader.vue';
import ReportConversation from '@/components/ReportConversation.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const router = useRouter();
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
  locationOutline,
  chatbubblesOutline
};

const currentUserId = ref<string | null>(null);
let subscription: any = null;

function setupRealtime() {
  if (!currentUserId.value) return;
  subscription = supabase
    .channel('my_location_reports')
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'location_reports',
      filter: `reported_by=eq.${currentUserId.value}`
    }, (payload) => {
      // Refresh list
      loadMyReports()
      
      // Update selected report if it's open
      if (selectedReport.value && selectedReport.value.id === payload.new?.id) {
        selectedReport.value = { ...selectedReport.value, ...payload.new }
      }
    })
    .subscribe();
}

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
  currentUserId.value = user.id;

  const start = currentPage.value * pageSize;
  const end = start + pageSize - 1;

  let query = supabase
    .from('location_reports')
    .select(`
      *,
      locations (name)
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

onMounted(async () => {
  await loadMyReports(true);
  setupRealtime();
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
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
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

.detail-section {
  margin-bottom: 20px;
}

.detail-section label {
  display: block;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--ion-color-medium);
  font-weight: 600;
  margin-bottom: 4px;
  letter-spacing: 0.05em;
}

.detail-value {
  font-size: 1rem;
  color: var(--ion-text-color);
}

.report-desc {
  white-space: pre-wrap;
  line-height: 1.5;
  background: var(--ion-color-step-50);
  padding: 12px;
  border-radius: 12px;
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
.conversation-section {
  margin-top: 8px;
}

.conversation-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--ion-color-step-600, #666);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 12px 4px 8px 4px;
  border-top: 1px solid var(--ion-color-step-100, rgba(0,0,0,0.06));
}

.conversation-header ion-icon {
  font-size: 18px;
  color: var(--ion-color-primary);
}

.conversation-wrapper {
  height: 380px;
}
</style>
