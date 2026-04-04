<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/explore"/>
        </ion-buttons>
        <ion-title>
          {{ isEditing ? $t('addPlace.editTitle') : $t('addPlace.title') }}
        </ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Not logged in -->
      <ion-card v-if="checkedRole && !myRole">
        <ion-card-content>
          Please login to submit a place.
        </ion-card-content>
      </ion-card>

      <!-- Logged in: everyone can submit; approval handled by role -->
      <form v-else @submit.prevent="submitPlace" class="form">
        <ion-item>
          <ion-input
              v-model="form.name"
              label-placement="stacked"
              required
              :placeholder="$t('addPlace.namePlaceholder')"
          >
            <div slot="label">
              {{ $t('addPlace.nameLabel') }}
              <ion-text color="danger">*</ion-text>
            </div>
          </ion-input>
        </ion-item>

        <ion-item>
          <ion-select
              v-model.number="form.type_id"
              label-placement="stacked"
              interface="popover"
              :placeholder="$t('addPlace.typePlaceholder')"
              required
          >
            <div slot="label">
              {{ $t('addPlace.typeLabel') }}
              <ion-text color="danger">*</ion-text>
            </div>
            <ion-select-option
                v-for="lt in locationTypes"
                :key="lt.id"
                :value="lt.id"
            >
              {{ lt.name }}
            </ion-select-option>
          </ion-select>
        </ion-item>

        <!-- Image upload -->
        <ion-item>
          <ion-label>
            {{ $t('addPlace.imageLabel') }}
            <ion-text color="danger">*</ion-text>
          </ion-label>
          <ion-buttons slot="end">
            <ion-button @click="takePicture" fill="clear" :disabled="uploading">
              <ion-icon :icon="cameraOutline"/>
            </ion-button>
            <ion-button @click="uploadFromGallery" fill="clear" :disabled="uploading">
              <ion-icon :icon="cloudUploadOutline"/>
            </ion-button>
          </ion-buttons>
        </ion-item>

        <!-- Preview -->
        <div v-if="imagePreview" class="img-preview-wrap">
          <img :src="imagePreview" alt="Preview" class="img-preview"/>
        </div>

        <ion-item>
          <ion-input
              v-model="form.address"
              label-placement="stacked"
              :placeholder="$t('addPlace.addressPlaceholder')"
              required
              @ionBlur="onAddressConfirm"
              @ionChange="onAddressConfirm"
              @keyup.enter="onAddressConfirm"
          >
            <div slot="label">
              {{ $t('addPlace.addressLabel') }}
              <ion-text color="danger">*</ion-text>
            </div>
          </ion-input>
        </ion-item>

        <div class="row-2">
          <ion-item>
            <ion-input
                v-model.number="form.lat"
                type="number"
                step="any"
                label-placement="stacked"
                required
                readonly
            >
              <div slot="label">
                {{ $t('addPlace.latLabel') }}
                <ion-text color="danger">*</ion-text>
              </div>
            </ion-input>
          </ion-item>
          <ion-item>
            <ion-input
                v-model.number="form.lng"
                type="number"
                step="any"
                label-placement="stacked"
                required
                readonly
            >
              <div slot="label">
                {{ $t('addPlace.lngLabel') }}
                <ion-text color="danger">*</ion-text>
              </div>
            </ion-input>
          </ion-item>
        </div>

        <div class="map-wrap">
          <div class="hint">{{ $t('addPlace.mapHint') }}</div>

          <div class="map-holder">
            <!-- Real map is ALWAYS in the DOM -->
            <div id="add-map" :class="{'fade-in': mapReady}"></div>

            <!-- Skeleton overlays while loading -->
            <ion-skeleton-text
                v-if="mapLoading"
                animated
                class="map-skeleton"
            />
          </div>
        </div>

        <ion-card
            v-if="warningLevel"
            :color="warningLevel === 'high' ? 'danger' : 'warning'"
            class="ion-margin-top"
            style="margin: 12px 0 16px;"
        >
          <ion-card-content>

            <strong>
              ⚠️ {{ warningLevel === 'high'
                ? 'Very likely duplicate nearby'
                : 'Similar place nearby detected'
              }}
            </strong>

            <ul style="margin:6px 0 0 16px; padding:0; font-size:14px;">
              <li v-for="m in nearbyMatches.slice(0, 3)" :key="m.id">
                {{ m.name }} · {{ m.distance_meters }} m
              </li>
            </ul>

            <small style="opacity:0.8;">
              Verify if this is a different branch, floor, or vendor.
            </small>

          </ion-card-content>

        </ion-card>


        <ion-button
            fill="outline"
            size="small"
            @click="showMoreOptions = !showMoreOptions"
            style="margin-bottom: 12px;"
        >
          {{ showMoreOptions ? 'Hide Details' : 'More Details' }}
        </ion-button>

        <div v-if="showMoreOptions">

          <p style="margin-top:20px; font-weight:600;">Description</p>

          <ion-item>
            <ion-textarea
                v-model="form.description"
                label="Description"
                label-placement="stacked"
                placeholder="Describe this place (halal status, specialties, notes, etc.)"
                auto-grow
                :maxlength="1000"
                counter
            />
          </ion-item>

          <p style="margin-top:20px; font-weight:600;">Contact Information</p>

          <ion-item>
            <ion-input
                v-model="form.phone"
                label="Phone / WhatsApp"
                label-placement="stacked"
                placeholder="+886 900 000 000"
            />
          </ion-item>

          <ion-item>
            <ion-input
                v-model="form.instagram"
                label="Instagram"
                label-placement="stacked"
                placeholder="@username"
            />
          </ion-item>

          <ion-item>
            <ion-input
                v-model="form.line_id"
                label="LINE ID"
                label-placement="stacked"
                placeholder="yourlineid"
            />
          </ion-item>

          <p style="margin-top:20px; font-weight:600;">Price Range</p>

          <ion-item>
            <ion-input
                v-model="form.price_range"
                label="Price Range"
                label-placement="stacked"
                placeholder="NTD 100–300"
            />
          </ion-item>

          <p style="margin-top:20px; font-weight:600;">Tags & Categories</p>

          <ion-item>
            <ion-input
                v-model="tagInput"
                label="Add Tag"
                label-placement="stacked"
                placeholder="Type and press Enter (e.g. ntu, prayer-room)"
                @ionInput="handleTagInput"
                @keyup.enter="addTag"
            />
            <ion-button slot="end" fill="clear" @click="addTag" style="margin-top: 14px;">
              Add
            </ion-button>
          </ion-item>

          <div v-if="form.tags.length > 0" class="tag-chips">
            <ion-chip
                v-for="tag in form.tags"
                :key="tag"
                color="primary"
                outline
                class="tag-chip"
            >
              <ion-label>{{ tag }}</ion-label>
              <ion-icon :icon="closeCircle" @click="removeTag(tag)" />
            </ion-chip>
          </div>

          <p style="margin-top:20px; font-weight:600;">Opening Hours</p>

          <ion-list class="opening-hours-list">
            <template v-for="(label, key) in dayLabels" :key="key">

              <ion-item lines="full" class="opening-hours-item">

                <ion-checkbox
                    v-model="form.opening_hours[key].active"
                    slot="start"
                    @ionChange="openingHoursTouched = true"
                />

                <ion-label class="day-label">{{ label }}</ion-label>

                <!-- CLOSED BADGE -->
                <span
                    v-if="!form.opening_hours[key].active"
                    class="closed-label"
                >
        Closed
      </span>

                <!-- TIME INPUTS -->
                <div
                    v-else
                    class="time-inputs"
                >
                  <ion-input
                      v-model="form.opening_hours[key].open"
                      type="time"
                      class="time-field"
                      @ionInput="openingHoursTouched = true"
                  />

                  <span style="margin: 0 4px;">-</span>

                  <ion-input
                      v-model="form.opening_hours[key].close"
                      type="time"
                      class="time-field"
                      @ionInput="openingHoursTouched = true"
                  />
                </div>

              </ion-item>

            </template>
          </ion-list>

        </div>

        <ion-card
            v-if="checkedRole && myRole && !isPrivileged(myRole)"
            color="light"
        >
          <ion-card-content style="font-size:14px;">
            🕵️ Submissions will be reviewed before appearing publicly.
          </ion-card-content>
        </ion-card>

        <ion-button type="submit" expand="block" :disabled="submitting || !isValid">
          <ion-spinner v-if="submitting" name="lines-small" class="mr-2"/>
          <span v-else>{{ isEditing ? $t('addPlace.updateBtn') : $t('addPlace.saveBtn') }}</span>
        </ion-button>
      </form>

      <ion-toast
          :is-open="toast.open"
          :message="toast.message"
          :color="toast.color"
          :duration="2200"
          @didDismiss="toast.open = false"
      />

      <!-- Admin Controls -->
      <ion-list v-if="myRole === 'admin'" class="ion-margin-top">
        <ion-list-header>
          <ion-label color="carrot">ADMIN CONTROLS</ion-label>
        </ion-list-header>
        <ion-item>
          <ion-icon :icon="checkmarkCircleOutline" slot="start" color="success" />
          <ion-label>{{ $t('admin.master.published') }}</ion-label>
          <ion-toggle
              slot="end"
              :checked="form.approved"
              @ionChange="form.approved = $event.detail.checked"
          />
        </ion-item>
      </ion-list>

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonItem,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonToast,
  IonSpinner,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardContent,
  IonLabel,
  IonIcon,
  IonSkeletonText,
  IonCheckbox,
  IonList,
  IonText,
    IonTextarea,
    IonChip,
    IonToggle,
    IonListHeader
} from '@ionic/vue'
import {ref, onMounted, onBeforeUnmount, computed} from 'vue'
import {useRouter} from 'vue-router'
import {supabase} from '@/plugins/supabaseClient'
import mapsLoader from '@/plugins/googleMapsLoader'
import {Camera, CameraResultType, CameraSource} from '@capacitor/camera'
import {cameraOutline, cloudUploadOutline, closeCircle, checkmarkCircleOutline} from 'ionicons/icons'
import {Capacitor} from '@capacitor/core'
import {Geolocation} from '@capacitor/geolocation'
import {usePoints} from "@/composables/usePoints";
import {useNotifier} from "@/composables/useNotifier"
import {watch} from 'vue'
import {useRoute} from 'vue-router'
import {ActivityLogService} from "@/services/ActivityLogService";

