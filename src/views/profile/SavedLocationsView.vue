<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('savedLocations.title')" show-back back-route="/profile" :icon="locationOutline" />
    </ion-header>

    <ion-content class="ion-padding">
      <div v-if="loading" class="ion-text-center ion-margin-top">
        <ion-spinner />
      </div>

      <template v-else>
        <!-- Free User Limit Progress (ALWAYS SHOW FOR NON-PRO) -->
        <ion-card v-if="!isDonor" class="ion-margin-bottom limit-card">
          <div class="ion-padding">
            <div class="limit-header">
              <span class="limit-label">{{ $t('savedLocations.freeTier') }}</span>
              <span class="limit-value">
                {{ totalSavedCount }} / 10
              </span>
            </div>
            <ion-progress-bar :value="totalSavedCount / 10" color="carrot" class="limit-progress"></ion-progress-bar>
            
            <p v-if="totalSavedCount >= 10" class="limit-message limit-reached">
              {{ $t('savedLocations.freeLimitReached') }}
            </p>
            <p v-else class="limit-message">
              {{ $t('savedLocations.proUpgrade', { pro: 'Halal Formosa Pro' }) }}
            </p>
            
            <ion-button expand="block" color="carrot" size="small" class="upgrade-btn" @click="presentRcPaywall">
              {{ $t('profile.pro.upgrade') }}
            </ion-button>
          </div>
        </ion-card>

        <!-- Empty State - No Folders -->
        <div v-if="folders.length === 0" class="empty-state">
          <ion-icon :icon="folderOutline" class="empty-icon"></ion-icon>
          <h3>{{ $t('savedLocations.noCollections') }}</h3>
          <p>{{ $t('savedLocations.noCollectionsDesc') }}</p>
          <ion-button color="carrot" @click="promptCreateFolder">
            <ion-icon :icon="addOutline" slot="start" />
            {{ $t('savedLocations.createFolder') }}
          </ion-button>
        </div>

        <div v-else>
          <!-- FOLDERS LIST/GRID -->
          <div v-if="!activeFolder">
            <!-- View Toggle Header -->
            <div class="view-header">
              <h2>{{ $t('savedLocations.myCollections') }}</h2>
              <div class="view-toggle">
                <ion-button 
                  fill="clear" 
                  size="small" 
                  :color="viewMode === 'grid' ? 'carrot' : 'medium'"
                  @click="viewMode = 'grid'"
                  class="toggle-btn"
                >
                  <ion-icon :icon="gridOutline" />
                </ion-button>
                <ion-button 
                  fill="clear" 
                  size="small" 
                  :color="viewMode === 'list' ? 'carrot' : 'medium'"
                  @click="viewMode = 'list'"
                  class="toggle-btn"
                >
                  <ion-icon :icon="listOutline" />
                </ion-button>
              </div>
            </div>

            <!-- GRID VIEW -->
            <div v-if="viewMode === 'grid'" class="folder-grid">
              <div 
                v-for="folder in folders" 
                :key="folder.id" 
                class="folder-card"
                @click="openFolder(folder)"
              >
                <div class="folder-icon-wrapper">
                  <ion-icon :icon="folderOutline" class="folder-icon" />
                </div>
                <div class="folder-info">
                  <span class="folder-name">{{ folder.name }}</span>
                  <span class="folder-count">{{ $t('savedLocations.locationsCount', { count: folder.saved_locations?.length || 0 }) }}</span>
                </div>
              </div>
            </div>

            <!-- LIST VIEW -->
            <ion-list v-else style="background: transparent;">
              <ion-item 
                v-for="folder in folders" 
                :key="folder.id" 
                button 
                @click="openFolder(folder)"
                class="folder-list-item"
                lines="none"
              >
                <ion-icon :icon="folderOutline" slot="start" color="carrot" />
                <ion-label>
                  <h3>{{ folder.name }}</h3>
                  <p class="folder-list-count">{{ $t('savedLocations.locationsCount', { count: folder.saved_locations?.length || 0 }) }}</p>
                </ion-label>
              </ion-item>
            </ion-list>
          </div>

          <!-- LOCATIONS IN FOLDER VIEW -->
          <div v-else>
            <!-- Back button & View Toggle Header -->
            <div class="view-header">
              <ion-button fill="clear" @click="closeFolder" class="back-btn">
                <ion-icon :icon="arrowBackOutline" slot="start" />
                <span>{{ activeFolder.name }}</span>
              </ion-button>
              <div class="view-toggle">
                <ion-button 
                  fill="clear" 
                  size="small" 
                  :color="viewMode === 'grid' ? 'carrot' : 'medium'"
                  @click="viewMode = 'grid'"
                  class="toggle-btn"
                >
                  <ion-icon :icon="gridOutline" />
                </ion-button>
                <ion-button 
                  fill="clear" 
                  size="small" 
                  :color="viewMode === 'list' ? 'carrot' : 'medium'"
                  @click="viewMode = 'list'"
                  class="toggle-btn"
                >
                  <ion-icon :icon="listOutline" />
                </ion-button>
              </div>
            </div>

            <!-- No Locations in Folder -->
            <p v-if="activeFolder.saved_locations?.length === 0" class="ion-text-center ion-margin-top">
              <small>{{ $t('savedLocations.noLocations') }}</small>
            </p>
            
            <!-- GRID VIEW FOR LOCATIONS -->
            <div v-else-if="viewMode === 'grid'" class="location-grid">
              <div 
                v-for="saved in activeFolder.saved_locations" 
                :key="saved.id" 
                class="location-card"
                @click="goToLocation(saved.location_id)"
              >
                <!-- Move button -->
                <ion-button 
                  fill="clear" 
                  color="primary" 
                  class="location-move-btn"
                  @click.stop="moveLocationPrompt(saved.id, activeFolder.id, saved.location_id)"
                >
                  <ion-icon :icon="folderOpenOutline" />
                </ion-button>

                <!-- Delete button -->
                <ion-button 
                  fill="clear" 
                  color="danger" 
                  class="location-delete-btn"
                  @click.stop="removeLocationPrompt(saved.id)"
                >
                  <ion-icon :icon="trashOutline" />
                </ion-button>

                <div class="location-img-wrapper">
                  <img :src="saved.locations?.image || 'https://via.placeholder.com/80.webp'" alt="Location Image" />
                </div>
                <div class="location-info">
                  <span class="location-name">{{ saved.locations?.name || 'Unknown Location' }}</span>
                  <ion-chip
                    v-if="saved.locations?.location_types?.name"
                    size="small"
                    color="carrot"
                    style="margin-left: 0; margin-top: 4px; font-size: 11px;"
                  >
                    {{ saved.locations.location_types.name }}
                  </ion-chip>
                </div>
              </div>
            </div>

            <!-- LIST VIEW FOR LOCATIONS -->
            <ion-list v-else style="background: transparent;">
              <ion-item 
                v-for="saved in activeFolder.saved_locations" 
                :key="saved.id" 
                button 
                @click="goToLocation(saved.location_id)"
                class="location-list-item"
                lines="none"
              >
                <ion-thumbnail slot="start" class="location-thumbnail">
                  <img :src="saved.locations?.image || 'https://via.placeholder.com/80.webp'" alt="Location Image" />
                </ion-thumbnail>
                <ion-label>
                  <h3 class="location-list-name">{{ saved.locations?.name || 'Unknown Location' }}</h3>
                  <ion-chip
                    v-if="saved.locations?.location_types?.name"
                    size="small"
                    color="carrot"
                    style="margin-left: 0; margin-top: 4px;"
                  >
                    {{ saved.locations.location_types.name }}
                  </ion-chip>
                </ion-label>
                
                <ion-button fill="clear" color="primary" slot="end" @click.stop="moveLocationPrompt(saved.id, activeFolder.id, saved.location_id)">
                  <ion-icon :icon="folderOpenOutline" />
                </ion-button>
                <ion-button fill="clear" color="danger" slot="end" @click.stop="removeLocationPrompt(saved.id)">
                  <ion-icon :icon="trashOutline" />
                </ion-button>
              </ion-item>
            </ion-list>
          </div>
        </div>
      </template>

      <!-- FAB to create new folder -->
      <ion-fab v-if="folders.length > 0 && !activeFolder" vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button color="carrot" @click="promptCreateFolder">
          <ion-icon :icon="addOutline"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage, IonHeader, IonContent, IonSpinner,
  IonItem, IonIcon, IonLabel, IonList, IonThumbnail, IonChip, IonButton,
  IonCard, IonProgressBar, alertController, IonFab, IonFabButton, 
  actionSheetController, toastController,
  onIonViewWillEnter
} from '@ionic/vue';
import { 
  locationOutline, folderOutline, trashOutline, gridOutline, 
  listOutline, arrowBackOutline, addOutline, folderOpenOutline 
} from 'ionicons/icons';
import AppHeader from '@/components/AppHeader.vue';
import { useI18n } from 'vue-i18n';
import { useSavedLocations } from '@/composables/useSavedLocations';
import type { SavedLocationFolder } from '@/types/SavedLocation';

