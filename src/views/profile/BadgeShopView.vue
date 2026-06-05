<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/profile" />
        </ion-buttons>
        <ion-title>{{ $t('profile.badgeShop.title') }}</ion-title>
        <ion-buttons slot="end">
          <div class="xp-wallet">
            <ion-icon :icon="sparkles" class="xp-wallet-icon" />
            <span class="xp-wallet-amount">{{ spendablePoints }}</span>
          </div>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding shop-content">
      <!-- Hero Section / Dressing Room Showcase -->
      <div class="shop-hero">
        <div class="hero-glow"></div>
        <div class="showcase-container">
          <!-- Mock Popover Card Container -->
          <div class="mock-popover-container" style="position: relative;">
            <!-- Aura backdrop -->
            <div v-if="previewCosmetics['aura']" class="popover-aura-backdrop" :style="getShowcaseAuraStyle()"></div>

            <!-- Mock Popover Card -->
            <div class="mock-popover-card" :style="getShowcaseContentStyle()" :class="{ 'is-light-bg': isBackgroundLight(previewCosmetics['background']) }">
              <div class="popover-cosmetic-wrapper" :style="getShowcaseGlowStyle()">
                <ion-avatar style="width:72px;height:72px;margin:0;" :style="getShowcaseFrameStyle()">
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

          <!-- Showcase Meta Controls -->
          <div class="showcase-details">
            <div class="showcase-meta">
              <div class="hero-balance">
                <ion-icon :icon="sparkles" />
                <span>{{ spendablePoints }} XP available</span>
              </div>
              <button v-if="hasPreviewChanges" class="reset-preview-btn" @click="syncPreviewWithEquipped">
                <ion-icon :icon="refreshOutline" style="margin-right: 4px;" />
                {{ $t('profile.badgeShop.reset') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Category Tabs -->
      <div class="category-tabs">
        <button
          v-for="cat in categories"
          :key="cat.key"
          :class="['cat-tab', { active: activeCategory === cat.key }]"
          @click="activeCategory = cat.key"
        >
          <span class="cat-tab-emoji">{{ cat.emoji }}</span>
          <span class="cat-tab-label">{{ $t('profile.badgeShop.categories.' + cat.key) }}</span>
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loadingCatalog" class="shop-loading">
        <ion-skeleton-text v-for="n in 6" :key="n" animated class="shop-skeleton-card" />
      </div>

      <!-- Items Grid -->
      <div v-else class="shop-grid">
        <div
          v-for="item in filteredItems"
          :key="item.id"
          :class="['shop-card', {
            owned: isOwned(item.id),
            equipped: isEquipped(item.id),
            previewing: isPreviewed(item),
            'pro-locked': item.tier === 'pro' && !isSubscribed
          }]"
          @click="handleItemClick(item)"
        >
          <!-- Preview Overlay Badge -->
          <div v-if="isPreviewed(item)" class="preview-card-badge">
            <span class="preview-pulse-dot"></span>
            <span>PREVIEW</span>
          </div>

          <!-- Pro Lock Overlay -->
          <div v-if="item.tier === 'pro' && !isSubscribed" class="pro-lock-overlay">
            <ion-icon :icon="lockClosedOutline" class="lock-icon" />
            <span>PRO</span>
          </div>

          <!-- Preview -->
          <div class="item-preview">
            <!-- Realistic Simulated Row Preview -->
            <div
              :class="['item-preview-row', { 'centered-preview': item.category !== 'background' }]"
              :style="getCardRowStyle(item)"
            >
              <!-- Simulated Avatar -->
              <div :style="getCardAvatarCellStyle(item)">
                <div :style="getCardAvatarImgStyle(item)">
                  <img
                    :src="userAvatar || 'https://placehold.co/40x40?text=U'"
                    class="mock-avatar-img"
                    loading="lazy"
                  />
                </div>
              </div>

              <!-- Simulated Name -->
              <div v-if="item.category === 'background'" style="font-weight: bold; font-size: 0.85rem; color: inherit;">
                {{ userDisplayName || 'You' }}
              </div>
            </div>
          </div>

          <!-- Info -->
          <div class="item-info">
            <h4 class="item-name">{{ item.name }}</h4>
            <div class="item-tier">
              <ion-badge v-if="isEquipped(item.id)" color="success" class="tier-chip">
                {{ $t('profile.badgeShop.equipped') }}
              </ion-badge>
              <ion-badge v-else-if="isOwned(item.id)" color="medium" class="tier-chip">
                {{ $t('profile.badgeShop.owned') }}
              </ion-badge>
              <ion-badge v-else-if="item.tier === 'free'" color="success" class="tier-chip">
                {{ $t('profile.badgeShop.tiers.free') }}
              </ion-badge>
              <ion-badge v-else-if="item.tier === 'pro'" color="warning" class="tier-chip">
                <ion-icon :icon="sparkles" style="margin-right: 2px;" />
                {{ $t('profile.badgeShop.tiers.pro') }}
              </ion-badge>
              <ion-badge v-else color="primary" class="tier-chip">
                <ion-icon :icon="sparkles" style="margin-right: 2px;" />
                {{ item.xp_cost }} XP
              </ion-badge>
            </div>
          </div>

          <!-- Action Button -->
          <div class="item-action">
            <ion-button
              v-if="isEquipped(item.id)"
              size="small"
              fill="outline"
              color="medium"
              @click.stop="handleUnequip(item)"
            >
              {{ $t('profile.badgeShop.unequip') }}
            </ion-button>
            <ion-button
              v-else-if="isOwned(item.id)"
              size="small"
              fill="solid"
              color="success"
              @click.stop="handleEquip(item)"
            >
              {{ $t('profile.badgeShop.equip') }}
            </ion-button>
            <ion-button
              v-else-if="item.tier === 'pro' && !isSubscribed"
              size="small"
              fill="solid"
              color="warning"
              @click.stop="openProPaywall"
            >
              <ion-icon :icon="lockClosedOutline" slot="start" />
              PRO
            </ion-button>
            <ion-button
              v-else-if="item.tier === 'free'"
              size="small"
              fill="solid"
              color="success"
              @click.stop="handlePurchase(item)"
            >
              {{ $t('profile.badgeShop.tiers.free') }}
            </ion-button>
            <ion-button
              v-else
              size="small"
              fill="solid"
              color="primary"
              :disabled="spendablePoints < item.xp_cost"
              @click.stop="handlePurchase(item)"
            >
              {{ spendablePoints < item.xp_cost ? $t('profile.badgeShop.insufficientXp') : $t('profile.badgeShop.purchase') }}
            </ion-button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="!loadingCatalog && filteredItems.length === 0" class="shop-empty">
        <p>No items in this category yet.</p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonBackButton, IonButton, IonBadge, IonIcon, IonSkeletonText,
  alertController, toastController, IonAvatar
} from '@ionic/vue'
import { sparkles, lockClosedOutline, refreshOutline } from 'ionicons/icons'
import { useI18n } from 'vue-i18n'
import { supabase } from '@/plugins/supabaseClient'
import CosmeticBadge from '@/components/CosmeticBadge.vue'
import { useBadgeCosmetics, type BadgeCosmetic } from '@/composables/useBadgeCosmetics'
import { Capacitor } from '@capacitor/core'
import confetti from 'canvas-confetti'