const route = useRoute()
const isEditing = computed(() => !!route.params.id)
const coordUpdateSource = ref<'address' | 'map' | 'manual' | null>(null)

/* -------------------- Constants -------------------- */
const MAP_ID = 'a40f1ec0ad0afbbb12694f19'
const MAX_BYTES = 5 * 1024 * 1024 // 5MB
const DEFAULT_CENTER = {lat: 25.0343, lng: 121.5645}
let clickMarker: google.maps.marker.AdvancedMarkerElement | null = null
let pinEl: any | null = null
const mapLoading = ref(true)  // show skeleton
const mapReady = ref(false)   // reveal map once real map is ready
const {awardAndCelebrate} = usePoints();
const {notifyEvent} = useNotifier();
const dayLabels = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};
const showMoreOptions = ref(false)
const openingHoursTouched = ref(false)


/* -------------------- Router -------------------- */
const router = useRouter()

/* -------------------- Role Gate -------------------- */
const checkedRole = ref(false)
const locationTypes = ref<{ id: number; name: string }[]>([])
const isPrivileged = (r: Role | null) => r === 'admin' || r === 'contributor'

type Role = 'admin' | 'contributor' | 'user'
const myRole = ref<Role | null>(null)

const loadRole = async () => {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    myRole.value = null
    checkedRole.value = true
    return
  }

  const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

  myRole.value = !error ? ((data?.role ?? 'user') as Role) : 'user'
  checkedRole.value = true

  // ✅ Default to approved if admin adding new place
  if (myRole.value === 'admin' && !isEditing.value) {
    form.value.approved = true
  }
}

