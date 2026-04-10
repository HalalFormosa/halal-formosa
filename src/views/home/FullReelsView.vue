<template>
  <ion-page>
    <!-- Floating Header -->
    <ion-header class="ion-no-border floating-header">
      <ion-toolbar class="transparent-toolbar">
        <ion-buttons slot="start">
          <div class="back-button-container">
            <ion-back-button default-href="/home" color="light" :icon="chevronBack" text=""></ion-back-button>
          </div>
        </ion-buttons>
        <ion-title class="header-title">{{ $t('home.whatsNew') || "What's New" }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="reels-content" :scroll-y="false">
      <!-- Full-Screen Reels Container -->
      <div class="reels-snap-container" ref="containerRef">
        <div 
          v-for="(reel, index) in combinedReels" 
          :key="reel.id" 
          class="reel-fullscreen-item"
          :data-id="reel.id"
          :data-index="index"
        >
          <!-- Video Player Layer -->
            <!-- Media Layer (Blurred Background + Main Content) -->
            <div class="media-container-inner">
              <!-- Background Blur -->
              <div class="media-bg-blur">
                <video
                  v-if="reel.video_url && reel.platform !== 'tiktok'"
                  :src="reel.video_url"
                  class="bg-video"
                  muted
                  loop
                  playsinline
                ></video>
                <img 
                  v-else
                  :src="reel.thumbnail_url || reel.media_url" 
                  class="bg-img"
                />
              </div>

              <!-- Main Media -->
              <video
                v-if="reel.video_url && reel.platform !== 'tiktok'"
                :ref="(el: any) => videoRefs[reel.id] = el"
                :src="reel.video_url"
                class="main-media video"
                loop
                :muted="isMuted"
                playsinline
                referrerpolicy="no-referrer"
                @timeupdate="handleTimeUpdate(reel, $event)"
                @click="togglePlay(reel.id)"
              ></video>
              
              <img 
                v-if="reel.platform === 'tiktok' || !reel.video_url || isLimited[reel.id]"
                :src="reel.thumbnail_url || reel.media_url" 
                class="main-media image"
                :class="{ 'dimmed': isLimited[reel.id] }"
                alt="Reel content"
              />
            </div>

            <!-- Limited Preview Overlay -->
            <div v-if="isLimited[reel.id]" class="limit-overlay fade-in">
              <div class="limit-box">
                <ion-icon :icon="lockClosedOutline" class="lock-icon" />
                <h3>{{ $t('home.previewLimit') || 'Preview Finished' }}</h3>
                <p>{{ $t('home.previewLimitDesc') || 'Watch the full video on the original platform' }}</p>
                
                <ion-button 
                  expand="block" 
                  shape="round" 
                  color="light" 
                  class="redirect-btn"
                  @click="openExternal(reel)"
                >
                  <ion-icon :icon="reel.platform === 'tiktok' ? logoTiktok : logoInstagram" slot="start" />
                  {{ $t('home.watchFull') || 'Watch Full Video' }}
                </ion-button>
                
                <ion-button 
                  fill="clear" 
                  color="light" 
                  @click="restartPreview(reel.id)"
                  size="small"
                >
                  <ion-icon :icon="refreshOutline" slot="start" />
                  {{ $t('common.replay') || 'Replay Preview' }}
                </ion-button>
              </div>
            </div>

            <!-- Metadata Overlay (Bottom) -->
            <div class="meta-overlay" v-if="!isLimited[reel.id]">
              <div class="creator-row">
                <ion-avatar class="creator-avatar">
                  <img src="/logo-raw/logo.png" alt="Halal Formosa" />
                </ion-avatar>
                <div class="creator-text">
                  <h2 class="creator-name">@{{ reel.username }}</h2>
                  <p class="post-time">{{ fromNow(reel.timestamp) }}</p>
                </div>
                <div class="platform-container">
                  <div class="platform-chip" :class="reel.platform">
                     <ion-icon :icon="reel.platform === 'tiktok' ? logoTiktok : logoInstagram" />
                  </div>
                  
                  <!-- Integrated Audio Toggle (On top of platform icon) -->
                  <div 
                    v-if="reel.platform !== 'tiktok' && !isLimited[reel.id]" 
                    class="audio-toggle-overlay"
                    @click.stop="toggleAudio"
                  >
                    <div class="audio-toggle-btn-small">
                      <ion-icon :icon="isMuted ? volumeMuteOutline : volumeHighOutline" />
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="caption-container">
                <p class="reel-caption">{{ reel.caption }}</p>
              </div>
              
              <div class="action-row">
                <ion-button 
                  fill="solid" 
                  class="external-link-btn-premium"
                  @click="openExternal(reel)"
                >
                  {{ $t('home.viewOriginal') || 'View Original' }}
                  <ion-icon :icon="openOutline" slot="end" />
                </ion-button>
              </div>
            </div>
            
            <!-- Play/Pause Indicator -->
            <div v-if="showPlayIndicator[reel.id]" class="play-indicator-overlay">
               <ion-icon :icon="isPlaying[reel.id] ? playOutline : pauseOutline" />
            </div>

          </div>
        </div>

      <!-- Loading State -->
      <div v-if="loading" class="full-screen-loader">
        <ion-spinner name="crescent" color="light"></ion-spinner>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, reactive } from 'vue'