const { t } = useI18n()
const {
  catalog, spendablePoints, loadingCatalog,
  fetchCatalog, fetchOwnedCosmetics, fetchSpendablePoints,
  purchaseCosmetic, equipCosmetic, unequipCosmetic,
  isOwned, isEquipped, equippedCosmetics
} = useBadgeCosmetics()

const activeCategory = ref('glow')
const userAvatar = ref('')
const userDisplayName = ref('')
const isSubscribed = ref(false)

// 📊 User statistics for mock popover preview
import { getLevelFromPoints } from '@/utils/xp'

const productCount = ref(0)
const locationCount = ref(0)
const userBio = ref('')
const donorType = ref('')
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
  
  if (donorType.value?.toLowerCase() === 'pro') {
    isSubscribed.value = true
  }
}

// 🎨 Dressing Room Preview State
const previewCosmetics = ref<Record<string, BadgeCosmetic | null>>({
  glow: null,
  aura: null,
  outline: null,
  background: null,
  nameplate: null,
  frame: null
})

const previewCosmeticsArray = computed(() => {
  return Object.values(previewCosmetics.value).filter((c): c is BadgeCosmetic => !!c)
})

function syncPreviewWithEquipped() {
  previewCosmetics.value = {
    glow: null,
    aura: null,
    outline: null,
    background: null,
    nameplate: null,
    frame: null
  }
  for (const c of equippedCosmetics.value) {
    if (c) {
      previewCosmetics.value[c.category] = c
    }
  }
}

