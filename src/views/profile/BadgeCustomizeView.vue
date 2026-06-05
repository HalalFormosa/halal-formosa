<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/profile" />
        </ion-buttons>
        <ion-title>{{ $t('profile.badgeCustomize.title') }}</ion-title>
        <ion-buttons slot="end">
          <ion-button fill="clear" color="primary" @click="$router.push('/profile/badge-shop')">
            <ion-icon :icon="cartOutline" slot="icon-only" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding customize-content">
      <!-- Live Preview Card Outer Wrapper -->
      <div class="preview-card-outer">
        <div class="preview-header">
          <h3 class="preview-label">{{ $t('profile.badgeCustomize.livePreview') }}</h3>
          <ion-badge v-if="hasChanges" color="warning" class="unsaved-badge">
            {{ $t('profile.badgeCustomize.unsaved') }}
          </ion-badge>
        </div>

        <div class="preview-stage-container">
          <!-- Mock Popover Card Container -->
          <div class="mock-popover-container" style="position: relative; width: 100%; max-width: 260px; margin: 0 auto;">
            <!-- Aura backdrop -->
            <div v-if="getCosmeticByCategory('aura')" class="popover-aura-backdrop" :style="getPopoverAuraStyle()"></div>

            <!-- Mock Popover Card -->
            <div class="mock-popover-card" :style="getPopoverContentStyle()" :class="{ 'is-light-bg': isBackgroundLight(getCosmeticByCategory('nameplate')) }">
              <div class="popover-cosmetic-wrapper" :style="getPopoverGlowStyle()">
                <ion-avatar style="width:72px;height:72px;margin:0;" :style="getPopoverFrameStyle()">
                  <img :src="userAvatar || 'https://placehold.co/72px?text=U'" />
                </ion-avatar>
              </div>

            <div v-if="isSubscribed" class="mock-popover-pro-badge">
              <ion-icon :icon="sparkles" class="pro-icon" />
              <span>Pro</span>
            </div>

            <h3 class="mock-popover-name">
              {{ userDisplayName || 'You' }}
            </h3>

            <p class="mock-popover-stats">
              Level {{ level }} • 
              <ion-badge
                class="leaderboard-points-badge"
                style="margin-left: 4px; border-radius: 8px; font-weight: bold; font-size: 0.75rem; padding: 4px 8px; display: inline-block; vertical-align: middle;"
              >
                {{ points }} pts
              </ion-badge>
            </p>

            <div class="mock-popover-grid">
              <div class="grid-col">
                <div class="grid-label">PRODUCTS</div>
                <div class="grid-val">{{ productCount }}</div>
              </div>
              <div class="grid-col">
                <div class="grid-label">LOCATIONS</div>
                <div class="grid-val">{{ locationCount }}</div>
              </div>
            </div>

            <p class="mock-popover-bio">
              "{{ userBio || 'Please support Halal Formosa 😋' }}"
            </p>
          </div>
        </div>
      </div>

        <!-- Active Effects Tags -->
        <div v-if="equippedCosmetics.length > 0" class="active-effects">
          <ion-chip
            v-for="cosmetic in equippedCosmetics"
            :key="cosmetic?.id"
            color="success"
            class="effect-chip"
          >
            <span>{{ getCategoryEmoji(cosmetic?.category || '') }}</span>
            <ion-label>{{ cosmetic?.name }}</ion-label>
            <ion-icon :icon="closeCircleOutline" @click="handleUnequip(cosmetic!)" />
          </ion-chip>
        </div>
        <p v-else class="no-effects-text">{{ $t('profile.badgeCustomize.noEffects') }}</p>
      </div>

      <!-- Owned Items by Category -->
      <template v-if="!loadingOwned">
        <div v-for="cat in categoriesWithItems" :key="cat.key" class="category-section">
          <div class="section-header">
            <span class="section-emoji">{{ cat.emoji }}</span>
            <h3 class="section-title">{{ $t('profile.badgeShop.categories.' + cat.key) }}</h3>
            <span class="section-count">{{ cat.items.length }}</span>
          </div>

          <div class="items-row">
            <div
              v-for="owned in cat.items"
              :key="owned.id"
              :class="['owned-item', { equipped: owned.equipped }]"
              @click="toggleEquip(owned)"
            >
              <div class="owned-item-preview" :style="getItemPreviewStyle(owned.cosmetic)">
                <CosmeticBadge
                  :cosmetics="[{ category: owned.cosmetic!.category, css_value: owned.cosmetic!.css_value, tier: owned.cosmetic!.tier }]"
                  :avatar-url="userAvatar || 'https://placehold.co/40x40'"
                  :show-avatar="['frame', 'glow', 'aura'].includes(owned.cosmetic!.category)"
                  :show-badge="['outline', 'background'].includes(owned.cosmetic!.category)"
                  :badge-text="owned.cosmetic!.name"
                  size="sm"
                />
              </div>
              <span class="owned-item-name">{{ owned.cosmetic?.name }}</span>
              <ion-icon
                v-if="owned.equipped"
                :icon="checkmarkCircle"
                class="equipped-check"
              />
              <div
                v-if="owned.cosmetic?.tier !== 'free' && !owned.equipped"
                class="refund-btn"
                title="Refund Item"
                @click.stop="confirmRefund(owned)"
              >
                <ion-icon :icon="arrowUndoOutline" />
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="ownedCosmetics.length === 0" class="empty-state">
          <div class="empty-icon">🎨</div>
          <h3>{{ $t('profile.badgeCustomize.noItems') }}</h3>
          <ion-button fill="outline" color="primary" @click="$router.push('/profile/badge-shop')">
            {{ $t('profile.badgeCustomize.goToShop') }}
          </ion-button>
        </div>
      </template>

      <!-- Loading -->
      <div v-else class="loading-state">
        <ion-skeleton-text v-for="n in 3" :key="n" animated style="height: 100px; border-radius: 16px; margin-bottom: 12px;" />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonBackButton, IonButton, IonBadge, IonIcon, IonChip, IonLabel,
  IonSkeletonText, toastController, IonAvatar, alertController,
  onIonViewWillEnter
} from '@ionic/vue'
import { cartOutline, checkmarkCircle, closeCircleOutline, sparkles, arrowUndoOutline } from 'ionicons/icons'
import { useI18n } from 'vue-i18n'
import { supabase } from '@/plugins/supabaseClient'
import CosmeticBadge from '@/components/CosmeticBadge.vue'
import { useBadgeCosmetics, type OwnedCosmetic, type BadgeCosmetic } from '@/composables/useBadgeCosmetics'
import { currentPoints } from '@/composables/usePoints'
import { getLevelFromPoints } from '@/utils/xp'

