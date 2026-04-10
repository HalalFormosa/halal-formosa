<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <app-header :title="$t('profile.title')" :icon="icons.personCircleOutline" />
    </ion-header>

    <ion-content class="ion-padding">

      <ion-header collapse="condense" class="ion-no-border">
        <ion-toolbar>
          <ion-title size="large">{{ $t('profile.title') }}</ion-title>
        </ion-toolbar>
      </ion-header>

      <!-- ================= LOADING STATE ================= -->
      <template v-if="loadingProfile">
        <ion-card>
          <div class="profile-header-premium">
            <ion-skeleton-text animated class="skeleton-avatar-premium" />
            <ion-skeleton-text animated style="width: 50%; height: 24px;" class="skeleton-text-center" />
            <ion-skeleton-text animated style="width: 30%; height: 16px;" class="skeleton-text-center" />
          </div>
        </ion-card>

        <ion-card>
          <div class="xp-section">
            <ion-skeleton-text animated style="width: 40%; height: 20px; margin-bottom: 12px;" />
            <ion-skeleton-text animated style="width: 100%; height: 12px; border-radius: 6px;" />
          </div>
        </ion-card>
      </template>

      <!-- ================= ACTUAL CONTENT ================= -->
      <template v-else>
        <!-- Profile Header Card -->
        <ion-card>
          <div class="profile-header-premium">
            <div class="avatar-container">
              <img v-if="userAvatar" :src="userAvatar" class="avatar-premium" />
              <ion-icon v-else :icon="icons.personCircleOutline" class="avatar-premium" style="font-size: 120px; color: var(--ion-color-step-600)" />
            </div>

            <div class="profile-info text-center" v-if="userEmail">
              <h2 class="profile-name-main">{{ userDisplayName || 'User' }}</h2>
              <p class="profile-email-sub">{{ userEmail }}</p>
              
              <div class="badge-row">
                <ion-badge v-if="isSubscribed" class="badge-pro">
                  <ion-icon :icon="icons.bookmarkOutline" style="margin-right: 4px" />
                  {{ $t('profile.proMember') }}
                </ion-badge>
                <ion-badge v-else :color="donorBadge.color" style="border-radius: 12px; padding: 6px 12px;">
                  {{ donorBadge.emoji }} {{ $t('profile.donors.' + donorBadge.label) }}
                </ion-badge>
              </div>
            </div>

            <div v-else class="login-prompt">
              <p>{{ $t('profile.noUserLogged') }}</p>
              <ion-button color="carrot" expand="block" shape="round" @click="goToLogin">
                {{ $t('profile.login') }}
              </ion-button>
            </div>
          </div>
        </ion-card>

        <!-- Pro Status / Support Card -->
        <ion-card v-if="userEmail && isNative" :class="{ 'tier-card-gold': !isSubscribed }">
          <div v-if="!isSubscribed" class="gold-glow"></div>
          
          <!-- Subscribed State -->
          <template v-if="isSubscribed">
            <div class="pro-active-banner">
              <div class="pro-active-header">
                <div class="pro-active-title-group">
                  <div class="pro-active-icon">
                    <ion-icon :icon="icons.bookmarkOutline" />
                  </div>
                  <div class="pro-active-title-info">
                    <h3 class="pro-active-title">{{ $t('profile.pro.title') }}</h3>
                    <div class="pro-status-chip">
                      <ion-icon :icon="icons.checkmarkCircle" />
                      <span>{{ $t('profile.pro.active') }}</span>
                    </div>
                  </div>
                </div>
                
                <ion-button fill="outline" class="pro-manage-btn" size="small" @click="openManageSubscription">
                  {{ $t('profile.pro.manage') }}
                </ion-button>
              </div>

              <div class="pro-active-footer">
                <div class="pro-detail-item">
                  <ion-icon :icon="willRenew ? icons.refreshOutline : icons.alertCircleOutline" :color="willRenew ? 'success' : 'warning'" />
                  <span>{{ renewalMessage }}</span>
                </div>
                <div class="pro-detail-item">
                  <ion-icon :icon="icons.timeOutline" />
                  <span>{{ $t('profile.pro.accessUntil') }} {{ formattedExpirationDate }}</span>
                </div>
              </div>
            </div>
          </template>

          <!-- Unsubscribed (Engaging) State -->
          <div v-else class="pro-upgrade-engaging">
            <div class="pro-header-engaging">
              <div class="pro-icon-hero">
                <ion-icon :icon="icons.bookmarkOutline" />
              </div>
              <h2 class="pro-title-engaging">{{ $t('profile.pro.title') }}</h2>
              <p class="pro-subtitle-engaging">{{ $t('profile.pro.upgrade') }}</p>
            </div>

            <div class="pro-benefits-grid">
              <div class="benefit-chip">
                <ion-icon :icon="icons.checkmarkCircle" />
                <span>{{ $t('profile.pro.benefits.aiExplanation') }}</span>
              </div>
              <div class="benefit-chip">
                <ion-icon :icon="icons.checkmarkCircle" />
                <span>{{ $t('profile.pro.benefits.smartFeed') }}</span>
              </div>
              <div class="benefit-chip">
                <ion-icon :icon="icons.checkmarkCircle" />
                <span>{{ $t('profile.pro.benefits.noAds') }}</span>
              </div>
              
              <template v-if="showBenefits">
                <div class="benefit-chip fade-in">
                  <ion-icon :icon="icons.checkmarkCircle" />
                  <span>{{ $t('profile.pro.benefits.unlimitedCollections') }}</span>
                </div>
                <div class="benefit-chip fade-in">
                  <ion-icon :icon="icons.checkmarkCircle" />
                  <span>{{ $t('profile.pro.benefits.unlimitedScans') }}</span>
                </div>
                <div class="benefit-chip fade-in">
                  <ion-icon :icon="icons.checkmarkCircle" />
                  <span>{{ $t('profile.pro.benefits.prioritySupport') }}</span>
                </div>
              </template>
            </div>

            <div class="pro-action-footer">
              <ion-button expand="block" class="pro-big-buy-button" @click="openProPaywall">
                {{ $t('profile.pro.upgrade') }}
              </ion-button>
              <button class="benefit-toggle-text" @click="showBenefits = !showBenefits">
                {{ showBenefits ? $t('profile.pro.benefits.showLess') : $t('profile.pro.benefits.showMore') }}
              </button>
            </div>
          </div>
        </ion-card>

        <!-- XP Card -->
        <ion-card v-if="userEmail">
          <div class="xp-section">
            <div class="xp-header">
              <div class="level-badge">
                <span class="level-label">LEVEL</span>
                <span class="level-num">{{ level }}</span>
              </div>
              <div class="xp-total">
                <span class="xp-val">{{ currentPoints || 0 }} XP</span>
                <span class="xp-next">{{ nextLevelXp }} XP TO NEXT LEVEL</span>
              </div>
            </div>
            
            <div class="progress-container">
              <div class="progress-bar-fill" :style="{ width: progressPercent + '%' }"></div>
            </div>
          </div>
        </ion-card>

        <!-- Account & Preferences Section -->
        <ion-card>
          <ion-list lines="none">
            <ion-list-header style="min-height: 32px; padding-bottom: 4px;">
              <ion-label style="font-size: 0.85rem; color: var(--ion-color-medium); margin-top: 0; text-transform: uppercase;">{{ $t('profile.sections.account') }}</ion-label>
            </ion-list-header>

            <ion-item v-if="userEmail" button @click="goToEditProfile">
              <div class="icon-box" slot="start">
                <ion-icon :icon="icons.createOutline" />
              </div>
              <ion-label>
                <h3>{{ $t('profile.aboutMe') }}</h3>
                <p>{{ userBio || $t('profile.noBio') }}</p>
              </ion-label>
              <ion-icon :icon="icons.settingsOutline" slot="end" size="small" style="opacity: 0.3" />
            </ion-item>

            <ion-item button @click="goToSettings">
              <div class="icon-box" slot="start">
                <ion-icon :icon="icons.settingsOutline" />
              </div>
              <ion-label>{{ $t('profile.settings') }}</ion-label>
            </ion-item>
          </ion-list>
        </ion-card>

        <!-- General Activity Section -->
        <ion-card v-if="userEmail">
          <ion-list lines="none">
            <ion-list-header style="min-height: 32px; padding-bottom: 4px;">
              <ion-label style="font-size: 0.85rem; color: var(--ion-color-medium); margin-top: 0; text-transform: uppercase;">{{ $t('profile.sections.activity') }}</ion-label>
            </ion-list-header>

            <ion-item v-if="userEmail" button @click="goToSavedItems">
              <div class="icon-box" slot="start">
                <ion-icon :icon="icons.bookmarkOutline" />
              </div>
              <ion-label>{{ $t('profile.savedItems') }}</ion-label>
            </ion-item>

            <ion-item v-if="userEmail" button @click="$router.push('/store/my-orders')" :disabled="isStoreUnderConstruction">
              <div class="icon-box" slot="start">
                <ion-icon :icon="icons.bagHandleOutline" />
              </div>
              <ion-label>
                <h3>{{ $t('store.myOrders') }}</h3>
                <p v-if="isStoreUnderConstruction" class="construction-text-small">{{ $t('common.underConstruction') }}</p>
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-card>

        <!-- Become a Merchant Section -->
        <ion-card v-if="userEmail && !merchantStore">
          <ion-list lines="none" style="padding-bottom: 0;">
            <ion-list-header style="min-height: 32px; padding-bottom: 4px;">
              <ion-label style="font-size: 0.85rem; color: var(--ion-color-medium); margin-top: 0; text-transform: uppercase;">{{ $t('merchant.register.sectionTitle') }}</ion-label>
            </ion-list-header>
          </ion-list>

          <div v-if="isStoreUnderConstruction" class="xp-section vendor-onboarding construction">
            <div class="pending-status-box">
              <div class="icon-pulse">
                <ion-icon :icon="icons.constructOutline" color="carrot" />
              </div>
              <div class="status-text">
                <h3>{{ $t('common.underConstruction') }}</h3>
                <p>{{ $t('store.underConstructionDesc') || "We're brewing something amazing! The store will be back soon." }}</p>
              </div>
            </div>
          </div>

          <template v-else>
            <div v-if="merchantApplication?.status === 'pending'" class="xp-section vendor-onboarding pending">
              <div class="pending-status-box">
                <div class="icon-pulse">
                  <ion-icon :icon="icons.timeOutline" color="carrot" />
                </div>
                <div class="status-text">
                  <h3>{{ $t('profile.merchant.pendingStatus') }}</h3>
                  <p>{{ $t('profile.merchant.pendingDesc') }}</p>
                </div>
              </div>
            </div>
            
            <div v-else-if="merchantApplication?.status === 'rejected'" class="xp-section vendor-onboarding rejected">
              <div class="pending-status-box">
                <div class="icon-pulse-red">
                  <ion-icon :icon="icons.closeCircleOutline" color="danger" />
                </div>
                <div class="status-text">
                  <h3 style="color: var(--ion-color-danger)">{{ $t('merchant.register.rejectedStatus') }}</h3>
                  <p>{{ $t('merchant.register.rejectedProfileDesc') }}</p>
                  
                  <ion-button 
                    fill="clear" 
                    size="small" 
                    color="carrot" 
                    @click="goToMerchantRegistration"
                    style="--padding-start: 0; font-weight: 700; margin-top: 8px;"
                  >
                    {{ $t('common.reapply') }}
                  </ion-button>
                </div>
              </div>
            </div>
            
            <ion-list v-else lines="none" class="vendor-list">
              <ion-item button @click="$router.push('/merchant/register')" class="vendor-onboarding-item">
                <div class="icon-box-vendor" slot="start">
                  <ion-icon :icon="icons.storefrontOutline" color="carrot" />
                </div>
                <ion-label>
                  <h3 class="vendor-title-label">{{ $t('profile.merchant.startSelling') }}</h3>
                  <p class="vendor-subtitle-label">{{ $t('profile.merchant.storeSubtitle') }}</p>
                </ion-label>
              </ion-item>
            </ion-list>
          </template>
        </ion-card>

        <ion-card v-if="merchantStore">
          <div v-if="isStoreUnderConstruction" class="xp-section vendor-onboarding construction">
            <div class="pending-status-box">
              <div class="icon-pulse">
                <ion-icon :icon="icons.constructOutline" color="primary" />
              </div>
              <div class="status-text">
                <h3 style="color: var(--ion-color-primary)">{{ $t('common.underConstruction') }}</h3>
                <p>{{ $t('store.underConstructionDesc') || "We're brewing something amazing! The store will be back soon." }}</p>
              </div>
            </div>
          </div>
          
          <ion-list v-else lines="none">
            <ion-list-header style="min-height: 32px; padding-bottom: 4px;">
              <ion-label style="font-size: 0.85rem; color: var(--ion-color-primary); margin-top: 0; text-transform: uppercase;">{{ $t('store.sellerCenter.title') }}</ion-label>
            </ion-list-header>

            <ion-item button @click="$router.push('/merchant/store/settings')">
              <div class="icon-box" slot="start" style="background: rgba(var(--ion-color-primary-rgb), 0.1);">
                <ion-icon :icon="icons.settingsOutline" color="primary" />
              </div>
              <ion-label>
                <h3>{{ $t('store.sellerCenter.manageStore') }}</h3>
                <p>{{ merchantStore.name_en || merchantStore.name_zh }}</p>
              </ion-label>
            </ion-item>

            <ion-item button @click="$router.push('/merchant/store/products')">
              <div class="icon-box" slot="start" style="background: rgba(var(--ion-color-primary-rgb), 0.1);">
                <ion-icon :icon="icons.bagHandleOutline" color="primary" />
              </div>
              <ion-label>{{ $t('store.sellerCenter.manageProducts') }}</ion-label>
            </ion-item>

            <ion-item button @click="$router.push('/merchant/store/orders')">
              <div class="icon-box" slot="start" style="background: rgba(var(--ion-color-primary-rgb), 0.1);">
                <ion-icon :icon="icons.listOutline" color="primary" />
              </div>
              <ion-label>{{ $t('store.sellerCenter.manageOrders') }}</ion-label>
              <ion-badge v-if="pendingOrdersCount > 0" color="warning" slot="end" style="border-radius: 8px;">{{ pendingOrdersCount }}</ion-badge>
            </ion-item>

            <ion-item button @click="$router.push('/merchant/store/chat-inbox')">
              <div class="icon-box" slot="start" style="background: rgba(var(--ion-color-secondary-rgb), 0.1);">
                <ion-icon :icon="icons.chatbubblesOutline" color="secondary" />
              </div>
              <ion-label>{{ $t('store.sellerCenter.manageMessages') }}</ion-label>
              <ion-badge v-if="unreadChatsCount > 0" color="danger" slot="end" style="border-radius: 8px;">{{ unreadChatsCount }}</ion-badge>
            </ion-item>
          </ion-list>
        </ion-card>

        <!-- Admin Section -->
        <ion-card v-if="isAdmin">
          <ion-list lines="none">
            <ion-list-header style="min-height: 32px; padding-bottom: 4px;">
              <ion-label style="font-size: 0.85rem; color: var(--ion-color-carrot); margin-top: 0; text-transform: uppercase;">{{ $t('profile.admin.sections.content') }}</ion-label>
            </ion-list-header>

            <ion-item button @click="goToReviewSubmissions">
              <div class="icon-box" slot="start">
                <ion-icon :icon="icons.listOutline" />
              </div>
              <ion-label>{{ $t('profile.review') }}</ion-label>
              <ion-badge v-if="pendingCount > 0" color="danger" slot="end" style="border-radius: 8px;">{{ pendingCount }}</ion-badge>
            </ion-item>

            <ion-item button @click="goToReviewLocations">
              <div class="icon-box" slot="start">
                <ion-icon :icon="icons.listOutline" />
              </div>
              <ion-label>{{ $t('profile.admin.locationsReview') }}</ion-label>
              <ion-badge v-if="pendingLocationsCount > 0" color="danger" slot="end" style="border-radius: 8px;">{{ pendingLocationsCount }}</ion-badge>
            </ion-item>

            <ion-item button @click="goToProductReports">
              <div class="icon-box" slot="start">
                <ion-icon :icon="icons.listOutline" />
              </div>
              <ion-label>{{ $t('profile.admin.productReports') }}</ion-label>
              <ion-badge v-if="pendingProductReportsCount > 0" color="danger" slot="end" style="border-radius: 8px;">{{ pendingProductReportsCount }}</ion-badge>
            </ion-item>

            <ion-item button @click="goToLocationReports">
              <div class="icon-box" slot="start">
                <ion-icon :icon="icons.listOutline" />
              </div>
              <ion-label>{{ $t('profile.admin.locationReports') }}</ion-label>
              <ion-badge v-if="pendingLocationReportsCount > 0" color="danger" slot="end" style="border-radius: 8px;">{{ pendingLocationReportsCount }}</ion-badge>
            </ion-item>

            <ion-list-header style="min-height: 32px; padding-bottom: 4px; border-top: 1px solid var(--ion-color-step-100); margin-top: 8px; padding-top: 8px;">
              <ion-label style="font-size: 0.85rem; color: var(--ion-color-carrot); margin-top: 0; text-transform: uppercase;">{{ $t('profile.admin.sections.store') }}</ion-label>
            </ion-list-header>

            <ion-item button @click="goToStoreOrders">
              <div class="icon-box" slot="start">
                <ion-icon :icon="icons.bagHandleOutline" />
              </div>
              <ion-label>{{ $t('store.adminOrders') }}</ion-label>
              <ion-badge v-if="pendingOrdersCount > 0" color="warning" slot="end" style="border-radius: 8px;">{{ pendingOrdersCount }}</ion-badge>
            </ion-item>

            <ion-item button @click="$router.push('/admin/store/chat-inbox')">
              <div class="icon-box" slot="start">
                <ion-icon :icon="icons.chatbubblesOutline" />
              </div>
              <ion-label>{{ $t('store.chat.storeMessages') }}</ion-label>
              <ion-badge v-if="unreadChatsCount > 0" color="danger" slot="end" style="border-radius: 8px;">{{ unreadChatsCount }}</ion-badge>
            </ion-item>

            <ion-list-header style="min-height: 32px; padding-bottom: 4px; border-top: 1px solid var(--ion-color-step-100); margin-top: 8px; padding-top: 8px;">
              <ion-label style="font-size: 0.85rem; color: var(--ion-color-carrot); margin-top: 0; text-transform: uppercase;">{{ $t('profile.admin.sections.management') }}</ion-label>
            </ion-list-header>

            <ion-item button @click="goToUsersList">
              <div class="icon-box" slot="start">
                <ion-icon :icon="icons.peopleOutline" />
              </div>
              <ion-label>{{ $t('profile.admin.users') }}</ion-label>
            </ion-item>

            <ion-item button @click="goToMerchantApplications">
              <div class="icon-box" slot="start">
                <ion-icon :icon="icons.storefrontOutline" />
              </div>
              <ion-label>{{ $t('admin.merchant.title') }}</ion-label>
              <ion-badge v-if="pendingMerchantAppsCount > 0" color="danger" slot="end" style="border-radius: 8px;">{{ pendingMerchantAppsCount }}</ion-badge>
            </ion-item>

            <ion-item button @click="goToMasterData">
              <div class="icon-box" slot="start">
                <ion-icon :icon="icons.constructOutline" />
              </div>
              <ion-label>{{ $t('profile.admin.masterData') }}</ion-label>
            </ion-item>

            <ion-list-header style="min-height: 32px; padding-bottom: 4px; border-top: 1px solid var(--ion-color-step-100); margin-top: 8px; padding-top: 8px;">
              <ion-label style="font-size: 0.85rem; color: var(--ion-color-carrot); margin-top: 0; text-transform: uppercase;">{{ $t('profile.admin.sections.system') }}</ion-label>
            </ion-list-header>

            <ion-item button @click="goToPointsLogs">
              <div class="icon-box" slot="start">
                <ion-icon :icon="icons.listOutline" />
              </div>
              <ion-label>{{ $t('profile.admin.pointsLogs') }}</ion-label>
            </ion-item>

            <ion-item button @click="goToScanLogs">
              <div class="icon-box" slot="start">
                <ion-icon :icon="icons.listOutline" />
              </div>
              <ion-label>{{ $t('profile.admin.scanLogs') }}</ion-label>
            </ion-item>

            <ion-item button @click="goToAnalyticsDashboard">
              <div class="icon-box" slot="start">
                <ion-icon :icon="icons.listOutline" />
              </div>
              <ion-label>{{ $t('profile.admin.analytics') }}</ion-label>
            </ion-item>
          </ion-list>
        </ion-card>

        <!-- Information & About Section -->
        <ion-card>
          <ion-list lines="none">
            <ion-list-header style="min-height: 32px; padding-bottom: 4px;">
              <ion-label style="font-size: 0.85rem; color: var(--ion-color-medium); margin-top: 0; text-transform: uppercase;">{{ $t('profile.sections.about') }}</ion-label>
            </ion-list-header>

            <ion-item button @click="goToLegal">
              <div class="icon-box" slot="start">
                <ion-icon :icon="icons.documentTextOutline" />
              </div>
              <ion-label>{{ $t('profile.legal') }}</ion-label>
            </ion-item>

            <ion-item button @click="goToCredits">
              <div class="icon-box" slot="start">
                <ion-icon :icon="icons.peopleOutline" />
              </div>
              <ion-label>{{ $t('profile.credits') }}</ion-label>
            </ion-item>
          </ion-list>
        </ion-card>

        <!-- Support Section -->
        <ion-card>
          <div class="xp-section" style="text-align: center; padding-top: 10px;">
            <h3 style="font-weight: 700; margin-bottom: 12px;">{{ $t('profile.support') }}</h3>
            
            <template v-if="donationProduct">
              <ion-item button style="text-align: left;" @click="donate">
                <ion-label>
                  <strong>{{ donationProduct.title }}</strong>
                  <br/>
                  <small>{{ donationProduct.description }}</small>
                </ion-label>
                <ion-note slot="end">{{ donationProduct.priceString }}</ion-note>
              </ion-item>
            </template>
            
            <template v-else>
              <p style="font-size: 0.85rem; color: var(--ion-color-medium); margin-bottom: 16px;">
                {{ $t('profile.supportDescription') }}
              </p>
              <a href="https://halalformosa.bobaboba.me" target="_blank" class="boba-button" style="margin: 0 auto 16px;">
                <img
                    src="https://s3.ap-southeast-1.amazonaws.com/media.anyonelab.com/images/boba/boba-embed-icon.png"
                    alt="boba-icon"
                    class="boba-img-premium"
                />
                <span class="boba-text-premium">{{ $t('profile.bobaMe') }}</span>
              </a>
              <p class="support-thank" style="font-size: 0.8rem;">{{ $t('profile.supportThank') }}</p>
              <p style="margin-top: 4px;"><small>{{ $t('profile.voluntary') }}</small></p>
            </template>
          </div>
        </ion-card>

        <!-- Social Media Card -->
        <ion-card>
          <div class="social-grid-premium">
            <a class="social-item-premium" @click.prevent="logAndOpen('instagram', 'https://www.instagram.com/halalformosa/')">
              <ion-icon :icon="icons.logoInstagram" class="social-icon-btn" style="color: #E1306C" />
              <span class="social-label-premium">Instagram</span>
            </a>
            
            <a class="social-item-premium" @click.prevent="logAndOpen('line', 'https://line.me/R/ti/p/@975schpu')">
              <img src="/social-logo/line-logo.png" alt="LINE" class="social-img-premium" />
              <span class="social-label-premium">LINE</span>
            </a>
            
            <a class="social-item-premium" @click.prevent="logAndOpen('web', 'https://halalformosa.com')">
              <ion-icon :icon="icons.globeOutline" class="social-icon-btn" style="color: var(--ion-color-carrot)" />
              <span class="social-label-premium">Website</span>
            </a>
          </div>
        </ion-card>

        <!-- App Info (Subtle) -->
        <div class="system-section fade-in">
          <p class="app-info-text">
            {{ $t('profile.appName') }} • v{{ appVersion || '1.0.0' }}
          </p>
          
          <button v-if="userEmail" class="logout-button" @click.prevent="handleLogout">
            <ion-icon :icon="icons.logOutOutline" />
            <span>{{ $t('profile.logout') }}</span>
          </button>
        </div>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref, watch} from "vue";
