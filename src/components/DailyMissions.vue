<template>
  <ion-card class="compact-section">
    <ion-card-header>
      <div class="card-header-row">
        <ion-card-title>
          {{ $t('dailyMissions.title') }}
        </ion-card-title>

        <ion-button
          fill="clear"
          size="small"
          color="carrot"
          @click="showModal = true"
          class="view-all-btn"
        >
          {{ $t('dailyMissions.viewAll') }}
          <div v-if="!claimedBonus" class="red-dot"></div>
        </ion-button>
      </div>
    </ion-card-header>

    <ion-card-content>
      <div v-if="loading" class="discover-grid compact-grid">
        <ion-card
          v-for="n in 3"
          :key="'mission-skel-' + n"
          class="discover-item discover-item--compact"
        >
          <ion-skeleton-text animated style="width:100%;height:70px;border-radius:10px;" />
          <ion-skeleton-text animated style="width:80%;height:14px;margin:6px auto;" />
        </ion-card>
      </div>

      <!-- Completion Message (Dashboard) -->
      <div v-else-if="allCompleted && claimedBonus" class="completion-message fade-in" style="margin-top: 0;">
        <ion-icon :icon="checkmarkCircle" color="success"></ion-icon>
        <p>{{ $t('dailyMissions.allCompletedMsg') }}</p>
      </div>

      <div v-else class="discover-grid compact-grid">
        <!-- Bonus Card (Dashboard version) -->
        <ion-card 
          v-if="allCompleted"
          :class="[
            'discover-item',
            'discover-item--compact',
            'bonus-dashboard-card',
            { 'is-claimed': claimedBonus }
          ]"
          button
          @click="handleClaimBonus"
        >
          <div class="mission-icon-container">
            <ion-icon :icon="rocketOutline" :color="claimedBonus ? 'success' : 'warning'"></ion-icon>
            <div class="pulse-ring" v-if="!claimedBonus"></div>
          </div>
          <ion-label class="discover-label discover-label--compact">
            <p class="discover-name" style="margin-top: 3px; font-weight: 800;">
              {{ claimedBonus ? $t('dailyMissions.bonusClaimed') : $t('dailyMissions.claimBonus') }}
            </p>
            <p class="discover-points">{{ $t('dailyMissions.bonusPoints', { label: $t('dailyMissions.xp') }) }}</p>
          </ion-label>
        </ion-card>

        <!-- Mission Cards -->
        <ion-card 
          v-for="mission in missions" 
          :key="mission.id" 
          :class="[
            'discover-item',
            'discover-item--compact',
            { 'mission-completed-border': mission.completed }
          ]"
          button
          @click="navigateToMission(mission.id)"
        >
          <div class="mission-icon-container">
            <ion-icon :icon="getIcon(mission.icon)" :color="mission.completed ? 'success' : 'medium'"></ion-icon>
            <div class="mission-progress-overlay" v-if="!mission.completed">
               <svg viewBox="0 0 36 36" class="mini-circular-chart">
                <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path class="circle" :style="{ strokeDasharray: Math.min(100, (mission.current / mission.required) * 100) + ', 100' }" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
            </div>
          </div>
          <ion-label class="discover-label discover-label--compact">
            <p class="discover-name" style="margin-top: 3px;">{{ $t('dailyMissions.missions.' + mission.id) }}</p>
            <p class="discover-points">{{ mission.current }}/{{ mission.required }} • +{{ mission.points }} {{ $t('dailyMissions.xp') }}</p>
          </ion-label>
        </ion-card>
      </div>
    </ion-card-content>

    <!-- Details Modal -->
    <ion-modal :is-open="showModal" @didDismiss="showModal = false" :initial-breakpoint="0.75" :breakpoints="[0, 0.75, 1]">
      <ion-header>
        <ion-toolbar>
          <ion-title>{{ $t('dailyMissions.title') }}</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="showModal = false">{{ $t('dailyMissions.close') }}</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <div class="missions-vertical-list">
          <div 
            v-for="mission in missions" 
            :key="mission.id" 
            class="v-mission-item"
            :class="{ completed: mission.completed }"
            @click="navigateToMission(mission.id)"
            style="cursor: pointer;"
          >
            <div class="v-mission-info">
              <div class="v-icon-wrap">
                <ion-icon :icon="getIcon(mission.icon)" :color="mission.completed ? 'success' : 'medium'"></ion-icon>
              </div>
              <div class="v-text-wrap">
                <div class="v-label">{{ $t('dailyMissions.missions.' + mission.id) }}</div>
                <div class="v-progress-text">{{ mission.current }} / {{ mission.required }} {{ $t('dailyMissions.completed') }}</div>
              </div>
              <div class="v-points">+{{ mission.points }} {{ $t('dailyMissions.xp') }}</div>
            </div>
            <ion-progress-bar :value="mission.current / mission.required" :color="mission.completed ? 'success' : 'carrot'"></ion-progress-bar>
          </div>

          <div 
            class="v-mission-item bonus-item" 
            :class="{ 
              'completed': claimedBonus, 
              'can-claim': allCompleted && !claimedBonus 
            }"
            @click="handleClaimBonus"
            style="cursor: pointer;"
          >
            <div class="v-mission-info">
              <div class="v-icon-wrap" :class="{ 'pulse-bg': allCompleted && !claimedBonus }">
                <ion-icon :icon="giftOutline" :color="claimedBonus ? 'success' : (allCompleted ? 'carrot' : 'medium')"></ion-icon>
              </div>
              <div class="v-text-wrap">
                <div class="v-label">{{ $t('dailyMissions.dailyBonus') }}</div>
                <div class="v-progress-text">
                  <span v-if="claimedBonus">{{ $t('dailyMissions.alreadyClaimed') }}</span>
                  <span v-else-if="allCompleted">{{ $t('dailyMissions.claimXpBonus') }}</span>
                  <span v-else>{{ $t('dailyMissions.dailyBonusDesc') }}</span>
                </div>
              </div>
              <div class="v-points">+50 {{ $t('dailyMissions.xp') }}</div>
            </div>
            <ion-progress-bar 
              :value="claimedBonus ? 1 : (allCompleted ? 1 : missions.filter(m => m.completed).length / missions.length)" 
              :color="claimedBonus ? 'success' : (allCompleted ? 'success' : 'carrot')"
            ></ion-progress-bar>
          </div>

          <!-- Completion Message (Modal) -->
          <div v-if="allCompleted && claimedBonus" class="modal-completion-info">
             <p>{{ $t('dailyMissions.masteryAchieved') }}</p>
             <small>{{ $t('dailyMissions.comeBackTomorrow') }}</small>
          </div>
        </div>
      </ion-content>
    </ion-modal>
  </ion-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  IonIcon, IonButton, IonModal,
  IonHeader, IonToolbar, IonTitle, IonButtons, IonContent, IonProgressBar,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, onIonViewWillEnter, IonSkeletonText, IonLabel
} from '@ionic/vue'
import { 
  rocketOutline, scanOutline, heartOutline, locationOutline, 
  barcodeOutline, addCircleOutline, checkmarkCircle, homeOutline,
  giftOutline
} from 'ionicons/icons'
import { useDailyMissions } from '@/composables/useDailyMissions'