const { t } = useI18n()
const {
  ownedCosmetics, equippedCosmetics, loadingOwned, spendablePoints,
  fetchOwnedCosmetics, equipCosmetic, unequipCosmetic, refundCosmetic
} = useBadgeCosmetics()

const userAvatar = ref('')
const userDisplayName = ref('')
const hasChanges = ref(false)

const productCount = ref(0)
const locationCount = ref(0)
const userBio = ref('')
const donorType = ref('')
const isSubscribed = computed(() => donorType.value?.toLowerCase() === 'pro')
const points = ref(0)
const level = computed(() => getLevelFromPoints(points.value))

async function fetchUserProfileData(userId: string) {
  const { data } = await supabase
    .from('leaderboard_view')
    .select('product_count, location_count, bio, points, donor_type')
    .eq('id', userId)
    .single()
    
  if (data) {
    productCount.value = data.product_count || 0
    locationCount.value = data.location_count || 0
    userBio.value = data.bio || ''
    donorType.value = data.donor_type || ''
    points.value = data.points || 0
  } else {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('bio, points, donor_type')
      .eq('id', userId)
      .single()
    if (profile) {
      userBio.value = profile.bio || ''
      donorType.value = profile.donor_type || ''
      points.value = profile.points || 0
    }
  }
}

