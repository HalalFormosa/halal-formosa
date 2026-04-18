<template>
  <ion-page>
    <ion-header>
      <app-header
          :title="$t('profile.admin.analytics')"
          :icon="listOutline"
          :showBack="true"
      />
    </ion-header>

    <ion-content class="ion-padding alternate-bg">
      <!-- DATE RANGE SELECTOR -->
      <section class="controls-section ion-margin-bottom">
        <div class="header-segment">
          <div class="segment-wrapper glass-effect">
            <ion-segment v-model="selectedRange" @ionChange="onRangeChange" color="carrot" mode="ios">
              <ion-segment-button value="daily">
                <ion-label>{{ $t('admin.daily') }}</ion-label>
              </ion-segment-button>
              <ion-segment-button value="weekly">
                <ion-label>{{ $t('admin.weekly') }}</ion-label>
              </ion-segment-button>
              <ion-segment-button value="monthly">
                <ion-label>{{ $t('admin.monthly') }}</ion-label>
              </ion-segment-button>
              <ion-segment-button value="custom">
                <ion-label>{{ $t('admin.custom') }}</ion-label>
              </ion-segment-button>
            </ion-segment>
          </div>
          
          <div v-if="selectedRange === 'custom'" class="custom-range-label" @click="showDateModal = true">
            <ion-icon :icon="calendarOutline" />
            <span>{{ formattedCustomRange }}</span>
          </div>
        </div>
      </section>

      <!-- 💡 TOP INSIGHTS SUMMARY -->
      <ion-card class="modern-card insight-card">
        <ion-card-header>
          <div class="title-with-icon">
            <ion-icon :icon="sparklesOutline" color="carrot" />
            <ion-card-title>{{ $t('admin.quickInsights') || 'Key Insights' }}</ion-card-title>
          </div>
        </ion-card-header>
        <ion-card-content>
          <div class="insights-container">
            <div v-for="(insight, idx) in generatedInsights" :key="idx" class="insight-item">
              <ion-icon :icon="checkmarkCircleOutline" color="success" />
              <span>{{ insight }}</span>
            </div>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- 📊 KEY METRICS GRID -->
      <div class="stats-grid">
        <div class="stat-card">
          <p class="stat-label">{{ $t('admin.dau') }}</p>
          <h2 class="stat-value">{{ dau.toLocaleString() }}</h2>
          <div class="stat-meta" :class="dauTrend > 0 ? 'trend-up' : 'trend-down'">
            <ion-icon :icon="dauTrend > 0 ? trendingUpOutline : trendingDownOutline" />
            <span>{{ Math.abs(dauTrend) }}% vs prev</span>
          </div>
        </div>
        <div class="stat-card">
          <p class="stat-label">{{ $t('admin.newUsers') || 'New Users' }}</p>
          <h2 class="stat-value">{{ newUsers.toLocaleString() }}</h2>
          <div class="stat-meta neutral">
            <ion-icon :icon="personAddOutline" />
            <span>This period</span>
          </div>
        </div>
        <div class="stat-card">
          <p class="stat-label">{{ $t('admin.conversion') || 'Conversion' }}</p>
          <h2 class="stat-value">{{ (globalConversion * 100).toFixed(1) }}%</h2>
          <div class="stat-meta" :class="globalConversion >= 0.5 ? 'trend-up' : 'trend-neutral'">
             <span>Success rate</span>
          </div>
        </div>
        <div class="stat-card">
          <p class="stat-label">{{ $t('admin.stickiness') || 'Stickiness' }}</p>
          <h2 class="stat-value">{{ (stickinessRatio * 100).toFixed(1) }}%</h2>
          <p class="stat-subtext">DAU / MAU</p>
        </div>
      </div>

      <!-- 🌍 DEMOGRAPHICS & SEGMENTATION -->
      <ion-grid class="ion-no-padding">
        <ion-row>
          <ion-col size="12" size-md="6">
            <ion-card class="modern-card">
              <ion-card-header>
                <ion-card-title>🌍 {{ $t('admin.topNationalities') || 'Top Nationalities' }}</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <div class="doughnut-container">
                  <Doughnut v-if="nationalityChartData" :data="nationalityChartData" :options="doughnutOptions" />
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>
          <ion-col size="12" size-md="6">
            <ion-card class="modern-card">
              <ion-card-header>
                <ion-card-title>💎 {{ $t('admin.accountRatios') || 'Pro vs Free' }}</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <div class="doughnut-container">
                  <Doughnut v-if="accountTypeChartData" :data="accountTypeChartData" :options="doughnutOptions" />
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>
      </ion-grid>

      <!-- 🎯 FUNNEL ANALYSIS -->
      <ion-card class="modern-card">
        <ion-card-header>
          <ion-card-title>🎯 {{ $t('admin.scanFunnel') || 'Scan Success Funnel' }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div class="chart-container-large">
            <Bar v-if="funnelChartData" :data="funnelChartData" :options="funnelChartOptions" />
          </div>
          <div class="funnel-labels ion-margin-top">
             <div class="funnel-stat">
               <span class="dot carrot"></span>
               <strong>{{ scanFunnel?.start || 0 }}</strong> Starts
             </div>
             <div class="funnel-stat">
               <span class="dot mint"></span>
               <strong>{{ scanFunnel?.success || 0 }}</strong> Success ({{ scanSuccessRate }}%)
             </div>
             <div class="funnel-stat">
               <span class="dot red"></span>
               <strong>{{ scanFunnel?.error || 0 }}</strong> Errors
             </div>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- TRENDS -->
      <ion-card class="modern-card">
        <ion-card-header>
          <ion-card-title>📈 {{ $t('admin.activityTrends') || 'Daily Activity Trends' }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div class="chart-container-large">
            <Bar v-if="dailyChartData" :data="dailyChartData" :options="trendChartOptions" />
          </div>
        </ion-card-content>
      </ion-card>

      <ion-grid class="ion-no-padding">
        <ion-row>
          <ion-col size="12" size-md="6">
            <!-- MOST USED FEATURES -->
            <ion-card class="modern-card">
              <ion-card-header>
                <ion-card-title>🔥 {{ $t('admin.topFeatures') || 'Top Features' }}</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <ion-list lines="full">
                  <ion-item v-for="(f, i) in topFeatures.slice(0, 8)" :key="i">
                    <ion-label>{{ f.activity_type.replace(/_/g, ' ') }}</ion-label>
                    <ion-badge slot="end" color="primary">{{ f.count.toLocaleString() }}</ion-badge>
                  </ion-item>
                </ion-list>
              </ion-card-content>
            </ion-card>
          </ion-col>
          <ion-col size="12" size-md="6">
             <!-- HOURLY ACTIVITY -->
            <ion-card class="modern-card">
              <ion-card-header>
                <ion-card-title>⏳ {{ $t('admin.hourlyDistribution') || 'Activity by Hour' }}</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <div class="chart-container">
                  <Bar v-if="hourlyChartData" :data="hourlyChartData" :options="hourlyChartOptions" />
                </div>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>
      </ion-grid>

      <!-- TOP PRODUCTS/LOCATIONS -->
      <ion-grid class="ion-no-padding">
        <ion-row>
          <ion-col size="12" size-md="4">
            <ion-card class="modern-card">
              <ion-card-header><ion-card-title>🥘 {{ $t('admin.topProducts') || 'Top Products' }}</ion-card-title></ion-card-header>
              <ion-card-content>
                 <ion-list lines="none">
                    <ion-item v-for="(p, i) in topProducts" :key="i">
                      <ion-label>{{ shortName(p.name) }}</ion-label>
                      <ion-badge slot="end" color="success">{{ p.count }}</ion-badge>
                    </ion-item>
                 </ion-list>
              </ion-card-content>
            </ion-card>
          </ion-col>
          <ion-col size="12" size-md="4">
            <ion-card class="modern-card">
              <ion-card-header><ion-card-title>🕌 {{ $t('admin.topLocations') || 'Top Locations' }}</ion-card-title></ion-card-header>
              <ion-card-content>
                 <ion-list lines="none">
                    <ion-item v-for="(l, i) in topLocations" :key="i">
                      <ion-label>{{ l.name || '(Unnamed)' }}</ion-label>
                      <ion-badge slot="end" color="tertiary">{{ l.count }}</ion-badge>
                    </ion-item>
                 </ion-list>
              </ion-card-content>
            </ion-card>
          </ion-col>
          <ion-col size="12" size-md="4">
            <ion-card class="modern-card">
              <ion-card-header><ion-card-title>🔍 {{ $t('admin.topSearches') || 'Top Searches' }}</ion-card-title></ion-card-header>
              <ion-card-content>
                 <ion-list lines="none">
                    <ion-item v-for="(s, i) in topSearches" :key="i">
                      <ion-label>{{ s.name }}</ion-label>
                      <ion-badge slot="end" color="medium">{{ s.count }}</ion-badge>
                    </ion-item>
                 </ion-list>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>
      </ion-grid>

      <!-- 📅 CUSTOM DATE MODAL -->
      <ion-modal :is-open="showDateModal" @didDismiss="showDateModal = false" class="date-selection-modal">
        <ion-header>
          <ion-toolbar color="carrot">
            <ion-buttons slot="start">
              <ion-button @click="showDateModal = false">{{ $t('common.cancel') }}</ion-button>
            </ion-buttons>
            <ion-title>{{ $t('admin.selectDates') }}</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="applyCustomDates" strong>{{ $t('common.apply') }}</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding content-background">
          <div class="date-pickers-container">
            <div class="date-picker-group">
              <ion-label class="picker-label">{{ $t('admin.startDate') }}</ion-label>
              <ion-datetime
                presentation="date"
                v-model="tempStartDate"
                class="glass-effect-dark"
                mode="ios"
              ></ion-datetime>
            </div>
            <div class="date-picker-group">
              <ion-label class="picker-label">{{ $t('admin.endDate') }}</ion-label>
              <ion-datetime
                presentation="date"
                v-model="tempEndDate"
                class="glass-effect-dark"
                mode="ios"
              ></ion-datetime>
            </div>
          </div>
        </ion-content>
      </ion-modal>

     </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {ref, onMounted, computed} from "vue";
import { isDark } from "@/composables/useTheme";
import { supabase } from "@/plugins/supabaseClient";
import { isAdmin } from "@/composables/userProfile";
import { useRouter } from "vue-router";
import { countries, loadCountries } from '@/composables/useCountries';
import AppHeader from "@/components/AppHeader.vue";
import {
  listOutline, trendingUpOutline, trendingDownOutline,
  personAddOutline, sparklesOutline, checkmarkCircleOutline, calendarOutline
} from "ionicons/icons";
import {
  IonPage, IonHeader, IonContent, IonSegment, IonSegmentButton, IonLabel,
  IonGrid, IonRow, IonCol, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonIcon, IonList, IonItem, IonBadge, IonModal, IonToolbar, IonButtons, IonButton,
  IonDatetime, IonTitle
} from "@ionic/vue";
import { useI18n } from "vue-i18n";
import dayjs from "dayjs";

/* Chart.js */
import { Bar, Doughnut } from "vue-chartjs";
import {
  Chart as ChartJS, Title, Tooltip, Legend, BarElement, LineElement,
  PointElement, CategoryScale, LinearScale, LineController, ArcElement
} from "chart.js";

ChartJS.register(Title, Tooltip, Legend, BarElement, LineElement, PointElement, CategoryScale, LinearScale, LineController, ArcElement);

const router = useRouter();
const { t } = useI18n();

// Summary Stats
const dau = ref(0);
const newUsers = ref(0);
const dauTrend = ref(0);
const globalConversion = ref(0);
const stickinessRatio = ref(0);

// Data for charts/lists
const demographicsData = ref<any>(null);
const scanFunnel = ref<any>(null);
const topFeatures = ref<any[]>([]);
const topProducts = ref<any[]>([]);
const topLocations = ref<any[]>([]);
const topSearches = ref<any[]>([]);
const hourlyChartData = ref<any>(null);
const recentTrends = ref<any>(null);

// Date Handling
const selectedRange = ref('daily');
const customStartDate = ref(dayjs().subtract(7, 'day').format('YYYY-MM-DD'));
const customEndDate = ref(dayjs().format('YYYY-MM-DD'));
const tempStartDate = ref(customStartDate.value);
const tempEndDate = ref(customEndDate.value);
const showDateModal = ref(false);

const formattedCustomRange = computed(() => {
  return `${dayjs(customStartDate.value).format('MMM D')} - ${dayjs(customEndDate.value).format('MMM D, YYYY')}`;
});

const generatedInsights = ref<string[]>([]);

/* Chart Computed Data */
const nationalityChartData = computed(() => {
  if (!demographicsData.value?.nationalities) return null;
  const data = demographicsData.value.nationalities;
  return {
    labels: data.map((n:any) => {
      const match = countries.value.find(c => c.cca2 === n.name);
      return match ? match.name.common : n.name;
    }),
    datasets: [{
      data: data.map((n:any) => n.value as number),
      backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF']
    }]
  };
});

const accountTypeChartData = computed(() => {
  if (!demographicsData.value?.account_types) return null;
  const data = demographicsData.value.account_types;
  return {
    labels: data.map((n:any) => n.name || 'Free'),
    datasets: [{
      data: data.map((n:any) => n.value as number),
      backgroundColor: ['#2ecc71', '#e67e22']
    }]
  };
});

const funnelChartData = computed(() => {
  if (!scanFunnel.value?.start) return null;
  return {
    labels: ['Starts', 'Success', 'Errors'],
    datasets: [{
      label: 'Volume',
      data: [scanFunnel.value.start, scanFunnel.value.success, scanFunnel.value.error].map(v => v as number),
      backgroundColor: ['rgba(255, 159, 64, 0.7)', 'rgba(46, 204, 113, 0.7)', 'rgba(231, 76, 60, 0.7)']
    }]
  };
});

const dailyChartData = computed(() => {
  if (!recentTrends.value?.daily) return null;
  const entries = Object.entries(recentTrends.value.daily as Record<string, number>).sort();
  return {
    labels: entries.map(([d]) => d.split('-').slice(1).join('/')),
    datasets: [{
      label: t('admin.activity'),
      data: entries.map(([,v]) => v),
      backgroundColor: 'rgba(54, 162, 235, 0.5)',
      borderColor: '#36A2EB',
      borderWidth: 1,
      type: 'bar' as const
    }]
  };
});

const scanSuccessRate = computed(() => {
  if (!scanFunnel.value?.start) return 0;
  return Math.round((scanFunnel.value.success / scanFunnel.value.start) * 100);
});

/* Chart Options (Theme Responsive) */
const chartTextColor = computed(() => isDark.value ? '#ccc' : '#666');
const chartGridColor = computed(() => isDark.value ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)');

const doughnutOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: { color: chartTextColor.value }
    }
  }
}));