import {useRouter} from "vue-router";
import {supabase} from "@/plugins/supabaseClient";

// ✅ Ionic components
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonProgressBar,
  IonSkeletonText,
  IonText,
  IonTitle,
  IonToolbar,
  onIonViewWillEnter,
  onIonViewDidEnter
} from "@ionic/vue";
import AppHeader from "@/components/AppHeader.vue";

import {
  constructOutline,
  createOutline,
  documentTextOutline,
  globeOutline,
  listOutline,
  logoInstagram,
  peopleOutline,
  personCircleOutline,
  settingsOutline,
  bookmarkOutline,
  logOutOutline,
  checkmarkCircle,
  chevronDown,
  chevronUp,
  bagHandleOutline,
  chatbubblesOutline,
  storefrontOutline,
  timeOutline,
  closeCircleOutline,
  refreshOutline,
  alertCircleOutline
} from "ionicons/icons";

// ✅ Composables
import {
  donorBadge, 
  isAdmin, 
  loadUserProfile, 
  resetUserProfileState, 
  loadDonorFromCache, 
  editBio, 
  editDOB, 
  editGender, 
  editNationality
} from "@/composables/userProfile";
import {Subscription} from "@supabase/supabase-js";
import {usePoints} from "@/composables/usePoints";
import {xpForLevel} from "@/utils/xp"
import {Capacitor} from "@capacitor/core";