const hasPreviewChanges = computed(() => {
  const categoriesList = ['glow', 'aura', 'outline', 'background', 'nameplate', 'frame']
  for (const cat of categoriesList) {
    const equipped = equippedCosmetics.value.find(c => c?.category === cat) || null
    const previewed = previewCosmetics.value[cat] || null
    if (equipped?.id !== previewed?.id) {
      return true
    }
  }
  return false
})

function togglePreview(item: BadgeCosmetic) {
  const current = previewCosmetics.value[item.category]
  if (current?.id === item.id) {
    const equipped = equippedCosmetics.value.find(c => c?.category === item.category) || null
    previewCosmetics.value[item.category] = equipped
  } else {
    previewCosmetics.value[item.category] = item
  }
}

function isPreviewed(item: BadgeCosmetic): boolean {
  return previewCosmetics.value[item.category]?.id === item.id
}

function isBackgroundLight(cosmetic?: BadgeCosmetic | null): boolean {
  if (!cosmetic) return false
  const slug = cosmetic.slug?.toLowerCase() || ''
  return slug.includes('sakura') || slug.includes('sunset') || slug.includes('light') || slug.includes('gold')
}

function getCardAvatarCellStyle(item: BadgeCosmetic) {
  const styles: Record<string, string> = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    width: '44px',
    height: '44px',
    flexShrink: '0',
    transition: 'all 0.3s ease'
  }
  if (item.category === 'glow' && item.css_value?.boxShadow) styles.boxShadow = item.css_value.boxShadow
  if (item.category === 'glow' && item.css_value?.animation) styles.animation = item.css_value.animation
  if (item.category === 'aura' && item.css_value?.background) styles.background = item.css_value.background
  if (item.category === 'aura' && item.css_value?.animation) styles.animation = item.css_value.animation
  return styles
}

function getCardAvatarImgStyle(item: BadgeCosmetic) {
  const styles: Record<string, string> = {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--ion-color-step-100)',
    border: '2px solid var(--ion-color-step-200)',
    transition: 'all 0.3s ease',
    overflow: 'hidden'
  }
  if (item.category === 'frame' && item.css_value?.border) styles.border = item.css_value.border
  if (item.category === 'frame' && item.css_value?.boxShadow) styles.boxShadow = item.css_value.boxShadow
  if (item.category === 'frame' && item.css_value?.animation) styles.animation = item.css_value.animation
  if (item.category === 'outline' && item.css_value?.border) styles.border = item.css_value.border
  if (item.category === 'outline' && item.css_value?.borderImage) styles.borderImage = item.css_value.borderImage
  return styles
}

function getCardRowStyle(item: BadgeCosmetic) {
  const styles: Record<string, string> = {}
  if (item.category === 'background' && item.css_value?.background) {
    styles.background = item.css_value.background
    styles['--background'] = item.css_value.background
    
    const isLight = isBackgroundLight(item)
    const textColor = isLight ? '#121212' : '#ffffff'
    styles.color = textColor
    styles['--color'] = textColor
    
    if (item.css_value.color) styles.color = item.css_value.color
    if (item.css_value.animation) styles.animation = item.css_value.animation
    if (item.css_value.backgroundSize) styles.backgroundSize = item.css_value.backgroundSize
    styles.border = 'none'
  }
  return styles
}



