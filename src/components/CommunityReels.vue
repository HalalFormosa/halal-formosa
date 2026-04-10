<template>
  <ion-card class="reels-section">
    <ion-card-header>
      <div class="card-header-row">
        <ion-card-title class="section-title">{{ $t('home.whatsNew') || 'What\'s New' }}</ion-card-title>
        <ion-button 
          fill="clear" 
          size="small" 
          color="carrot" 
          @click="$router.push('/reels')"
        >
          {{ $t('home.viewMore') }}
        </ion-button>
      </div>
      <p class="section-subtitle">
        {{ $t('home.communityBuzzDesc') || 'See what\'s trending with @halalformosa' }}
      </p>
    </ion-card-header>

    <ion-card-content>
      <!-- Loading Skeletons -->
      <div v-if="loading" class="discover-grid">
        <ion-card v-for="n in 4" :key="n" class="discover-item reel-skeleton">
          <ion-skeleton-text animated style="width: 100%; height: 260px;" />
        </ion-card>
      </div>

      <!-- Reels Grid -->
      <div v-else class="discover-grid">
        <ion-card
          v-for="reel in reels"
          :key="reel.id"
          class="discover-item reel-item"
          button
          @click="openReel(reel)"
          :id="'reel-' + reel.id"
        >
          <!-- Video Thumbnail / Player -->
          <div class="reel-thumbnail-container" :data-id="reel.id">
            <!-- Actual Video (Plays when visible) -->
            <video
              v-if="reel.video_url && activeReelId === reel.id"
              :src="reel.video_url"
              class="reel-video"
              autoplay
              muted
              loop
              playsinline
              referrerpolicy="no-referrer"
            ></video>
            
            <!-- Static Thumbnail (Placeholder) -->
            <img 
              v-show="activeReelId !== reel.id || !reel.video_url"
              :src="reel.thumbnail_url || reel.media_url" 
              class="discover-img reel-img" 
              loading="lazy"
              alt="Reel thumbnail"
              @error="handleImageError"
            />

            <div class="reel-overlay">
              <ion-icon 
                v-if="activeReelId !== reel.id" 
                :icon="playCircleOutline" 
                class="play-icon" 
              />
              <div class="platform-badge">
                <ion-icon :icon="reel.platform === 'tiktok' ? logoTiktok : logoInstagram" />
              </div>
            </div>
          </div>

          <!-- Reel Meta -->
          <div class="discover-label reel-label">
            <div class="creator-info">
              <ion-avatar class="creator-avatar">
                <img src="/logo-raw/logo.png" alt="Halal Formosa" />
              </ion-avatar>
              <div class="creator-meta">
                <span class="creator-name">@{{ reel.username }}</span>
                <span v-if="reel.timestamp" class="post-time">{{ fromNow(reel.timestamp) }}</span>
              </div>
            </div>
            <p class="reel-caption">{{ reel.caption }}</p>
          </div>
        </ion-card>

        <!-- No Content State -->
        <div v-if="reels && reels.length === 0" class="no-reels">
          <ion-icon :icon="videocamOutline" />
          <p>{{ $t('home.noReels') || 'No recent content found.' }}</p>
        </div>
      </div>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonIcon, IonSkeletonText, IonAvatar } from '@ionic/vue'
import { logoInstagram, logoTiktok, playCircleOutline, videocamOutline, chevronForward } from 'ionicons/icons'
import { ActivityLogService } from '@/services/ActivityLogService'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

// Configure dayjs
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(relativeTime)

interface Reel {
  id: string
  caption: string
  media_url: string
  video_url?: string
  thumbnail_url?: string
  permalink: string
  username: string
  media_type: string
  timestamp: string
  platform?: 'instagram' | 'tiktok'
  creator_avatar?: string
}

const props = defineProps<{
  reels?: Reel[]
  loading?: boolean
  mode?: 'place' | 'home'
}>()

const emit = defineEmits(['refresh-needed'])