// Services
import {CustomerInfo, Purchases} from "@revenuecat/purchases-capacitor";
import {RevenueCatUI, PAYWALL_RESULT} from '@revenuecat/purchases-capacitor-ui';
import {refreshSubscriptionStatus} from "@/composables/useSubscriptionStatus";
import {toastController} from "@ionic/vue";
import { ActivityLogService } from '@/services/ActivityLogService'
import { MerchantService, MerchantApplication } from '@/services/MerchantService'
import { useI18n } from 'vue-i18n'
import { useNotifier } from "@/composables/useNotifier";

const { t } = useI18n()
const { notifyEvent } = useNotifier();
// const pendingLocationsCount = ref(0)

// Icons for use in template
const icons = {
  closeCircleOutline, 
  timeOutline, 
  storefrontOutline,
  settingsOutline,
  bagHandleOutline,
  listOutline,
  chatbubblesOutline,
  peopleOutline,
  constructOutline,
  documentTextOutline,
  personCircleOutline,
  bookmarkOutline,
  globeOutline,
  logOutOutline,
  checkmarkCircle,
  logoInstagram,
  createOutline,
  refreshOutline,
  alertCircleOutline
}

interface RcProduct {
  identifier: string;
  price: number;
  priceString: string;
  title: string;
  description: string;
  currencyCode?: string;
}