// Subscription Logic
import { isDonor, refreshSubscriptionStatus } from '@/composables/useSubscriptionStatus';
import { RevenueCatUI, PAYWALL_RESULT } from '@revenuecat/purchases-capacitor-ui';
import { Capacitor } from '@capacitor/core';
import { ActivityLogService } from '@/services/ActivityLogService';

const router = useRouter();
const { t } = useI18n();
const { folders, loading, totalSavedCount, loadFoldersAndSavedLocations, createFolder, unsaveLocation, moveLocation } = useSavedLocations();

const viewMode = ref<'grid' | 'list'>('grid');
const activeFolderId = ref<string | null>(null);

const activeFolder = computed<SavedLocationFolder | null>(() => {
  if (!activeFolderId.value) return null;
  return folders.value.find(f => f.id === activeFolderId.value) || null;
});

function openFolder(folder: SavedLocationFolder) {
  activeFolderId.value = folder.id;
}

function closeFolder() {
  activeFolderId.value = null;
}

async function presentRcPaywall() {
  if (!Capacitor.isNativePlatform()) {
    console.warn("[RC] Paywall can only run on native apps.");
    return false;
  }

  try {
    const { result } = await RevenueCatUI.presentPaywall();

    if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
      await refreshSubscriptionStatus({ syncToServer: true });
      ActivityLogService.log('pro_purchase_success', {
        source: 'saved_locations_view'
      });
      return true;
    }
  } catch (err) {
    console.error("Paywall failed:", err);
  }
  return false;
}