// 👁️ Viewport Tracking Logic
const activeReelId = ref<string | null>(null)
let observer: IntersectionObserver | null = null

const setupObserver = () => {
  if (observer) observer.disconnect()

  observer = new IntersectionObserver((entries) => {
    // Find the item with the highest intersection ratio
    let maxRatio = 0
    let mostVisibleId = null

    entries.forEach((entry) => {
      if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
        maxRatio = entry.intersectionRatio
        mostVisibleId = (entry.target as HTMLElement).getAttribute('data-id')
      }
    })

    if (mostVisibleId) {
      activeReelId.value = mostVisibleId
    }
  }, {
    threshold: 0.6 // Card must be 60% visible to trigger autoplay
  })

  // Observe all thumbnails
  const containers = document.querySelectorAll('.reel-thumbnail-container')
  containers.forEach(container => observer?.observe(container))
}

// Watch for reels data changes to re-observe
watch(() => props.reels, () => {
  setTimeout(setupObserver, 500)
}, { deep: true })

onMounted(() => {
  setTimeout(setupObserver, 1000)
})

onUnmounted(() => {
  if (observer) observer.disconnect()
})

const handleImageError = (event: Event) => {
  const target = event.target as HTMLImageElement
  if (target) {
    target.src = '/logo-raw/logo.png'
    target.style.objectFit = 'contain'
    target.style.padding = '20px'
    target.style.background = 'var(--ion-color-step-50)'
    emit('refresh-needed')
  }
}

const openReel = (reel: Reel) => {
  ActivityLogService.log(
      props.mode === 'home'
          ? 'home_media_partner_open'
          : 'explore_reel_open',
       {
        reel_id: reel.id,
        platform: reel.platform || 'instagram',
        username: reel.username
      }
  )

  window.open(reel.permalink, '_blank')
}

const fromNow = (timestamp: string) => {
  if (!timestamp) return ''
  return dayjs(timestamp).fromNow()
}

const logSocialFollow = (platform: string) => {
  ActivityLogService.log('home_social_follow_click', {
    platform: platform,
    handle: platform === 'instagram' ? '@halalformosa' : '@halal_formosa'
  })
}
</script>

<style scoped>
.reels-section {
  margin: 10px; /* Standard margin for Home sections */
}

.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-weight: 700;
  font-size: 1.1rem;
}

.section-subtitle {
  margin: -4px 0 0;
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  font-weight: 500;
}

.discover-grid {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.discover-grid::-webkit-scrollbar {
  display: none;
}

.reel-item {
  flex: 0 0 180px;
  height: auto;
  margin: 0;
}

.reel-skeleton {
  flex: 0 0 180px;
  height: 260px;
  margin: 0;
}

.reel-thumbnail-container {
  position: relative;
  width: 100%;
  height: 260px;
  overflow: hidden;
  background: #000; /* Black background for video transition */
}

.reel-img, .reel-video {
  height: 100% !important;
  width: 100%;
  object-fit: cover;
  border-radius: 0 !important;
}

.reel-video {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}

.reel-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.6));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2; /* Ensure overlay stays on top of video */
}

.play-icon {
  font-size: 40px;
  color: white;
  opacity: 0.8;
}

.platform-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(4px);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px;
}

.reel-label {
  padding: 10px 8px !important;
  text-align: left !important;
}

.creator-info {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 6px;
}

.creator-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0;
}

.creator-avatar {
  width: 24px;
  height: 24px;
  border: 1px solid var(--ion-color-step-150);
}

.creator-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--ion-text-color);
}

.post-time {
  font-size: 10px;
  color: var(--ion-color-medium);
  font-weight: 500;
}

.reel-caption {
  font-size: 11px !important;
  line-height: 1.3;
  color: var(--ion-color-medium);
  margin: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.no-reels {
  padding: 40px 20px;
  text-align: center;
  width: 100%;
  color: var(--ion-color-medium);
}

.no-reels ion-icon {
  font-size: 48px;
  margin-bottom: 12px;
}
</style>