// Fetch from Supabase
const fetchLocationTypes = async () => {
  const {data, error} = await supabase
      .from('location_types')
      .select('id, name')
      .order('name', {ascending: true}) // alphabetic sort
  if (!error && data) locationTypes.value = data
}

/* -------------------- Form State -------------------- */
const form = ref<{
  name: string
  type_id: number | null
  lat: number
  lng: number
  image: string | null
  address: string | null,
  description: string | null,
  phone: string | null,
  instagram: string | null,
  line_id: string | null,
  price_range: string | null,
  opening_hours: any,
  tags: string[],
  approved: boolean,
}>({
  name: '',
  type_id: null,
  lat: DEFAULT_CENTER.lat,
  lng: DEFAULT_CENTER.lng,
  address: null,
  image: null,
  description: '',
  phone: '',
  instagram: '',
  line_id: '',
  price_range: '',
  tags: [],
  approved: false,

  opening_hours: {
    mon: {active: false, open: "09:00", close: "18:00"},
    tue: {active: false, open: "09:00", close: "18:00"},
    wed: {active: false, open: "09:00", close: "18:00"},
    thu: {active: false, open: "09:00", close: "18:00"},
    fri: {active: false, open: "09:00", close: "18:00"},
    sat: {active: false, open: "09:00", close: "18:00"},
    sun: {active: false, open: "09:00", close: "18:00"},
  },
})