function getShowcaseBadgeStyle() {
  const bg = previewCosmetics.value['background']
  const styles: Record<string, string> = {}
  if (bg?.css_value?.background) {
    styles.background = bg.css_value.background
    styles['--background'] = bg.css_value.background
    if (bg.css_value.color) styles.color = bg.css_value.color
    if (bg.css_value.animation) styles.animation = bg.css_value.animation
    if (bg.css_value.backgroundSize) styles.backgroundSize = bg.css_value.backgroundSize
  }
  return styles
}

function getShowcaseContentStyle() {
  const bg = previewCosmetics.value['background']
  const outline = previewCosmetics.value['outline']
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

function getShowcaseGlowStyle() {
  const glow = previewCosmetics.value['glow']
  const styles: Record<string, string> = {}
  if (glow?.css_value?.boxShadow) styles.boxShadow = glow.css_value.boxShadow
  if (glow?.css_value?.animation) styles.animation = glow.css_value.animation
  return styles
}

function getShowcaseAuraStyle() {
  const aura = previewCosmetics.value['aura']
  if (!aura?.css_value?.background) return {}
  const styles: Record<string, string> = {
    background: aura.css_value.background
  }
  if (aura.css_value.animation) styles.animation = aura.css_value.animation
  return styles
}

function getShowcaseFrameStyle() {
  const frame = previewCosmetics.value['frame']
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

const filteredItems = computed(() =>
  catalog.value.filter(item => item.category === activeCategory.value)
)

onMounted(async () => {
  const session = (await supabase.auth.getSession()).data.session
  if (!session) return

  userAvatar.value = session.user?.user_metadata?.avatar_url || ''
  userDisplayName.value =
    session.user?.user_metadata?.full_name ||
    session.user?.user_metadata?.display_name || ''

  await Promise.all([
    fetchCatalog(),
    fetchOwnedCosmetics(session.user.id),
    fetchSpendablePoints(session.user.id),
    fetchUserProfileData(session.user.id)
  ])

  // Check subscription status
  if (Capacitor.isNativePlatform()) {
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor')
      const { customerInfo } = await Purchases.getCustomerInfo()
      isSubscribed.value = !!customerInfo?.entitlements?.active?.['Halal Formosa Pro']
    } catch { /* not subscribed */ }
  }

  syncPreviewWithEquipped()
})

async function handlePurchase(item: BadgeCosmetic) {
  if (item.tier === 'xp' && spendablePoints.value < item.xp_cost) return

  const alert = await alertController.create({
    header: t('profile.badgeShop.confirmTitle'),
    message: item.tier === 'free'
      ? t('profile.badgeShop.confirmFree', { name: item.name })
      : t('profile.badgeShop.confirmPurchase', { cost: item.xp_cost, name: item.name }),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('profile.badgeShop.purchase'),
        handler: async () => {
          const result = await purchaseCosmetic(item.id)
          if (result.success) {
            fireConfetti()
            previewCosmetics.value[item.category] = item
            const toast = await toastController.create({
              message: t('profile.badgeShop.purchaseSuccess', { name: item.name }),
              duration: 3000,
              color: 'success',
              position: 'top'
            })
            await toast.present()
          } else {
            const toast = await toastController.create({
              message: result.error || 'Purchase failed',
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

async function handleEquip(item: BadgeCosmetic) {
  await equipCosmetic(item.id, item.category)
  syncPreviewWithEquipped()
  const toast = await toastController.create({
    message: `✅ ${item.name} equipped!`,
    duration: 2000,
    color: 'success',
    position: 'top'
  })
  await toast.present()
}

async function handleUnequip(item: BadgeCosmetic) {
  await unequipCosmetic(item.id)
  syncPreviewWithEquipped()
  const toast = await toastController.create({
    message: `${item.name} unequipped`,
    duration: 2000,
    color: 'medium',
    position: 'top'
  })
  await toast.present()
}

function handleItemClick(item: BadgeCosmetic) {
  togglePreview(item)
}

async function openProPaywall() {
  if (!Capacitor.isNativePlatform()) {
    const toast = await toastController.create({
      message: t('profile.pro.nativeOnly'),
      duration: 3000,
      color: 'warning',
      position: 'top'
    })
    await toast.present()
    return
  }
  try {
    const { RevenueCatUI } = await import('@revenuecat/purchases-capacitor-ui')
    await RevenueCatUI.presentPaywall()
  } catch (err) {
    console.error('Paywall error:', err)
  }
}

function fireConfetti() {
  if (typeof confetti === 'function') {
    confetti({ particleCount: 80, spread: 60, origin: { x: 0.5, y: 0.4 } })
    confetti({ particleCount: 40, spread: 90, origin: { x: 0.3, y: 0.6 } })
    confetti({ particleCount: 40, spread: 90, origin: { x: 0.7, y: 0.6 } })
  }
}
</script>

<style scoped>
/* ========= Hero / Dressing Room Showcase ========= */
.shop-hero {
  position: relative;
  padding: 20px 16px;
  margin-bottom: 12px;
  border-radius: 20px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  color: #fff;
  overflow: hidden;
}

.hero-glow {
  position: absolute;
  top: -40px;
  right: -40px;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 215, 0, 0.3), transparent 70%);
  filter: blur(20px);
  pointer-events: none;
}

.showcase-container {
  display: flex;
  align-items: center;
  gap: 18px;
  position: relative;
  z-index: 1;
}

.showcase-avatar-wrapper {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.showcase-details {
  flex: 1;
  text-align: left;
}

.hero-title {
  font-size: 1.4rem;
  font-weight: 800;
  margin: 0 0 2px;
  letter-spacing: -0.5px;
}

.hero-subtitle {
  font-size: 0.75rem;
  opacity: 0.75;
  margin: 0 0 10px;
  line-height: 1.2;
}

.showcase-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.hero-balance {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.12);
  padding: 6px 12px;
  border-radius: 100px;
  font-weight: 700;
  font-size: 0.80rem;
  backdrop-filter: blur(8px);
}

.hero-balance ion-icon {
  color: #FFD700;
  font-size: 1rem;
}

.reset-preview-btn {
  display: inline-flex;
  align-items: center;
  background: rgba(var(--ion-color-warning-rgb), 0.15);
  border: 1px solid rgba(var(--ion-color-warning-rgb), 0.3);
  color: var(--ion-color-warning-tint);
  padding: 6px 12px;
  border-radius: 100px;
  font-weight: 700;
  font-size: 0.80rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reset-preview-btn:active {
  transform: scale(0.95);
  background: rgba(var(--ion-color-warning-rgb), 0.25);
}

/* ========= XP Wallet (Header) ========= */
.xp-wallet {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--ion-color-step-100);
  padding: 4px 10px;
  border-radius: 100px;
  margin-right: 4px;
}

.xp-wallet-icon {
  color: #FFD700;
  font-size: 0.9rem;
}

.xp-wallet-amount {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--ion-text-color);
}

/* ========= Category Tabs ========= */
.category-tabs {
  display: flex;
  gap: 6px;
  padding: 0 0 16px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.category-tabs::-webkit-scrollbar { display: none; }

.cat-tab {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 14px;
  border-radius: 14px;
  border: 2px solid var(--ion-color-step-200);
  background: var(--ion-card-background);
  cursor: pointer;
  transition: all 0.25s ease;
  min-width: 64px;
}

.cat-tab.active {
  border-color: var(--ion-color-primary);
  background: rgba(var(--ion-color-primary-rgb), 0.1);
}

.cat-tab-emoji { font-size: 1.2rem; }
.cat-tab-label {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--ion-color-step-600);
  white-space: nowrap;
}

.cat-tab.active .cat-tab-label { color: var(--ion-color-primary); }

/* ========= Shop Grid ========= */
.shop-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding-bottom: 40px;
}

.shop-card {
  background: var(--ion-card-background);
  border-radius: 16px;
  padding: 16px 12px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  border: 2px solid var(--ion-color-step-100);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  cursor: pointer;
}

.shop-card:active {
  transform: scale(0.97);
}

.shop-card.owned {
  border-color: var(--ion-color-success);
  background: rgba(var(--ion-color-success-rgb), 0.04);
}

.shop-card.equipped {
  border-color: var(--ion-color-success);
  box-shadow: 0 0 16px rgba(var(--ion-color-success-rgb), 0.25);
}

.shop-card.pro-locked {
  opacity: 0.85;
}

/* ========= Pro Lock Overlay ========= */
.pro-lock-overlay {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 3px;
  background: rgba(255, 193, 7, 0.15);
  color: #FFB300;
  padding: 3px 8px;
  border-radius: 8px;
  font-size: 0.6rem;
  font-weight: 800;
  z-index: 2;
}

.lock-icon { font-size: 0.7rem; }

/* ========= Item Preview ========= */
.item-preview {
  padding: 4px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.item-preview-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--ion-color-step-50);
  border-radius: 12px;
  width: 100%;
  justify-content: space-between;
  box-sizing: border-box;
  margin: 6px 0;
  border: 1px solid var(--ion-color-step-100);
}

.item-preview-row.centered-preview {
  justify-content: center;
}

.mock-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.ion-palette-dark .item-preview-row {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.05);
}

/* ========= Item Info ========= */
.item-info {
  text-align: center;
  width: 100%;
}

.item-name {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--ion-text-color);
  line-height: 1.2;
}

.item-tier {
  margin-top: 4px;
}

.tier-chip {
  font-size: 0.6rem;
  padding: 2px 8px;
  border-radius: 8px;
  --padding-start: 6px;
  --padding-end: 6px;
}

/* ========= Item Action ========= */
.item-action {
  width: 100%;
  margin-top: 4px;
}

.item-action ion-button {
  --border-radius: 10px;
  font-weight: 700;
  font-size: 0.7rem;
  width: 100%;
  height: 32px;
}

/* ========= Loading ========= */
.shop-loading {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.shop-skeleton-card {
  height: 180px;
  border-radius: 16px;
}

/* ========= Empty ========= */
.shop-empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--ion-color-medium);
}

