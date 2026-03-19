<template>
  <ion-page>
   <ion-header class="ion-no-border immersive-header" :class="{ 'is-scrolled': isScrolled }">
       <app-header
           :title="$t('explore.details.title')"
           show-back
           :useRouterBack="true"
           :backRoute="'/explore'"
           :icon="mapOutline"
           :transparent="!isScrolled"
           :contrast="!isScrolled"
       >
         <template #actions>
           <ion-item v-if="canEdit" button @click="editItem" lines="none">
             <ion-icon :icon="createOutline" slot="start"/>
             <ion-label>{{ $t('search.details.edit') }}</ion-label>
           </ion-item>

           <ion-item button @click="reportItem" lines="none">
             <ion-icon :icon="alertCircleOutline" slot="start"/>
             <ion-label>{{ $t('search.details.report') }}</ion-label>
           </ion-item>

           <ion-item button @click="share" lines="none">
             <ion-icon :icon="shareSocialOutline" slot="start"/>
             <ion-label>{{ $t('search.details.share') }}</ion-label>
           </ion-item>
         </template>
       </app-header>
     </ion-header>

    <ion-content :scroll-events="true" @ionScroll="handleScroll" fullscreen>
      <div v-if="!loading && place">
        <!-- 🖼️ Image carousel (Swiper) -->
        <Swiper
            v-if="place.image"
            :modules="modules"
            :zoom="true"
            :slides-per-view="1"
            :pagination="{ clickable: true }"
            class="place-swiper"
        >
          <SwiperSlide>
            <img
                :src="place?.image || 'https://placehold.co/200x100'"
                alt="Place image"
                style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;"
                @click="openImageModal"
            />
          </SwiperSlide>
        </Swiper>

        <!-- 📍 Location Info Section -->
        <div 
          :class="[
            'details-container', 
            place?.partner_tier ? 'tier-' + place.partner_tier.toLowerCase() : ''
          ]"
        >
          <!-- Premium Flare for Gold/Silver -->
          <div v-if="['gold', 'silver'].includes(String(place?.partner_tier || '').toLowerCase())" class="premium-flare"></div>

          <div class="ion-padding" style="position: relative; z-index: 2;">
            <div class="title-row">
              <h2 class="product-title">{{ place?.name }}</h2>
              <div v-if="place?.partner_tier" class="premium-badge-wrapper">
                <div :class="['premium-badge-pill', place.partner_tier.toLowerCase()]">
                  <ion-icon :icon="sparkles" />
                  <span>{{ place.partner_tier.toUpperCase() }}</span>
                </div>
              </div>
            </div>

            <div class="status-action-row">
              <ion-chip color="carrot" class="capitalize">{{ place?.type }}</ion-chip>
              <div v-if="place?.partner_tier" class="official-verified-tag">
                <ion-icon :icon="shieldCheckmarkOutline" />
                <span>OFFICIAL PARTNER</span>
              </div>
            </div>

            <p v-if="place?.author?.public_profile" class="attribution-text">
              {{ $t('home.addedBy', { author: place.author.display_name }) }} - {{ fromNowToTaipei(place.created_at) }}
            </p>
            <p v-else class="attribution-text">
              {{ $t('home.added') }} {{ fromNowToTaipei(place.created_at) }}
            </p>

            <!-- Certified By (Gold Partner) -->
            <div
                v-if="!loadingCertifications && certifications.length"
                class="ion-margin-top"
            >
              <p class="section-title">
                <strong><small>Certified by</small></strong>
              </p>

              <div
                  v-for="c in certifications"
                  :key="c.partner.id"
                  class="gold-cert-card"
                  role="button"
                  tabindex="0"
                  @click="goToPartner(c.partner.id)"
              >
                <div class="gold-glow"></div>

                <div class="gold-cert-content">
                  <div class="gold-cert-left">
                    <img
                        v-if="c.partner.logo_url"
                        :src="c.partner.logo_url"
                        alt="logo"
                        class="gold-cert-logo"
                    />

                    <div class="gold-cert-text">
                      <div class="gold-cert-name">
                        {{ c.partner.name }}
                      </div>
                      <div class="premium-verified-tag">
                        <ion-icon :icon="sparkles" />
                        Verified Gold Partner
                      </div>
                    </div>
                  </div>

                  <!-- RIGHT SIDE ACTION -->
                  <ion-button
                      v-if="c.proof_url"
                      fill="clear"
                      size="small"
                      color="carrot"
                      @click.stop
                      :href="c.proof_url"
                      target="_blank"
                      aria-label="View certificate"
                  >
                    <ion-icon slot="icon-only" :icon="documentTextOutline" />
                  </ion-button>
                </div>
              </div>
            </div>


          <!-- 📝 Description -->
          <template v-if="place.description">
            <ion-item lines="none">
              <ion-icon :icon="documentTextOutline" slot="start" color="carrot"/>

              <ion-label>
                <p class="text-sm text-gray-500">Description</p>
                <p style="white-space: pre-line;">
                  {{ place.description }}
                </p>
              </ion-label>
            </ion-item>
          </template>


          <!-- 📍 Address -->
          <ion-item lines="none">
            <ion-icon :icon="navigateOutline" slot="start" color="carrot"/>

            <ion-label>
              <p class="text-sm text-gray-500">Address</p>
              <p>{{ place.address || 'No address available' }}</p>
            </ion-label>

            <ion-button
                fill="clear"
                size="small"
                color="carrot"
                @click="logOpenMaps"
                :href="`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`"
                target="_blank"
            >
              Open
            </ion-button>
          </ion-item>


          <!-- 🗺️ Mini Map -->
          <div class="rounded-xl overflow-hidden ion-margin-vertical shadow-md">
            <iframe
                :src="`https://maps.google.com/maps?q=${place.lat},${place.lng}&z=16&output=embed`"
                width="100%"
                height="200"
                style="border:0;"
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>

          <!-- ⭐ Additional Details -->
          <div class="ion-margin-vertical">
            <!-- 🕒 Opening Hours -->
            <template v-if="place.opening_hours">
              <h3 class="font-bold text-lg ion-margin-top">Opening Hours</h3>

              <ion-list>
                <ion-item v-for="(value, day) in formattedOpeningHours" :key="day">
                  <ion-label class="capitalize">{{ day }}</ion-label>
                  <ion-label slot="end" class="ion-text-right">
          <span v-if="value.active">
            {{ value.open }} – {{ value.close }}
          </span>
                    <span v-else class="text-gray-400">Closed</span>
                  </ion-label>
                </ion-item>
              </ion-list>
            </template>

            <!-- 📞 Contact Info -->
            <template v-if="place.phone || place.instagram || place.line_id">
              <h3 class="font-bold text-lg ion-margin-top">Additional Details</h3>

              <ion-item lines="none" v-if="place.phone">
                <ion-icon :icon="callOutline" slot="start" color="carrot"/>
                <ion-label>
                  <p class="text-sm text-gray-500">Phone</p>
                  <p>{{ place.phone }}</p>
                </ion-label>

                <ion-button
                    fill="clear"
                    color="carrot"
                    @click="logCall"
                    :href="`tel:${place.phone}`"
                >
                  Call
                </ion-button>
              </ion-item>


              <ion-item lines="none" v-if="place.instagram">
                <ion-icon :icon="logoInstagram" slot="start" color="carrot"/>
                <ion-label>
                  <p class="text-sm text-gray-500">Instagram</p>
                  <p>@{{ place.instagram.replace('@', '') }}</p>
                </ion-label>
                <ion-button
                    fill="clear"
                    size="small"
                    @click="logInstagram"
                    :href="`https://instagram.com/${place.instagram.replace('@','')}`"
                    target="_blank">
                  Open
                </ion-button>
              </ion-item>

              <ion-item lines="none" v-if="place.line_id">
                <ion-icon :icon="chatboxEllipsesOutline" slot="start" color="carrot"/>
                <ion-label>
                  <p class="text-sm text-gray-500">LINE ID</p>
                  <p>{{ place.line_id }}</p>
                </ion-label>

                <ion-button
                    fill="clear"
                    size="small"
                    @click="logLine"
                    :href="`line://ti/p/~${place.line_id}`">
                  Open
                </ion-button>

              </ion-item>

            </template>

            <!-- 💰 Price Range -->
            <template v-if="place.price_range">
              <ion-item lines="none">
                <ion-icon :icon="cashOutline" slot="start" color="carrot"/>
                <ion-label>
                  <p class="text-sm text-gray-500">Estimated Price</p>
                  <p>{{ place.price_range }}</p>
                </ion-label>
              </ion-item>
            </template>

          </div>
          </div>
          </div>
        </div>

      <!-- Skeleton while loading -->
      <div v-else>
        <ion-skeleton-text
            animated
            style="width:100%;height:300px;margin-bottom:12px;"
        />
        <ion-skeleton-text animated style="width:80%;height:20px;margin-bottom:8px;"/>
        <ion-skeleton-text animated style="width:60%;height:16px;margin-bottom:8px;"/>
      </div>
    </ion-content>

    <!-- 🟢 Fullscreen image modal -->
    <ion-modal :is-open="showImageModal" @didDismiss="closeImageModal">
      <ion-content fullscreen>
        <ion-button
            fill="solid"
            color="carrot"
            class="image-modal-close-btn"
            @click="closeImageModal"
        >
          ✕
        </ion-button>

        <Swiper
            :modules="[Zoom]"
            :zoom="true"
            :slides-per-view="1"
            class="fullscreen-swiper"
        >
          <SwiperSlide>
            <div class="swiper-zoom-container">
              <img :src="place?.image || 'https://placehold.co/200x100'" alt="Place Image"/>
            </div>
          </SwiperSlide>
        </Swiper>
      </ion-content>
    </ion-modal>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonContent,
  IonSkeletonText,
  IonIcon,
  IonItem,
  IonLabel,
  IonModal,
  IonButton, IonHeader, IonChip,
  IonList,
  popoverController
} from '@ionic/vue'
import {ref, onMounted, computed} from 'vue'
import {useI18n} from 'vue-i18n'
import {onIonViewWillEnter} from '@ionic/vue'
import {useRoute, useRouter} from 'vue-router'
import {supabase} from '@/plugins/supabaseClient'
import {Share} from '@capacitor/share'
import {Swiper, SwiperSlide} from 'swiper/vue'
import {Pagination, Zoom} from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/zoom'
import AppHeader from '@/components/AppHeader.vue'
import {
  alertCircleOutline, callOutline, cashOutline, chatboxEllipsesOutline,
  createOutline, documentTextOutline, logoInstagram,
  mapOutline,
  navigateOutline,
  shareSocialOutline,
  sparkles,
  shieldCheckmarkOutline
} from 'ionicons/icons'
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

