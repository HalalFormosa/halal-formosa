<template>
  <ion-page>
    <ion-header>
      <app-header :title="t('notifications.title', 'Notifications')" show-back back-route="/home" :icon="icons.notificationsOutline" :show-profile="false" />
    </ion-header>

    <ion-content class="ion-padding">
      <div v-if="loading && !hasAnyContent" class="ion-text-center ion-margin-top">
        <ion-spinner />
      </div>

      <template v-else>
        <!-- Daily mission nudge: not a real notification row, so it doesn't
             come from useNotifications — just a call-to-action while today's
             missions aren't all done yet. -->
        <div v-if="!dailyMissionsCompleted" class="feed-section">
          <ion-item button class="notif-item mission-item" @click="openDailyMissions">
            <ion-icon slot="start" :icon="icons.flashOutline" class="notif-icon color-carrot" />
            <ion-label>
              <h3 class="notif-title">{{ t('notifications.dailyMissionTitle', 'Daily Mission still available') }}</h3>
              <p class="notif-body">{{ t('notifications.dailyMissionBody', 'Finish it to get Extra XP!') }}</p>
            </ion-label>
          </ion-item>
        </div>

        <!-- Aggregate cards: categories with more new items than the threshold -->
        <div v-if="aggregateBadges.length > 0" class="category-grid">
          <div
            v-for="badge in aggregateBadges"
            :key="badge.category"
            class="category-card"
            @click="openCategory(badge)"
          >
            <div class="category-count">{{ badge.count }}</div>
            <div class="category-label">{{ t(`notifications.category.${badge.category}`, badge.label) }}</div>
          </div>
        </div>

        <!-- Individual new items: categories with only a few new items get listed by name -->
        <div v-if="newItemEntries.length > 0" class="feed-section">
          <div class="feed-header">
            <h3>{{ t('notifications.whatsNew', "What's new") }}</h3>
          </div>
          <ion-list lines="none" class="notif-list">
            <ion-item
              v-for="entry in newItemEntries"
              :key="entry.category + '-' + entry.item.id"
              button
              class="notif-item"
              @click="openNewItem(entry)"
            >
              <ion-thumbnail slot="start" v-if="entry.item.image">
                <img :src="entry.item.image" :alt="entry.item.title" />
              </ion-thumbnail>
              <ion-icon v-else slot="start" :icon="iconForCategory(entry.category)" class="notif-icon color-carrot" />
              <ion-label>
                <h3 class="notif-title">{{ entry.item.title }}</h3>
                <p class="notif-body">{{ t(`notifications.category.${entry.category}Single`, entry.categoryLabel) }}</p>
              </ion-label>
            </ion-item>
          </ion-list>
        </div>

        <!-- Personal notification feed -->
        <div v-if="personalNotifications.length > 0" class="feed-section">
          <div class="feed-header">
            <h3>{{ t('notifications.activity', 'Activity') }}</h3>
            <ion-button v-if="unreadPersonalCount > 0" fill="clear" size="small" @click="markAllPersonalRead">
              {{ t('notifications.markAllRead', 'Mark all read') }}
            </ion-button>
          </div>

          <ion-list lines="none" class="notif-list">
            <ion-item
              v-for="notif in personalNotifications"
              :key="notif.id"
              button
              class="notif-item"
              :class="{ unread: !notif.is_read }"
              @click="openNotification(notif)"
            >
              <ion-thumbnail slot="start" v-if="notif.image_url" class="notif-thumb">
                <img :src="notif.image_url" :alt="notif.title" />
                <ion-icon :icon="iconFor(notif.type)" :class="['notif-thumb-badge', colorClassFor(notif.type)]" />
              </ion-thumbnail>
              <ion-icon v-else slot="start" :icon="iconFor(notif.type)" :class="['notif-icon', colorClassFor(notif.type)]" />
              <ion-label>
                <h3 class="notif-title">{{ notif.title }}</h3>
                <p v-if="notif.body" class="notif-body">{{ notif.body }}</p>
                <p class="notif-date">{{ formatDate(notif.created_at) }}</p>
              </ion-label>
              <div v-if="!notif.is_read" class="unread-dot" slot="end"></div>
            </ion-item>
          </ion-list>
        </div>

        <div v-if="!hasAnyContent" class="empty-state">
          <ion-icon :icon="icons.notificationsOffOutline" class="empty-icon" />
          <h3>{{ t('notifications.empty', 'No notifications yet') }}</h3>
          <p>{{ t('notifications.emptyHint', "We'll let you know when something new happens.") }}</p>
        </div>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage, IonHeader, IonContent, IonSpinner, IonList, IonItem,
  IonLabel, IonIcon, IonButton, IonThumbnail
} from '@ionic/vue';
import {
  notificationsOutline, notificationsOffOutline, checkmarkCircleOutline,
  closeCircleOutline, chatbubbleEllipsesOutline, cubeOutline, locationOutline,
  newspaperOutline, compassOutline, bagHandleOutline, flashOutline
} from 'ionicons/icons';
import AppHeader from '@/components/AppHeader.vue';
import { useI18n } from 'vue-i18n';
import { useNotifications, type AppNotification, type CategoryBadge, type BroadcastCategory, type CategoryItem } from '@/composables/useNotifications';
import { useDailyMissions } from '@/composables/useDailyMissions';
import { ActivityLogService } from '@/services/ActivityLogService';

