<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/news" />
        </ion-buttons>
        <ion-title>{{ isEdit ? $t('newsAdmin.editTitle') : $t('newsAdmin.title') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">

      <!-- Title -->
      <ion-item>
        <ion-input
            v-model="title"
            :label="$t('newsAdmin.articleTitle')"
            label-placement="stacked"
            :placeholder="$t('newsAdmin.titlePlaceholder')"
            required
        />
      </ion-item>

      <!-- Header Image Upload -->
      <div class="upload-section">
        <label class="upload-label">{{ $t('newsAdmin.headerImage') }}</label>
        <input type="file" accept="image/*" @change="handleHeaderImage" />
        <div v-if="headerPreview" class="image-preview">
          <img :src="headerPreview" alt="Header Preview" />
        </div>
      </div>

      <!-- Toggle -->
      <ion-segment v-model="useRawHtml" class="mode-toggle">
      <ion-segment-button value="editor">
          <ion-label>{{ $t('newsAdmin.editor') }}</ion-label>
        </ion-segment-button>
        <ion-segment-button value="raw">
          <ion-label>{{ $t('newsAdmin.rawHtml') }}</ion-label>
        </ion-segment-button>
      </ion-segment>

      <!-- Editor Section -->
      <div class="editor-section">
        <label class="upload-label">{{ $t('newsAdmin.content') }}</label>
        <div v-if="useRawHtml === 'editor'">
          <QuillEditor
              ref="quillRef"
              theme="snow"
              toolbar="full"
              :placeholder="$t('newsAdmin.editorPlaceholder')"
              @text-change="onQuillTextChange"
          />
        </div>
        <div v-else>
          <ion-textarea
              v-model="content"
              :label="$t('newsAdmin.rawHtml')"
              label-placement="stacked"
              auto-grow
              :rows="10"
          />
        </div>
      </div>

      <!-- Actions -->
      <ion-button expand="block" color="carrot" class="ion-margin-top" @click="submitArticle" :disabled="loading">
        {{ loading ? $t('newsAdmin.publishing') : (isEdit ? $t('newsAdmin.update') : $t('newsAdmin.publish')) }}
      </ion-button>

      <ion-toast
          :is-open="showToast"
          :message="toastMessage"
          :duration="2000"
          color="success"
          position="bottom"
          @did-dismiss="showToast = false"
      />

      <ion-toast
          :is-open="showErrorToast"
          :message="errorMsg"
          :duration="2500"
          color="danger"
          position="bottom"
          @did-dismiss="showErrorToast = false"
      />

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, computed } from 'vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonItem,
  IonInput,
  IonButton,
  IonBackButton,
  IonButtons,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonTextarea,
  IonToast
} from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '@/plugins/supabaseClient';
import type { User } from '@supabase/supabase-js';
import { QuillEditor } from '@vueup/vue-quill';
import '@vueup/vue-quill/dist/vue-quill.snow.css';
import {usePoints} from "@/composables/usePoints";
import { useNotifier } from "@/composables/useNotifier";
import { useI18n } from 'vue-i18n';

const user = ref<User | null>(null);
const title = ref('');
const content = ref('');
const headerFile = ref<File | null>(null);
const headerPreview = ref<string | null>(null);
const loading = ref(false);

const quillRef = ref();
const useRawHtml = ref('editor');

const showToast = ref(false);
const showErrorToast = ref(false);
const toastMessage = ref('');
const errorMsg = ref('');

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const isEdit = computed(() => !!route.params.id);
const editingId = computed(() => route.params.id as string);

const { notifyEvent } = useNotifier()
const { awardAndCelebrate } = usePoints();

// Prefill form if editing
onMounted(async () => {
  const { data } = await supabase.auth.getUser();
  user.value = data.user;

  if (isEdit.value) {
    const { data: article, error } = await supabase
        .from('news')
        .select('*')
        .eq('id', editingId.value)
        .single();

    if (!error && article) {
      title.value = article.title;
      content.value = article.content;
      headerPreview.value = article.header_image;

      // 🛠️ Manually update the Quill editor content if mode is 'editor'
      nextTick(() => {
        if (useRawHtml.value === 'editor' && quillRef.value) {
          const quill = quillRef.value.getQuill();
          if (quill) {
            quill.setContents([]);
            quill.clipboard.dangerouslyPasteHTML(article.content || '');
          }
        }
      });
    }
  }
});

// Sync raw ↔ editor
watch(useRawHtml, async (val) => {
  if (val === 'editor') {
    await nextTick();
    const quill = quillRef.value?.getQuill();
    if (quill) {
      quill.setContents([]);
      quill.clipboard.dangerouslyPasteHTML(content.value || '');
    }
  }
});

function onQuillTextChange() {
  const quill = quillRef.value?.getQuill();
  if (quill) content.value = quill.root.innerHTML;
}