onMounted(async () => {
  await loadFoldersAndSavedLocations();
});

onIonViewWillEnter(async () => {
  await loadFoldersAndSavedLocations();
});

async function promptCreateFolder() {
  const alert = await alertController.create({
    header: t('savedLocations.newFolder'),
    inputs: [
      {
        name: 'folderName',
        type: 'text',
        placeholder: t('savedLocations.folderName')
      }
    ],
    buttons: [
      {
        text: t('common.cancel'),
        role: 'cancel'
      },
      {
        text: t('savedLocations.create'),
        handler: async (data) => {
          if (data.folderName && data.folderName.trim() !== '') {
            await createFolder(data.folderName.trim());
            await loadFoldersAndSavedLocations();
          }
        }
      }
    ]
  });
  await alert.present();
}

function goToLocation(locationId: number) {
  router.push(`/place/${locationId}`);
}

async function removeLocationPrompt(saveId: string) {
  const alert = await alertController.create({
    header: t('savedLocations.removeLocation'),
    message: t('savedLocations.removeConfirm'),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('savedLocations.remove'),
        role: 'destructive',
        handler: async () => {
          await unsaveLocation(saveId);
        }
      }
    ]
  });
  await alert.present();
}

async function moveLocationPrompt(savedId: string, currentFolderId: string, locationId: number) {
  const otherFolders = folders.value.filter(f => f.id !== currentFolderId);
  
  if (otherFolders.length === 0) {
    const alert = await alertController.create({
      header: t('savedLocations.noOtherFolders'),
      message: t('savedLocations.noOtherFoldersDesc'),
      buttons: [t('common.ok')]
    });
    await alert.present();
    return;
  }

  const actionButtons = otherFolders.map(folder => ({
    text: folder.name,
    icon: folderOpenOutline,
    handler: async () => {
      const success = await moveLocation(savedId, folder.id, locationId);
      
      if (!success) {
        const toast = await toastController.create({
          message: t('savedLocations.locationAlreadyInFolder'),
          duration: 2000,
          color: 'warning',
          position: 'bottom'
        });
        await toast.present();
      } else {
        activeFolderId.value = folder.id;
        
        const toast = await toastController.create({
          message: t('savedLocations.moveSuccess', { name: folder.name }),
          duration: 2000,
          color: 'success',
          position: 'bottom'
        });
        await toast.present();
      }
    }
  }));

  actionButtons.push({
    text: t('common.cancel'),
    icon: 'close',
    role: 'cancel',
    handler: () => {}
  } as any);

  const actionSheet = await actionSheetController.create({
    header: t('savedLocations.moveToFolder'),
    buttons: actionButtons
  });
  
  await actionSheet.present();
}
</script>

