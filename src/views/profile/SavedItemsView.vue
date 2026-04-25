<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('profile.savedItems')" show-back back-route="/profile" :icon="bookmarkOutline" />
    </ion-header>

    <ion-content class="ion-padding">
      <div v-if="loading" class="ion-text-center ion-margin-top">
        <ion-spinner />
      </div>

      <template v-else>
        <!-- Free User Limit Progress (ALWAYS SHOW FOR NON-PRO) -->
        <ion-card v-if="!isDonor" class="ion-margin-bottom" style="margin-left: 0; margin-right: 0; box-shadow: none; border: 1px solid var(--ion-color-light); border-radius: 12px; margin-top: 0;">
          <div class="ion-padding" style="padding-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 14px; font-weight: 600; color: var(--ion-color-medium);">{{ $t('savedItems.freeTier') }}</span>
              <span style="font-size: 14px; font-weight: bold; color: var(--ion-color-carrot);">
                {{ totalSavedItems }} / 10
              </span>
            </div>
            <ion-progress-bar :value="totalSavedItems / 10" color="carrot" style="border-radius: 4px; height: 8px;"></ion-progress-bar>
            
            <p v-if="totalSavedItems >= 10" style="font-size: 12px; color: var(--ion-color-danger); margin-top: 12px; margin-bottom: 0;">
              {{ $t('savedItems.freeLimitReached') }}
            </p>
            <p v-else style="font-size: 12px; color: var(--ion-color-medium); margin-top: 12px; margin-bottom: 0;">
              {{ $t('savedItems.proUpgrade', { pro: 'Halal Formosa Pro' }) }}
            </p>
            
            <ion-button expand="block" color="carrot" size="small" style="margin-top: 12px; margin-bottom: 0;" @click="presentRcPaywall">
              {{ $t('profile.pro.upgrade') }}
            </ion-button>
          </div>
        </ion-card>

        <div v-if="folders.length === 0" class="ion-text-center ion-margin-top" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 50vh;">
          <ion-icon :icon="folderOutline" style="font-size: 64px; color: var(--ion-color-medium); margin-bottom: 16px;"></ion-icon>
          <h3 style="margin-top: 0; font-weight: 600;">{{ $t('savedItems.noCollections') }}</h3>
          <p style="color: var(--ion-color-medium); max-width: 80%;">{{ $t('savedItems.noCollectionsDesc') }}</p>
          <ion-button color="carrot" style="margin-top: 16px;" @click="promptCreateFolder">
            <ion-icon :icon="addOutline" slot="start" />
            {{ $t('savedItems.createFolder') }}
          </ion-button>
        </div>

        <div v-else>
          <!-- FOLDERS LIST/GRID -->
        <div v-if="!activeFolder">
          <!-- View Toggle Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h2 style="margin: 0; font-size: 1.2rem; font-weight: 600;">{{ $t('savedItems.myCollections') }}</h2>
            <div style="background: var(--ion-color-light); border-radius: 8px; display: flex; padding: 2px;">
              <ion-button 
                fill="clear" 
                size="small" 
                :color="viewMode === 'grid' ? 'carrot' : 'medium'"
                @click="viewMode = 'grid'"
                style="margin: 0; --padding-start: 8px; --padding-end: 8px;"
              >
                <ion-icon :icon="gridOutline" />
              </ion-button>
              <ion-button 
                fill="clear" 
                size="small" 
                :color="viewMode === 'list' ? 'carrot' : 'medium'"
                @click="viewMode = 'list'"
                style="margin: 0; --padding-start: 8px; --padding-end: 8px;"
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
                <span class="folder-count">{{ $t('savedItems.itemsCount', { count: folder.saved_items.length }) }}</span>
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
              style="margin-bottom: 8px; --border-radius: 8px; --background: var(--ion-color-light);"
              lines="none"
            >
              <ion-icon :icon="folderOutline" slot="start" color="carrot" />
              <ion-label>
                <h3>{{ folder.name }}</h3>
                <p style="font-size: 13px; color: var(--ion-color-medium);">{{ $t('savedItems.itemsCount', { count: folder.saved_items.length }) }}</p>
              </ion-label>
            </ion-item>
          </ion-list>
        </div>

        <!-- ITEMS IN FOLDER VIEW -->
        <div v-else>
          <!-- Back button & View Toggle Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <ion-button fill="clear" @click="closeFolder" style="margin: 0; margin-left: -10px;">
              <ion-icon :icon="arrowBackOutline" slot="start" />
              <span style="font-weight: 600;">{{ activeFolder.name }}</span>
            </ion-button>
            <div style="background: var(--ion-color-light); border-radius: 8px; display: flex; padding: 2px;">
              <ion-button 
                fill="clear" 
                size="small" 
                :color="viewMode === 'grid' ? 'carrot' : 'medium'"
                @click="viewMode = 'grid'"
                style="margin: 0; --padding-start: 8px; --padding-end: 8px;"
              >
                <ion-icon :icon="gridOutline" />
              </ion-button>
              <ion-button 
                fill="clear" 
                size="small" 
                :color="viewMode === 'list' ? 'carrot' : 'medium'"
                @click="viewMode = 'list'"
                style="margin: 0; --padding-start: 8px; --padding-end: 8px;"
              >
                <ion-icon :icon="listOutline" />
              </ion-button>
            </div>
          </div>

          <p v-if="activeFolder.saved_items.length === 0" class="ion-text-center ion-margin-top">
            <small>{{ $t('savedItems.noItems') }}</small>
          </p>
          
          <!-- GRID VIEW FOR ITEMS -->
          <div v-else-if="viewMode === 'grid'" class="folder-grid">
            <div 
              v-for="saved in activeFolder.saved_items" 
              :key="saved.id" 
              class="item-card"
              @click="goToItem(saved.products.barcode)"
            >
              <!-- Move button absolute next to corner -->
              <ion-button 
                 fill="clear" 
                 color="primary" 
                 class="item-move-btn"
                 @click.stop="moveItem(saved.id, activeFolder.id, saved.products.id)"
              >
                <ion-icon :icon="folderOpenOutline" />
              </ion-button>

              <!-- Delete button absolute to corner -->
              <ion-button 
                 fill="clear" 
                 color="danger" 
                 class="item-delete-btn"
                 @click.stop="removeItem(saved.id)"
              >
                <ion-icon :icon="trashOutline" />
              </ion-button>

              <div class="item-img-wrapper">
                <img :src="saved.products.photo_front_url || 'https://via.placeholder.com/80.webp'" alt="Product Image" />
              </div>
              <div class="item-info">
                <span class="folder-name">{{ saved.products.name }}</span>
                <ion-chip
                    size="small"
                    :class="[
                      saved.products.status === 'Halal' ? 'chip-success' :
                      saved.products.status === 'Muslim-friendly' ? 'chip-primary' :
                      saved.products.status === 'Syubhah' ? 'chip-warning' :
                      saved.products.status === 'Haram' ? 'chip-danger' : 'chip-medium'
                    ]"
                    style="margin-left: 0; margin-top: 4px; font-size: 11px;"
                >
                  {{ saved.products.status }}
                </ion-chip>
              </div>
            </div>
          </div>

          <!-- LIST VIEW FOR ITEMS -->
          <ion-list v-else style="background: transparent;">
            <ion-item v-for="saved in activeFolder.saved_items" :key="saved.id" button @click="goToItem(saved.products.barcode)" style="margin-bottom: 8px; --border-radius: 8px; --background: var(--ion-color-light);" lines="none">
              <ion-thumbnail slot="start" style="border-radius: 8px; overflow: hidden;">
                <img :src="saved.products.photo_front_url || 'https://via.placeholder.com/80.webp'" alt="Product Image" style="width: 100%; height: 100%; object-fit: cover;" />
              </ion-thumbnail>
              <ion-label>
                <h3 style="font-weight: 600;">{{ saved.products.name }}</h3>
                <ion-chip
                    size="small"
                    :class="[
                      saved.products.status === 'Halal' ? 'chip-success' :
                      saved.products.status === 'Muslim-friendly' ? 'chip-primary' :
                      saved.products.status === 'Syubhah' ? 'chip-warning' :
                      saved.products.status === 'Haram' ? 'chip-danger' : 'chip-medium'
                    ]"
                    style="margin-left: 0; margin-top: 4px;"
                >
                  {{ saved.products.status }}
                </ion-chip>
              </ion-label>
              
              <ion-button fill="clear" color="primary" slot="end" @click.stop="moveItem(saved.id, activeFolder.id, saved.products.id)">
                <ion-icon :icon="folderOpenOutline" />
              </ion-button>
              <ion-button fill="clear" color="danger" slot="end" @click.stop="removeItem(saved.id)">
                <ion-icon :icon="trashOutline" />
              </ion-button>
            </ion-item>
          </ion-list>
        </div>
        </div>
      </template>
    <!-- FAB to create new folder from list/grid view -->
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
import { supabase } from '@/plugins/supabaseClient';
import {
  IonPage, IonHeader, IonContent, IonSpinner,
  IonItem, IonIcon, IonLabel, IonList, IonThumbnail, IonChip, IonButton,
  IonCard, IonProgressBar, alertController, IonFab, IonFabButton, actionSheetController, toastController
} from '@ionic/vue';
import { bookmarkOutline, folderOutline, trashOutline, gridOutline, listOutline, arrowBackOutline, addOutline, folderOpenOutline } from 'ionicons/icons';
import AppHeader from '@/components/AppHeader.vue';
import { useI18n } from 'vue-i18n';
import { useNotifier } from "@/composables/useNotifier";

