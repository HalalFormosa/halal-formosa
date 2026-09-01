<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('trip.checkout')" :showBack="true" icon="none" />
    </ion-header>

    <ion-content :fullscreen="true" class="ion-padding">
      <template v-if="loading">
        <ion-skeleton-text animated style="width:100%;height:160px;border-radius:12px;" />
      </template>

      <template v-else-if="bookingResult">
        <div class="section-card confirmation-card">
          <div class="confirmation-icon">✅</div>
          <h2 class="checkout-title">{{ $t('trip.bookingConfirmed') }}</h2>
          <p v-if="bookingResult.klookBookingRef" class="confirmation-ref">
            {{ $t('trip.bookingRef') }}: <strong>{{ bookingResult.klookBookingRef }}</strong>
          </p>
          <p v-else-if="bookingResult.klookOrderNo" class="confirmation-ref">
            {{ $t('trip.bookingRef') }}: <strong>{{ bookingResult.klookOrderNo }}</strong>
          </p>
        </div>
        <ion-button expand="block" fill="outline" color="carrot" @click="router.push('/trip')">
          {{ $t('trip.backToTrips') }}
        </ion-button>
      </template>

      <template v-else-if="trip">
        <div class="section-card">
          <img v-if="trip.cover" :src="trip.cover" :alt="trip.title" class="checkout-cover" />
          <h2 class="checkout-title">{{ $i18n.locale === 'zh-tw' ? (trip.title_zh || trip.title) : trip.title }}</h2>
          <p class="checkout-price">
            {{ trip.currency }} {{ (trip.live_price ?? trip.min_price ?? 0).toLocaleString() }}
          </p>
        </div>

        <div class="section-card">
          <h3 class="section-title">{{ $t('trip.halalStandards') }}</h3>
          <ul class="halal-checklist">
            <li v-if="trip.halal?.halal_lunch_included">🍽️ {{ $t('trip.halalLunchIncluded') }}</li>
            <li v-if="trip.halal?.prayer_room_onsite">🕌 {{ $t('trip.prayerRoomOnsite') }}</li>
            <li v-if="trip.halal?.mosque_stop_nearby">🧭 {{ $t('trip.mosqueStopNearby') }}</li>
            <li v-if="trip.halal?.alcohol_pork_free_environment">🚫🍺 {{ $t('trip.alcoholPorkFree') }}</li>
          </ul>
        </div>

        <div class="section-card">
          <h3 class="section-title">{{ $t('store.buyerInfo') }}</h3>
          <ion-item class="form-item">
            <ion-input v-model="buyerName" label-placement="stacked" :placeholder="$t('store.buyerName')">
              <div slot="label">{{ $t('store.buyerName') }}</div>
            </ion-input>
          </ion-item>
          <ion-item class="form-item">
            <ion-input v-model="buyerEmail" type="email" label-placement="stacked" :placeholder="$t('store.buyerEmail')">
              <div slot="label">{{ $t('store.buyerEmail') }}</div>
            </ion-input>
          </ion-item>
          <ion-item class="form-item">
            <ion-input v-model="buyerPhone" type="tel" label-placement="stacked" :placeholder="$t('store.buyerPhone')">
              <div slot="label">{{ $t('store.buyerPhone') }}</div>
            </ion-input>
          </ion-item>
          <ion-item class="form-item">
            <ion-input v-model="travelDate" type="date" label-placement="stacked">
              <div slot="label">{{ $t('trip.travelDate') }}</div>
            </ion-input>
          </ion-item>
        </div>

        <p v-if="bookingError" class="checkout-error">⚠️ {{ bookingError }}</p>

        <ion-button expand="block" color="carrot" :disabled="submitting" @click="confirmBooking">
          {{ submitting ? $t('common.loading') : $t('trip.confirmBooking') }}
        </ion-button>
      </template>

      <template v-else>
        <ion-card>
          <ion-card-content>🧭 {{ $t('trip.noTripsFound') }}</ion-card-content>
        </ion-card>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IonPage, IonHeader, IonContent, IonButton, IonSkeletonText, IonCard, IonCardContent, IonItem, IonInput } from '@ionic/vue'