const funnelChartOptions = computed(() => ({
  indexAxis: 'y' as const,
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { color: chartTextColor.value } },
    y: { grid: { display: false }, ticks: { color: chartTextColor.value } }
  }
}));

const trendChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { color: chartTextColor.value } },
    y: { 
      beginAtZero: true, 
      grid: { color: chartGridColor.value },
      ticks: { color: chartTextColor.value } 
    }
  }
}));

const hourlyChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: { display: false },
    y: { display: false }
  },
  plugins: { legend: { display: false } }
}));

/* Fetch Analytics */
async function fetchAnalytics() {
  const range = resolveDateRange();
  const { data: analytics, error } = await supabase.rpc("analytics_dashboard_overhaul", { start_ts: range.start, end_ts: range.end });
  if (error) return;
  if (countries.value.length === 0) await loadCountries();

  dau.value = analytics.summary.unique_users;
  newUsers.value = analytics.summary.new_users;
  stickinessRatio.value = analytics.summary.dau_mau_ratio;
  demographicsData.value = analytics.demographics;
  scanFunnel.value = analytics.funnels.scan;
  recentTrends.value = analytics.trends;
  topFeatures.value = analytics.top_content.features || [];
  topProducts.value = analytics.top_content.products || [];
  topLocations.value = analytics.top_content.locations || [];
  topSearches.value = analytics.top_content.searches || [];
  globalConversion.value = scanSuccessRate.value / 100;

  const hours = Array(24).fill(0);
  Object.entries(analytics.trends.hourly || {}).forEach(([h, v]:any) => hours[Number(h)] = v);
  hourlyChartData.value = { 
    labels: hours.map((_, i) => `${i}h`), 
    datasets: [{ 
      data: hours as number[], 
      backgroundColor: '#f39c12', 
      borderRadius: 2 
    }] 
  };
  generateInsightsList(analytics);
}