// Subscription Logic
import { isDonor, refreshSubscriptionStatus } from '@/composables/useSubscriptionStatus';
import { RevenueCatUI, PAYWALL_RESULT } from '@revenuecat/purchases-capacitor-ui';
import { Capacitor } from '@capacitor/core';
import { ActivityLogService } from '@/services/ActivityLogService';

const router = useRouter();
const { t } = useI18n();
const { notifyEvent } = useNotifier();
const loading = ref(true);
const folders = ref<any[]>([]);

const viewMode = ref<'grid' | 'list'>('grid');
const activeFolderId = ref<string | null>(null);

const totalSavedItems = computed(() => {
  return folders.value.reduce((acc, folder) => acc + (folder.saved_items?.length || 0), 0);
});

const activeFolder = computed(() => {
  if (!activeFolderId.value) return null;
  return folders.value.find(f => f.id === activeFolderId.value) || null;
});

function openFolder(folder: any) {
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
        source: 'saved_items_view'
      });

      const { data: { user } } = await supabase.auth.getUser();
      await notifyEvent(
        'pro_purchase_success',
        '💎 New Pro Member!',
        `User ${user?.email ?? 'unknown'} has just subscribed to Halal Formosa Pro!`,
        undefined,
        {
          source: 'saved_items_view',
          email: user?.email,
          user_id: user?.id
        },
        ['discord']
      ).catch(console.error);

      return true;
    }
  } catch (err) {
    console.error("Paywall failed:", err);
  }
  return false;
}

