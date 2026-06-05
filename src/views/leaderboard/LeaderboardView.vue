<template>
  <ion-page>
    <ion-header>
      <AppHeader :title="$t('home.leaderboard')" show-back :icon="medalOutline" />
    </ion-header>

    <ion-content class="ion-padding">
      <!-- 💡 Public Profile Hint Banner -->
      <div v-if="!isPublicProfile" class="leaderboard-hint-banner" @click="router.push('/settings')">
        <ion-icon :icon="sparkles" class="hint-icon" />
        <div class="hint-text">
          {{ $t('home.leaderboard_privacy_hint') || 'Want your name to be shown in the leaderboard? Go to settings and make your profile public.' }}
        </div>
        <ion-icon :icon="chevronForwardOutline" class="hint-arrow" />
      </div>

      <!-- 🔍 Search Bar -->
      <ion-searchbar
        :value="searchQuery"
        :placeholder="$t('search.placeholder') || 'Search users...'"
        @ionInput="onSearchInput"
        @ionClear="onSearchClear"
        show-clear-button="always"
        animated
        class="ion-margin-bottom"
      />
      <!-- Segment control to toggle Daily / Monthly / All Time -->
      <ion-segment :value="leaderboardType" @ionChange="changeLeaderboardType($event)" mode="ios" class="ion-margin-bottom" style="margin: 0 auto 16px; width: fit-content; display: flex;">
        <ion-segment-button value="daily">
          <ion-label>{{ $t('home.leaderboardDaily') }}</ion-label>
        </ion-segment-button>
        <ion-segment-button value="monthly">
          <ion-label>{{ $t('home.leaderboardMonthly') }}</ion-label>
        </ion-segment-button>
        <ion-segment-button value="all_time">
          <ion-label>{{ $t('home.leaderboardAllTime') }}</ion-label>
        </ion-segment-button>
      </ion-segment>

      <!-- 🏆 Leaderboard List -->
      <ion-list v-if="users.length > 0" class="leaderboard-list">
        <ion-item
          v-for="(user, index) in users"
          :key="user.id"
          lines="none"
          button
          class="leaderboard-item"
          :style="getLeaderboardRowStyle(user)"
          @click="openUserProfile(user, $event)"
        >
          <div style="display: flex; align-items: center; width: 100%;">
            <!-- Rank -->
            <div style="width: 28px; text-align: center; font-weight: 600; display: flex; align-items: center; justify-content: center; color: inherit;">
              <ion-icon v-if="getDisplayRank(user, index) === 1" :icon="medalOutline" style="color: #FFD700; font-size: 1.2rem;" />
              <ion-icon v-else-if="getDisplayRank(user, index) === 2" :icon="medalOutline" style="color: #C0C0C0; font-size: 1.2rem;" />
              <ion-icon v-else-if="getDisplayRank(user, index) === 3" :icon="medalOutline" style="color: #CD7F32; font-size: 1.2rem;" />
              <span v-else>{{ getDisplayRank(user, index) }}</span>
            </div>

            <!-- Avatar with Cosmetics -->
            <div class="leaderboard-avatar-cell" :style="getLeaderboardGlowStyle(user)">
              <ion-avatar style="width: 40px; height: 40px;" :style="getLeaderboardFrameStyle(user)">
                <img
                  :src="(user.public_profile || currentUser?.id === user.id) ? (user.public_profile ? (user.avatar_url || 'https://placehold.co/64x64') : (currentUser?.user_metadata?.avatar_url || 'https://placehold.co/64x64')) : `https://placehold.co/64x64?text=${$t('home.unknownAvatar')}`"
                  :alt="$t('home.altAvatar')"
                  loading="lazy"
                  @error="handleImgError"
                />
              </ion-avatar>
            </div>

            <!-- Info -->
            <ion-label style="flex: 1; min-width: 0;">
              <h2 style="margin: 0; font-weight: 600; font-size: 1rem; display: flex; align-items: center; gap: 6px; color: inherit;">
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; color: inherit;">
                  {{ currentUser?.id === user.id && !user.public_profile ? (currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.display_name || 'Me') : user.display_name }}
                </span>
                <ion-badge v-if="currentUser?.id === user.id && !user.public_profile" color="medium" style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px;" @click="showPrivateInfoAlert($event)">Private</ion-badge>
              </h2>
              <p style="margin: 0; font-size: 0.8rem; color: var(--sub-color, var(--ion-color-medium));">
                {{ $t('profile.level', { level: getLevelFromPoints(user.total_points || user.points) }) }}
              </p>
            </ion-label>

            <!-- Points Badge -->
            <ion-badge
              :color="getLevelColor(user.points)"
              class="leaderboard-points-badge"
            >
              {{ $t('home.pointsCount', { points: user.points }) }}
            </ion-badge>
          </div>
        </ion-item>
      </ion-list>

      <!-- 🔎 Loading skeletons -->
      <ion-list v-if="loading && users.length === 0">
        <ion-item v-for="n in 8" :key="n" lines="none" class="leaderboard-item">
          <div style="display: flex; align-items: center; width: 100%;">
            <ion-skeleton-text animated style="width: 20px; height: 20px; margin-right: 12px; border-radius: 4px;" />
            <ion-avatar style="width: 40px; height: 40px; margin-right: 12px;">
              <ion-skeleton-text animated />
            </ion-avatar>
            <ion-label style="flex: 1;">
              <ion-skeleton-text animated style="width: 60%; height: 16px; margin-bottom: 8px;" />
              <ion-skeleton-text animated style="width: 40%; height: 12px;" />
            </ion-label>
            <ion-skeleton-text animated style="width: 60px; height: 24px; border-radius: 8px;" />
          </div>
        </ion-item>
      </ion-list>

      <!-- 📭 Empty state -->
      <div v-if="!loading && users.length === 0" class="empty-state">
        <p>{{ $t('search.noResults') || 'No users found.' }}</p>
      </div>

      <!-- 🔄 Infinite Scroll -->
      <ion-infinite-scroll @ionInfinite="loadNextPage" :disabled="isInfiniteScrollDisabled">
        <ion-infinite-scroll-content loading-spinner="bubbles" :loading-text="$t('common.loading') || 'Loading more players...'" />
      </ion-infinite-scroll>
    </ion-content>

    <!-- 👤 User Profile popover -->
    <ion-popover
      :is-open="!!selectedUser"
      :event="popoverEvent"
      class="leaderboard-popover"
      :style="getPopoverCardVariables(selectedUser)"
      @didDismiss="closePopover"
    >
      <ion-content class="ion-padding popover-custom-content" style="text-align:center; min-width: 250px;" :style="getPopoverContentStyle(selectedUser)" :class="{ 'is-light-bg': isBackgroundLight(getCosmeticByCategory(selectedUser, 'background')) }">
        <div v-if="selectedUser" style="position: relative;">
          <!-- Aura backdrop layer -->
          <div v-if="getCosmeticByCategory(selectedUser, 'aura')" class="popover-aura-backdrop" :style="getPopoverAuraStyle(selectedUser)"></div>

          <div style="position: relative; z-index: 1;">
            <!-- ✅ Public profile shown or is current logged-in user -->
            <template v-if="selectedUser.public_profile || currentUser?.id === selectedUser.id">
              <div class="popover-cosmetic-wrapper" :style="getPopoverGlowStyle(selectedUser)">
                <ion-avatar style="width:72px;height:72px;margin:0;" :style="getPopoverFrameStyle(selectedUser)">
                  <img :src="(selectedUser.public_profile ? selectedUser.avatar_url : currentUser?.user_metadata?.avatar_url) || 'https://placehold.co/72px?text=?'" :alt="$t('home.altAvatar')" @error="handleImgError"/>
                </ion-avatar>
              </div>

              <div v-if="selectedUser.donor_type && selectedUser.donor_type.toLowerCase().includes('pro')" class="mock-popover-pro-badge">
                <ion-icon :icon="sparkles" class="pro-icon" />
                <span>Pro</span>
              </div>

              <div v-if="currentUser?.id === selectedUser.id && !selectedUser.public_profile" style="margin-bottom: 8px;">
                <ion-badge color="medium" style="font-size: 0.7rem; padding: 4px 8px; border-radius: 12px;" @click="showPrivateInfoAlert($event)">
                  Private
                </ion-badge>
              </div>

              <h3 class="mock-popover-name">
                <span>
                  {{ selectedUser.public_profile ? selectedUser.display_name : (currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.display_name || 'Me') }}
                </span>
              </h3>

              <p class="mock-popover-stats">
                {{ $t('profile.level', { level: getLevelFromPoints(selectedUser.total_points || selectedUser.points) }) }} • 
                <ion-badge
                  class="leaderboard-points-badge"
                  style="margin-left: 4px; border-radius: 8px; font-weight: bold; font-size: 0.75rem; padding: 4px 8px; display: inline-block; vertical-align: middle;"
                >
                  {{ selectedUser.points }} pts
                </ion-badge>
              </p>

              <!-- Stats Grid -->
              <div class="mock-popover-grid">
                <div class="grid-col">
                  <div class="grid-label">{{ $t('home.productsCount') }}</div>
                  <div class="grid-val">{{ selectedUser.product_count || 0 }}</div>
                </div>
                <div class="grid-col">
                  <div class="grid-label">{{ $t('home.locationsCount') }}</div>
                  <div class="grid-val">{{ selectedUser.location_count || 0 }}</div>
                </div>
              </div>

              <p v-if="selectedUser.bio" class="mock-popover-bio">
                "{{ selectedUser.bio }}"
              </p>
            </template>

            <!-- ❌ No public profile: only show XP and basic stats -->
            <template v-else>
              <ion-avatar style="width:72px;height:72px;margin:12px auto 8px; border: 2px solid var(--ion-color-step-200);">
                 <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background: var(--ion-color-step-100); color: var(--ion-color-step-400); font-size: 24px; font-weight: 800;">?</div>
              </ion-avatar>

              <h3 class="mock-popover-name" style="color: var(--ion-color-medium);">
                <span>
                  {{ selectedUser.display_name }}
                </span>
              </h3>

              <p class="mock-popover-stats">
                {{ $t('profile.level', { level: getLevelFromPoints(selectedUser.total_points || selectedUser.points) }) }} • 
                <ion-badge
                  class="leaderboard-points-badge"
                  style="margin-left: 4px; border-radius: 8px; font-weight: bold; font-size: 0.75rem; padding: 4px 8px; display: inline-block; vertical-align: middle;"
                >
                  {{ selectedUser.points }} pts
                </ion-badge>
              </p>

              <!-- Stats for Anonymous -->
              <div class="mock-popover-grid">
                <div class="grid-col">
                  <div class="grid-label">{{ $t('home.productsCount') }}</div>
                  <div class="grid-val">{{ selectedUser.product_count || 0 }}</div>
                </div>
                <div class="grid-col">
                  <div class="grid-label">{{ $t('home.locationsCount') }}</div>
                  <div class="grid-val">{{ selectedUser.location_count || 0 }}</div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </ion-content>
    </ion-popover>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  IonPage, IonContent, IonHeader, IonSearchbar, IonList, IonItem, IonAvatar, IonLabel, IonBadge,
  IonIcon, IonPopover, IonInfiniteScroll, IonInfiniteScrollContent, IonSkeletonText,
  IonSegment, IonSegmentButton, alertController
} from '@ionic/vue'
import AppHeader from '@/components/AppHeader.vue'
import {
  medalOutline,
  sparkles,
  chevronForwardOutline
} from 'ionicons/icons'
import { supabase } from '@/plugins/supabaseClient'
import { getThemedAnonymousName } from '@/composables/useLeaderboard'
import { getLevelColor } from '@/composables/useLevels'
import { getLevelFromPoints } from '@/utils/xp'
import { isPublicProfile, currentUser } from '@/composables/userProfile'
import { ActivityLogService } from '@/services/ActivityLogService'