function fromNowToTaipei(dateString?: string) {
  if (!dateString) return ''
  return dayjs.utc(dateString).tz('Asia/Taipei').fromNow()
}

import {ActivityLogService} from "@/services/ActivityLogService";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"

type OpeningHours = {
  [key: string]: {
    active: boolean
    open: string
    close: string
  }
}

type PlaceDetail = {
  id: number
  name: string
  lat: number
  lng: number
  image?: string | null
  address?: string | null
  description?: string | null
  type: string
  location_types: { name: string } | null
  phone?: string | null
  instagram?: string | null
  line_id?: string | null
  price_range?: string | null
  opening_hours?: OpeningHours | null
  created_at?: string
  author?: {
    display_name: string | null;
    public_profile: boolean;
  } | null;
  partner_tier?: 'Gold' | 'Silver' | 'Bronze' | null;
}

type LocationCertification = {
  certified_at: string | null
  proof_url?: string | null
  partner: {
    id: string
    name: string
    logo_url: string | null
    partner_tier: 'gold' | 'silver' | 'bronze' | null
    verified: boolean
  }
}


const certifications = ref<LocationCertification[]>([])
const loadingCertifications = ref(false)

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const place = ref<PlaceDetail | null>(null)
const canEdit = ref(false)
const modules = [Pagination, Zoom]