import { 
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle, 
  IonButtons, IonBackButton, IonIcon, IonAvatar, IonButton, IonSpinner 
} from '@ionic/vue'
import { 
  logoInstagram, logoTiktok, chevronBack, lockClosedOutline, 
  refreshOutline, openOutline, playOutline, pauseOutline,
  volumeHighOutline, volumeMuteOutline 
} from 'ionicons/icons'
import { supabase } from '@/plugins/supabaseClient'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { ActivityLogService } from '@/services/ActivityLogService'

dayjs.extend(relativeTime)

const combinedReels = ref<any[]>([])
const loading = ref(true)
const containerRef = ref<HTMLElement | null>(null)
const videoRefs = reactive<Record<string, HTMLVideoElement | null>>({})
const isLimited = reactive<Record<string, boolean>>({})
const isPlaying = reactive<Record<string, boolean>>({})
const showPlayIndicator = reactive<Record<string, boolean>>({})
const activeId = ref<string | null>(null)
const isMuted = ref(true) // Global mute state (Twitter/X style)
let observer: IntersectionObserver | null = null
let playbackTimer: any = null // Backup timer for short previews

const getLimitSeconds = (platform: string) => {
  return platform === 'tiktok' ? 3 : 10
}

const fetchData = async () => {
  loading.value = true
  try {
    const [{ data: igData }, { data: ttData }] = await Promise.all([
      supabase.from('instagram_posts').select('*').order('timestamp', { ascending: false }).limit(20),
      supabase.from('tiktok_posts').select('*').order('timestamp', { ascending: false }).limit(20)
    ])

    const combined = [
      ...(igData || []).map(p => ({ ...p, platform: 'instagram' })),
      ...(ttData || []).map(p => ({ ...p, platform: 'tiktok' }))
    ].sort((a, b) => dayjs(b.timestamp).valueOf() - dayjs(a.timestamp).valueOf())

    combinedReels.value = combined
    
    // Initialize states
    combined.forEach(r => {
      isLimited[r.id] = false
      isPlaying[r.id] = false
      showPlayIndicator[r.id] = false
    })

    // Setup observer after render
    setTimeout(setupIntersectionObserver, 500)
  } catch (err) {
    console.error('Error loading reels:', err)
  } finally {
    loading.value = false
  }
}

