<template>
  <ion-page>
    <ion-header>
      <app-header
          :title="$t('profile.admin.analytics')"
          :icon="listOutline"
          :showBack="true"
      />
    </ion-header>

    <ion-content class="ion-padding">
      <!-- ============================
     DATE RANGE SELECTOR
=============================== -->
      <ion-card>
        <ion-card-content>
          <!-- segmented control -->
          <ion-list>
            <ion-item>
              <ion-label>{{ $t('admin.range') }}</ion-label>
              <ion-select
                  v-model="selectedRange"
                  interface="popover"
                  :placeholder="$t('admin.selectRange')"
                  @ionChange="onRangeChange($event)"

              >

              <ion-select-option value="daily">{{ $t('admin.daily') }}</ion-select-option>
                <ion-select-option value="weekly">{{ $t('admin.weekly') }}</ion-select-option>
                <ion-select-option value="monthly">{{ $t('admin.monthly') }}</ion-select-option>
              </ion-select>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>


      <!-- ============================
           TODAY STATS
      ============================ -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ activityTitle }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p>
            <strong>{{ dauLabel }}</strong>

            <ion-icon
                :icon="informationCircleOutline"
                id="dau-info"
                color="medium"
                style="margin-left: 6px; cursor: help;"
            ></ion-icon>

            <ion-popover trigger="dau-info" trigger-action="click">
              <ion-content class="ion-padding">
                <span v-html="dauTooltip"></span>
              </ion-content>
            </ion-popover>
            : {{ dau }}
          </p>


          <p><strong>{{ $t('admin.totalEvents') }}:</strong> {{ totalEvents }}</p>
        </ion-card-content>
      </ion-card>

      <!-- ============================
           MOST USED FEATURES
      ============================ -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>🔥 {{ $t('admin.mostUsedFeatures') }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>

          <!-- Bar Chart -->
          <div class="chart-container">
            <Bar
                v-if="featureChartData && featureChartData.labels.length"
                :data="featureChartData"
                :options="chartOptions"
            />

          </div>

          <!-- Feature list -->
          <ion-list class="ion-margin-top">
            <ion-item
                v-for="(f, i) in (showAllFeatures ? topFeatures : topFeatures.slice(0, 5))"
                :key="f.activity_type + '-' + i"
            >
              <ion-label>{{ f.activity_type }}</ion-label>
              <ion-badge slot="end" color="primary">{{ f.count }}</ion-badge>
            </ion-item>
          </ion-list>

          <div style="text-align:center; margin-top: 10px;" v-if="topFeatures.length > 5">
            <ion-button
                fill="clear"
                color="carrot"
                size="small"
                @click="showAllFeatures = !showAllFeatures"
            >
              {{ showAllFeatures ? $t('common.viewLess') : $t('common.viewMore') }}
            </ion-button>
          </div>




        </ion-card-content>
      </ion-card>


      <!-- ============================
           MOST VIEWED PRODUCTS
      ============================ -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>🥘 {{ $t('admin.mostViewedProducts') }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>

          <div class="chart-container">
            <Bar
                v-if="productChartData && productChartData.labels && productChartData.labels.length"
                :data="productChartData"
                :options="chartOptions"
            />
          </div>

          <ion-list class="ion-margin-top">
            <ion-item
                v-for="(p, i) in (showAllProducts ? topProducts : topProducts.slice(0, 5))"
                :key="p.barcode + '-' + i"
            >
              <ion-label>{{ p.product_name }}</ion-label>
              <ion-badge slot="end" color="success">{{ p.count }}</ion-badge>
            </ion-item>
          </ion-list>

          <div style="text-align:center; margin-top: 10px;" v-if="topProducts.length > 5">
            <ion-button
                fill="clear"
                color="carrot"
                size="small"
                @click="showAllProducts = !showAllProducts"
            >
              {{ showAllProducts ? $t('common.viewLess') : $t('common.viewMore') }}
            </ion-button>
          </div>



        </ion-card-content>
      </ion-card>



      <!-- ============================
           MOST VIEWED LOCATIONS
      ============================ -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>🕌 {{ $t('admin.mostViewedLocations') }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>

          <div class="chart-container">
            <Bar
                v-if="locationChartData && locationChartData.labels.length > 0"
                :data="locationChartData"
                :options="chartOptions"
            />
          </div>


          <ion-list class="ion-margin-top">
            <ion-item
                v-for="(l, i) in (showAllLocations ? topLocations : topLocations.slice(0, 5))"
                :key="l.place_id + '-' + i"
            >
              <ion-label>{{ l.place_name }}</ion-label>
              <ion-badge slot="end" color="tertiary">{{ l.count }}</ion-badge>
            </ion-item>
          </ion-list>

          <div style="text-align:center; margin-top: 10px;" v-if="topLocations.length > 5">
            <ion-button
                fill="clear"
                color="carrot"
                size="small"
                @click="showAllLocations = !showAllLocations"
            >
              {{ showAllLocations ? $t('common.viewLess') : $t('common.viewMore') }}
            </ion-button>
          </div>



        </ion-card-content>
      </ion-card>


      <!-- ============================
           HOURLY ACTIVITY
      ============================ -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>⏳ {{ $t('admin.activityByHour', { range: activityRangeLabel }) }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div class="chart-container">
            <Bar
                v-if="hourlyChartData"
                :data="hourlyChartData"
                :options="hourlyChartOptions"
            />

          </div>

        </ion-card-content>
      </ion-card>

      <!-- ============================
     TOP USER PATHS
=============================== -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>🧭 {{ $t('admin.topUserPaths') }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <ion-list>
            <ion-item
                v-for="(p, i) in (showAllPaths ? topUserPaths : topUserPaths.slice(0,5))"
                :key="p.path + '-' + i"
            >
              <ion-label>
                <strong>{{ p.path }}</strong>
                <br />
                <small>{{ $t('admin.stepsCount', { count: p.steps }) }}</small>
              </ion-label>

              <ion-badge slot="end" color="warning">
                {{ $t('admin.usersCount', { count: p.users }) }}
              </ion-badge>
            </ion-item>
          </ion-list>

          <div style="text-align:center; margin-top:10px;" v-if="topUserPaths.length > 5">
            <ion-button
                fill="clear"
                color="carrot"
                size="small"
                @click="showAllPaths = !showAllPaths"
            >
              {{ showAllPaths ? $t('common.viewLess') : $t('common.viewMore') }}
            </ion-button>
          </div>
        </ion-card-content>
      </ion-card>



      <!-- ============================
           RECENT SEARCHES
      ============================ -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>🔍 {{ $t('admin.recentSearches') }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list>
            <ion-item
                v-for="(s) in (showAllSearches ? recentSearches : recentSearches.slice(0, 5))"
                :key="s.id"
            >
              <ion-label>{{ s.activity_detail?.query || '-' }}</ion-label>
            </ion-item>
          </ion-list>

          <div style="text-align:center; margin-top: 10px;" v-if="recentSearches.length > 5">
            <ion-button
                fill="clear"
                color="carrot"
                size="small"
                @click="showAllSearches = !showAllSearches"
            >
              {{ showAllSearches ? $t('common.viewLess') : $t('common.viewMore') }}
            </ion-button>
          </div>


        </ion-card-content>
      </ion-card>

    </ion-content>
  </ion-page>
</template>



<script setup lang="ts">
/* -----------------------------------
   Imports
----------------------------------- */
import {
  IonPage, IonHeader, IonContent,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonList, IonItem, IonLabel, IonBadge, IonButton, IonIcon, IonPopover, IonSelect, IonSelectOption
} from "@ionic/vue";

import {ref, onMounted, computed} from "vue";
import { supabase } from "@/plugins/supabaseClient";
import { isAdmin } from "@/composables/userProfile";
import { useRouter } from "vue-router";
import {informationCircleOutline, listOutline} from "ionicons/icons";
import AppHeader from "@/components/AppHeader.vue";
import { useI18n } from 'vue-i18n';

/* Chart.js */
import { Bar } from "vue-chartjs";

import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  LineController
} from "chart.js";


ChartJS.register(
    Title,
    Tooltip,
    Legend,
    BarElement,
    LineElement,
    PointElement,
    CategoryScale,
    LinearScale,
    LineController   // ⭐ REQUIRED FOR PRODUCTION
);


interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor: string;
}

interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}


/* -----------------------------------
   State Variables
----------------------------------- */
const router = useRouter();
const { t } = useI18n();

const dau = ref(0);
const totalEvents = ref(0);

const topFeatures = ref<any[]>([]);
const topProducts = ref<any[]>([]);
const topLocations = ref<any[]>([]);
const recentSearches = ref<any[]>([]);

const showAllFeatures = ref(false);
const showAllProducts = ref(false);
const showAllLocations = ref(false);
const showAllSearches = ref(false);
const showAllPaths = ref(false);

const topUserPaths = ref<any[]>([]);

/* Chart Data */
const featureChartData = computed<ChartData>(() => {
  const items = showAllFeatures.value
      ? topFeatures.value
      : topFeatures.value.slice(0, 5);

  return {
    labels: items.map(f => f.activity_type),
    datasets: [
      {
        label: t('admin.usage'),
        data: items.map(f => f.count),
        backgroundColor: "rgba(255,159,64,0.8)"
      }
    ]
  };
});

const productChartData = computed(() => {
  const items = showAllProducts.value
      ? topProducts.value
      : topProducts.value.slice(0, 5);

  return {
    labels: items.map(p => shortName(p.product_name)),
    datasets: [
      {
        label: t('admin.views'),
        data: items.map(p => p.count),
        backgroundColor: "#2ecc71"
      }
    ]
  };
});


const locationChartData = computed(() => {
  const items = showAllLocations.value
      ? topLocations.value
      : topLocations.value.slice(0, 5);

  return {
    labels: items.map(l => l.name || l.place_name || "(Unknown)"),
    datasets: [
      {
        label: t('admin.views'),
        data: items.map(l => Number(l.count)),
        backgroundColor: "#3498db"
      }
    ]
  };
});


const hourlyChartData = ref<any>(null);

/* Chart options */
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: {
      ticks: {
        maxRotation: 30,
        minRotation: 0,
        autoSkip: true,
        color: "#ccc"
      }
    },
    y: { ticks: { color: "#ccc" } }
  }
};

const hourlyChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: "#ccc" } }
  },
  scales: {
    x: { ticks: { color: "#ccc" } },
    y: { ticks: { color: "#ccc" } }
  }
};