const tagInput = ref('')

const handleTagInput = (e: any) => {
  const val = e.target.value
  if (val.endsWith(',')) {
    const tag = val.slice(0, -1).trim()
    if (tag && !form.value.tags.includes(tag)) {
      form.value.tags.push(tag)
    }
    tagInput.value = ''
  }
}

const addTag = (e?: any) => {
  if (e) e.preventDefault()
  const val = tagInput.value.trim().replace(/,/g, '')
  if (val && !form.value.tags.includes(val)) {
    form.value.tags.push(val)
  }
  tagInput.value = ''
}

const removeTag = (tag: string) => {
  form.value.tags = form.value.tags.filter(t => t !== tag)
}



const submitting = ref(false)
const toast = ref<{ open: boolean; message: string; color: string }>({
  open: false,
  message: '',
  color: 'primary'
})

const isValid = computed(() =>
    !!form.value.name &&
    !!form.value.type_id &&
    form.value.lat !== null &&
    form.value.lng !== null &&
    (!!form.value.image || !!pendingFile.value) // allow deferred file
)

/* -------------------- Image Upload -------------------- */
async function resizeImageFromWebPath(
    webPath: string,
    filename: string,
    maxSize = 1200,     // longest side in px
    quality = 0.8       // JPEG quality 0..1
): Promise<File> {
  const res = await fetch(webPath)
  const blob = await res.blob()

  // Try createImageBitmap first (fast), fallback to HTMLImageElement
  const loadBitmap = async () => {
    try {
      return await createImageBitmap(blob)
    } catch {
      return new Promise<ImageBitmap>((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          // draw to canvas to produce a bitmap-like object
          const c = document.createElement('canvas')
          c.width = img.naturalWidth
          c.height = img.naturalHeight
          const ctx = c.getContext('2d')!
          ctx.drawImage(img, 0, 0)
          c.toBlob(b => {
            if (!b) return reject(new Error('toBlob failed'))
            createImageBitmap(b).then(resolve).catch(reject)
          })
        }
        img.onerror = reject
        img.src = URL.createObjectURL(blob)
      })
    }
  }

  const bmp = await loadBitmap()

  // Resize keeping aspect ratio by the longest edge
  const w = bmp.width
  const h = bmp.height
  const scale = Math.min(1, maxSize / Math.max(w, h))
  const outW = Math.round(w * scale)
  const outH = Math.round(h * scale)

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bmp, 0, 0, outW, outH)

  const outBlob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Compression failed'))), 'image/jpeg', quality)
  )

  return new File([outBlob], filename, {type: 'image/jpeg'})
}

type NearbyMatch = {
  id: number
  name: string
  distance_meters: number
  name_similarity: number
}

const nearbyMatches = ref<NearbyMatch[]>([])
const checkingNearby = ref(false)

let debounceTimer: number | undefined

watch(
    () => ({
      name: form.value.name,
      lat: form.value.lat,
      lng: form.value.lng
    }),
    (v) => {
      clearTimeout(debounceTimer)

      debounceTimer = window.setTimeout(async () => {
        const { name, lat, lng } = v

        if (!name || !lat || !lng || name.trim().length < 4) {
          nearbyMatches.value = []
          return
        }

        checkingNearby.value = true

        const { data, error } = await supabase.rpc(
            'find_nearby_similar_locations',
            {
              p_lat: lat,
              p_lng: lng,
              p_name: name.trim(),
              p_exclude_id: isEditing.value
                  ? Number(route.params.id)
                  : null
            }
        )

        nearbyMatches.value = !error && Array.isArray(data) ? data : []
        checkingNearby.value = false
      }, 600)
    },
    { deep: false }
)


const warningLevel = computed(() => {
  if (!nearbyMatches.value.length) return null

  const strongest = nearbyMatches.value[0]

  if (strongest.distance_meters <= 20 && strongest.name_similarity >= 0.75) {
    return 'high'
  }

  if (strongest.distance_meters <= 50 && strongest.name_similarity >= 0.6) {
    return 'medium'
  }

  return 'low'
})



const makeSafeBase = () => {
  const base = form.value.name?.trim()
      .replace(/\s+/g, '-')            // spaces → dash
      .replace(/[^a-zA-Z0-9-_]/g, '')  // strip weird chars
      .toLowerCase()
  return base && base.length ? base : 'place'
}

const imagePreview = ref<string | null>(null)   // preview URL
const pendingFile = ref<File | null>(null)      // hold the chosen file until submit
const uploading = ref(false)