onMounted(async () => {
  await loadFoldersAndItems();
});

async function loadFoldersAndItems() {
  loading.value = true;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    loading.value = false;
    return;
  }

  // 1. Fetch folders
  const { data: folderData } = await supabase
    .from('saved_item_folders')
    .select('id, name')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (!folderData || folderData.length === 0) {
    folders.value = [];
    loading.value = false;
    return;
  }

  // 2. Map existing folders and inject their items from `saved_items` table linked to `products`
  const { data: savedItems } = await supabase
    .from('saved_items')
    .select(`
      id,
      folder_id,
      products ( id, barcode, name, status, photo_front_url )
    `)
    .eq('user_id', user.id);

  // Parse items logically per category
  const mappedFolders = folderData.map(folder => {
    return {
      ...folder,
      saved_items: savedItems ? savedItems.filter(item => item.folder_id === folder.id) : []
    };
  });

  folders.value = mappedFolders;
  loading.value = false;
}

async function promptCreateFolder() {
  const alert = await alertController.create({
    header: t('savedItems.newFolder'),
    inputs: [
      {
        name: 'folderName',
        type: 'text',
        placeholder: t('savedItems.folderName')
      }
    ],
    buttons: [
      {
        text: t('common.cancel'),
        role: 'cancel'
      },
      {
        text: t('savedItems.create'),
        handler: async (data) => {
          if (data.folderName && data.folderName.trim() !== '') {
            await createFolder(data.folderName.trim());
          }
        }
      }
    ]
  });
  await alert.present();
}