// @ts-expect-error – injected global
const appVersion = __APP_VERSION__;
const isNative = Capacitor.isNativePlatform();
const isStoreUnderConstruction = computed(() => import.meta.env.VITE_STORE_UNDER_CONSTRUCTION === 'true')
const userEmail = ref("");
const userDisplayName = ref("");
const userAvatar = ref("");
const pendingCount = ref(0);
const pendingLocationsCount = ref(0);
const pendingLocationReportsCount = ref(0);
const pendingProductReportsCount = ref(0);
const pendingMerchantAppsCount = ref(0);
const merchantStore = ref<any | null>(null);
const merchantApplication = ref<MerchantApplication | null>(null);

const loadingProfile = ref(true)     // avatar, name, email
const loadingAdmin = ref(false)      // admin-only data

const user = ref<any | null>(null);
const router = useRouter();

const userBio = editBio;
const userNationality = editNationality;
const donationProduct = ref<RcProduct | null>(null);
const paywallOpening = ref(false);
const showBenefits = ref(false);

// ✅ Points composable
const {currentPoints, fetchCurrentPoints} = usePoints();

const customerInfo = ref<CustomerInfo | null>(null)

const entitlement = computed(() =>
    customerInfo.value?.entitlements?.active?.['Halal Formosa Pro'] ?? null
)