const router = useRouter()
const { t, locale } = useI18n()

/* ---------------- State ---------------- */
const users = ref<any[]>([])
const loading = ref(false)
const searchQuery = ref('')
const page = ref(0)
const pageSize = 20
const isInfiniteScrollDisabled = ref(false)
const leaderboardType = ref<'daily' | 'monthly' | 'all_time'>('daily')

const selectedUser = ref<any | null>(null)
const popoverEvent = ref<Event | null>(null)

function changeLeaderboardType(ev: any) {
  leaderboardType.value = ev.detail.value as 'daily' | 'monthly' | 'all_time'
  resetAndFetch()
}

/* ---------------- Functions ---------------- */
function getDisplayRank(user: any, index: number): number {
  return user.rank || (page.value * pageSize) + index + 1
}

function handleImgError(ev: Event) {
  (ev.target as HTMLImageElement).src = 'https://placehold.co/64x64?text=👤'
}

async function resolveRanks(usersList: any[]) {
  let table = 'leaderboard_view'
  if (leaderboardType.value === 'daily') {
    table = 'leaderboard_daily_view'
  } else if (leaderboardType.value === 'monthly') {
    table = 'leaderboard_monthly_view'
  }
  const promises = usersList.map(async (u) => {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .gt('points', u.points)
      
      if (!error && count !== null) {
        u.rank = count + 1
      }
    } catch (e) {
      console.warn('Failed to resolve rank for user:', u.id, e)
    }
  })
  await Promise.all(promises)
}