const isScrolled = ref(false)
const handleScroll = (ev: any) => {
  isScrolled.value = ev.detail.scrollTop > 80
}

const showImageModal = ref(false)

function openImageModal() {
  if (place.value) {
    ActivityLogService.log("explore_detail_open_image", {
      id: place.value.id,
      name: place.value.name
    });
  }
  showImageModal.value = true
}


function closeImageModal() {
  showImageModal.value = false
}

const loading = ref(true)

const formattedOpeningHours = computed(() => {
  if (!place.value?.opening_hours) return {}

  const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
  const labels = {
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun",
  }

  const result: any = {}
  order.forEach(day => {
    const key = day as DayKey
    if (place.value?.opening_hours?.[key]) {
      result[labels[key]] = place.value.opening_hours[key]
    }
  })

  return result
})


const loadPlace = async () => {
  loading.value = true

  const {data, error} = await supabase
      .from('locations')
      .select(`
    id,
    name,
    lat,
    lng,
    image,
    address,
    description,
    created_by,
    phone,
    instagram,
    line_id,
    price_range,
    opening_hours,
    created_at,
    location_types(name),
    partner:partners(partner_tier)
  `)
      .eq('id', route.params.id)
      .maybeSingle()

  if (error) {
    console.error(error)
    return
  }

  if (data) {
    const locationType = Array.isArray(data.location_types)
        ? data.location_types[0]
        : data.location_types

    place.value = {
      id: data.id,
      name: data.name,
      image: data.image,
      type: locationType?.name ?? 'Halal Location',
      lat: data.lat,
      lng: data.lng,
      address: data.address,
      description: data.description,
      phone: data.phone,
      instagram: data.instagram,
      line_id: data.line_id,
      price_range: data.price_range,
      opening_hours: data.opening_hours,
      created_at: data.created_at,
      author: null,
      location_types: locationType ?? null,
      partner_tier: Array.isArray(data.partner) ? data.partner[0]?.partner_tier : (data.partner as any)?.partner_tier
    }

    // 🔹 Fetch author details separately since join is missing in schema
    if (data.created_by) {
      const { data: authorData } = await supabase
        .from('user_profiles')
        .select('display_name, public_profile')
        .eq('id', data.created_by)
        .maybeSingle()
      
      if (authorData && place.value) {
        place.value.author = authorData
      }
    }

    await fetchLocationCertifications(data.id)


    // 🔹 Check if the current user can edit
    const {data: {user}} = await supabase.auth.getUser()
    if (user) {
      // Check if user is the creator or an admin/contributor
      const {data: roleData} = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single()

      if (
          user.id === data.created_by ||
          roleData?.role === 'admin' ||
          roleData?.role === 'contributor'
      ) {
        canEdit.value = true
      }
    }

    await ActivityLogService.log("explore_place_detail_view", {
      id: data.id,
      name: data.name,
      type: locationType?.name ?? null
    });
  }

  loading.value = false
}