const setPreview = (file: File) => {
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
  imagePreview.value = URL.createObjectURL(file)
  pendingFile.value = file
}

const takePicture = async () => {
  try {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 85,
      allowEditing: false
    })
    if (!photo.webPath) return
    const safeBase = makeSafeBase()

    try {
      const file = await resizeImageFromWebPath(photo.webPath, `image-${safeBase}.jpg`, 1200, 0.8)
      if (file.size > MAX_BYTES) {
        toast.value = {open: true, message: 'Image still too large after compression.', color: 'danger'}
        return
      }
      setPreview(file)
    } catch (e: any) {
      toast.value = {open: true, message: e?.message || 'Could not process image.', color: 'danger'}
    }
  } catch { /* empty */
  }
}

const uploadFromGallery = async () => {
  try {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Photos,
      quality: 85,
      allowEditing: false
    })
    if (!photo.webPath) return
    const safeBase = makeSafeBase()

    // compress to JPEG here
    const file = await resizeImageFromWebPath(photo.webPath, `image-${safeBase}.jpg`, 1200, 0.8)

    if (file.size > MAX_BYTES) {
      toast.value = {open: true, message: 'Image still too large after compression.', color: 'danger'}
      return
    }
    setPreview(file)
  } catch { /* empty */
  }
}

/* -------------------- Map Picker -------------------- */
let map: google.maps.Map | null = null
let advancedMarkerLib: any = null
let mapClickListener: google.maps.MapsEventListener | null = null

const initMap = async () => {
  mapLoading.value = true

  const [{Map}, markerLib] = await Promise.all([
    mapsLoader.importLibrary('maps'),
    mapsLoader.importLibrary('marker')
  ])

  // after markerLib is set
  if (!markerLib?.PinElement || !markerLib?.AdvancedMarkerElement) {
    console.error('Advanced markers not available. Check Maps JS API version/libraries.')
  }

  advancedMarkerLib = markerLib

  map = new Map(document.getElementById('add-map') as HTMLElement, {
    center: {lat: form.value.lat, lng: form.value.lng},
    zoom: 14,
    disableDefaultUI: true,
    mapId: MAP_ID,
    gestureHandling: 'greedy'   // 👈 add
  })

  // Build a colored pin (much more visible than a small dot)
  pinEl = new advancedMarkerLib.PinElement({
    background: getComputedStyle(document.documentElement)
        .getPropertyValue('--ion-color-carrot')
        .trim() || '#d8620d',
    borderColor: '#ffffff',
    glyphColor: '#ffffff',
    scale: 1.2,
  })

  // Create marker at initial coords
  clickMarker = new advancedMarkerLib.AdvancedMarkerElement({
    map,
    position: {lat: form.value.lat, lng: form.value.lng},
    content: pinEl.element,
    zIndex: 10,
  })

  // Prefer 'idle' (fires once map finishes first render)
  const onReady = () => {
    mapReady.value = true
    // tiny next tick to avoid flicker
    requestAnimationFrame(() => {
      mapLoading.value = false
    })
  }

  google.maps.event.addListenerOnce(map, 'idle', onReady);
  google.maps.event.addListenerOnce(map, 'tilesloaded', onReady);

  // Absolute last resort: time out after 3s
  setTimeout(() => {
    if (!mapReady.value) {
      onReady()
      console.warn('Map ready fallback timeout used')
    }
  }, 3000)

  // On click: move pin + animate + update form
  let firstTapDone = false
  mapClickListener = map.addListener('click', async (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return

    coordUpdateSource.value = 'map'

    const lat = e.latLng.lat()
    const lng = e.latLng.lng()

    form.value.lat = lat
    form.value.lng = lng

    if (clickMarker) {
      clickMarker.position = {lat, lng}
    } else {
      // safety: if null for any reason
      clickMarker = new advancedMarkerLib.AdvancedMarkerElement({
        map,
        position: {lat, lng},
        content: pinEl?.element ?? undefined,
        zIndex: 10,
      })
    }

    // optional: pan slightly so user sees the pin move
    map!.panTo({lat, lng})

    // add a quick "pop" animation for feedback
    if (pinEl?.element) {
      pinEl.element.classList.add('marker-pop')
      setTimeout(() => pinEl.element.classList.remove('marker-pop'), 220)
    }

    if (!firstTapDone) {
      map!.setZoom(16);
      firstTapDone = true
    }

    // 🧠 Auto-fetch address
    const addr = await reverseGeocode(lat, lng)
    if (addr) form.value.address = addr

    coordUpdateSource.value = null
  })
}

