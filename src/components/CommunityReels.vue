<template>
  <div class="ion-margin-top">
    <!-- Section Header -->
    <div
        v-if="mode !== 'home'"
        class="ion-padding-horizontal"
    >
      <h3 class="font-bold text-lg">Media Partner Content</h3>
      <p class="text-sm text-gray-500">
        Real halal experiences from our verified media partner
      </p>
    </div>


    <!-- Horizontal Reel Placeholder -->
    <div class="reel-scroll ion-padding-horizontal">
      <div
          v-for="n in 5"
          :key="n"
          class="reel-card"
          @click="openPlaceholder"
      >
        <!-- Thumbnail -->
        <div class="reel-thumb">
          <img
              src="/placeholder/reel-cover.png"
              alt="Community reel placeholder"
          />

          <!-- Play Overlay -->
          <div class="play-overlay">▶</div>

          <!-- Platform Badge -->
          <div class="platform-badge">
            <ion-icon :icon="logoInstagram" />
          </div>
        </div>

        <!-- Meta -->
        <div class="reel-meta">
          <p class="creator">@nihaoindo</p>
          <p class="partner">
            Media partner · <strong>Nihao Indo</strong> · Instagram
          </p>
          <p class="caption" style="white-space: pre-line;">
            Kebab Halal terenak sih menurut mimin 😍
            📍Imtiaz Bhai, Pakistan Food 巴基斯坦甩餅
            🚆MRT Yongan Market
            🚶‍♂️Jalan kaki 10 menit

            #nihaoindo #nihaoindonesia #taiwan #taiwanfood
          </p>

        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue'
import { logoInstagram } from 'ionicons/icons'
import { ActivityLogService } from '@/services/ActivityLogService'

const props = defineProps<{
  placeId?: number        // optional now
  mode?: 'place' | 'home'
}>()


const CONTENT_LINK = {
  instagram: 'https://www.instagram.com/reel/DMr2W7dy5Gr/',
  // tiktok: 'https://www.tiktok.com/@nihaoindo/video/XXXXXXXX',
  // facebook: 'https://www.facebook.com/watch/?v=XXXXXXXX'
}

const reel = {
  platform: 'instagram',
  media_partner: 'nihaoindo',
  place_id: 123
}



const openPlaceholder = () => {
  ActivityLogService.log(
      props.mode === 'home'
          ? 'home_media_partner_open'
          : 'explore_reel_open',
      {
        place_id: reel.place_id ?? null,
        platform: reel.platform,
        media_partner: reel.media_partner
      }
  )

  window.open(CONTENT_LINK.instagram, '_blank')
}

</script>

<style scoped>
.reel-scroll {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding-top: 12px;
  padding-bottom: 16px;
}

/* Card feels embedded, not owned */
.reel-card {
  min-width: 220px;
  max-width: 220px;
  border-radius: 18px;
  background: #fafafa;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.reel-card:active {
  transform: scale(0.98);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

/* Thumbnail */
.reel-thumb {
  position: relative;
  width: 100%;
  height: 300px;
  overflow: hidden;
  border-radius: 18px 18px 0 0;
  background: #000;
}

.reel-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Play overlay – subtle */
.play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 44px;
  color: white;
  background: linear-gradient(
      to bottom,
      rgba(0,0,0,0.1),
      rgba(0,0,0,0.35)
  );
}

/* Platform badge */
.platform-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0,0,0,0.6);
  border-radius: 999px;
  padding: 6px;
  color: white;
}

/* Meta section */
.reel-meta {
  padding: 10px 12px 14px;
}

/* Creator handle */
.creator {
  font-weight: 600;
  font-size: 13px;
  color: #222;
}

/* Partner attribution – visually distinct */
.partner {
  font-size: 11px;
  color: #888;
  margin-top: 2px;
}

/* Caption – social style */
.caption {
  font-size: 12px;
  color: #444;
  margin-top: 6px;
  line-height: 1.4;
}

</style>