async function fetchLocationCertifications(locationId: number) {
  loadingCertifications.value = true

  const { data, error } = await supabase
      .from('location_certifications')
      .select(`
    certified_at,
    proof_url,
    partners:partner_id (
      id,
      name,
      logo_url,
      partner_tier,
      verified
    )
  `)
      .eq('location_id', locationId)
      .eq('status', 'active')



  if (!error && data) {
    certifications.value = data
        .map(c => {
          const body = Array.isArray(c.partners)
              ? c.partners[0]
              : c.partners

          if (!body) return null

          return {
            certified_at: c.certified_at ?? null,
            proof_url: c.proof_url ?? null,
            partner: body
          }
        })
        .filter(c => c !== null)
        .filter(c => c.partner.partner_tier === 'gold')
  }

  loadingCertifications.value = false
}

// Run once and every time view re-enters
onMounted(loadPlace)
onIonViewWillEnter(loadPlace)

const logInstagram = () => {
  if (!place.value) return;
  ActivityLogService.log("explore_detail_instagram", {
    id: place.value.id,
    instagram: place.value.instagram
  });
};

function goToPartner(id: string) {
  ActivityLogService.log("partner_click", {
    partner_id: id,
    source: "location_detail"
  })

  router.push(`/partner/${id}`)
}


