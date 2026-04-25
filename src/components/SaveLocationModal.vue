<template>
  <ion-modal 
    :is-open="isOpen" 
    @didDismiss="$emit('close')" 
    :initial-breakpoint="0.5" 
    :breakpoints="[0, 0.5, 0.75]"
    class="save-location-modal"
  >
    <ion-content class="ion-padding">
      <h3>{{ $t('savedLocations.saveToFolder') }}</h3>
      
      <!-- New Folder Input -->
      <ion-item lines="full">
        <ion-input 
          v-model="newFolderName" 
          :placeholder="$t('savedLocations.newCollectionPlaceholder')" 
          @keyup.enter="createNewFolder"
        ></ion-input>
        <ion-button fill="clear" slot="end" @click="createNewFolder" :disabled="!newFolderName.trim()">
          <ion-icon :icon="addOutline"></ion-icon>
        </ion-button>
      </ion-item>

      <!-- Folders List -->
      <ion-list class="ion-margin-top">
        <ion-list-header>{{ $t('savedLocations.yourCollections') }}</ion-list-header>
        
        <ion-item 
          v-for="folder in folders" 
          :key="folder.id" 
          button 
          @click="saveToFolder(folder.id)"
          :disabled="isSaving"
        >
          <ion-icon :icon="isLocationInFolder(folder.id) ? bookmark : bookmarkOutline" slot="start" :color="isLocationInFolder(folder.id) ? 'carrot' : 'medium'"></ion-icon>
          <ion-label>{{ folder.name }}</ion-label>
          <ion-spinner v-if="isSaving && selectedFolderId === folder.id" slot="end" name="dots" color="carrot"></ion-spinner>
        </ion-item>
        
        <p v-if="folders.length === 0" class="ion-text-center ion-padding">{{ $t('savedLocations.noCollections') }}</p>
      </ion-list>
    </ion-content>
  </ion-modal>

  <!-- Toasts -->
  <ion-toast
    :is-open="showSuccessToast"
    :message="toastMessage"
    :duration="2000"
    color="success"
    position="bottom"
    @didDismiss="showSuccessToast = false"
  />
  <ion-toast
    :is-open="showWarningToast"
    :message="toastMessage"
    :duration="2000"
    color="warning"
    position="bottom"
    @didDismiss="showWarningToast = false"
  />
  <ion-toast
    :is-open="showErrorToast"
    :message="toastMessage"
    :duration="2000"
    color="danger"
    position="bottom"
    @didDismiss="showErrorToast = false"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { 
  IonModal, IonContent, IonItem, IonInput, IonButton, IonIcon, 
  IonList, IonListHeader, IonLabel, IonSpinner, IonToast 
} from '@ionic/vue';
import { addOutline, bookmarkOutline, bookmark } from 'ionicons/icons';
import { useI18n } from 'vue-i18n';
import { useSavedLocations } from '@/composables/useSavedLocations';
import { isDonor } from '@/composables/useSubscriptionStatus';
import { Capacitor } from '@capacitor/core';
import { RevenueCatUI, PAYWALL_RESULT } from '@revenuecat/purchases-capacitor-ui';
import { ActivityLogService } from '@/services/ActivityLogService';

const props = defineProps<{
  isOpen: boolean;
  locationId: number;
  locationName: string;
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const { t } = useI18n();
const { folders, savedLocations, totalSavedCount, loadFoldersAndSavedLocations, createFolder, saveLocation } = useSavedLocations();

const newFolderName = ref('');
const isSaving = ref(false);
const selectedFolderId = ref<string | null>(null);
const savedFolderIds = ref<Set<string>>(new Set());

const showSuccessToast = ref(false);
const showWarningToast = ref(false);
const showErrorToast = ref(false);
const toastMessage = ref('');

// Load folders when modal opens
watch(() => props.isOpen, async (open) => {
  if (open) {
    await loadFoldersAndSavedLocations();
    await updateSavedFolderIds();
  }
});

onMounted(async () => {
  if (props.isOpen) {
    await loadFoldersAndSavedLocations();
    await updateSavedFolderIds();
  }
});

async function updateSavedFolderIds() {
  // Find which folders contain this location
  const savedInFolders = savedLocations.value
    .filter(sl => sl.location_id === props.locationId)
    .map(sl => sl.folder_id);
  savedFolderIds.value = new Set(savedInFolders);
}

function isLocationInFolder(folderId: string): boolean {
  return savedFolderIds.value.has(folderId);
}

async function presentPaywall(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.warn("[RC] Paywall can only run on native.");
    return false;
  }

  try {
    const { result } = await RevenueCatUI.presentPaywall();

    if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
      // Refresh subscription state
      const { refreshSubscriptionStatus } = await import('@/composables/useSubscriptionStatus');
      await refreshSubscriptionStatus({ syncToServer: true });
      
      await ActivityLogService.log("pro_purchase_success", {
        source: "save_location_limit"
      });
      return true;
    }
  } catch (err) {
    console.error("Paywall failed:", err);
  }
  return false;
}

async function createNewFolder() {
  if (!newFolderName.value.trim()) return;
  
  const folder = await createFolder(newFolderName.value.trim());
  if (folder) {
    newFolderName.value = '';
    // Auto-save to newly created folder
    await saveToFolder(folder.id);
  }
}

async function saveToFolder(folderId: string) {
  // Check if already in this folder
  if (isLocationInFolder(folderId)) {
    toastMessage.value = t('savedLocations.locationAlreadySaved');
    showWarningToast.value = true;
    return;
  }

  // Check free tier limit
  if (!isDonor.value && totalSavedCount.value >= 10) {
    await ActivityLogService.log("pro_paywall_trigger", {
      source: "save_location_limit",
      location_id: props.locationId,
      location_name: props.locationName
    });

    const purchased = await presentPaywall();
    if (!purchased) return;

    // Yield small delay for subscription reactive update
    await new Promise(r => setTimeout(r, 300));
  }

  isSaving.value = true;
  selectedFolderId.value = folderId;

  const success = await saveLocation(props.locationId, folderId);

  if (success) {
    savedFolderIds.value.add(folderId);
    toastMessage.value = t('savedLocations.locationSavedSuccess');
    showSuccessToast.value = true;
    
    await ActivityLogService.log("location_save_success", {
      location_id: props.locationId,
      location_name: props.locationName,
      folder_id: folderId,
      source: "save_modal"
    });
    
    emit('saved');
    emit('close');
  } else {
    toastMessage.value = t('savedLocations.locationAlreadySaved');
    showWarningToast.value = true;
  }

  isSaving.value = false;
  selectedFolderId.value = null;
}
</script>

<style scoped>
h3 {
  margin-top: 0;
  margin-bottom: 16px;
  font-weight: 600;
}
</style>