/* ------------- Responsive Pin Color --------------- */
let themeObserver: MutationObserver | null = null   // <-- add this
const updatePinColor = () => {
  const carrot = getComputedStyle(document.documentElement)
      .getPropertyValue('--ion-color-carrot').trim() || '#d8620d'
  if (pinEl && advancedMarkerLib?.PinElement) {
    pinEl = new advancedMarkerLib.PinElement({
      background: carrot, borderColor: '#ffffff', glyphColor: '#ffffff', scale: 1.2
    })
    if (clickMarker) clickMarker.content = pinEl.element
  }
}

/* ---------------- Geocoding --------------------- */

const geocoder = ref<google.maps.Geocoder | null>(null)

const onAddressConfirm = async () => {
  const addr = form.value.address?.trim()
  if (!addr || addr.length < 8) return

  coordUpdateSource.value = 'address'

  const result = await geocodeAddress(addr)
  if (!result) return

  const { lat, lng } = result

  form.value.lat = lat
  form.value.lng = lng

  map?.panTo({ lat, lng })
  map?.setZoom(16)

  if (clickMarker) {
    clickMarker.position = { lat, lng }
  }

  coordUpdateSource.value = null
}




async function reverseGeocode(lat: number, lng: number) {
  if (!mapReady.value) return null // ✅ safety guard

  // ✅ Initialize geocoder only after loader is ready
  if (!geocoder.value) {
    geocoder.value = new google.maps.Geocoder()
  }

  return new Promise<string | null>((resolve) => {
    geocoder.value!.geocode({location: {lat, lng}}, (results, status) => {
      if (status === 'OK' && results?.[0]) resolve(results[0].formatted_address)
      else {
        console.warn('Geocode failed:', status)
        resolve(null)
      }
    })
  })
}

async function geocodeAddress(address: string) {
  if (!mapReady.value || !address) return null

  if (!geocoder.value) {
    geocoder.value = new google.maps.Geocoder()
  }

  return new Promise<{ lat: number; lng: number } | null>((resolve) => {
    geocoder.value!.geocode({
      address,
      region: 'TW',
      componentRestrictions: { country: 'TW' },
    }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        const loc = results[0].geometry.location
        resolve({
          lat: loc.lat(),
          lng: loc.lng()
        })
      } else {
        console.warn('Address geocode failed:', status)
        resolve(null)
      }
    })
  })
}

/* -------------------- Submit -------------------- */
const uploadToSupabase = async (file: File): Promise<string> => {
  uploading.value = true
  try {
    const {data: {user}} = await supabase.auth.getUser()
    if (!user) throw new Error('You must be logged in.')
    const safeBase = makeSafeBase()
    const rand = Math.random().toString(36).slice(2, 8)
    const path = `${user.id}/${safeBase}/${Date.now()}_${rand}.jpg`   // folder per place
    const {error: upErr} = await supabase.storage.from('location-image')
        .upload(path, file, {cacheControl: '3600', upsert: false, contentType: 'image/jpeg'})
    if (upErr) throw upErr
    const {data: pub} = supabase.storage.from('location-image').getPublicUrl(path)
    if (!pub?.publicUrl) throw new Error('Could not get public URL.')
    return pub.publicUrl
  } finally {
    uploading.value = false
  }
}

const normalizeOpeningHours = () => {
  if (!openingHoursTouched.value) return null

  const hours = form.value.opening_hours

  const hasAnyActive = Object.values(hours).some(
      (d: any) => d.active && d.open && d.close
  )

  if (!hasAnyActive) return null

  return hours
}