const activityTitle = computed(() => {
  if (selectedRange.value === "daily") return t('admin.activityToday');
  if (selectedRange.value === "weekly") return t('admin.activityWeekly');
  if (selectedRange.value === "monthly") return t('admin.activityMonthly');
  return t('admin.activity');
});

const activityRangeLabel = computed(() => {
  if (selectedRange.value === "daily") return t('admin.daily');
  if (selectedRange.value === "weekly") return t('admin.weekly');
  if (selectedRange.value === "monthly") return t('admin.monthly');
  return "";
});

const dauLabel = computed(() => {
  if (selectedRange.value === "daily") return "DAU";
  if (selectedRange.value === "weekly") return "WAU";
  if (selectedRange.value === "monthly") return "MAU";
  return "DAU";
});

const dauTooltip = computed(() => {
  if (selectedRange.value === "daily")
    return t('admin.dauTooltip');

  if (selectedRange.value === "weekly")
    return t('admin.wauTooltip');

  if (selectedRange.value === "monthly")
    return t('admin.mauTooltip');

  return "";
});



const selectedRange = ref<"daily" | "weekly" | "monthly">("daily");

/* -----------------------------------
   Fetch Analytics Data
----------------------------------- */
async function fetchAnalytics() {
  const range = resolveDateRange();
  if (!range) return;

  const { start, end } = range;

  /* -----------------------------------
     ONE RPC: Full Analytics Bundle
  ----------------------------------- */
  const { data: analytics, error } = await supabase.rpc(
      "analytics_full_range",
      { start_ts: start, end_ts: end }
  );

  if (error) {
    console.error("Analytics RPC Error:", error);
    return;
  }

  /* SUMMARY */
  dau.value = analytics.summary.unique_users;
  totalEvents.value = analytics.summary.total_events;

  /* TOP FEATURES / PRODUCTS / LOCATIONS */
  topFeatures.value = analytics.top_features || [];
  topProducts.value = analytics.top_products || [];
  topLocations.value = analytics.top_locations || [];

  /* HOURLY ACTIVITY */
  const hours = Array(24).fill(0);
  const hourlyData = analytics.summary.hourly || {};

  Object.entries(hourlyData).forEach(([h, count]) => {
    hours[Number(h)] = Number(count);
  });

  const trendData = loess(hours, 0.22);

  /* BUILD HOURLY CHART */
  hourlyChartData.value = {
    labels: [...Array(24).keys()].map(h => `${h}:00`),
    datasets: [
      {
        type: "bar",
        label: t('admin.totalEvents'),
        data: hours,
        backgroundColor: "rgba(255,159,64,0.6)",
        borderRadius: 4,
        order: 0
      },
      {
        type: "line",
        label: t('admin.trend'),
        data: trendData,
        borderColor: "#bb86fc",
        backgroundColor: "rgba(187,134,252,0.15)",
        fill: false,
        tension: 0.6,
        cubicInterpolationMode: "monotone",
        pointRadius: 0,
        borderWidth: 3,
        order: 1
      }
    ]
  };

  /* 6. Recent Searches */
  const { data: searchesRaw } = await supabase
      .from("activity_log")
      .select("id, activity_detail")
      .eq("activity_type", "search_query")
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: false })
      .limit(10);

  recentSearches.value = (searchesRaw || []).map(s => ({
    ...s,
    activity_detail: typeof s.activity_detail === "string"
        ? JSON.parse(s.activity_detail)
        : s.activity_detail
  }));

  /* 7. User Paths (Option A) */
  const { data: pathsRaw } = await supabase.rpc(
      "analytics_user_behavior_clusters",
      { start_ts: start, end_ts: end }
  );

  topUserPaths.value = (pathsRaw || [])
      .slice(0, 10);  // top 10 paths


  showAllFeatures.value = false;
  showAllProducts.value = false;
  showAllLocations.value = false;
  showAllSearches.value = false;

}