const isSubscribed = computed(() => Boolean(entitlement.value))

const willRenew = computed(() => entitlement.value?.willRenew ?? false)

const expirationDate = computed(() => {
  return (
      entitlement.value?.expirationDate ??
      customerInfo.value?.latestExpirationDate ??
      null
  )
})

const needsProfileCompletion = ref(false)

watch(needsProfileCompletion, (v) => {
  if (!v) return

  router.replace({ name: 'EditProfile' })
})


let authSubscription: Subscription | null = null;

const level = computed(() => {
  const points = currentPoints.value || 0
  let lvl = 1

  // ✅ Safety cap to prevent infinite loop if points data is corrupted
  while (points >= xpForLevel(lvl + 1) && lvl < 2000) {
    lvl++
  }
  return lvl
})

const nextLevelXp = computed(() => xpForLevel(level.value + 1))
const prevLevelXp = computed(() => xpForLevel(level.value))

const progressPercent = computed(() => {
  const points = currentPoints.value || 0
  return ((points - prevLevelXp.value) / (nextLevelXp.value - prevLevelXp.value)) * 100
})

const countriesList = ref<any[]>([]);
const resolvedNationality = ref<string | null>(null);
const resolvedFlag = ref<string | null>(null);

const refreshCustomerInfo = async () => {
  const result = await Purchases.getCustomerInfo()
  customerInfo.value = result.customerInfo
}

async function fetchCountries() {
  if (countriesList.value.length > 0) return; // ✅ Cache check
  try {
    const response = await fetch("https://restcountries.com/v3.1/all?fields=name,cca2,flags");
    if (!response.ok) throw new Error("Failed to fetch countries");
    countriesList.value = await response.json();
  } catch (err) {
    console.error("fetchCountries failed:", err);
  }
}

// ✅ Resolve flag when countries list arrives
watch(countriesList, () => {
  if (userNationality.value && countriesList.value.length > 0) {
    const match = countriesList.value.find(c => c.cca2 === userNationality.value);
    if (match) {
      resolvedNationality.value = match.name.common;
      resolvedFlag.value = match.flags.png;
    }
  }
}, { immediate: true });


async function fetchPendingCount() {
  if (!isAdmin.value) {
    pendingCount.value = 0;
    return;
  }

  const {count, error} = await supabase
      .from("products")
      .select("*", {count: "exact", head: true})
      .eq("approved", false);

  if (!error && count !== null) {
    pendingCount.value = count;
  }
}

async function fetchMerchantStore(ownerId: string) {
  const { data, error } = await supabase
    .from("merchant_stores")
    .select("*")
    .eq("user_id", ownerId)
    .maybeSingle();

  if (!error && data) {
    merchantStore.value = data;
  } else {
    merchantStore.value = null;
  }
}

async function fetchPendingLocationsCount() {
  if (!isAdmin.value) return

  const { count } = await supabase
    .from('locations')
    .select('*', { count: 'exact', head: true })
    .eq('approved', false)

  pendingLocationsCount.value = count || 0
}

async function fetchPendingMerchantAppsCount() {
  if (!isAdmin.value) return
  pendingMerchantAppsCount.value = await MerchantService.getPendingApplicationsCount()
}

async function fetchPendingLocationReportsCount() {
  if (!isAdmin.value) return
  const { count } = await supabase
    .from('location_reports')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
  pendingLocationReportsCount.value = count || 0
}

async function fetchPendingProductReportsCount() {
  if (!isAdmin.value) return
  const { count } = await supabase
    .from('product_reports')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
  pendingProductReportsCount.value = count || 0
}

const renewalMessage = computed(() => {
  if (!entitlement.value) return ''

  return willRenew.value
      ? t('profile.pro.renew')
      : t('profile.pro.noRenew')
})