const showModal = ref(false)
const { missions, loading, claimedBonus, allCompleted, fetchProgress, checkAndAwardBonus } = useDailyMissions()
const router = useRouter()

const navigateToMission = (id: string) => {
  showModal.value = false
  
  switch(id) {
    case 'open_app':
      router.push('/home')
      break
    case 'scan_ingredients':
      router.push('/scan')
      break
    case 'find_muslim_friendly':
      router.push('/scan')
      break
    case 'view_place_details':
      router.push('/explore')
      break
    case 'scan_barcode':
      router.push({ path: '/search', query: { scan: 'true' } })
      break
    case 'add_product':
      router.push('/add')
      break
  }
}

const getIcon = (name: string) => {
  switch(name) {
    case 'scan-outline': return scanOutline
    case 'heart-outline': return heartOutline
    case 'location-outline': return locationOutline
    case 'barcode-outline': return barcodeOutline
    case 'add-circle-outline': return addCircleOutline
    case 'home-outline': return homeOutline
    default: return rocketOutline
  }
}

async function handleClaimBonus() {
  await checkAndAwardBonus()
}

onMounted(() => {
  fetchProgress()
})

onIonViewWillEnter(() => {
  fetchProgress()
})
</script>

<style scoped>
.mission-icon-container {
  width: 100%;
  height: 70px;
  background: var(--ion-background-color);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
  position: relative;
  box-shadow: inset 0 0 10px rgba(0,0,0,0.02);
}

.bonus-card-premium .mission-icon-container {
  background: linear-gradient(135deg, var(--ion-background-color) 0%, rgba(var(--ion-color-carrot-rgb), 0.1) 100%);
}

.is-completed.bonus-card-premium .mission-icon-container {
  background: linear-gradient(135deg, var(--ion-background-color) 0%, rgba(var(--ion-color-success-rgb), 0.15) 100%);
}

.mission-completed-border {
  border: 1.5px solid rgba(var(--ion-color-success-rgb), 0.4) !important;
}

.mini-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  font-size: 0.6rem;
  --padding-start: 4px;
  --padding-end: 4px;
  border-radius: 4px;
}