async function fetchUsersPage(isAppend = false) {
  if (loading.value) return
  loading.value = true

  const from = page.value * pageSize
  const to = from + pageSize - 1

  try {
    let table = 'leaderboard_view'
    if (leaderboardType.value === 'daily') {
      table = 'leaderboard_daily_view'
    } else if (leaderboardType.value === 'monthly') {
      table = 'leaderboard_monthly_view'
    }
    let queryBuilder = supabase
      .from(table)
      .select('*')
      .order('points', { ascending: false })
      .range(from, to)

    if (searchQuery.value) {
      queryBuilder = queryBuilder
        .ilike('display_name', `%${searchQuery.value}%`)
        .eq('public_profile', true)
    }

    const { data, error } = await queryBuilder

    if (error) {
      console.error('Error fetching leaderboard pages:', error)
      return
    }

    if (data) {
      const mapped = data.map((u: any, idx: number) => {
        const absRank = searchQuery.value ? null : from + idx + 1
        return {
          ...u,
          display_name: u.public_profile ? u.display_name : getThemedAnonymousName(u.id, absRank || 1),
          avatar_url: u.public_profile ? u.avatar_url : 'https://placehold.co/64x64',
          rank: absRank,
          total_points: u.total_points ?? u.points
        }
      })

      if (searchQuery.value && mapped.length > 0) {
        await resolveRanks(mapped)
      }

      if (isAppend) {
        users.value.push(...mapped)
      } else {
        users.value = mapped
      }

      if (data.length < pageSize) {
        isInfiniteScrollDisabled.value = true
      }
    }
  } catch (err) {
    console.error('Exception in fetchUsersPage:', err)
  } finally {
    loading.value = false
  }
}