function onRangeChange(ev: any) {
  selectedRange.value = ev.detail.value;   // <-- CRITICAL
  fetchAnalytics();                         // now fetches with correct dates
}


function shortName(name: string | null, max = 20) {
  if (!name) return "(Unnamed)";
  return name.length > max ? name.slice(0, max) + "…" : name;
}



function loess(data: number[], bandwidth = 0.25): number[] {
  const res: number[] = [];
  const n = data.length;

  for (let i = 0; i < n; i++) {

    // Distance-based weights
    const weights: number[] = [];
    for (let j = 0; j < n; j++) {
      const dist = Math.abs(j - i);
      const w = Math.exp(-(dist * dist) / (2 * bandwidth * bandwidth * n * n));
      weights.push(w);
    }

    // Weighted average
    let numerator = 0;
    let denominator = 0;
    for (let j = 0; j < n; j++) {
      numerator += weights[j] * data[j];
      denominator += weights[j];
    }

    res.push(denominator ? numerator / denominator : 0);
  }

  return res;
}


function resolveDateRange() {
  const now = new Date();
  const end = now.toISOString();

  const start = new Date();

  if (selectedRange.value === "daily") {
    // Start of today, correct local time
    start.setHours(0, 0, 0, 0);
  }

  else if (selectedRange.value === "weekly") {
    const day = start.getDay();            // 0=Sun
    const diff = day === 0 ? 6 : day - 1;  // Monday as start
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
  }

  else if (selectedRange.value === "monthly") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  // ❌ DO NOT subtract timezone offset again
  return {
    start: start.toISOString(),
    end
  };
}

/* -----------------------------------
   Auth check
----------------------------------- */
onMounted(() => {
  if (!isAdmin.value) {
    router.replace("/profile");
    return;
  }
  fetchAnalytics();
});
</script>

<style scoped>
.chart-container {
  width: 100%;
  height: 500px !important;
  position: relative;
}

</style>

