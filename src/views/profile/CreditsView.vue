<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('credits.title')" back-route="/profile" icon="none" show-back/>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- 🔹 Logo at top, centered -->
      <div class="logo-wrapper">
        <img src="/android-chrome-512x512.png" alt="Halal Formosa Logo" class="logo-img" />
      </div>

      <!-- Founder -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ $t('credits.founder') }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p 
            v-if="hasProfile('Rakha Ramadhana A.B.')" 
            class="clickable-contributor"
            @click="clickContributor('Rakha Ramadhana A.B.', $event)"
          >
            Rakha Ramadhana A.B. <ion-icon :icon="sparkles" class="link-spark" />
          </p>
          <p v-else>Rakha Ramadhana A.B.</p>
        </ion-card-content>
      </ion-card>

      <!-- Co-Founder -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ $t('credits.coFounder') }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p 
            v-if="hasProfile('Sherlis Oktaviani')" 
            class="clickable-contributor"
            @click="clickContributor('Sherlis Oktaviani', $event)"
          >
            Sherlis Oktaviani <ion-icon :icon="sparkles" class="link-spark" />
          </p>
          <p v-else>Sherlis Oktaviani</p>
        </ion-card-content>
      </ion-card>

      <!-- Co-Developer -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ $t('credits.coDeveloper') }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p 
            v-if="hasProfile('Fauzan Aqil')" 
            class="clickable-contributor"
            @click="clickContributor('Fauzan Aqil', $event)"
          >
            Fauzan Aqil <ion-icon :icon="sparkles" class="link-spark" />
          </p>
          <p v-else>Fauzan Aqil</p>
        </ion-card-content>
      </ion-card>

      <!-- UI/UX -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ $t('credits.uiUx') }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p 
            v-if="hasProfile('Rachmad Zu')" 
            class="clickable-contributor"
            @click="clickContributor('Rachmad Zu', $event)"
          >
            Rachmad Zu <ion-icon :icon="sparkles" class="link-spark" />
          </p>
          <p v-else>Rachmad Zu</p>
        </ion-card-content>
      </ion-card>

      <!-- Early Contributor -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ $t('credits.database') }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ul>
            <li v-for="(name, idx) in sortedContributors" :key="idx">
              <span 
                v-if="hasProfile(name)" 
                class="clickable-contributor"
                @click="clickContributor(name, $event)"
              >
                {{ name }} <ion-icon :icon="sparklesOutline" class="link-spark" />
              </span>
              <span v-else>{{ name }}</span>
            </li>
          </ul>
        </ion-card-content>
      </ion-card>

      <!-- Special Thanks -->
      <div class="special-thanks ion-padding-horizontal">
        <h3>{{ $t('credits.specialThanks') }}</h3>
        <p>{{ $t('credits.thankYou') }}</p>
      </div>

    </ion-content>

    <!-- 👤 User Profile popover -->
    <ion-popover
      :is-open="!!selectedUser"
      :event="popoverEvent"
      class="credits-popover"
      @didDismiss="closePopover"
    >
      <ion-content class="ion-padding popover-custom-content" style="text-align:center; min-width: 250px;">
        <div v-if="selectedUser" style="position: relative; z-index: 1;">
          <ion-avatar style="width:72px;height:72px;margin:12px auto 8px; border: 2px solid var(--ion-color-carrot);">
            <img :src="selectedUser.avatar_url || 'https://placehold.co/72px?text=?'" alt="Avatar"/>
          </ion-avatar>

          <div v-if="selectedUser.donor_type && selectedUser.donor_type.toLowerCase().includes('pro')" class="mock-popover-pro-badge">
            <ion-icon :icon="sparkles" class="pro-icon" />
            <span>Pro</span>
          </div>

          <h3 class="mock-popover-name">
            <span>{{ selectedUser.display_name }}</span>
          </h3>

          <p class="mock-popover-stats">
            {{ $t('profile.level', { level: getLevelFromPoints(selectedUser.points || 0) }) }} • 
            <ion-badge
              class="leaderboard-points-badge"
              style="margin-left: 4px; border-radius: 8px; font-weight: bold; font-size: 0.75rem; padding: 4px 8px; display: inline-block; vertical-align: middle; --background: var(--ion-color-carrot);"
            >
              {{ selectedUser.points || 0 }} pts
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
        </div>
      </ion-content>
    </ion-popover>

  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonHeader,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonPopover,
  IonAvatar,
  IonBadge,
  IonIcon
} from '@ionic/vue'
import { sparklesOutline, sparkles } from 'ionicons/icons'
import AppHeader from "@/components/AppHeader.vue"
import { ref, onMounted } from 'vue'
import { supabase } from '@/plugins/supabaseClient'
import { getLevelFromPoints } from '@/utils/xp'