const submitPlace = async () => {
  if (submitting.value) return

  // ✅ Auto-add any pending tag in input box before saving
  if (tagInput.value.trim()) {
    addTag()
  }

  if (!form.value.image && !pendingFile.value) {
    toast.value = { open: true, message: 'Please select an image.', color: 'warning' }
    return
  }

  submitting.value = true
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('You must be logged in.')

    // ✅ Decide auto-approval (for new places)
    const autoApprove = isPrivileged(myRole.value)

    // delete old image if editing + new image selected
    if (isEditing.value && pendingFile.value && form.value.image) {
      const oldPath = form.value.image.split('/storage/v1/object/public/location-image/')[1]
      if (oldPath) await supabase.storage.from('location-image').remove([oldPath])
    }

    // upload new image if selected
    if (pendingFile.value) {
      form.value.image = await uploadToSupabase(pendingFile.value)
    }

    const payload: Record<string, any> = {
      name: form.value.name.trim(),
      lat: form.value.lat,
      lng: form.value.lng,
      type_id: form.value.type_id,
      image: String(form.value.image || '').trim(),
      address: form.value.address?.trim() || null,
      description: form.value.description?.trim() || null,
      phone: form.value.phone || null,
      instagram: form.value.instagram || null,
      line_id: form.value.line_id || null,
      price_range: form.value.price_range || null,
      opening_hours: normalizeOpeningHours(),
      updated_by: user.id,
      updated_at: new Date().toISOString(),
      tags: form.value.tags,
    }

    // ✅ Approval Logic
    if (myRole.value === 'admin') {
      // Admins manually control the toggle
      payload.approved = form.value.approved
      if (form.value.approved) {
        payload.approved_by = user.id
        payload.approved_at = new Date().toISOString()
      } else {
        payload.approved_by = null
        payload.approved_at = null
      }
    } else if (!isEditing.value) {
      // New places for non-admins use auto-approve logic
      payload.approved = autoApprove
      payload.approved_by = autoApprove ? user.id : null
      payload.approved_at = autoApprove ? new Date().toISOString() : null
      payload.created_by = user.id
    }

    if (isEditing.value) {
      const { error } = await supabase
          .from('locations')
          .update(payload)
          .eq('id', route.params.id)

      if (error) throw error

      toast.value = { open: true, message: 'Place updated!', color: 'success' }
      
      await ActivityLogService.log("edit_place_success", {
        id: route.params.id,
        name: form.value.name,
        approved: payload.approved
      })

      setTimeout(() => router.replace(`/place/${route.params.id}`), 500)
    } else {
      // CREATE
      payload.created_by = user.id
      const { data: newPlace, error } = await supabase
          .from('locations')
          .insert([payload])
          .select('id')
          .single()

      if (error) throw error

      toast.value = {
        open: true,
        message: payload.approved ? '✅ Place published!' : '✅ Place submitted and awaiting approval.',
        color: 'success',
      }

      // ✅ Notification if approved
      if (payload.approved) {
        const selectedType = locationTypes.value.find(t => t.id === form.value.type_id)
        const placeTypeName = selectedType?.name || 'Halal Place'

        await notifyEvent(
            'new_place',
            `🕌 New ${placeTypeName} Added!`,
            `${form.value.name} (${placeTypeName})\nLat: ${form.value.lat}, Lng: ${form.value.lng}`,
            form.value.image ?? undefined,
            { id: newPlace.id, lat: form.value.lat, lng: form.value.lng, isNative: true }
        )
      }

      await awardAndCelebrate('add_place', 10000)

      await ActivityLogService.log("add_place_success", {
        name: form.value.name,
        address: form.value.address,
        lat: form.value.lat,
        lng: form.value.lng
      })

      setTimeout(() => {
        router.replace(payload.approved ? `/explore?focus=${newPlace.id}` : `/explore`)
      }, 500)
    }

    // cleanup
    if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
    imagePreview.value = null
    pendingFile.value = null
  } catch (err: any) {
    toast.value = { open: true, message: err.message || 'Failed to save.', color: 'danger' }
  } finally {
    submitting.value = false
  }
}

/* -------------------- Lifecycle -------------------- */
const centerOnUserOnce = async () => {
  // Native (Android/iOS): use Capacitor plugin
  if (Capacitor.getPlatform() !== 'web') {
    try {
      // Permissions
      const perm = await Geolocation.checkPermissions()
      if (perm.location !== 'granted') {
        await Geolocation.requestPermissions()
      }

      // Get position
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      })
      const {latitude, longitude} = pos.coords
      form.value.lat = latitude
      form.value.lng = longitude

      const addr = await reverseGeocode(latitude, longitude)
      if (addr) form.value.address = addr

      return
    } catch (err) {
      console.warn('Native geolocation failed, falling back to default', err)
      return
    }
  }

  // Web fallback: use the browser API
  return new Promise<void>((resolve) => {
    navigator.geolocation.getCurrentPosition(
        (pos) => {
          const {latitude, longitude} = pos.coords
          form.value.lat = latitude
          form.value.lng = longitude
          resolve()
        },
        (err) => {
          console.warn('Web geolocation failed or denied', err)
          resolve()
        },
        {
          enableHighAccuracy: false, // Low accuracy is standard and faster for web
          timeout: 15000,           // 15 seconds is more reliable for triangulation
          maximumAge: 60000         // Use a cached position up to 1 min old
        }
    )
  })
}