const { t } = useI18n();
const router = useRouter();

const {
  personalNotifications,
  unreadPersonalCount,
  categoryBadges,
  loading,
  refreshAll,
  markRead,
  markAllPersonalRead,
  markCategorySeen,
  markAllSeen,
} = useNotifications();

const { allCompleted: dailyMissionsCompleted, requestOpenMissionsModal } = useDailyMissions();

const icons = { notificationsOutline, notificationsOffOutline, flashOutline };

const visibleBadges = computed(() => categoryBadges.value.filter(b => b.count > 0));
// Small counts get listed as individual items instead of a vague "N new X" card.
const aggregateBadges = computed(() => visibleBadges.value.filter(b => b.items.length === 0));

interface NewItemEntry {
  category: BroadcastCategory;
  categoryLabel: string;
  item: CategoryItem;
}

const newItemEntries = computed<NewItemEntry[]>(() => {
  const entries: NewItemEntry[] = [];
  for (const badge of visibleBadges.value) {
    for (const item of badge.items) {
      entries.push({ category: badge.category, categoryLabel: badge.label, item });
    }
  }
  return entries.sort((a, b) => new Date(b.item.date).getTime() - new Date(a.item.date).getTime());
});

const hasAnyContent = computed(() =>
  personalNotifications.value.length > 0 || visibleBadges.value.length > 0 || !dailyMissionsCompleted.value
);

function openDailyMissions() {
  ActivityLogService.log('notification_daily_mission_opened', {});
  // Flip the shared flag before navigating — DailyMissions.vue (rendered on
  // Home) watches it with immediate:true, so it opens its own details modal
  // the moment it mounts regardless of exactly when that happens relative
  // to this navigation.
  requestOpenMissionsModal();
  router.push('/home');
}

function iconForCategory(category: BroadcastCategory) {
  switch (category) {
    case 'products': return cubeOutline;
    case 'locations': return locationOutline;
    case 'news': return newspaperOutline;
    case 'trips': return compassOutline;
    case 'store': return bagHandleOutline;
    default: return notificationsOutline;
  }
}

function iconFor(type: string) {
  switch (type) {
    case 'product_approved':
    case 'location_approved':
      return checkmarkCircleOutline;
    case 'product_rejected':
    case 'location_rejected':
      return closeCircleOutline;
    case 'report_reply':
      return chatbubbleEllipsesOutline;
    default:
      return notificationsOutline;
  }
}

function colorClassFor(type: string) {
  if (type.endsWith('_approved')) return 'color-success';
  if (type.endsWith('_rejected')) return 'color-danger';
  return 'color-carrot';
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' - ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

async function openNotification(notif: AppNotification) {
  ActivityLogService.log('notification_opened', { notification_id: notif.id, type: notif.type });
  if (!notif.is_read) await markRead(notif.id);
  if (notif.action_path) router.push(notif.action_path);
}

async function openCategory(badge: CategoryBadge) {
  ActivityLogService.log('notification_category_opened', { category: badge.category });
  await markCategorySeen(badge.category);
  router.push(badge.actionPath);
}

async function openNewItem(entry: NewItemEntry) {
  ActivityLogService.log('notification_newitem_opened', { category: entry.category, item_id: entry.item.id });
  // All items in a category are shown at once (count <= threshold), so opening
  // any one of them means the whole category has been seen.
  await markCategorySeen(entry.category);
  router.push(entry.item.actionPath);
}

onMounted(() => {
  refreshAll();
});

onUnmounted(() => {
  // Counts stay visible while the user is on this page; clear them once they leave.
  markAllSeen();
});
</script>

<style scoped>
.category-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}

.category-card {
  background: var(--card-bg, #fff);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  padding: 14px;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.category-card:active {
  transform: scale(0.97);
}

.category-count {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--ion-color-carrot);
}

.category-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ion-text-color);
  margin-top: 2px;
}

.feed-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.feed-header h3 {
  font-weight: 800;
  margin: 0;
}

.notif-list {
  background: transparent;
}

.notif-item {
  --background: var(--card-bg, #fff);
  --border-radius: 14px;
  margin-bottom: 8px;
  border: 1px solid var(--card-border);
  border-radius: 14px;
}

.notif-item.unread {
  --background: rgba(var(--ion-color-carrot-rgb), 0.08);
}

.notif-icon {
  font-size: 22px;
}

.notif-thumb {
  position: relative;
  --border-radius: 10px;
  width: 48px;
  height: 48px;
}

.notif-thumb-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  font-size: 16px;
  background: var(--card-bg, #1e1e1e);
  border-radius: 50%;
  padding: 2px;
  box-shadow: 0 0 0 2px var(--card-bg, #1e1e1e);
}

.color-success { color: var(--ion-color-success); }
.color-danger { color: var(--ion-color-danger); }
.color-carrot { color: var(--ion-color-carrot); }

.notif-title {
  font-weight: 700;
}

.notif-body {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  margin-top: 2px;
}

.notif-date {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  margin-top: 4px;
}

.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ion-color-carrot);
}

.empty-state {
  text-align: center;
  margin-top: 60px;
  color: var(--ion-color-medium);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}
</style>