const setupIntersectionObserver = () => {
  observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const id = entry.target.getAttribute('data-id')
      if (!id) return

      const video = videoRefs[id]
        if (entry.isIntersecting && entry.intersectionRatio > 0.8) {
          activeId.value = id
          
          // Find the reel object to get platform
          const reel = combinedReels.value.find(r => r.id === id)
          if (!reel) return
          
          const limitSeconds = getLimitSeconds(reel.platform)

          // Play video if available
          if (video && !isLimited[id]) {
            video.play().catch(() => {})
            isPlaying[id] = true
          }

          // Setup timer (for both video and image reels)
          if (playbackTimer) clearTimeout(playbackTimer)
          
            if (!isLimited[id]) {
            // Log view
            ActivityLogService.log('reels_item_view', { reel_id: id, platform: reel.platform })

            playbackTimer = setTimeout(() => {
              if (activeId.value === id && !isLimited[id]) {
                triggerLimit(id, reel.platform)
              }
            }, limitSeconds * 1000)
          }
        } else {
        if (video) {
          video.pause()
          isPlaying[id] = false
        }
        // If the reel being exited is the current active one, clear timer
        if (activeId.value === id && playbackTimer) {
          clearTimeout(playbackTimer)
          playbackTimer = null
        }
      }
    })
  }, {
    threshold: 0.8
  })

  document.querySelectorAll('.reel-fullscreen-item').forEach(el => observer?.observe(el))
}

const triggerLimit = (id: string, platform: string) => {
  const video = videoRefs[id]
  if (video) {
    video.pause()
    // Snap to end if possible, otherwise just stay at current
    try { video.currentTime = getLimitSeconds(platform) } catch(e) {}
  }
  isLimited[id] = true
  isPlaying[id] = false
  
  ActivityLogService.log('reels_preview_limit_reached', {
      reel_id: id,
      platform: platform
  })
}

const handleTimeUpdate = (reel: any, event: any) => {
  const video = event.target
  const limitSeconds = getLimitSeconds(reel.platform)
  
  if (video.currentTime >= limitSeconds) {
    if (playbackTimer) clearTimeout(playbackTimer)
    triggerLimit(reel.id, reel.platform)
  }
}

const restartPreview = (id: string) => {
  isLimited[id] = false
  const video = videoRefs[id]
  if (video) {
    video.currentTime = 0
    video.play()
    isPlaying[id] = true
  }

  ActivityLogService.log('reels_restart_preview', { reel_id: id })
}

const togglePlay = (id: string) => {
  if (isLimited[id]) return
  const video = videoRefs[id]
  if (video) {
    if (video.paused) {
      video.play()
      isPlaying[id] = true
    } else {
      video.pause()
      isPlaying[id] = false
    }
    
    // Show indicator briefly
    showPlayIndicator[id] = true
    setTimeout(() => showPlayIndicator[id] = false, 500)
  }
}

const toggleAudio = () => {
  isMuted.value = !isMuted.value
  ActivityLogService.log('reels_audio_toggle', { is_muted: isMuted.value })
}

const openExternal = (reel: any) => {
  ActivityLogService.log('reels_view_original_click', {
    reel_id: reel.id,
    platform: reel.platform
  })
  window.open(reel.permalink, '_blank')
}

const fromNow = (ts: string) => dayjs(ts).fromNow()

onMounted(() => {
  fetchData()
  ActivityLogService.log('reels_page_open')
})

onUnmounted(() => {
  if (observer) observer.disconnect()
})
</script>

<style scoped>
.floating-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%);
}

.transparent-toolbar {
  --background: transparent;
  --color: white;
  --border-width: 0;
  padding: 8px 4px;
}