function getCosmeticByCategory(category: string) {
  return equippedCosmetics.value.find(c => c?.category === category)
}

function isBackgroundLight(cosmetic?: BadgeCosmetic | null): boolean {
  if (!cosmetic) return false
  const slug = cosmetic.slug?.toLowerCase() || ''
  return slug.includes('sakura') || slug.includes('sunset') || slug.includes('light') || slug.includes('gold')
}

function getPopoverContentStyle() {
  const bg = getCosmeticByCategory('nameplate')
  const outline = getCosmeticByCategory('outline')
  const styles: Record<string, string> = {
    borderRadius: '20px',
    transition: 'all 0.3s ease',
    boxSizing: 'border-box'
  }
  
  let bgValue = '#181818'
  let colorValue = '#ffffff'
  let bgSize = ''
  let bgAnim = ''
  
  if (bg?.css_value?.background) {
    bgValue = bg.css_value.background
    if (bg.css_value.color) colorValue = bg.css_value.color
    if (bg.css_value.backgroundSize) bgSize = bg.css_value.backgroundSize
    if (bg.css_value.animation) bgAnim = bg.css_value.animation
  }
  
  // Adapt text color to light background if detected
  const isLight = isBackgroundLight(bg)
  styles.color = isLight ? '#121212' : colorValue
  
  if (outline?.css_value) {
    if (outline.css_value.borderImage) {
      const borderImg = outline.css_value.borderImage.replace(/\s+\d+$/, '')
      const baseBg = bgValue.includes('gradient') ? bgValue : `linear-gradient(${bgValue}, ${bgValue})`
      styles.background = `${baseBg} padding-box, ${borderImg} border-box`
      styles.border = '2px solid transparent'
      if (outline.css_value.animation) {
        styles.animation = bgAnim ? `${bgAnim}, ${outline.css_value.animation}` : outline.css_value.animation
      } else if (bgAnim) {
        styles.animation = bgAnim
      }
    } else {
      styles.background = bgValue
      if (bgSize) styles.backgroundSize = bgSize
      if (bgAnim) styles.animation = bgAnim
      if (outline.css_value.border) styles.border = outline.css_value.border
    }
  } else {
    styles.background = bgValue
    if (bgSize) styles.backgroundSize = bgSize
    if (bgAnim) styles.animation = bgAnim
    styles.border = '1px solid rgba(255, 255, 255, 0.08)'
  }
  
  return styles
}

function getPopoverGlowStyle() {
  const glow = getCosmeticByCategory('glow')
  const styles: Record<string, string> = {}
  if (glow?.css_value?.boxShadow) styles.boxShadow = glow.css_value.boxShadow
  if (glow?.css_value?.animation) styles.animation = glow.css_value.animation
  return styles
}

function getPopoverAuraStyle() {
  const aura = getCosmeticByCategory('aura')
  if (!aura?.css_value?.background) return {}
  const styles: Record<string, string> = {
    background: aura.css_value.background
  }
  if (aura.css_value.animation) styles.animation = aura.css_value.animation
  return styles
}

function getPopoverFrameStyle() {
  const frame = getCosmeticByCategory('frame')
  const styles: Record<string, string> = { border: '2px solid var(--ion-color-primary-tint)' }
  if (frame?.css_value?.border) styles.border = frame.css_value.border
  if (frame?.css_value?.boxShadow) styles.boxShadow = frame.css_value.boxShadow
  return styles
}



const categories = [
  { key: 'glow', emoji: '✨' },
  { key: 'aura', emoji: '🌀' },
  { key: 'outline', emoji: '💠' },
  { key: 'background', emoji: '🎨' },
  { key: 'frame', emoji: '🖼️' }
]

