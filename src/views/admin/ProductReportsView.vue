<template>
  <ion-page>
    <ion-header>
      <app-header
          :title="$t('profile.admin.productReports')"
          :icon="listOutline"
          :showBack="true"
          backRoute="/profile"
      />
      <ion-toolbar>
        <ion-segment v-model="statusFilter" mode="ios">
          <ion-segment-button value="pending">
            <ion-label>{{ $t('admin.reportStatus.pending') }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="reviewing">
            <ion-label>{{ $t('admin.reportStatus.reviewing') }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="resolved">
            <ion-label>{{ $t('admin.reportStatus.resolved') }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="rejected">
            <ion-label>{{ $t('admin.reportStatus.rejected') }}</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div v-if="loading">
        <ion-list>
          <ion-item v-for="n in 5" :key="n">
            <ion-label>
              <h2><ion-skeleton-text animated style="width: 60%" /></h2>
              <p><ion-skeleton-text animated style="width: 40%" /></p>
            </ion-label>
          </ion-item>
        </ion-list>
      </div>

      <ion-list v-else-if="reports.length">
        <ion-item v-for="report in reports" :key="report.id" button @click="openReport(report)">
          <ion-label>
            <h2>{{ report.products?.name || 'Unknown Product' }}</h2>
            <p>{{ truncate(report.description, 40) }} - {{ new Date(report.created_at).toLocaleDateString() }}</p>
            <ion-note slot="end" :color="getStatusColor(report.status)">
              {{ $t(`admin.reportStatus.${report.status}`) }}
            </ion-note>
          </ion-label>
        </ion-item>
      </ion-list>

      <div v-else class="empty-state">
        <ion-text color="medium">{{ $t('admin.noReports') || 'No reports found' }}</ion-text>
      </div>

      <!-- Report Detail Modal -->
      <ion-modal :is-open="!!selectedReport" @didDismiss="selectedReport = null">
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ $t('admin.reportDetail') || 'Report Detail' }}</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="selectedReport = null">{{ $t('admin.close') }}</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding" v-if="selectedReport">
          <ion-list>
            <ion-item>
              <ion-label>
                <h2>{{ $t('admin.productName') || 'Product' }}</h2>
                <p>{{ selectedReport.products?.name }}</p>
                <p v-if="selectedReport.barcode">Barcode: {{ selectedReport.barcode }}</p>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                <h2>{{ $t('admin.reason') || 'Reason' }}</h2>
                <p>{{ truncate(selectedReport.description, 30) }}</p>
                <div v-if="selectedReport.image_url" class="photo-grid">
                  <img :src="selectedReport.image_url" class="report-photo" />
                </div>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                <h2>{{ $t('admin.description') }}</h2>
                <p style="white-space: pre-wrap;">{{ selectedReport.description || 'No description' }}</p>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                <h2>{{ $t('admin.reporter') || 'Reporter' }}</h2>
                <p>{{ selectedReport.profiles?.display_name || selectedReport.reported_by }}</p>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                <h2>{{ $t('admin.status') || 'Status' }}</h2>
                <ion-select v-model="selectedReport.status" @ionChange="updateStatus">
                  <ion-select-option value="pending">{{ $t('admin.reportStatus.pending') }}</ion-select-option>
                  <ion-select-option value="reviewing">{{ $t('admin.reportStatus.reviewing') }}</ion-select-option>
                  <ion-select-option value="resolved">{{ $t('admin.reportStatus.resolved') }}</ion-select-option>
                  <ion-select-option value="rejected">{{ $t('admin.reportStatus.rejected') }}</ion-select-option>
                </ion-select>
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-content>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, reactive } from 'vue'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem,
  IonLabel, IonNote, IonSkeletonText, IonSegment, IonSegmentButton,
  IonModal, IonButtons, IonButton, IonSelect, IonSelectOption, IonText
} from '@ionic/vue'
import { listOutline } from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import { supabase } from '@/plugins/supabaseClient'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const loading = ref(true)
const reports = ref<any[]>([])
const statusFilter = ref('pending')
const selectedReport = ref<any>(null)

async function fetchReports() {
  loading.value = true
  const { data, error } = await supabase
    .from('product_reports')
    .select(`
      *,
      products!barcode (name),
      profiles:reported_by (display_name)
    `)
    .eq('status', statusFilter.value)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching product reports:', error)
  } else {
    reports.value = data || []
  }
  loading.value = false
}

function getStatusColor(status: string) {
  switch (status) {
    case 'pending': return 'warning'
    case 'reviewing': return 'primary'
    case 'resolved': return 'success'
    case 'rejected': return 'danger'
    default: return 'medium'
  }
}

function openReport(report: any) {
  selectedReport.value = { ...report }
}

function truncate(text: string, length: number) {
  if (!text) return ''
  return text.length > length ? text.substring(0, length) + '...' : text
}

async function updateStatus() {
  if (!selectedReport.value) return

  const { error } = await supabase
    .from('product_reports')
    .update({ status: selectedReport.value.status })
    .eq('id', selectedReport.value.id)

  if (!error) {
    fetchReports()
    // Update local list
    const idx = reports.value.findIndex(r => r.id === selectedReport.value.id)
    if (idx !== -1 && selectedReport.value.status !== statusFilter.value) {
      reports.value.splice(idx, 1)
    }
  }
}

watch(statusFilter, fetchReports)
onMounted(fetchReports)
</script>

<style scoped>
.empty-state {
  text-align: center;
  margin-top: 40px;
}
.photo-grid {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  overflow-x: auto;
}
.report-photo {
  width: 100px;
  height: 100px;
  border-radius: 8px;
  object-fit: cover;
}
</style>