const formattedExpirationDate = computed(() => {
  if (!expirationDate.value) return '—'

  return new Date(expirationDate.value).toLocaleDateString(useI18n().locale.value, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

const openManageSubscription = () => {
  const url = customerInfo.value?.managementURL
  if (url) {
    window.open(url, '_blank')
  }
}

const isSyncing = ref(false);

async function refreshAllData(userId: string) {
  if (isSyncing.value) return;
  isSyncing.value = true;
  try {
    // Authorized profile and points fetch in parallel
    await Promise.all([
      loadUserProfile(userId),
      fetchCurrentPoints(userId),
      fetchMerchantStore(userId),
      (async () => {
        merchantApplication.value = await MerchantService.getUserApplication()
      })(),
      (async () => {
        if (isAdmin.value) {
          await Promise.all([
            fetchPendingCount(),
            fetchPendingLocationsCount(),
            fetchPendingMerchantAppsCount(),
            fetchPendingLocationReportsCount(),
            fetchPendingProductReportsCount()
          ])
        }
      })()
    ]);

    // Check for profile completion
    if (!editDOB.value || !editNationality.value || !editGender.value) {
      needsProfileCompletion.value = true;
    }
  } finally {
    isSyncing.value = false;
    loadingProfile.value = false;
  }
}

// ✅ Always refresh when ProfileView becomes active
onIonViewWillEnter(async () => {
  const { data } = await supabase.auth.getUser()
  if (!data?.user) return
  
  refreshAllData(data.user.id);
})

onIonViewDidEnter(async () => {
  const { data } = await supabase.auth.getUser()
  if (!data?.user) return

  if (isNative) {
    refreshCustomerInfo().catch(() => {});
  }

  ActivityLogService.log('profile_page_open', {
    user_id: data.user.id
  }).catch(() => {});
})


async function logRevenueCatStatus() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    console.log("[RC] Fetching customer info...");
    const {customerInfo} = await Purchases.getCustomerInfo();

    const entitlement = customerInfo.entitlements.active["Halal Formosa Pro"];

    if (entitlement) {
      console.log("[RC] Entitlement ACTIVE:", entitlement);
    } else {
      console.log("[RC] Entitlement NOT active");
    }
  } catch (err) {
    console.error("[RC] Error fetching customer info:", err);
  }
}


onMounted(async () => {
  try {
    fetchCountries();

    const {data} = await supabase.auth.getUser();
    if (data?.user) {
      user.value = data.user;
      userEmail.value = user.value.email || "";
      userDisplayName.value = user.value.user_metadata?.full_name || user.value.user_metadata?.display_name || "";
      userAvatar.value = user.value.user_metadata?.avatar_url || "";
      
      refreshAllData(user.value.id);
    }

    const {
      data: {subscription: authSub},
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session?.user) {
        resetUserProfileState();
        userEmail.value = "";
        userDisplayName.value = "";
        userAvatar.value = "";
        currentPoints.value = null;
        merchantStore.value = null;
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const u = session.user;
        userEmail.value = u.email || "";
        userDisplayName.value = u.user_metadata?.full_name || u.user_metadata?.display_name || "";
        userAvatar.value = u.user_metadata?.avatar_url || "";

        loadDonorFromCache(u.id);
        refreshAllData(u.id);

        if (isAdmin.value) {
          fetchPendingCount();
          fetchPendingLocationsCount();
          fetchPendingLocationReportsCount();
          fetchPendingProductReportsCount();
        }
        
        fetchPendingOrdersCount();
        fetchUnreadChatsCount();
      }
    });

    authSubscription = authSub;
    logRevenueCatStatus();
  } catch (err) {
    console.error("Error in onMounted:", err);
  } finally {
    loadingProfile.value = false;
    loadingAdmin.value = false;
  }
});

async function donate() {
  ActivityLogService.log('donation_click', {
    product: donationProduct.value?.identifier ?? null
  })

  const offerings = await Purchases.getOfferings();

  if (!offerings.current) return;

  const pkg = offerings.current.availablePackages.find(
      (p) => p.identifier === "small_support"
  );

  if (!pkg) return;

  try {
    await Purchases.purchasePackage({aPackage: pkg});
    alert(t('profile.supportSuccess'));

    ActivityLogService.log('donation_success', {
      product: donationProduct.value?.identifier ?? null
    })

  } catch (err) {
    console.error("Donation failed:", err);
  }
}

async function presentPaywall(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.warn("[RC] Paywall can only run on native (Android/iOS).");
    return false;
  }

  try {
    console.log("[RC] Presenting Paywall...");

    const {result} = await RevenueCatUI.presentPaywall();

    console.log("[RC] Paywall Result:", result);

    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
        console.log("[RC] 🎉 User purchased subscription!");
        return true;

      case PAYWALL_RESULT.RESTORED:
        console.log("[RC] 🔄 Subscription restored!");
        return true;

      case PAYWALL_RESULT.CANCELLED:
        console.log("[RC] User cancelled paywall.");
        return false;

      case PAYWALL_RESULT.ERROR:
        console.log("[RC] Paywall error.");
        return false;

      case PAYWALL_RESULT.NOT_PRESENTED:
      default:
        console.log("[RC] Paywall not presented.");
        return false;
    }

  } catch (e) {
    console.error("[RC] Paywall failed:", e);
    return false;
  }
}

async function ensureRevenueCatLoggedIn() {
  if (!Capacitor.isNativePlatform()) return

  const {data} = await supabase.auth.getUser()
  if (!data?.user) return

  await Purchases.logIn({
    appUserID: data.user.id
  })

  console.log("🔐 RevenueCat logged in as:", data.user.id)
}

function logAndOpen(platform: string, url: string) {
  // 🔓 Open immediately (keeps browser happy)
  window.open(url, '_blank')

  // 🧾 Log asynchronously (no await)
  ActivityLogService.log('social_link_click', {
    platform
  }).catch(() => {
    /* silent */
  })
}

function goToSavedItems() {
  router.push('/profile/saved-items')
}

async function openProPaywall() {
  ActivityLogService.log('pro_paywall_open')

  // ⛔ Web / PWA guard
  if (!Capacitor.isNativePlatform()) {
    const toast = await toastController.create({
      message: t('profile.pro.nativeOnly'),
      duration: 2000,
      color: "medium",
      position: "bottom",
    });
    await toast.present();
    return;
  }

  if (paywallOpening.value) return;
  paywallOpening.value = true;

  try {
    // 🔐 Safe to continue (native only)
    await ensureRevenueCatLoggedIn();

    const purchased = await presentPaywall();
    if (!purchased) return; // ✅ safe now

    // 🔄 Refresh subscription state
    await refreshCustomerInfo();
    await refreshSubscriptionStatus({syncToServer: true});

    // 🔓 Yield back to Ionic
    await new Promise(resolve => setTimeout(resolve, 300));

    // 🔁 Soft app "restart"
    await router.replace('/profile'); // 👈 see note below

    // ✅ Success feedback
    const toast = await toastController.create({
      message: t('profile.pro.purchaseSuccess'),
      duration: 2500,
      color: "success",
      position: "bottom",
    });
    await toast.present();

    ActivityLogService.log('pro_purchase_success', {
      entitlement: 'Halal Formosa Pro'
    })

    await notifyEvent(
      'pro_purchase_success',
      '💎 New Pro Member!',
      `User ${userEmail.value} has just subscribed to Halal Formosa Pro!`,
      undefined,
      {
        source: 'profile_view',
        email: userEmail.value,
        user_id: user.value?.id
      },
      ['discord']
    ).catch(console.error);

  } finally {
    // 🔓 ALWAYS release the lock
    paywallOpening.value = false;
  }
}

onBeforeUnmount(() => {
  if (authSubscription) {
    authSubscription.unsubscribe();
    authSubscription = null;
  }
});

// Actions
const handleLogout = async () => {
  ActivityLogService.log('profile_logout')

  const {error} = await supabase.auth.signOut();
  if (!error) {
    userEmail.value = "";
    currentPoints.value = null; // reset points
    router.push("/login");
  }
};
const goToReviewSubmissions = () => router.push("/admin/review-products");
const goToReviewLocations = () => router.push('/admin/review-locations')
const goToLogin = () => router.push("/login");
const goToSettings = () => router.push("/settings");
const goToLegal = () => router.push("/legal");
const goToCredits = () => router.push("/credits");
const goToPointsLogs = () => router.push("/admin/points-logs");
const goToUsersList = () => router.push("/admin/users");
const goToMerchantApplications = () => router.push("/admin/merchant/applications");
const goToLocationReports = () => router.push('/admin/location-reports')
const goToProductReports = () => router.push('/admin/product-reports')