const categoriesWithItems = computed(() =>
  categories
    .map(cat => ({
      ...cat,
      items: ownedCosmetics.value.filter(o => o.cosmetic?.category === cat.key)
    }))
    .filter(cat => cat.items.length > 0)
)

const previewCosmetics = computed(() =>
  equippedCosmetics.value.map(c => ({
    category: c!.category,
    css_value: c!.css_value,
    tier: c!.tier
  }))
)

const previewBgStyle = computed(() => {
  const bg = equippedCosmetics.value.find(c => c?.category === 'background')
  if (bg?.css_value?.background) {
    return { background: bg.css_value.background }
  }
  return {}
})

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    glow: '✨', aura: '🌀', outline: '💠', background: '🎨', frame: '🖼️'
  }
  return map[category] || '🎯'
}

function getItemPreviewStyle(cosmetic?: BadgeCosmetic) {
  if (!cosmetic?.preview_color) return {}
  return {
    borderColor: cosmetic.preview_color + '33'
  }
}

onIonViewWillEnter(async () => {
  const session = (await supabase.auth.getSession()).data.session
  if (!session) return

  userAvatar.value = session.user?.user_metadata?.avatar_url || ''
  userDisplayName.value =
    session.user?.user_metadata?.full_name ||
    session.user?.user_metadata?.display_name || ''

  await Promise.all([
    fetchOwnedCosmetics(session.user.id),
    fetchUserProfileData(session.user.id)
  ])
})

async function toggleEquip(owned: OwnedCosmetic) {
  if (owned.equipped) {
    await handleUnequip(owned.cosmetic!)
  } else {
    await handleEquip(owned)
  }
}

async function handleEquip(owned: OwnedCosmetic) {
  await equipCosmetic(owned.cosmetic_id, owned.cosmetic!.category)
  const toast = await toastController.create({
    message: `✅ ${owned.cosmetic?.name} equipped!`,
    duration: 2000,
    color: 'success',
    position: 'top'
  })
  await toast.present()
}

async function handleUnequip(cosmetic: BadgeCosmetic) {
  await unequipCosmetic(cosmetic.id)
  const toast = await toastController.create({
    message: `${cosmetic.name} unequipped`,
    duration: 2000,
    color: 'medium',
    position: 'top'
  })
  await toast.present()
}

async function confirmRefund(owned: OwnedCosmetic) {
  const cosmetic = owned.cosmetic
  if (!cosmetic) return

  if (cosmetic.tier === 'free') {
    const alert = await alertController.create({
      header: t('common.error') || 'Error',
      message: 'Free cosmetics cannot be refunded.',
      buttons: ['OK']
    })
    await alert.present()
    return
  }

  const alert = await alertController.create({
    header: 'Refund Cosmetic?',
    message: `Are you sure you want to return "${cosmetic.name}"? You will be refunded ${cosmetic.xp_cost} XP.`,
    buttons: [
      {
        text: t('common.cancel') || 'Cancel',
        role: 'cancel'
      },
      {
        text: 'Refund',
        role: 'destructive',
        handler: async () => {
          const res = await refundCosmetic(cosmetic.id)
          if (res.success) {
            const toast = await toastController.create({
              message: `💸 Refunded ${cosmetic.xp_cost} XP for "${cosmetic.name}"!`,
              duration: 3000,
              color: 'success',
              position: 'top'
            })
            await toast.present()
          } else {
            const toast = await toastController.create({
              message: `❌ Refund failed: ${res.error}`,
              duration: 3000,
              color: 'danger',
              position: 'top'
            })
            await toast.present()
          }
        }
      }
    ]
  })
  await alert.present()
}
</script>

<style scoped>
/* ========= Preview Card ========= */
/* ========= Preview Card Wrapper ========= */
.preview-card-outer {
  background: var(--ion-card-background);
  border-radius: 20px;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid var(--ion-color-step-100);
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.preview-label {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--ion-color-medium);
}