onMounted(async () => {
  await loadRole()
  await fetchLocationTypes()

  // 1️⃣ If editing, load existing location data first
  if (isEditing.value) {
    const {data, error} = await supabase
        .from('locations')
        .select(`
    id,
    name,
    lat,
    lng,
    address,
    description,
    image,
    type_id,
    phone,
    instagram,
    line_id,
    price_range,
    opening_hours,
    tags,
    approved
  `)
        .eq('id', route.params.id)
        .maybeSingle()

    if (!error && data) {
      form.value = {
        name: data.name,
        type_id: data.type_id,
        lat: data.lat,
        lng: data.lng,
        address: data.address,
        image: data.image,
        description: data.description || '',
        phone: data.phone || '',
        instagram: data.instagram || '',
        line_id: data.line_id || '',
        price_range: data.price_range || '',

        opening_hours: data.opening_hours || form.value.opening_hours,
        tags: data.tags || [],
        approved: data.approved || false,
      }

      imagePreview.value = data.image || null
    }

    if (isEditing.value && data?.opening_hours) {
      openingHoursTouched.value = true
    }

  }

  // 2️⃣ Only center on user if adding a NEW place
  if (!isEditing.value && checkedRole.value && myRole.value) {
    await centerOnUserOnce()
  }

  // 3️⃣ Initialize map in all cases
  await initMap()
  updatePinColor()

  // 4️⃣ Wait until map is fully ready before fetching address
  const waitForMapReady = () =>
      new Promise<void>((resolve) => {
        const stop = watch(mapReady, (ready) => {
          if (ready) {
            stop()
            resolve()
          }
        })
      })
  await waitForMapReady()

  // 5️⃣ Auto-fill address if missing
  if (!form.value.address && form.value.lat && form.value.lng) {
    const addr = await reverseGeocode(form.value.lat, form.value.lng)
    if (addr) form.value.address = addr
  }


  // 6️⃣ Theme listener for dark/light map pin color
  themeObserver = new MutationObserver(updatePinColor)
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
})


onBeforeUnmount(() => {
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
  if (mapClickListener) {
    mapClickListener.remove();
    mapClickListener = null
  }
  if (themeObserver) {
    themeObserver.disconnect();
    themeObserver = null
  }
  clickMarker = null
  pinEl = null
  map = null
})

</script>

<style scoped>
.form :deep(.ion-invalid) {
  --highlight-color-invalid: var(--ion-color-danger);
}

/* Grid for lat/lng inputs */
.row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 8px;
}

/* Map */
.map-wrap {
  margin: 12px 0 16px;
}

.hint {
  font-size: 12px;
  color: var(--ion-color-medium);
  margin: 4px 0 8px;
}

.map-holder {
  position: relative;
  height: 32vh;
  border-radius: 12px;
  overflow: hidden;
}

#add-map {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 180ms ease-out;
}

#add-map.fade-in {
  opacity: 1;
}

.map-skeleton {
  position: absolute;
  inset: 0; /* cover the map fully */
  border-radius: 12px;
}

/* Image preview */
.img-preview-wrap {
  padding: 0 16px 16px;
}

.img-preview {
  max-width: 100%;
  display: block;
  border-radius: 8px;
}

/* Misc */
.mr-2 {
  margin-right: 8px;
}

/* subtle feedback when the pin moves */
@keyframes pop {
  0% {
    transform: translateZ(0) scale(0.85);
  }
  70% {
    transform: translateZ(0) scale(1.08);
  }
  100% {
    transform: translateZ(0) scale(1);
  }
}

.marker-pop {
  animation: pop 220ms ease-out;
}

/* optional: show crosshair cursor on map to hint interactivity */
#add-map {
  cursor: crosshair;
}

.opening-hours-list {
  margin-top: 4px;
}

.opening-hours-item {
  display: flex;
  align-items: center;
}

.day-label {
  min-width: 50px;
  font-weight: 600;
}

.time-inputs {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.time-field {
  max-width: 110px;
}

.closed-label {
  margin-left: auto;
  color: var(--ion-color-medium);
  font-size: 14px;
}

/* Tags */
.tag-chips {
  padding: 8px 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-chip {
  margin: 0;
  height: 32px;
  --color: var(--ion-color-primary);
}

.tag-chip ion-icon {
  font-size: 18px;
  cursor: pointer;
  margin-inline-start: 4px;
}

.tag-chip ion-icon:hover {
  color: var(--ion-color-danger);
}

</style>