/* ========= Dressing Room Active Highlighting ========= */
.shop-card.previewing {
  border-color: var(--ion-color-warning);
  background: rgba(var(--ion-color-warning-rgb), 0.05);
  box-shadow: 0 0 16px rgba(var(--ion-color-warning-rgb), 0.25);
  transform: scale(1.02);
}

.preview-card-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(var(--ion-color-warning-rgb), 0.15);
  color: var(--ion-color-warning-shade);
  padding: 3px 8px;
  border-radius: 8px;
  font-size: 0.6rem;
  font-weight: 800;
  z-index: 2;
  border: 1px solid rgba(var(--ion-color-warning-rgb), 0.25);
}

.preview-pulse-dot {
  width: 6px;
  height: 6px;
  background: var(--ion-color-warning);
  border-radius: 50%;
  animation: pulse-dot 1.5s infinite;
}

@keyframes pulse-dot {
  0% { transform: scale(0.8); opacity: 0.5; }
  50% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(0.8); opacity: 0.5; }
}

/* ========= Dark Mode ========= */
.ion-palette-dark .shop-hero {
  background: linear-gradient(135deg, #0d0d1a 0%, #1a1a3a 50%, #0a2a4a 100%);
}

.ion-palette-dark .cat-tab {
  border-color: var(--ion-color-step-150);
}

.ion-palette-dark .preview-card-badge {
  background: rgba(255, 193, 7, 0.15);
  color: #FFD54F;
  border-color: rgba(255, 193, 7, 0.3);
}

.ion-palette-dark .reset-preview-btn {
  background: rgba(255, 193, 7, 0.15);
  color: #FFD54F;
  border-color: rgba(255, 193, 7, 0.3);
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
  position: relative;
  z-index: 1;
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

/* ========= Responsive ========= */
@media (min-width: 600px) {
  .shop-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 480px) {
  .showcase-container {
    flex-direction: column;
    text-align: center;
    gap: 14px;
  }
  .showcase-details {
    text-align: center;
  }
}
</style>