const share = async () => {
  if (!place.value) return

  await ActivityLogService.log("explore_detail_share", {
    id: place.value.id,
    name: place.value.name
  });

  await Share.share({
    title: place.value.name,
    text: `${place.value.name} (${place.value.type})\n🔗 https://app.halalformosa.com/place/${place.value.id}\n\nShared via Halal Formosa 🕌`,
    dialogTitle: t('search.details.share'),
  })
}

const logOpenMaps = () => {
  if (!place.value) return;
  ActivityLogService.log("explore_detail_open_maps", {
    id: place.value.id,
    name: place.value.name
  });
};

const logCall = () => {
  if (!place.value) return;
  ActivityLogService.log("explore_detail_call", {
    id: place.value.id,
    phone: place.value.phone
  });
};


const editItem = async () => {
  if (!place.value) return;

  ActivityLogService.log("explore_detail_edit", {
    id: place.value.id,
    name: place.value.name
  });

  try {
    await popoverController.dismiss();
  } catch (e) {}

  router.push(`/place/${place.value.id}/edit`);
};

const reportItem = async () => {
  if (!place.value) return;

  ActivityLogService.log("explore_detail_report", {
    id: place.value.id,
    name: place.value.name
  });

  try {
    await popoverController.dismiss();
  } catch (e) {}

  router.push(`/place/${place.value.id}/report`);
};

const logLine = () => {
  if (!place.value) return;
  ActivityLogService.log("explore_detail_line", {
    id: place.value.id,
    line_id: place.value.line_id
  });
};

</script>


<style scoped>
/* TIERED PAGE STYLES - Inherit from global variables if needed, otherwise clean up redundant local backgrounds */
.tier-gold .official-verified-tag {
  color: #ca8a04;
}
.tier-silver .official-verified-tag {
  color: #64748b;
}

.details-container {
  background: var(--ion-background-color); /* Default theme background */
  margin-top: -24px;
  position: relative;
  border-radius: 24px 24px 0 0;
  min-height: 100vh; /* Ensure background fills to bottom */
  z-index: 10;
  overflow: hidden;
}

/* PREMIUM FLARE */
.premium-flare {
  position: absolute;
  top: 0;
  left: -150%;
  width: 50%;
  height: 100%;
  background: linear-gradient(
    to right,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.4) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  transform: skewX(-25deg);
  z-index: 1;
  pointer-events: none;
  animation: details-shimmer 4s infinite linear;
}

@keyframes details-shimmer {
  0% { left: -150%; }
  30% { left: 150%; }
  100% { left: 150%; }
}

/* TITLES AND TEXT */
.title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 8px;
}

.product-title {
  margin: 0;
  font-weight: 800;
  font-size: 1.6rem;
  line-height: 1.2;
}

.attribution-text {
  font-size: 12px;
  color: var(--ion-color-medium);
  margin: 2px 0 12px 0;
}

.section-title {
  margin-bottom: 4px;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  font-size: 10px;
}

/* PREMIUM BADGES */
.premium-badge-wrapper {
  flex-shrink: 0;
}

.premium-badge-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 99px;
  font-weight: 800;
  font-size: 11px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.premium-badge-pill.gold {
  background: #facc15;
  color: #854d0e;
}

.premium-badge-pill.silver {
  background: #94a3b8;
  color: #1e293b;
}

.status-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  gap: 8px;
}

.official-verified-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--ion-color-medium);
  font-weight: 700;
  font-size: 10px;
  letter-spacing: 0.5px;
}

.tier-gold .official-verified-tag {
  color: #ca8a04;
}

.image-modal-close-btn {
  position: absolute;
  top: calc(env(safe-area-inset-top, 0px) + 16px);
  right: 16px;
  z-index: 9999;
}

.place-swiper {
  margin: 0 !important;
  padding: 0 !important;
  width: 100%;
  height: 350px;
  border-radius: 0 0 24px 24px;
  overflow: hidden;
}

.fullscreen-swiper,
.fullscreen-swiper .swiper-slide,
.fullscreen-swiper .swiper-zoom-container {
  width: 100%;
  height: 100%;
}

.fullscreen-swiper .swiper-slide {
  display: flex;
  justify-content: center;
  align-items: center;
  background: black;
}

.fullscreen-swiper img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

iframe {
  border-radius: 4px;
}
</style>