// ✅ List of contributors
const contributors = [
  "Aisyah Nayan",
  "Damas Bariek",
  "Faqih Ilmi",
  "Fata Falih Hilmi",
  "Fathur Rahman Alhadi",
  "Muslima",
  "Ogi Dani Sakarov",
  "Rosyid Shidiq",
  "Yusuf Rahmatullah"
]

const allNames = [
  "Rakha Ramadhana A.B.",
  "Sherlis Oktaviani",
  "Fauzan Aqil",
  "Rachmad Zu",
  ...contributors
]

// ✅ Sort alphabetically
const sortedContributors = [...contributors].sort()

const contributorProfiles = ref<Record<string, any>>({})
const selectedUser = ref<any | null>(null)
const popoverEvent = ref<Event | null>(null)

const hasProfile = (name: string) => !!contributorProfiles.value[name]

const clickContributor = (name: string, ev: Event) => {
  const profile = contributorProfiles.value[name]
  if (profile) {
    selectedUser.value = profile
    popoverEvent.value = ev
  }
}

const closePopover = () => {
  selectedUser.value = null
  popoverEvent.value = null
}

function isHighSimilarity(dbName: string, contributorName: string): boolean {
  const cleanDb = dbName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
  const cleanCont = contributorName.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()

  // Special override for "Fathur Rahman Alhadi" -> "Fathur R. A."
  if ((cleanCont === 'fathur rahman alhadi' || cleanCont === 'hadi') && (cleanDb === 'fathur r a' || cleanDb.includes('fathur'))) {
    return true
  }

  if (cleanDb === cleanCont) return true
  
  const dbWords = cleanDb.split(/\s+/).filter(w => w.length > 0)
  const contWords = cleanCont.split(/\s+/).filter(w => w.length > 0)
  
  // For short names (1 word), must be exact match
  if (contWords.length === 1 || dbWords.length === 1) {
    return cleanDb === cleanCont
  }
  
  // For multi-word names, check overlap of words
  // If at least 2 significant words (length > 2) match exactly, it's a high similarity match
  const dbWordSet = new Set(dbWords)
  const matchingWords = contWords.filter(w => w.length > 2 && dbWordSet.has(w))
  
  return matchingWords.length >= 2
}

onMounted(async () => {
  try {
    const { data, error } = await supabase
      .from('leaderboard_view')
      .select('*')
      .eq('public_profile', true)
      
    if (!error && data) {
      const mapping: Record<string, any> = {}
      for (const u of data) {
        const dbName = u.display_name?.trim() || ''
        for (const cName of allNames) {
          if (isHighSimilarity(dbName, cName)) {
            mapping[cName] = u
          }
        }
      }
      contributorProfiles.value = mapping
    }
  } catch (err) {
    console.warn('Failed to load contributor public profiles:', err)
  }
})
</script>

<style scoped>
ion-card-content ul {
  padding-left: 20px;
  margin: 0;
}

ion-card-content li {
  margin-bottom: 6px;
}

.logo-wrapper {
  display: flex;
  justify-content: center;
  margin: 16px 0 24px;
}

.logo-img {
  max-width: 160px;   /* adjust size as needed */
  height: auto;
}

.special-thanks {
  margin-top: 24px;
  text-align: justify;
  font-size: 0.95rem;
  color: var(--ion-color-medium);
}

.special-thanks h3 {
  text-align: center;
  font-weight: 600;
  font-size: 1rem;
  margin-bottom: 6px;
  color: var(--ion-color-dark);
}

/* Clickable Contributor Link Styles */
.clickable-contributor {
  color: var(--ion-color-carrot);
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.link-spark {
  font-size: 0.85rem;
  display: inline-block;
}

/* Premium Popover Styles */
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
}
</style>
