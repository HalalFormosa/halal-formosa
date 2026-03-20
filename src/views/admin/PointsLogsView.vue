<template>
  <ion-page>
    <ion-header>
      <app-header
          :title="$t('points.title')"
          :icon="ribbonOutline"
          :showBack="true"
          :contrast="true"
      />
    </ion-header>

    <ion-content class="ion-padding content-background">
      <ion-list lines="none" class="points-list">
        <ion-item v-for="log in logs" :key="log.id" class="points-item">
          <!-- User Profile -->
          <div class="user-profile-section">
            <ion-avatar class="points-avatar">
              <img v-if="log.avatar_url" :src="log.avatar_url" />
              <div v-else class="avatar-placeholder">
                {{ (log.full_name || log.display_name || '?').charAt(0).toUpperCase() }}
              </div>
            </ion-avatar>
            
            <div class="user-details">
              <div class="top-row">
                <h2 class="user-name">{{ log.full_name || log.display_name || log.email }}</h2>
                <div class="points-badge">
                  +{{ log.points }} {{ $t('admin.pts') }}
                </div>
              </div>
              
              <div class="action-row">
                <div class="action-label">
                  <ion-icon :icon="discOutline" class="action-icon" />
                  <span class="action-text">{{ log.label }}</span>
                </div>
              </div>
              
              <p class="log-time">{{ fromNowToTaipei(log.created_at) }}</p>
            </div>
          </div>

          <!-- Actions -->
          <ion-button
              v-if="isAdmin"
              color="danger"
              fill="clear"
              slot="end"
              class="retract-button"
              @click="retractLog(log.id)"
          >
            <ion-icon slot="icon-only" :icon="trashOutline" />
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
import { ribbonOutline, discOutline, trashOutline } from "ionicons/icons";
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

<style scoped>
.content-background {
  --background: var(--ion-background-color);
}

.points-list {
  background: transparent;
  padding: 0;
}

.points-item {
  --padding-start: 12px;
  --padding-end: 12px;
  --inner-padding-end: 0;
  --background: var(--ion-background-color);
  margin-bottom: 12px;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  border: 1px solid var(--ion-color-step-100);
}

.user-profile-section {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 0;
  width: 100%;
}

.points-avatar {
  width: 44px;
  height: 44px;
  border: 2px solid var(--ion-color-carrot-tint, #ffb380);
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ion-color-step-200);
  color: var(--ion-color-step-600);
  font-weight: 700;
  font-size: 1.2rem;
}

.user-details {
  flex: 1;
  min-width: 0;
}

.top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  gap: 12px;
}

.user-name {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--ion-color-dark);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.action-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.action-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--ion-color-dark);
  font-weight: 600;
  font-size: 0.95rem;
  width: 100%;
}

.action-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.action-icon {
  color: var(--ion-color-carrot);
  font-size: 1.1rem;
  flex-shrink: 0;
}

.points-badge {
  background: rgba(var(--ion-color-carrot-rgb), 0.12);
  color: var(--ion-color-carrot);
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 800;
  border: 1px solid rgba(var(--ion-color-carrot-rgb), 0.3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.log-time {
  margin: 0;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  font-weight: 500;
}

.retract-button {
  --padding-start: 8px;
  --padding-end: 8px;
  font-size: 20px;
}

/* Dark mode adjustments */
:host-context(.ion-palette-dark) .points-item,
.ion-palette-dark .points-item {
  background: var(--ion-color-step-50);
  border-color: var(--ion-color-step-150);
}

:host-context(.ion-palette-dark) .points-badge,
.ion-palette-dark .points-badge {
  background: rgba(var(--ion-color-carrot-rgb), 0.2);
  border-color: rgba(var(--ion-color-carrot-rgb), 0.4);
}
</style>