function resetAndFetch() {
  page.value = 0
  isInfiniteScrollDisabled.value = false
  fetchUsersPage(false)
}

let searchTimeout: any = null
function onSearchInput(ev: any) {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    const val = ev.detail.value || ''
    searchQuery.value = val.trim()
    resetAndFetch()
  }, 300)
}

function onSearchClear() {
  searchQuery.value = ''
  resetAndFetch()
}

async function loadNextPage(ev: any) {
  page.value++
  await fetchUsersPage(true)
  ev.target.complete()
}

function openUserProfile(user: any, ev: Event) {
  ActivityLogService.log("home_leaderboard_profile", {
    user_id: user.id,
    display_name: user.display_name
  })

  selectedUser.value = user
  popoverEvent.value = ev
}

function closePopover() {
  selectedUser.value = null
  popoverEvent.value = null
}

async function showPrivateInfoAlert(ev?: Event) {
  if (ev) {
    ev.stopPropagation()
  }
  const isZh = locale.value === 'zh' || locale.value?.startsWith('zh')
  const alert = await alertController.create({
    header: isZh ? '個人檔案已設為不公開' : 'Profile is Private',
    message: isZh 
      ? '您的個人檔案目前設定為不公開。您的姓名與頭像僅對您自己顯示，其他使用者將會看到您顯示為「匿名」。' 
      : 'Your profile is set to private. Your name and details are only visible to you. Other users will see you as Anonymous.',
    buttons: [isZh ? '我知道了' : 'Got It']
  })
  await alert.present()
}

/* ---------------- Cosmetic Helpers ---------------- */
function getCosmeticByCategory(user: any, category: string) {
  return user?.equipped_cosmetics?.find((c: any) => c.category === category)
}

function getLeaderboardGlowStyle(user: any) {
  const glow = getCosmeticByCategory(user, 'glow')
  const aura = getCosmeticByCategory(user, 'aura')
  const styles: Record<string, string> = { margin: '0 10px', position: 'relative' }
  if (glow?.css_value?.boxShadow) styles.boxShadow = glow.css_value.boxShadow
  if (glow?.css_value?.animation) styles.animation = glow.css_value.animation
  if (aura?.css_value?.background) styles.background = aura.css_value.background
  if (aura?.css_value?.animation && !glow?.css_value?.animation) styles.animation = aura.css_value.animation
  return styles
}

