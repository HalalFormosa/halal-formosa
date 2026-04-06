<template>
  <ion-card class="reels-section">
    <ion-card-header>
      <div class="card-header-row">
        <div class="header-main">
          <ion-card-title>{{ $t('home.communityBuzz') || 'Community Buzz' }}</ion-card-title>
          <p class="section-subtitle">
            {{ $t('home.communityBuzzDesc') || 'See what\'s trending with @halalformosa' }}
          </p>
        </div>

        <!-- Social Follow Buttons -->
        <div class="social-follow-row">
          <a 
            href="https://instagram.com/halalformosa" 
            target="_blank" 
            class="social-pill instagram"
            @click="logSocialFollow('instagram')"
          >
            <ion-icon :icon="logoInstagram" />
            <span>IG</span>
          </a>
          <a 
            href="https://tiktok.com/@halal_formosa" 
            target="_blank" 
            class="social-pill tiktok"
            @click="logSocialFollow('tiktok')"
          >
            <ion-icon :icon="logoTiktok" />
            <span>TikTok</span>
          </a>
        </div>
      </div>
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
        >
          <!-- Video Thumbnail -->
          <div class="reel-thumbnail-container">
            <img 
              :src="reel.thumbnail_url" 
              class="discover-img reel-img" 
              loading="lazy"
              alt="Reel thumbnail"
            />
            <div class="reel-overlay">
              <ion-icon :icon="playCircleOutline" class="play-icon" />
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
              <span class="creator-name">@{{ reel.username }}</span>
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
import { IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonIcon, IonSkeletonText, IonAvatar } from '@ionic/vue'
import { logoInstagram, logoTiktok, playCircleOutline, videocamOutline } from 'ionicons/icons'
import { ActivityLogService } from '@/services/ActivityLogService'

interface Reel {
  id: string
  caption: string
  media_url: string
  thumbnail_url?: string
  permalink: string
  username: string
  media_type: string
  platform?: 'instagram' | 'tiktok'
  creator_avatar?: string
}

const props = defineProps<{
  reels?: Reel[]
  loading?: boolean
  mode?: 'place' | 'home'
}>()

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

const logSocialFollow = (platform: string) => {
  ActivityLogService.log('home_social_follow_click', {
    platform: platform,
    handle: platform === 'instagram' ? '@halalformosa' : '@halal_formosa'
  })
}
</script>

<style scoped>
.reels-section {
  margin: 12px 10px;
}

.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.section-subtitle {
  margin: 2px 0 0;
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  font-weight: 500;
}

.social-follow-row {
  display: flex;
  gap: 8px;
}

.social-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  text-decoration: none;
  font-size: 0.75rem;
  font-weight: 700;
  transition: all 0.2s ease;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
}

.social-pill:active {
  transform: scale(0.95);
}

.social-pill span {
  color: white;
}

.social-pill.instagram {
  background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
  color: white;
}

.social-pill.tiktok {
  background: #000000;
  color: white;
  border: 1px solid rgba(255,255,255,0.2);
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
}

.reel-img {
  height: 100% !important;
  width: 100%;
  object-fit: cover;
  border-radius: 0 !important;
}

.reel-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.6));
  display: flex;
  align-items: center;
  justify-content: center;
}

.play-icon {
  font-size: 40px;
  color: white;
  opacity: 0.8;
}

.platform-badge {
  position: absolute;
  top: 10px;
  right: 10px;
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
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.creator-avatar {
  width: 20px;
  height: 20px;
}

.creator-name {
  font-size: 11px;
  font-weight: 700;
  color: var(--ion-text-color);
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

.empty-reels {
  padding: 20px;
  text-align: center;
  color: var(--ion-color-medium);
}
</style>
