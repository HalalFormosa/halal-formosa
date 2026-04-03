<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { ref, onMounted } from 'vue';
import { onIonViewWillEnter } from '@ionic/vue';
import { supabase } from '@/plugins/supabaseClient';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonItem, IonLabel,
  IonTextarea, IonButton, IonInput, IonCard, IonCardHeader, IonCardContent, IonCardTitle, IonToast,
  IonItemDivider, IonIcon, IonButtons, IonProgressBar
} from '@ionic/vue';
import { cameraOutline, cloudUploadOutline, closeCircle, alertCircleOutline } from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { useImageResizer } from '@/composables/useImageResizer';
import AppHeader from '@/components/AppHeader.vue';

const props = defineProps<{
  barcode: string
}>();

const route = useRoute();
const router = useRouter();

const showToast = ref(false);
const toastMessage = ref('');
const toastColor = ref<'success' | 'danger'>('success');

const barcode = props.barcode;
const product = ref<any>(null);
const reportDescription = ref('');
const currentUser = ref<any>(null);
const { resizeImage } = useImageResizer();

const imageFile = ref<File | null>(null);
const imagePreview = ref<string | null>(null);
const uploading = ref(false);

async function takePicture() {
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera
    });
    imagePreview.value = image.webPath || null;
    imageFile.value = await resizeImage(image.webPath || '');
  } catch (error) {
    console.error('Error taking photo:', error);
  }
}

function uploadFromGallery() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      const file = target.files[0];
      const reader = new FileReader();
      reader.onload = async () => {
        imagePreview.value = reader.result as string;
        imageFile.value = await resizeImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  input.click();
}

function clearImage() {
  imageFile.value = null;
  imagePreview.value = null;
}

async function fetchProduct() {
  const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('barcode', props.barcode)
      .eq('is_archived', false)
      .single();

  if (error) {
    toastMessage.value = '❌ Product not found.';
    toastColor.value = 'danger';
    showToast.value = true;
    setTimeout(() => router.back(), 1500);
  } else {
    product.value = data;
  }
}

const loading = ref(false);

async function submitReport() {
  if (!product.value || !reportDescription.value.trim()) return;

  // Guard: only logged-in users can submit reports
  const { data: { user: freshUser } } = await supabase.auth.getUser();
  if (!freshUser) {
    toastMessage.value = '⚠️ You must be logged in to submit a report.';
    toastColor.value = 'danger';
    showToast.value = true;
    return;
  }

  loading.value = true;
  uploading.value = true;

  try {
    let imageUrl = null;

    if (imageFile.value) {
      const fileName = `${Date.now()}_${barcode}.jpg`;
      const { error: uploadError } = await supabase.storage
          .from('reports')
          .upload(`products/${fileName}`, imageFile.value);

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
          .from('reports')
          .getPublicUrl(`products/${fileName}`);

      imageUrl = publicUrl.publicUrl;
    }

    const { error } = await supabase.from('product_reports').insert([{
      barcode: product.value.barcode,
      description: reportDescription.value.trim(),
      image_url: imageUrl,
      created_at: new Date().toISOString(),
      reported_by: freshUser.id,
    }]);

    if (error) throw error;

    toastMessage.value = '✅ Report submitted!';
    toastColor.value = 'success';
    setTimeout(() => router.back(), 1000);
  } catch (error: any) {
    console.error('Error submitting report:', error);
    toastMessage.value = error.message || 'Failed to submit report.';
    toastColor.value = 'danger';
  } finally {
    loading.value = false;
    uploading.value = false;
    showToast.value = true;
  }
}


onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser();
  currentUser.value = user;
});

onIonViewWillEnter(() => {
  if (barcode) fetchProduct();
});
</script>


<template>
  <ion-page>
    <ion-header>
      <app-header title="Report Product" show-back :icon="alertCircleOutline" />
    </ion-header>
    <ion-content class="ion-padding">
      <ion-card v-if="product">
        <ion-card-header>
          <ion-card-title>{{ product.name }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-item>
            <ion-label position="stacked">Barcode</ion-label>
            <ion-input :value="product.barcode" readonly />
          </ion-item>

          <ion-item lines="none" class="ion-margin-top">
            <ion-label>Evidence Image (Optional)</ion-label>
            <ion-buttons slot="end">
              <ion-button @click="takePicture">
                <ion-icon :icon="cameraOutline" slot="icon-only" />
              </ion-button>
              <ion-button @click="uploadFromGallery">
                <ion-icon :icon="cloudUploadOutline" slot="icon-only" />
              </ion-button>
            </ion-buttons>
          </ion-item>

          <div v-if="imagePreview" class="image-preview-container">
            <img :src="imagePreview" class="image-preview" />
            <ion-button fill="clear" color="danger" class="clear-image-btn" @click="clearImage">
              <ion-icon :icon="closeCircle" slot="icon-only" />
            </ion-button>
          </div>

          <ion-progress-bar v-if="uploading" type="indeterminate" class="ion-margin-top" />

          <ion-item style="margin-top: 10px;">
            <ion-textarea
                label="Reason"
                label-placement="floating"
                v-model="reportDescription"
                auto-grow
                placeholder="Explain the issue"
            />
          </ion-item>

          <ion-button
              expand="block"
              color="danger"
              @click="submitReport"
              :disabled="!reportDescription.trim() || loading"
          >
            Submit Report
          </ion-button>


          <ion-button expand="block" fill="clear" @click="router.back()">
            Cancel
          </ion-button>
        </ion-card-content>
      </ion-card>

      <ion-toast
          :is-open="showToast"
          :message="toastMessage"
          :color="toastColor"
          duration="2000"
          @didDismiss="showToast = false"
          style="transform: translateY(-55px);"
      />
    </ion-content>
  </ion-page>
</template>

<style scoped>
.image-preview-container {
  position: relative;
  margin: 10px 0;
  border-radius: 8px;
  overflow: hidden;
  max-height: 200px;
  display: flex;
  justify-content: center;
  background: var(--ion-color-step-50);
}

.image-preview {
  max-width: 100%;
  object-fit: contain;
}

.clear-image-btn {
  position: absolute;
  top: 5px;
  right: 5px;
  --padding-start: 0;
  --padding-end: 0;
  height: 30px;
  width: 30px;
}
</style>