const goToAnalyticsDashboard = () => router.push("/admin/analytics");
const goToScanLogs = () => router.push("/admin/scan-logs");

const goToEditProfile = () => {
  ActivityLogService.log('profile_edit_open')
  router.push({ name: "EditProfile" })
}

const goToMasterData = () => router.push('/admin/master-data')
const goToStoreOrders = () => router.push('/admin/store/orders')
const goToMerchantRegistration = () => router.push('/merchant/register')
const pendingOrdersCount = ref(0)
const unreadChatsCount = ref(0)

async function fetchPendingOrdersCount() {
  const isGlobalAdmin = isAdmin.value
  let query = supabase
    .from('store_orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
  
  if (!isGlobalAdmin && merchantStore.value) {
    query = query.eq('store_id', merchantStore.value.id)
  } else if (!isGlobalAdmin && !merchantStore.value) {
    pendingOrdersCount.value = 0
    return
  }

  const { count } = await query
  pendingOrdersCount.value = count || 0
}

async function fetchUnreadChatsCount() {
  const isGlobalAdmin = isAdmin.value
  let query = supabase
    .from('store_chat_conversations')
    .select('store_unread')
    .gt('store_unread', 0)
  
  if (!isGlobalAdmin && merchantStore.value) {
    query = query.eq('store_id', merchantStore.value.id)
  } else if (!isGlobalAdmin && !merchantStore.value) {
    unreadChatsCount.value = 0
    return
  }

  const { data } = await query
  unreadChatsCount.value = data?.length || 0
}

</script>


<style scoped>
/* Gradients used across component */
.profile-header-premium, .xp-section {
  --primary-gradient: linear-gradient(135deg, var(--ion-color-carrot-tint), var(--ion-color-carrot));
  --accent-gradient: linear-gradient(135deg, #ff9f43, var(--ion-color-carrot));
}

/* Profile Header Section */
.profile-header-premium {
  padding: 32px 16px 24px;
  text-align: center;
  position: relative;
}

.avatar-container {
  position: relative;
  width: 120px;
  height: 120px;
  margin: 0 auto 16px;
}

.avatar-premium {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 4px solid var(--ion-color-carrot);
  object-fit: cover;
  position: relative;
  z-index: 1;
  box-shadow: 0 4px 12px rgba(var(--ion-color-carrot-rgb), 0.3);
}

.profile-info {
  margin-top: 12px;
}

.profile-name-main {
  font-size: 1.6rem;
  font-weight: 800;
  margin: 0;
  background: linear-gradient(to bottom, var(--ion-color-carrot), var(--ion-color-carrot-shade));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.profile-email-sub {
  font-size: 0.9rem;
  color: var(--ion-color-medium);
  margin: 4px 0 16px;
}

.badge-pro {
  --background: var(--accent-gradient);
  --color: #fff;
  padding: 6px 12px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.5px;
  box-shadow: 0 4px 12px rgba(230, 126, 34, 0.3);
}

/* XP Visualization */
.xp-section {
  padding: 20px;
}

.xp-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 12px;
}

.level-badge {
  background: var(--primary-gradient);
  padding: 8px 16px;
  border-radius: 16px;
  color: #fff;
}

.level-num {
  font-size: 1.4rem;
  font-weight: 900;
}

.level-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  opacity: 0.8;
  display: block;
}

.xp-total {
  text-align: right;
}

.xp-val {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--ion-color-carrot);
}

.xp-next {
  font-size: 0.7rem;
  color: var(--ion-color-step-500);
  display: block;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.progress-container {
  height: 12px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 6px;
  overflow: hidden;
  position: relative;
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.ion-palette-dark .progress-container {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.08);
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--ion-color-carrot-tint), var(--ion-color-carrot));
  border-radius: 6px;
  transition: width 1s ease-out;
  box-shadow: 
    0 0 10px rgba(var(--ion-color-carrot-rgb), 0.5),
    0 0 20px rgba(var(--ion-color-carrot-rgb), 0.3);
  position: relative;
  overflow: hidden;
}

.progress-bar-fill::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.25), transparent);
}

/* Menu List Styling */
ion-item {
  --padding-start: 16px;
  --padding-end: 16px;
  --inner-padding-top: 12px;
  --inner-padding-bottom: 12px;
}

.icon-box {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  background: rgba(var(--ion-color-carrot-rgb), 0.1);
  border: 1px solid rgba(var(--ion-color-carrot-rgb), 0.1);
}

.icon-box ion-icon {
  font-size: 20px;
  color: var(--ion-color-carrot);
}

/* Social Media */
.social-grid-premium {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 16px;
}

.social-item-premium {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  text-decoration: none;
  transition: all 0.2s ease;
}

.social-item-premium:active {
  background: rgba(var(--ion-color-dark-rgb), 0.1);
  transform: translateY(2px);
}

.social-img-premium {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.social-icon-btn {
  font-size: 24px;
}

/* Boba Button Styling */
.boba-button {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #5d4037;
  border: none;
  padding: 12px 20px;
  border-radius: 16px;
  text-decoration: none;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  max-width: fit-content;
}

.boba-button:active {
  transform: scale(0.95);
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.boba-img-premium {
  height: 24px;
  width: auto;
  margin-right: 10px;
}
/* Engaging Pro Upgrade UI */
.pro-upgrade-engaging {
  padding: 24px 16px;
  text-align: center;
  position: relative;
  z-index: 1;
}

.pro-header-engaging {
  margin-bottom: 20px;
}

.pro-icon-hero {
  background: rgba(255, 215, 0, 0.15);
  width: 64px;
  height: 64px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
  box-shadow: 0 4px 12px rgba(250, 204, 21, 0.2);
}

.pro-icon-hero ion-icon {
  font-size: 32px;
  color: #ca8a04;
}

.pro-title-engaging {
  font-size: 1.5rem;
  font-weight: 800;
  margin: 0;
  color: #ca8a04;
}

.pro-subtitle-engaging {
  font-size: 0.95rem;
  font-weight: 600;
  color: #92400e;
  margin: 4px 0 0;
}

.pro-benefits-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-bottom: 24px;
}

.benefit-chip {
  background: rgba(255, 215, 0, 0.1);
  border: 1px solid rgba(250, 204, 21, 0.2);
  padding: 6px 12px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #78350f;
}

.benefit-chip ion-icon {
  color: #ca8a04;
  font-size: 14px;
}

.pro-action-footer {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Subscribed Pro Banner */
.pro-active-banner {
  padding: 24px;
  background: linear-gradient(135deg, rgba(250, 204, 21, 0.08) 0%, rgba(217, 119, 6, 0.12) 100%);
  border-radius: 20px;
  position: relative;
  overflow: hidden;
}

.pro-active-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.pro-active-title-group {
  display: flex;
  gap: 16px;
  align-items: center;
}

.pro-active-icon {
  width: 48px;
  height: 48px;
  background: var(--ion-color-carrot);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(var(--ion-color-carrot-rgb), 0.3);
}

.pro-active-icon ion-icon {
  font-size: 24px;
  color: white;
}

.pro-active-title-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pro-active-title {
  font-size: 1.25rem;
  font-weight: 800;
  margin: 0;
  color: var(--ion-color-carrot-shade);
}

.pro-status-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--ion-color-success-tint);
  color: var(--ion-color-success-shade);
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  width: fit-content;
}