function generateInsightsList(data: any) {
  const list: string[] = [];
  const success = scanSuccessRate.value;
  
  // Scanner Performance
  if (success > 80) list.push(t('admin.insight_high_scan_success') || "AI Scanner is performing exceptionally well (>80% success).");
  else if (success < 50 && scanFunnel.value?.start > 10) list.push(t('admin.insight_low_scan_success') || "Scanner error rates are higher than usual. Check visibility/lighting logs.");

  // Engagement Insights
  if (stickinessRatio.value > 0.2) list.push("High retention: Users are returning more frequently than the average.");
  
  // Search & Content Trends
  if (topSearches.value?.length > 0) {
    list.push(`High interest in "${topSearches.value[0].name}" this period.`);
  }

  // Demographics
  const topNat = demographicsData.value?.nationalities?.[0]?.name;
  if (topNat && topNat !== 'Unknown') {
    const match = countries.value.find(c => c.cca2 === topNat);
    list.push(`Highest user engagement coming from ${match ? match.name.common : topNat} community.`);
  }

  generatedInsights.value = list.slice(0, 3);
}

function resolveDateRange() {
  const end = dayjs().endOf('day');
  let start;
  if (selectedRange.value === 'daily') start = dayjs().startOf('day');
  else if (selectedRange.value === 'weekly') start = dayjs().subtract(7, 'day').startOf('day');
  else if (selectedRange.value === 'monthly') start = dayjs().subtract(30, 'day').startOf('day');
  else if (selectedRange.value === 'custom') {
    return { start: dayjs(customStartDate.value).startOf('day').toISOString(), end: dayjs(customEndDate.value).endOf('day').toISOString() };
  } else {
    start = dayjs().subtract(7, 'day').startOf('day');
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

const onRangeChange = () => {
  if (selectedRange.value === 'custom') showDateModal.value = true;
  else fetchAnalytics();
};

const applyCustomDates = () => {
  customStartDate.value = tempStartDate.value;
  customEndDate.value = tempEndDate.value;
  showDateModal.value = false;
  fetchAnalytics();
};

function shortName(name: string | null, max = 20) {
  if (!name) return "(Unnamed)";
  return name.length > max ? name.slice(0, max) + "…" : name;
}

onMounted(() => {
  fetchAnalytics();
});
</script>

<style scoped>
.alternate-bg,
.content-background {
  --background: var(--ion-background-color);
}

.controls-section {
  display: flex;
  justify-content: center;
  padding: 10px 0;
}

.range-selector-pill {
  width: 100%;
  max-width: 400px;
  background: var(--card-bg);
  padding: 4px;
  border-radius: 30px;
  box-shadow: var(--card-shadow);
}

.modern-card {
  border-radius: 16px;
  box-shadow: var(--card-shadow);
  margin-bottom: 16px;
  border: 1px solid var(--card-border);
}

.insight-card {
  background: var(--soft-warning-bg);
  border-left: 4px solid var(--ion-color-carrot);
}

.title-with-icon {
  display: flex;
  align-items: center;
  gap: 12px;
}

.insights-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.insight-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 0.95rem;
  line-height: 1.4;
  color: var(--ion-color-step-700);
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

@media (min-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.stat-card {
  background: var(--card-bg);
  padding: 16px;
  border-radius: 16px;
  box-shadow: var(--card-shadow);
}

.stat-label {
  margin: 0;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ion-color-step-600);
}

.stat-value {
  margin: 4px 0;
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--ion-color-dark);
}

.stat-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.stat-subtext {
  margin: 0;
  font-size: 0.7rem;
  color: #aaa;
}

.trend-up { color: #2ecc71; }
.trend-down { color: #e74c3c; }
.trend-neutral { color: #f39c12; }
.neutral { color: #3498db; }

.doughnut-container {
  height: 220px;
  position: relative;
}

.chart-container-large {
  height: 300px;
  position: relative;
}

.chart-container {
  height: 180px;
  position: relative;
}

.funnel-labels {
  display: flex;
  justify-content: space-around;
  flex-wrap: wrap;
  gap: 10px;
}

.funnel-stat {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.dot.carrot { background: #ff9f40; }
.dot.mint { background: #2ecc71; }
.dot.red { background: #e74c3c; }

/* Custom Date Range Styles */
.header-segment {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.segment-wrapper {
  width: 100%;
  max-width: 450px;
  border-radius: 30px;
  padding: 4px;
}

.glass-effect {
  background: var(--card-bg);
  backdrop-filter: blur(10px);
  border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow);
}

.custom-range-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--card-bg);
  border-radius: 20px;
  font-size: 0.85rem;
  color: var(--ion-color-carrot);
  font-weight: 600;
  box-shadow: var(--card-shadow);
  cursor: pointer;
  transition: opacity 0.2s;
}

.custom-range-label:active {
  opacity: 0.7;
}

.date-pickers-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding-top: 10px;
}

.date-picker-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.picker-label {
  font-weight: 600;
  color: var(--ion-color-step-600);
  margin-left: 4px;
}

.glass-effect-dark {
  background: var(--ion-color-step-50);
  border-radius: 12px;
  border: 1px solid var(--card-border);
}

.top-list-item {
  --padding-start: 0;
  --inner-padding-end: 0;
}

.item-count {
  font-weight: 700;
  color: var(--ion-color-carrot);
}
</style>