function getLeaderboardFrameStyle(user: any) {
  const frame = getCosmeticByCategory(user, 'frame')
  const outline = getCosmeticByCategory(user, 'outline')
  const styles: Record<string, string> = {}
  if (frame?.css_value?.border) styles.border = frame.css_value.border
  if (frame?.css_value?.boxShadow) styles.boxShadow = frame.css_value.boxShadow
  if (outline?.css_value?.border) styles.border = outline.css_value.border
  return styles
}

function getLeaderboardRowStyle(user: any) {
  const np = getCosmeticByCategory(user, 'background')
  const styles: Record<string, string> = {}
  if (np?.css_value?.background) {
    styles['--background'] = np.css_value.background
    styles.background = np.css_value.background
    
    const isLight = isBackgroundLight(np)
    const textColor = isLight ? '#121212' : '#ffffff'
    const subTextColor = isLight ? '#444444' : 'rgba(255, 255, 255, 0.7)'
    
    styles['--color'] = textColor
    styles.color = textColor
    styles['--sub-color'] = subTextColor
    styles['--ion-text-color'] = textColor
    
    if (np.css_value.animation) styles.animation = np.css_value.animation
    if (np.css_value.backgroundSize) styles.backgroundSize = np.css_value.backgroundSize
  }
  return styles
}

function getPopoverGlowStyle(user: any) {
  if (!user) return {}
  const glow = getCosmeticByCategory(user, 'glow')
  const styles: Record<string, string> = {}
  if (glow?.css_value?.boxShadow) styles.boxShadow = glow.css_value.boxShadow
  if (glow?.css_value?.animation) styles.animation = glow.css_value.animation
  return styles
}

function getPopoverAuraStyle(user: any) {
  if (!user) return {}
  const aura = getCosmeticByCategory(user, 'aura')
  if (!aura?.css_value?.background) return {}
  const styles: Record<string, string> = {
    background: aura.css_value.background
  }
  if (aura.css_value.animation) styles.animation = aura.css_value.animation
  return styles
}

function getPopoverFrameStyle(user: any) {
  const frame = getCosmeticByCategory(user, 'frame')
  const styles: Record<string, string> = { border: '2px solid var(--ion-color-primary-tint)' }
  if (frame?.css_value?.border) styles.border = frame.css_value.border
  if (frame?.css_value?.boxShadow) styles.boxShadow = frame.css_value.boxShadow
  return styles
}

function getPopoverContentStyle(user: any) {
  if (!user) return {}
  const bg = getCosmeticByCategory(user, 'background')
  const styles: Record<string, string> = {}
  
  if (bg?.css_value?.background) {
    if (bg.css_value.color) {
      styles['--color'] = bg.css_value.color
      styles.color = bg.css_value.color
    } else {
      const isLight = isBackgroundLight(bg)
      const textColor = isLight ? '#121212' : '#ffffff'
      styles['--color'] = textColor
      styles.color = textColor
    }
    if (bg.css_value.animation) styles.animation = bg.css_value.animation
    if (bg.css_value.backgroundSize) styles.backgroundSize = bg.css_value.backgroundSize
  }
  return styles
}

function getPopoverCardVariables(user: any) {
  if (!user) return {}
  const bg = getCosmeticByCategory(user, 'background')
  const outline = getCosmeticByCategory(user, 'outline')
  const styles: Record<string, string> = {}
  
  if (bg?.css_value?.background) {
    styles['--leaderboard-popover-bg'] = bg.css_value.background
  }
  if (outline?.css_value) {
    if (outline.css_value.border) {
      styles['--leaderboard-popover-border'] = outline.css_value.border
    }
    if (outline.css_value.borderImage) {
      styles['--leaderboard-popover-border-image'] = outline.css_value.borderImage
    }
    if (outline.css_value.animation) {
      styles['--leaderboard-popover-animation'] = outline.css_value.animation
    }
  }
  return styles
}

function isBackgroundLight(cosmetic?: any | null): boolean {
  if (!cosmetic) return false
  const slug = cosmetic.slug?.toLowerCase() || cosmetic.name?.toLowerCase() || ''
  return slug.includes('sakura') || slug.includes('sunset') || slug.includes('light') || slug.includes('gold')
}

/* ---------------- Lifecycle ---------------- */
onMounted(() => {
  fetchUsersPage(false)
})
</script>

<style scoped>
/* === Compact Segment === */
ion-segment {
  --background: var(--ion-color-step-100);
  border-radius: 8px;
  min-height: 32px;
}
ion-segment-button {
  --padding-top: 4px;
  --padding-bottom: 4px;
  --margin-top: 2px;
  --margin-bottom: 2px;
  --margin-start: 2px;
  --margin-end: 2px;
  min-height: 28px;
  font-size: 0.82rem;
  letter-spacing: 0;
}