<style scoped>
.limit-card {
  margin-left: 0; 
  margin-right: 0; 
  box-shadow: none; 
  border: 1px solid var(--ion-color-light); 
  border-radius: 12px; 
  margin-top: 0;
}

.limit-header {
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  margin-bottom: 8px;
}

.limit-label {
  font-size: 14px; 
  font-weight: 600; 
  color: var(--ion-color-medium);
}

.limit-value {
  font-size: 14px; 
  font-weight: bold; 
  color: var(--ion-color-carrot);
}

.limit-progress {
  border-radius: 4px; 
  height: 8px;
}

.limit-message {
  font-size: 12px; 
  color: var(--ion-color-medium); 
  margin-top: 12px; 
  margin-bottom: 0;
}

.limit-reached {
  color: var(--ion-color-danger);
}

.upgrade-btn {
  margin-top: 12px; 
  margin-bottom: 0;
}

.empty-state {
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  justify-content: center; 
  height: 50vh;
  text-align: center;
}

.empty-icon {
  font-size: 64px; 
  color: var(--ion-color-medium); 
  margin-bottom: 16px;
}

.empty-state h3 {
  margin-top: 0; 
  font-weight: 600;
}

.empty-state p {
  color: var(--ion-color-medium); 
  max-width: 80%;
}

.view-header {
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  margin-bottom: 16px;
}

.view-header h2 {
  margin: 0; 
  font-size: 1.2rem; 
  font-weight: 600;
}

.view-toggle {
  background: var(--ion-color-light); 
  border-radius: 8px; 
  display: flex; 
  padding: 2px;
}

.toggle-btn {
  margin: 0; 
  --padding-start: 8px; 
  --padding-end: 8px;
}

.back-btn {
  margin: 0; 
  margin-left: -10px;
}

.back-btn span {
  font-weight: 600;
}

/* Folder Grid/List Styles */
.folder-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 16px;
}

.folder-card {
  background: var(--ion-color-light);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  cursor: pointer;
  box-shadow: 0 4px 6px rgba(0,0,0,0.02);
  transition: transform 0.2s ease;
}

.folder-card:active {
  transform: scale(0.96);
}

.folder-icon-wrapper {
  background: rgba(var(--ion-color-carrot-rgb), 0.15);
  padding: 10px;
  border-radius: 10px;
  margin-bottom: 12px;
}

.folder-icon {
  font-size: 28px;
  color: var(--ion-color-carrot);
}

.folder-info {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.folder-name {
  font-weight: 600;
  font-size: 15px;
  margin-bottom: 2px;
  color: var(--ion-color-dark);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.folder-count {
  font-size: 13px;
  color: var(--ion-color-medium);
}

.folder-list-item {
  margin-bottom: 8px; 
  --border-radius: 8px; 
  --background: var(--ion-color-light);
}

.folder-list-count {
  font-size: 13px; 
  color: var(--ion-color-medium);
}

/* Location Grid Styles */
.location-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 16px;
}

.location-card {
  background: var(--ion-color-light);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  cursor: pointer;
  box-shadow: 0 4px 6px rgba(0,0,0,0.02);
  transition: transform 0.2s ease;
  overflow: hidden;
  position: relative;
}

.location-card:active {
  transform: scale(0.96);
}

.location-move-btn {
  position: absolute;
  top: 4px;
  right: 40px;
  margin: 0;
  --padding-start: 8px;
  --padding-end: 8px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  z-index: 2;
}

.location-delete-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  margin: 0;
  --padding-start: 8px;
  --padding-end: 8px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  z-index: 2;
}

.location-img-wrapper {
  width: 100%;
  height: 100px;
  background: white;
}

.location-img-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.location-info {
  padding: 12px;
  display: flex;
  flex-direction: column;
  width: 100%;
}

.location-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--ion-color-dark);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

/* Location List Styles */
.location-list-item {
  margin-bottom: 8px; 
  --border-radius: 8px; 
  --background: var(--ion-color-light);
}

.location-thumbnail {
  border-radius: 8px; 
  overflow: hidden;
}

.location-thumbnail img {
  width: 100%; 
  height: 100%; 
  object-fit: cover;
}

.location-list-name {
  font-weight: 600;
}
</style>