.pro-manage-btn {
  --border-radius: 10px;
  --border-color: var(--ion-color-step-300);
  --color: var(--ion-color-step-600);
  margin: 0;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-size: 0.7rem;
}

.pro-active-footer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 16px;
  border-top: 1px solid rgba(var(--ion-color-carrot-rgb), 0.1);
}

.pro-detail-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  font-weight: 600;
}

.pro-detail-item ion-icon {
  font-size: 18px;
  min-width: 18px;
}

.ion-palette-dark .pro-active-banner {
  background: linear-gradient(135deg, rgba(250, 204, 21, 0.05) 0%, rgba(217, 119, 6, 0.08) 100%);
}

.ion-palette-dark .pro-active-title {
  color: white;
}

.ion-palette-dark .pro-status-chip {
  background: rgba(var(--ion-color-success-rgb), 0.2);
  color: var(--ion-color-success-tint);
}

.ion-palette-dark .pro-manage-btn {
  --border-color: rgba(255, 255, 255, 0.1);
  --color: var(--ion-color-step-400);
}


.pro-big-buy-button {
  --background: linear-gradient(135deg, #f59e0b, #d97706);
  --background-activated: linear-gradient(135deg, #d97706, #b45309);
  --color: white;
  --box-shadow: 0 8px 20px rgba(217, 119, 6, 0.4);
  --border-radius: 16px;
  height: 54px;
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  margin: 0;
}

.benefit-toggle-text {
  background: transparent;
  border: none;
  color: #92400e;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  text-decoration: underline;
  opacity: 0.8;
}

.benefit-toggle-text:active {
  opacity: 1;
}

/* Dark Mode Overrides */
.ion-palette-dark .pro-title-engaging {
  color: #fde68a;
}

.ion-palette-dark .pro-subtitle-engaging {
  color: #fde68a;
  opacity: 0.9;
}

.ion-palette-dark .benefit-chip {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  color: #fef3c7;
}

.ion-palette-dark .benefit-toggle-text {
  color: #fde68a;
}

.gold-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at top right, rgba(255, 215, 0, 0.3), transparent 70%),
              radial-gradient(circle at bottom left, rgba(255, 100, 0, 0.1), transparent 50%);
  pointer-events: none;
  z-index: 0;
}
.boba-text-premium {
  color: white;
  font-weight: 800;
  font-size: 1rem;
}

.social-label-premium {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--ion-color-medium);
}


@media (prefers-color-scheme: light) {
  .profile-name-main {
    background: linear-gradient(to bottom, var(--ion-color-carrot), var(--ion-color-carrot-shade));
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}

/* System Section & Logout */
.system-section {
  margin: 40px 16px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.app-info-text {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  margin: 0;
  opacity: 0.7;
}

.logout-button {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(var(--ion-color-danger-rgb), 0.08);
  color: var(--ion-color-danger);
  border: 1px solid rgba(var(--ion-color-danger-rgb), 0.15);
  padding: 12px 24px;
  border-radius: 14px;
  font-size: 0.95rem;
  font-weight: 700;
  transition: all 0.2s ease;
  cursor: pointer;
}

.logout-button ion-icon {
  font-size: 1.2rem;
}

.logout-button:active {
  background: rgba(var(--ion-color-danger-rgb), 0.15);
  transform: scale(0.97);
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 0.3; }
  50% { transform: scale(1.05); opacity: 0.5; }
  100% { transform: scale(1); opacity: 0.3; }
}

/* Animations */
.fade-in {
  animation: fadeIn 0.8s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Skeletons */
.skeleton-avatar-premium {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  margin: 0 auto 16px;
}

.skeleton-text-center {
  margin: 0 auto 8px;
  border-radius: 4px;
}

/* Overrides */
ion-toolbar {
  --background: transparent;
  --border-width: 0;
}

ion-header {
  background: transparent;
}

/* Vendor Onboarding & Consistency Improvements */
.vendor-onboarding.pending {
  padding: 16px;
  background: linear-gradient(135deg, rgba(var(--ion-color-carrot-rgb), 0.05) 0%, rgba(var(--ion-color-secondary-rgb), 0.05) 100%);
}

.vendor-onboarding-item {
  --padding-start: 16px;
  --padding-end: 16px;
  --padding-top: 12px;
  --padding-bottom: 12px;
  --background: transparent;
  margin: 0;
}

.icon-box-vendor {
  background: rgba(var(--ion-color-carrot-rgb), 0.1);
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
  transition: all 0.2s ease;
}

.icon-box-vendor ion-icon {
  font-size: 24px;
}

.vendor-title-label {
  font-weight: 800;
  font-size: 1.1rem;
  margin-bottom: 2px;
  color: var(--ion-color-carrot);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.vendor-subtitle-label {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  margin: 0;
}

.pending-status-box {
  display: flex;
  align-items: center;
  gap: 16px;
}

.icon-pulse {
  background: rgba(var(--ion-color-carrot-rgb), 0.1);
  padding: 12px;
  border-radius: 12px;
  animation: pulse 2s infinite ease-in-out;
}

.icon-pulse ion-icon {
  font-size: 24px;
}

.icon-pulse-red {
  background: rgba(var(--ion-color-danger-rgb), 0.1);
  padding: 12px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rejection-reason-box {
  margin-top: 12px;
  padding: 12px;
  background: rgba(var(--ion-color-danger-rgb), 0.05);
  border-left: 3px solid var(--ion-color-danger);
  border-radius: 12px;
  text-align: left;
}

.rejection-reason-box strong {
  display: block;
  font-size: 0.8rem;
  color: var(--ion-color-danger);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.rejection-reason-box p {
  margin: 0;
  font-size: 0.95rem;
  color: var(--ion-color-dark);
  line-height: 1.4;
}

.status-text h3 {
  font-weight: 700;
  margin: 0 0 2px;
  font-size: 1rem;
}

.status-text p {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  margin: 0;
  line-height: 1.2;
}

.construction-text-small {
  color: var(--ion-color-warning-shade);
  font-size: 0.75rem;
  font-weight: 600;
  margin-top: 4px;
}
</style>
