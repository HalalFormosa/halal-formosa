<template>
  <div class="cosmetic-badge-wrapper" :class="wrapperClasses" :style="wrapperStyle">
    <!-- Aura layer (behind content) -->
    <div v-if="auraStyle" class="cosmetic-aura-layer" :style="auraStyle"></div>

    <!-- Frame layer (around avatar) -->
    <div v-if="showAvatar" class="cosmetic-avatar-wrapper" :style="frameStyle">
      <img
        v-if="avatarUrl"
        :src="avatarUrl"
        :alt="alt"
        class="cosmetic-avatar-img"
        loading="lazy"
      />
      <div v-else class="cosmetic-avatar-placeholder">
        <ion-icon :icon="personCircleOutline" />
      </div>
    </div>

    <!-- Badge / content layer -->
    <div v-if="showBadge" class="cosmetic-badge-inner" :style="badgeStyle">
      <slot>
        <ion-badge :color="badgeColor" class="cosmetic-badge-label">
          {{ badgeText }}
        </ion-badge>
      </slot>
    </div>

    <!-- Glow overlay -->
    <div v-if="glowStyle" class="cosmetic-glow-layer" :style="glowStyle"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IonBadge, IonIcon } from '@ionic/vue'
import { personCircleOutline } from 'ionicons/icons'

interface CosmeticEffect {
  slug?: string
  category: string
  css_value: Record<string, any>
  tier?: string
}

const props = withDefaults(defineProps<{
  cosmetics?: CosmeticEffect[] | null
  avatarUrl?: string
  alt?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showAvatar?: boolean
  showBadge?: boolean
  badgeText?: string
  badgeColor?: string
}>(), {
  cosmetics: null,
  avatarUrl: '',
  alt: 'Avatar',
  size: 'md',
  showAvatar: true,
  showBadge: false,
  badgeText: '',
  badgeColor: 'primary'
})

const sizeMap = { sm: 40, md: 56, lg: 80, xl: 120 }

function getEffect(category: string): CosmeticEffect | undefined {
  return props.cosmetics?.find(c => c.category === category)
}

const wrapperClasses = computed(() => [
  `cosmetic-size-${props.size}`,
  props.cosmetics?.some(c => c.css_value?.animation) ? 'has-animation' : ''
])

const wrapperStyle = computed(() => {
  const bg = getEffect('background')
  const styles: Record<string, string> = {}
  if (bg?.css_value) {
    if (bg.css_value.background) styles.background = bg.css_value.background
    if (bg.css_value.backgroundSize) styles.backgroundSize = bg.css_value.backgroundSize
    if (bg.css_value.color) styles.color = bg.css_value.color
    if (bg.css_value.animation) styles.animation = bg.css_value.animation
  }
  return styles
})

const glowStyle = computed(() => {
  const glow = getEffect('glow')
  if (!glow?.css_value) return null
  const styles: Record<string, string> = {}
  if (glow.css_value.boxShadow) styles.boxShadow = glow.css_value.boxShadow
  if (glow.css_value.animation) styles.animation = glow.css_value.animation
  return styles
})

const auraStyle = computed(() => {
  const aura = getEffect('aura')
  if (!aura?.css_value) return null
  const styles: Record<string, string> = {}
  if (aura.css_value.background) styles.background = aura.css_value.background
  if (aura.css_value.backdropFilter) styles.backdropFilter = aura.css_value.backdropFilter
  if (aura.css_value.animation) styles.animation = aura.css_value.animation
  return styles
})

const frameStyle = computed(() => {
  const frame = getEffect('frame')
  const outline = getEffect('outline')
  const styles: Record<string, string> = {
    width: `${sizeMap[props.size]}px`,
    height: `${sizeMap[props.size]}px`
  }
  if (frame?.css_value) {
    if (frame.css_value.border) styles.border = frame.css_value.border
    if (frame.css_value.boxShadow) styles.boxShadow = frame.css_value.boxShadow
    if (frame.css_value.animation) styles.animation = frame.css_value.animation
  }
  if (outline?.css_value) {
    if (outline.css_value.border) styles.border = outline.css_value.border
    if (outline.css_value.borderImage) styles.borderImage = outline.css_value.borderImage
    if (outline.css_value.animation) styles.animation = outline.css_value.animation
  }
  return styles
})

const badgeStyle = computed(() => {
  const outline = getEffect('outline')
  const styles: Record<string, string> = {}
  if (!props.showAvatar && outline?.css_value) {
    if (outline.css_value.border) styles.border = outline.css_value.border
  }
  return styles
})
</script>

<style scoped>
.cosmetic-badge-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.cosmetic-size-sm { width: 44px; height: 44px; }
.cosmetic-size-md { width: 60px; height: 60px; }
.cosmetic-size-lg { width: 84px; height: 84px; }
.cosmetic-size-xl { width: 124px; height: 124px; }

.cosmetic-aura-layer {
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  z-index: 0;
  pointer-events: none;
}

.cosmetic-avatar-wrapper {
  position: relative;
  z-index: 1;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ion-color-step-100);
}

.cosmetic-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.cosmetic-avatar-placeholder {
  font-size: 2rem;
  color: var(--ion-color-step-400);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.cosmetic-glow-layer {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  z-index: 0;
  pointer-events: none;
}

.cosmetic-badge-inner {
  position: relative;
  z-index: 2;
}

.cosmetic-badge-label {
  border-radius: 12px;
  padding: 6px 12px;
}

/* ========= Animations ========= */
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
  50% { filter: brightness(1.3); }
}
</style>