.unsaved-badge {
  font-size: 0.6rem;
  border-radius: 6px;
}

.preview-stage-container {
  padding: 16px 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* ========= Mock Popover Card (Realistic Leaderboard Detail Card) ========= */
.mock-popover-card {
  width: 100%;
  max-width: 260px;
  background: #181818;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 20px 16px;
  margin: 0 auto;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  text-align: center;
  transition: all 0.3s ease;
  color: #ffffff;
  box-sizing: border-box;
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
  color: #ffffff;
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
  color: #8e8e93;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.grid-val {
  font-size: 1.15rem;
  font-weight: 800;
  color: #ffffff;
}

.mock-popover-bio {
  margin: 16px 0 0;
  font-size: 0.85rem;
  color: #e5e5ea;
  font-style: italic;
  line-height: 1.45;
}

.popover-cosmetic-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  margin: 12px auto;
  padding: 0;
  transition: all 0.3s ease;
  position: relative;
}

.popover-aura-backdrop {
  position: absolute;
  inset: -12px;
  z-index: 0;
  filter: blur(14px);
  opacity: 0.8;
  border-radius: 28px;
  pointer-events: none;
  transition: all 0.3s ease;
}

.ion-palette-dark .mock-popover-card {
  border-color: rgba(255, 255, 255, 0.08);
}

/* Light Background overrides */
.mock-popover-card.is-light-bg {
  color: #121212 !important;
}
.mock-popover-card.is-light-bg .mock-popover-name {
  color: #121212 !important;
}
.mock-popover-card.is-light-bg .mock-popover-stats {
  color: #444444 !important;
}
.mock-popover-card.is-light-bg .grid-label {
  color: #666666 !important;
}
.mock-popover-card.is-light-bg .grid-val {
  color: #121212 !important;
}
.mock-popover-card.is-light-bg .mock-popover-bio {
  color: #333333 !important;
}

/* ========= Active Effects ========= */
.active-effects {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin-top: 8px;
}

.effect-chip {
  --background: rgba(var(--ion-color-success-rgb), 0.1);
  font-size: 0.75rem;
  height: 28px;
}

.no-effects-text {
  text-align: center;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  margin-top: 8px;
}

/* ========= Category Sections ========= */
.category-section {
  margin-bottom: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.section-emoji {
  font-size: 1.2rem;
}

.section-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--ion-text-color);
  flex: 1;
}

.section-count {
  font-size: 0.7rem;
  color: var(--ion-color-medium);
  background: var(--ion-color-step-100);
  padding: 2px 8px;
  border-radius: 8px;
  font-weight: 600;
}

/* ========= Items Row ========= */
.items-row {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
}

.items-row::-webkit-scrollbar { display: none; }

.owned-item {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px;
  border-radius: 14px;
  border: 2px solid var(--ion-color-step-150);
  background: var(--ion-card-background);
  cursor: pointer;
  transition: all 0.25s ease;
  min-width: 80px;
  position: relative;
}

.owned-item:active { transform: scale(0.95); }

.owned-item.equipped {
  border-color: var(--ion-color-success);
  background: rgba(var(--ion-color-success-rgb), 0.05);
  box-shadow: 0 0 12px rgba(var(--ion-color-success-rgb), 0.15);
}

.owned-item-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
}

.owned-item-name {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--ion-color-step-700);
  text-align: center;
  max-width: 70px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.equipped-check {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 0.9rem;
  color: var(--ion-color-success);
}

/* ========= Empty State ========= */
.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 12px;
}

.empty-state h3 {
  font-weight: 700;
  color: var(--ion-color-medium);
  margin-bottom: 16px;
}

/* ========= Loading ========= */
.loading-state {
  padding: 20px 0;
}

.refund-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  background: var(--ion-color-danger);
  color: white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  z-index: 10;
  cursor: pointer;
  transition: transform 0.2s;
}

.refund-btn:active {
  transform: scale(0.85);
}
</style>
