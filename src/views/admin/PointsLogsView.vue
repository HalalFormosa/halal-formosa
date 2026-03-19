<template>
  <ion-page>
    <ion-header>
      <app-header
          :title="$t('points.title')"
          :icon="listOutline"
          :showBack="true"
      />
    </ion-header>

    <ion-content class="ion-padding">
      <ion-list>
        <ion-item v-for="log in logs" :key="log.id">
          <!-- Avatar -->
          <ion-avatar slot="start" v-if="log.avatar_url">
            <img :src="log.avatar_url" :alt="$t('admin.userAvatar')" />
          </ion-avatar>

          <!-- Label & details -->
          <ion-label class="log-label">
            <h2 class="log-user">
              {{ log.full_name || log.display_name || log.email }}
            </h2>

            <div class="log-action">
              <ion-text color="dark">
                <strong>🎯 {{ log.label }}</strong>
              </ion-text>
              <ion-badge color="primary" class="log-badge">
                +{{ log.points }} {{ $t('admin.pts') }}
              </ion-badge>
            </div>

            <p class="log-time">{{ fromNowToTaipei(log.created_at) }}</p>
          </ion-label>

          <!-- Admin retract -->
          <ion-button
              v-if="isAdmin"
              color="danger"
              fill="clear"
              slot="end"
              @click="retractLog(log.id)"
          >
            {{ $t('common.delete') }}
          </ion-button>
        </ion-item>
      </ion-list>
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
  IonButton,
} from "@ionic/vue";
import AppHeader from "@/components/AppHeader.vue";
import { listOutline } from "ionicons/icons";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import relativeTime from "dayjs/plugin/relativeTime";
import { isAdmin } from "@/composables/userProfile";
import { usePoints } from "@/composables/usePoints";
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const logs = ref<any[]>([]);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

const { currentPoints } = usePoints();

async function retractLog(logId: string) {
  if (!confirm(t('admin.retractConfirm'))) return;

  const { error, data } = await supabase.rpc("retract_point_log", { log_id: logId });

  if (error) {
    console.error("❌ Error retracting log:", error);
    alert(t('admin.retractFailed', { error: error.message }));
  } else {
    // remove from UI
    logs.value = logs.value.filter((log) => log.id !== logId);

    // refresh points if current user was affected
    const { data: { user } } = await supabase.auth.getUser();
    if (user && data?.user_id === user.id) {
      currentPoints.value = data.new_points;
    }
  }
}

async function fetchLogs() {
  const { data, error } = await supabase.rpc("get_point_logs_with_users", { limit_count: 15 });
  if (error) {
    console.error("Error fetching point logs:", error);
    logs.value = [];
  } else {
    logs.value = data || [];
  }
}

function fromNowToTaipei(dateString?: string) {
  if (!dateString) return "";
  return dayjs.utc(dateString).tz("Asia/Taipei").fromNow();
}

onMounted(fetchLogs);
</script>

<style>
.log-label h2.log-user {
  margin: 0 0 4px 0;
  font-weight: 600;
}

.log-action {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.log-badge {
  font-size: 0.8rem;
}

.log-time {
  margin: 0;
  font-size: 0.85rem;
  color: var(--ion-color-medium);
}
</style>
