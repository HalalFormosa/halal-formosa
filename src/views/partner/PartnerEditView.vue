<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <app-header :title="$t('partner.edit.title')" show-back :back-route="`/partner/${partnerId}`" icon="none" />
    </ion-header>

    <ion-content class="ion-padding">
      <div v-if="loading" class="ion-text-center ion-padding">
        <ion-spinner name="crescent" color="carrot" />
      </div>

      <div v-else class="pe-container">
        <p class="pe-name">{{ name }}</p>
        <p class="pe-note">{{ $t('partner.edit.note') }}</p>

        <label class="pe-label">{{ $t('partner.edit.about') }}</label>
        <ion-textarea v-model="form.about" :rows="6" :maxlength="2000" class="pe-input" />

        <label class="pe-label">{{ $t('partner.edit.address') }}</label>
        <ion-input v-model="form.address" :maxlength="250" class="pe-input" />

        <label class="pe-label">{{ $t('partner.edit.phone') }}</label>
        <ion-input v-model="form.phone" type="tel" :maxlength="40" class="pe-input" />

        <label class="pe-label">{{ $t('partner.edit.email') }}</label>
        <ion-input v-model="form.email" type="email" inputmode="email" :maxlength="200" class="pe-input" />

        <label class="pe-label">{{ $t('partner.edit.website') }}</label>
        <ion-input v-model="form.website" type="url" inputmode="url" :maxlength="250" class="pe-input" placeholder="https://" />

        <ion-button expand="block" color="carrot" mode="md" class="pe-save" :disabled="saving" @click="save">
          <ion-spinner v-if="saving" name="crescent" />
          <template v-else>{{ $t('partner.edit.save') }}</template>
        </ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { IonPage, IonHeader, IonContent, IonButton, IonInput, IonSpinner, IonTextarea, toastController, onIonViewWillEnter } from '@ionic/vue'
import AppHeader from '@/components/AppHeader.vue'
import router from '@/router'
import { PartnerService, PartnerEditError } from '@/services/PartnerService'

const route = useRoute()
const { t } = useI18n()

const partnerId = computed(() => String(route.params.id))
const loading = ref(true)
const saving = ref(false)
const name = ref('')
const form = reactive({ about: '', address: '', phone: '', email: '', website: '' })

async function toast(message: string) {
  const el = await toastController.create({ message, duration: 3000, position: 'bottom' })
  await el.present()
}

// Only this partner page's owners (and admins) belong here; the server enforces it on save too.
onIonViewWillEnter(async () => {
  loading.value = true
  if (!(await PartnerService.isOwner(partnerId.value))) {
    router.replace(`/partner/${partnerId.value}`)
    await toast(t('partner.edit.noAccess'))
    return
  }
  const page = await PartnerService.getPageText(partnerId.value)
  if (!page) {
    router.replace(`/partner/${partnerId.value}`)
    return
  }
  name.value = page.name
  Object.assign(form, { about: page.about, address: page.address, phone: page.phone, email: page.email, website: page.website })
  loading.value = false
})

async function save() {
  saving.value = true
  try {
    // "mrmomeat.com" -> "https://mrmomeat.com"
    let website = form.website.trim()
    if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`
    await PartnerService.updatePageText(partnerId.value, { ...form, website })
    form.website = website
    await toast(t('partner.edit.saved'))
    router.push(`/partner/${partnerId.value}`)
  } catch (e) {
    const code = e instanceof PartnerEditError ? e.code : 'unknown'
    await toast(
      code === 'invalid_email' ? t('partner.edit.errEmail')
      : code === 'invalid_website' ? t('partner.edit.errWebsite')
      : code === 'invalid_about' || code === 'invalid_address' || code === 'invalid_phone' ? t('partner.edit.errTooLong')
      : code === 'not_allowed' ? t('partner.edit.noAccess')
      : t('partner.edit.errGeneric')
    )
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.pe-container { max-width: 560px; margin: 0 auto; display: flex; flex-direction: column; gap: 6px; }
.pe-name { margin: 0; font-size: 1.15rem; font-weight: 800; }
.pe-note { margin: 0 0 8px; font-size: 13px; opacity: 0.75; }
.pe-label { font-size: 12px; font-weight: 600; margin: 10px 0 0; opacity: 0.8; }
.pe-input { --padding-start: 10px; --padding-end: 10px; border: 1px solid var(--ion-color-medium, #999); border-radius: 10px; }
.pe-save { margin-top: 18px; }
</style>