.discover-points {
  font-size: 0.7rem;
  color: var(--ion-color-carrot);
  font-weight: 700;
  margin-top: 2px;
}

.mission-progress-overlay {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
}

.mini-circular-chart {
  display: block;
}

.circle-bg {
  fill: none;
  stroke: #eee;
  stroke-width: 4;
}

.circle {
  fill: none;
  stroke-width: 4;
  stroke-linecap: round;
  stroke: var(--ion-color-carrot);
  transition: stroke-dasharray 0.3s ease;
}

/* Modal Vertical List */
.missions-vertical-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.v-mission-item {
  background: var(--ion-color-light);
  padding: 16px;
  border-radius: 16px;
}

.v-mission-info {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.v-icon-wrap {
  width: 40px;
  height: 40px;
  background: var(--ion-background-color);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
}

.v-text-wrap {
  flex: 1;
}

.v-label {
  font-weight: 700;
  font-size: 0.95rem;
}

.v-progress-text {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

.v-points {
  font-weight: 800;
  color: var(--ion-color-carrot);
}

/* Bonus Item Styling (Modal) */
.bonus-item.can-claim {
  border: 1.5px solid var(--ion-color-carrot);
  animation: gentlePulse 2s infinite;
}

.bonus-item.completed {
  opacity: 0.8;
}

.pulse-bg {
  animation: pulseBg 2s infinite;
}

@keyframes gentlePulse {
  0% { box-shadow: 0 0 0 0 rgba(var(--ion-color-carrot-rgb), 0.2); }
  70% { box-shadow: 0 0 0 8px rgba(var(--ion-color-carrot-rgb), 0); }
  100% { box-shadow: 0 0 0 0 rgba(var(--ion-color-carrot-rgb), 0); }
}

@keyframes pulseBg {
  0% { transform: scale(1); background: var(--ion-background-color); }
  50% { transform: scale(1.05); background: rgba(var(--ion-color-carrot-rgb), 0.1); }
  100% { transform: scale(1); background: var(--ion-background-color); }
}



.loading-state {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 20px;
}

/* Red Dot Indicator */
.view-all-btn {
  position: relative;
}

.red-dot {
  position: absolute;
  top: -2px;
  right: -4px;
  width: 9px;
  height: 9px;
  background-color: var(--ion-color-danger);
  border-radius: 50%;
  border: 2px solid var(--ion-card-background, #fff);
  box-shadow: 0 0 5px rgba(var(--ion-color-danger-rgb), 0.5);
  z-index: 10;
}

/* Bonus Dashboard Card Styling (Clean Premium Look) */
.bonus-dashboard-card {
  background: linear-gradient(135deg, #4d2b0a 0%, #2d1a06 100%) !important;
  border-color: rgba(var(--ion-color-carrot-rgb), 0.5) !important;
  border-style: solid !important;
  border-width: 1.5px !important;
  box-shadow: 0 4px 15px rgba(var(--ion-color-carrot-rgb), 0.15) !important;
  padding: 0 !important;
}

.bonus-dashboard-card.is-claimed {
  background: linear-gradient(135deg, #0e2a1a 0%, #05140d 100%) !important;
  border-color: rgba(var(--ion-color-success-rgb), 0.4) !important;
  box-shadow: none !important;
}

/* Remove 'inner box' background for bonus card icon */
.bonus-dashboard-card .mission-icon-container {
  background: transparent !important;
  box-shadow: none !important;
  height: 80px; /* Adjust height since internal padding is removed */
}

.bonus-dashboard-card .discover-label {
  padding: 0 8px 12px 8px !important;
}

.pulse-ring {
  position: absolute;
  width: 32px;
  height: 32px;
  border: 2px solid var(--ion-color-carrot);
  border-radius: 50%;
  animation: pulse 2s infinite;
  opacity: 0;
}

@keyframes pulse {
  0% { transform: scale(0.5); opacity: 0; }
  50% { opacity: 0.5; }
  100% { transform: scale(1.5); opacity: 0; }
}

.completion-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(var(--ion-color-success-rgb), 0.1);
  padding: 12px;
  border-radius: 12px;
  margin-top: 16px;
  border: 1px dashed rgba(var(--ion-color-success-rgb), 0.3);
}

.completion-message p {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ion-color-success-shade);
}

.completion-message ion-icon {
  font-size: 1.4rem;
}

.modal-completion-info {
  text-align: center;
  padding: 5px;
  color: var(--ion-color-medium);
}

.modal-completion-info p {
  font-weight: 800;
  font-size: 1.1rem;
  color: var(--ion-color-success);
  margin-bottom: 4px;
}

.fade-in {
  animation: fadeIn 0.5s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