function handleHeaderImage(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0] || null;
  if (file) {
    headerFile.value = file;
    headerPreview.value = URL.createObjectURL(file);
  }
}

async function submitArticle() {
  if (!user.value) {
    errorMsg.value = t('newsAdmin.loginRequired');
    showErrorToast.value = true;
    return;
  }

  if (!title.value || !content.value) {
    alert(t('newsAdmin.requiredFields'));
    return;
  }

  loading.value = true;
  let newsId = editingId.value;

  // Step 1: Insert or update article (without image)
  if (isEdit.value) {
    const { error: updateError } = await supabase
        .from('news')
        .update({
          title: title.value,
          content: content.value,
          updated_at: new Date()
        })
        .eq('id', editingId.value);

    if (updateError) {
      errorMsg.value = '❌ Failed to update: ' + updateError.message;
      showErrorToast.value = true;
      loading.value = false;
      return;
    }

    // 🔔 Notify Discord about edit
    await notifyEvent(
        "update_article",
        "📝 News Article Updated",
        `${title.value}`,
        headerPreview.value || undefined,   // use preview (existing or uploaded)
        { id: newsId }                      // use the correct article ID
    );

  } else {
    const { data: insertResult, error: insertError } = await supabase
        .from('news')
        .insert({
          title: title.value,
          content: content.value,
          created_at: new Date(),
          author_id: user.value.id,
          author_name: user.value.user_metadata.name,
        })
        .select()
        .single();

    if (insertError || !insertResult) {
      errorMsg.value = '❌ ' + (insertError?.message || 'Insert failed.');
      showErrorToast.value = true;
      loading.value = false;
      return;
    }
    newsId = insertResult.id;

    await notifyEvent(
        "new_article",
        "📰 New News Article Published",
        `${title.value}`,
        headerPreview.value || undefined,   // show header image preview (if any)
        { id: newsId }                      // pass article ID for deep link
    );
  }

  // Step 2: Upload image if selected
  if (headerFile.value) {
    const filePath = `${newsId}/${Date.now()}-${headerFile.value.name}`;
    const { error: uploadError } = await supabase.storage
        .from('news-images')
        .upload(filePath, headerFile.value, { upsert: true });

    if (uploadError) {
      console.error('❌ Image upload failed:', uploadError.message);
    } else {
      const { data: urlData } = supabase.storage
          .from('news-images')
          .getPublicUrl(filePath);

      const headerUrl = urlData?.publicUrl;

      // Step 3: Update header_image field
      if (headerUrl) {
        const { error: imageUpdateError } = await supabase
            .from('news')
            .update({ header_image: headerUrl })
            .eq('id', newsId);

        if (imageUpdateError) {
          console.error('❌ Failed to set image:', imageUpdateError.message);
        }
      }
    }
  }

  loading.value = false;
  if (!isEdit.value) {
    // Only give points if it's a new article
    await awardAndCelebrate("create_news", 10000);
  }

  toastMessage.value = isEdit.value
      ? t('newsAdmin.updateSuccess')
      : t('newsAdmin.publishSuccess');

  showToast.value = true;

  // Clear form or redirect
  setTimeout(() => {
    router.push(`/news/${newsId}`);
  }, 1200);
}
</script>


<style scoped>
ion-toast {
  margin-bottom: 80px;
}

.mode-toggle {
  margin-top: 1rem;
  margin-bottom: 1rem;
}

.upload-section {
  margin-top: 1rem;
}

.upload-label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.image-preview {
  margin-top: 0.5rem;
  max-width: 100%;
}

.image-preview img {
  max-width: 100%;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.editor-section {
  margin-top: 1rem;
}

/* Scoped or global */
:deep(.ql-toolbar) {
  background-color: var(--ion-background-color-step-50);
  border-radius: 8px 8px 0 0;
  padding: 0.5rem;
}
:deep(.ql-container) {
  border-radius: 0 0 8px 8px;
}

:deep(.ql-editor.ql-blank::before) {
  color: var(--ion-color-dark);
}

:deep(.ql-toolbar) {
  background-color: var(--ion-background-color-step-300); /* or a custom dark color */
  border-color: var(--ion-color-medium);
}

:deep(.ql-toolbar .ql-picker-label),
:deep(.ql-toolbar .ql-picker-item),
:deep(.ql-toolbar button) {
  color: var(--ion-color-dark); /* Text/icon color */
}

:deep(.ql-toolbar button:hover),
:deep(.ql-toolbar button.ql-active),
:deep(.ql-toolbar .ql-picker-label:hover),
:deep(.ql-toolbar .ql-picker-item:hover) {
  color: var(--ion-color-primary); /* Hover/active highlight */
}

/* Optional: lighten SVG icons too */
:deep(.ql-toolbar .ql-stroke) {
  stroke: var(--ion-color-dark);
}
:deep(.ql-toolbar .ql-fill) {
  fill: var(--ion-color-dark);
}


</style>