import AppHeader from '@/components/AppHeader.vue'
import { supabase } from '@/plugins/supabaseClient'
import { invokeFunction } from '@/plugins/supabaseClient'
import { ActivityLogService } from '@/services/ActivityLogService'
import type { TripItem, BookingMode } from '@/types/Trip'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const submitting = ref(false)
const trip = ref<TripItem | null>(null)
const bookingError = ref<string | null>(null)
const bookingResult = ref<{ klookOrderNo?: string; klookBookingRef?: string } | null>(null)

const buyerName = ref('')
const buyerEmail = ref('')
const buyerPhone = ref('')
const travelDate = ref('')

async function fetchTrip() {
  loading.value = true

  const { data, error } = await supabase
      .from('trips')
      .select(`
        id, title, title_zh, cover_url, min_price, currency, source, booking_mode,
        halal_trip_metadata ( halal_tier, halal_lunch_included, prayer_room_onsite, mosque_stop_nearby, alcohol_pork_free_environment ),
        klook_product_bindings ( id, klook_activity_id, klook_package_id, integration_mode, affiliate_id, affiliate_deep_link )
      `)
      .eq('id', route.params.tripId)
      .maybeSingle()

  if (!error && data) {
    const halal = Array.isArray((data as any).halal_trip_metadata) ? (data as any).halal_trip_metadata[0] : (data as any).halal_trip_metadata
    const klook = Array.isArray((data as any).klook_product_bindings) ? (data as any).klook_product_bindings[0] : (data as any).klook_product_bindings

    trip.value = {
      id: data.id,
      title: data.title,
      title_zh: data.title_zh,
      cover: data.cover_url,
      duration: '',
      external_url: '',
      source: data.source,
      booking_mode: data.booking_mode as BookingMode,
      min_price: data.min_price,
      currency: data.currency,
      provider: null,
      category: null,
      trip_cities: [],
      halal: halal ?? null,
      klook: klook ?? null,
      live_price: null,
      live_stock_status: null,
      nearest_mosque: null,
      nearest_halal_restaurant: null
    }
  }

  loading.value = false
}

async function confirmBooking() {
  if (!trip.value) return
  submitting.value = true
  bookingError.value = null

  try {
    // Only Klook-sourced trips need the B2B Open API call — a plain
    // internal trip has nothing external to book, so we just record intent.
    if (trip.value.booking_mode !== 'klook_b2b') {
      ActivityLogService.log('trip_checkout_confirm', { trip_id: trip.value.id, booking_mode: trip.value.booking_mode })
      bookingResult.value = {}
      return
    }

    const { data, error } = await invokeFunction('klook-create-order', {
      body: {
        tripId: trip.value.id,
        packageId: route.query.packageId ?? trip.value.klook?.klook_package_id,
        unitCount: 1,
        travelDate: travelDate.value || null,
        buyerName: buyerName.value || null,
        buyerEmail: buyerEmail.value || null,
        buyerPhone: buyerPhone.value || null
      }
    })

    if (error || data?.success === false) {
      throw new Error(data?.error || error?.message || 'Booking failed')
    }

    ActivityLogService.log('trip_checkout_confirm', {
      trip_id: trip.value.id,
      booking_mode: trip.value.booking_mode,
      klook_order_no: data.klookOrderNo
    })

    bookingResult.value = { klookOrderNo: data.klookOrderNo, klookBookingRef: data.klookBookingRef }
  } catch (e) {
    console.error('[TripCheckout] booking failed', e)
    bookingError.value = e instanceof Error ? e.message : String(e)
  } finally {
    submitting.value = false
  }
}

onMounted(fetchTrip)
</script>

<style scoped>
.section-card {
  background: var(--ion-card-background, #fff);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.06);
}

.checkout-cover {
  width: 100%;
  height: 160px;
  object-fit: cover;
  border-radius: 12px;
  margin-bottom: 12px;
}

.checkout-title {
  margin: 0 0 6px;
  font-weight: 800;
}

.checkout-price {
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--ion-color-carrot);
  margin: 0;
}

.section-title {
  margin: 0 0 10px;
  font-weight: 700;
}

.halal-checklist {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.9rem;
}

.form-item {
  --background: transparent;
  margin-bottom: 4px;
}

.checkout-error {
  color: var(--ion-color-danger);
  font-size: 0.85rem;
  margin: 0 0 12px;
}

.confirmation-card {
  text-align: center;
  padding: 32px 16px;
}

.confirmation-icon {
  font-size: 2.5rem;
  margin-bottom: 8px;
}

.confirmation-ref {
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}
</style>