/* === Leaderboard Hint Banner === */
.leaderboard-hint-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(251, 146, 60, 0.08) 100%);
  border: 1px solid rgba(249, 115, 22, 0.15);
  border-radius: 12px;
  margin-bottom: 16px;
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.leaderboard-hint-banner:active {
  transform: scale(0.98);
  opacity: 0.9;
}

.hint-icon {
  font-size: 20px;
  color: var(--ion-color-carrot);
  flex-shrink: 0;
  animation: pulse 2s infinite;
}

.hint-text {
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--ion-color-step-800);
  flex: 1;
}

.hint-arrow {
  font-size: 16px;
  color: var(--ion-color-medium);
  flex-shrink: 0;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

.ion-palette-dark .leaderboard-hint-banner {
  background: linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(251, 146, 60, 0.15) 100%);
  border-color: rgba(249, 115, 22, 0.3);
}

/* ========= Leaderboard Cosmetic Effects ========= */
.leaderboard-list {
  overflow: visible;
  background: transparent;
  padding-bottom: 32px;
}
.leaderboard-item {
  --overflow: visible;
  overflow: visible;
  contain: none;
  margin: 8px 0;
  border-radius: 12px;
}
.leaderboard-item::part(native) {
  overflow: visible !important;
  border-radius: 12px !important;
}

.leaderboard-avatar-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  padding: 2px;
  transition: all 0.3s ease;
}

.leaderboard-points-badge {
  border-radius: 8px;
  transition: all 0.3s ease;
}

.popover-cosmetic-wrapper {
  display: flex;
  justify-content: center;
  padding: 4px;
  border-radius: 50%;
  margin: 0 auto;
  width: fit-content;
  transition: all 0.3s ease;
}

.popover-custom-content {
  border-radius: 20px;
  overflow: hidden;
  --border-radius: 20px;
}

.mock-popover-pro-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #ffd700;
  color: #111;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 750;
  margin: 8px auto 12px;
  width: fit-content;
  box-shadow: 0 0 10px rgba(250, 204, 21, 0.4);
}

.mock-popover-pro-badge .pro-icon {
  font-size: 0.85rem;
}

.mock-popover-name {
  margin: 8px 0 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--ion-text-color);
}

.mock-popover-stats {
  margin: 4px 0 16px;
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  font-weight: 600;
}

.mock-popover-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin: 16px 0;
  padding: 0;
  background: transparent;
  border: none;
}

.grid-col {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.grid-label {
  font-size: 0.7rem;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.grid-val {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--ion-color-dark);
}

.ion-palette-dark .grid-val {
  color: #ffffff;
}

.mock-popover-bio {
  margin: 16px 0 0;
  font-size: 0.85rem;
  color: var(--ion-color-step-700);
  font-style: italic;
  line-height: 1.45;
}

.ion-palette-dark .mock-popover-bio {
  color: #e5e5ea;
}

/* Cosmetic Animations */
@keyframes pulse-glow {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.05); }
}

@keyframes shimmer {
  0% { opacity: 0.5; }
  50% { opacity: 1; }
  100% { opacity: 0.5; }
}

@keyframes flame-dance {
  0% { opacity: 0.7; filter: hue-rotate(0deg); }
  100% { opacity: 1; filter: hue-rotate(15deg); }
}

@keyframes neon-rainbow {
  0% { filter: hue-rotate(0deg); }
  100% { filter: hue-rotate(360deg); }
}

@keyframes dragon-shimmer {
  0% { opacity: 0.7; filter: hue-rotate(0deg) brightness(1); }
  100% { opacity: 1; filter: hue-rotate(20deg) brightness(1.2); }
}

@keyframes aurora-wave {
  0%, 100% { opacity: 0.6; filter: hue-rotate(0deg); }
  50% { opacity: 1; filter: hue-rotate(30deg); }
}

@keyframes sparkle-border {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; filter: brightness(1.3); }
}

@keyframes holo-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes gold-shimmer {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.2); }
}

/* Aura Popover Backdrop */
.popover-aura-backdrop {
  position: absolute;
  top: -20px;
  left: -20px;
  right: -20px;
  bottom: -20px;
  filter: blur(25px);
  opacity: 0.15;
  z-index: 0;
  pointer-events: none;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--ion-color-medium);
}
.empty-state p {
  margin: 8px 0 0;
  font-size: 0.95rem;
}
</style>