async function createFolder(name: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  
  const { error } = await supabase
    .from('saved_item_folders')
    .insert({ user_id: user.id, name });
    
  if (!error) {
    await loadFoldersAndItems();
  }
}

function goToItem(barcode: string) {
  router.push(`/item/${barcode}`);
}

async function removeItem(saveId: string) {
  const alert = await alertController.create({
    header: t('savedItems.removeItem'),
    message: t('savedItems.removeConfirm'),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('savedItems.remove'),
        role: 'destructive',
        handler: async () => {
          await supabase.from('saved_items').delete().eq('id', saveId);
          await loadFoldersAndItems();
        }
      }
    ]
  });
  await alert.present();
}
async function moveItem(saveId: string, currentFolderId: string, productId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const otherFolders = folders.value.filter(f => f.id !== currentFolderId);
  
  if (otherFolders.length === 0) {
    const alert = await alertController.create({
      header: t('savedItems.noOtherFolders'),
      message: t('savedItems.noOtherFoldersDesc'),
      buttons: [t('common.ok')]
    });
    await alert.present();
    return;
  }

  const actionButtons = otherFolders.map(folder => ({
    text: folder.name,
    icon: folderOpenOutline,
    handler: async () => {
      // Execute the move by inserting a new relation
      const { error } = await supabase
        .from('saved_items')
        .insert({
          user_id: user.id,
          folder_id: folder.id,
          product_id: productId
        });
        
      if (error && error.code === '23505') {
        // Unique constraint triggered, user already saved it in that target folder
        const toast = await toastController.create({
          message: t('savedItems.itemAlreadyInFolder'),
          duration: 2000,
          color: 'warning',
          position: 'bottom'
        });
        await toast.present();
      } else if (!error) {
        // Success! Now delete the old relation
        await supabase.from('saved_items').delete().eq('id', saveId);
        
        // Refresh local data completely to instantly reflect the jump
        await loadFoldersAndItems();
        
        // Immediately navigate the user to the destination folder
        activeFolderId.value = folder.id;
        
        const toast = await toastController.create({
          message: t('savedItems.moveSuccess', { name: folder.name }),
          duration: 2000,
          color: 'success',
          position: 'bottom'
        });
        await toast.present();
      } else {
        const toast = await toastController.create({
          message: t('savedItems.moveFailed'),
          duration: 2000,
          color: 'danger',
          position: 'bottom'
        });
        await toast.present();
      }
    }
  }));

  actionButtons.push({
    text: 'Cancel',
    icon: 'close',
    role: 'cancel',
    handler: () => {}
  } as any);

  const actionSheet = await actionSheetController.create({
    header: t('savedItems.moveToFolder'),
    buttons: actionButtons
  });
  
  await actionSheet.present();
}

</script>

<style scoped>
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

/* Items specific styling for Grid view */
.item-card {
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
.item-card:active {
  transform: scale(0.96);
}

.item-move-btn {
  position: absolute;
  top: 4px;
  right: 40px; /* Offset it to the left of the delete button */
  margin: 0;
  --padding-start: 8px;
  --padding-end: 8px;
  background: rgba(255, 255, 255, 0.85); /* Readability above image */
  border-radius: 50%;
  width: 32px;
  height: 32px;
  z-index: 2;
}

.item-delete-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  margin: 0;
  --padding-start: 8px;
  --padding-end: 8px;
  background: rgba(255, 255, 255, 0.85); /* Readability above image */
  border-radius: 50%;
  width: 32px;
  height: 32px;
  z-index: 2;
}

.item-img-wrapper {
  width: 100%;
  height: 100px;
  background: white;
}
.item-img-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-info {
  padding: 12px;
  display: flex;
  flex-direction: column;
  width: 100%;
}
</style>