.back-button-container {
  background: rgba(255,255,255,0.9);
  backdrop-filter: blur(8px);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

/* Ensure back button icon is dark on the white background */
.back-button-container ion-back-button {
  --color: #000;
  margin-right: -2px; /* Visual center adjustment */
}

.header-title {
  font-weight: 800;
  text-shadow: 0 2px 10px rgba(0,0,0,0.8);
  letter-spacing: 0.5px;
  font-size: 1.2rem;
}

.reels-content {
  --background: #000;
}

.reels-snap-container {
  height: 100vh;
  overflow-y: scroll;
  scroll-snap-type: y mandatory;
}

.reels-snap-container::-webkit-scrollbar {
  display: none;
}

.reel-fullscreen-item {
  height: 100vh;
  width: 100%;
  scroll-snap-align: start;
  position: relative;
  background: #000;
}

.media-container-inner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}

.media-bg-blur {
  position: absolute;
  inset: 0;
  z-index: 1;
  overflow: hidden;
}

.bg-video, .bg-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(40px) brightness(0.5);
  transform: scale(1.1); /* Prevent white edges from blur */
}

.main-media {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.main-media.dimmed {
  filter: blur(10px) brightness(0.4);
  transition: filter 0.5s ease;
}

/* Metadata Overlay */
.meta-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24px 20px 40px;
  background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, transparent 100%);
  z-index: 10;
  color: white;
  text-align: left;
}

.creator-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.creator-avatar {
  width: 36px;
  height: 36px;
  border: 1.5px solid white;
}

.creator-name {
  font-size: 1.1rem;
  font-weight: 800;
  margin: 0;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}

.post-time {
  font-size: 0.8rem;
  opacity: 0.8;
  margin: 0;
}

.platform-container {
  position: relative;
  margin-left: auto;
  width: 32px;
  height: 32px;
}

.platform-chip {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.3);
}

.platform-chip.instagram {
  background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
}

.platform-chip.tiktok {
  background: #000;
  border: 1px solid rgba(255,255,255,0.3);
}

.caption-container {
  margin-bottom: 12px;
}

.reel-caption {
  font-size: 0.95rem;
  line-height: 1.4;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

.external-link-btn-premium {
  --background: rgba(255,255,255,0.2);
  --background-activated: rgba(255,255,255,0.4);
  --border-radius: 12px;
  --color: white;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.3);
  font-weight: 700;
  height: 44px;
  text-transform: none;
  font-size: 0.95rem;
  margin-top: 10px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.3);
}

/* Limit Overlay */
.limit-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.8);
  backdrop-filter: blur(10px);
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.limit-box {
  text-align: center;
  color: white;
}

.lock-icon {
  font-size: 60px;
  margin-bottom: 20px;
  color: var(--ion-color-primary);
}

.limit-box h3 {
  font-size: 1.5rem;
  font-weight: 800;
  margin: 0 0 10px;
}

.limit-box p {
  font-size: 1rem;
  opacity: 0.8;
  margin-bottom: 30px;
}

.redirect-btn {
  height: 54px;
  font-size: 1rem;
  font-weight: 800;
  margin-bottom: 12px;
  --box-shadow: 0 10px 20px rgba(0,0,0,0.3);
  --border-radius: 27px;
}

/* Indicators and Loader */
.play-indicator-overlay {
  position: absolute;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  inset: 0;
}

.play-indicator-overlay ion-icon {
  font-size: 48px;
  color: white;
  opacity: 0.6;
  pointer-events: none;
  animation: pulse-out 0.5s ease;
}

.audio-toggle-overlay {
  position: absolute;
  bottom: 44px;
  left: 50%;
  transform: translateX(-50%);
  width: 32px;
  height: 32px;
  z-index: 5;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.audio-toggle-btn-small {
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  border: 1px solid rgba(255,255,255,0.2);
  transition: all 0.2s ease;
}

.audio-toggle-btn-small:active {
  transform: scale(0.9);
}

.audio-toggle-btn-small ion-icon {
  font-size: 16px;
}

.full-screen-loader {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes pulse-out {
  0% { transform: scale(0.8); opacity: 0; }
  50% { transform: scale(1.1); opacity: 0.6; }
  100% { transform: scale(1); opacity: 0; }
}

.fade-in {
  animation: fadeIn 0.4s ease forwards;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
