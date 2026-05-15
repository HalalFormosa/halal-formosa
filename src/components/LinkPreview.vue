<template>
  <div v-if="preview" class="link-preview-container" @click="openLink">
    <div v-if="preview.image" class="preview-image-box">
      <img :src="preview.image.url" :alt="preview.title" />
    </div>
    <div class="preview-content">
      <div v-if="preview.publisher" class="preview-publisher">
        <img v-if="preview.logo" :src="preview.logo.url" class="publisher-logo" />
        <span>{{ preview.publisher }}</span>
      </div>
      <h4 class="preview-title">{{ preview.title }}</h4>
      <p v-if="preview.description" class="preview-desc">{{ truncate(preview.description, 100) }}</p>
      <span class="preview-url">{{ displayUrl }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue'

const props = defineProps<{
  url: string
}>()

const preview = ref<any>(null)
const loading = ref(false)

const displayUrl = computed(() => {
  try {
    const url = new URL(props.url)
    return url.hostname
  } catch {
    return props.url
  }
})

const emit = defineEmits(['load'])

async function fetchPreview() {
  if (!props.url) return
  loading.value = true
  try {
    const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(props.url)}`)
    const result = await res.json()
    if (result.status === 'success') {
      preview.value = result.data
      nextTick(() => emit('load'))
    }
  } catch (err) {
    console.error('Link preview error:', err)
  } finally {
    loading.value = false
  }
}

function truncate(text: string, length: number) {
  if (!text) return ''
  return text.length > length ? text.substring(0, length) + '...' : text
}

function openLink() {
  window.open(props.url, '_blank')
}

onMounted(() => {
  fetchPreview()
})
</script>

<style scoped>
.link-preview-container {
  margin-top: 8px;
  background: var(--ion-background-color);
  border: 1px solid var(--ion-color-step-150, rgba(0,0,0,0.1));
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  max-width: 100%;
}

.link-preview-container:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.preview-image-box {
  width: 100%;
  height: 150px;
  overflow: hidden;
  background: var(--ion-color-step-50);
}

.preview-image-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-content {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-publisher {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--ion-color-step-600);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.publisher-logo {
  width: 14px;
  height: 14px;
  border-radius: 2px;
}

.preview-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--ion-text-color);
  line-height: 1.3;
}

.preview-desc {
  margin: 0;
  font-size: 12px;
  color: var(--ion-color-step-500);
  line-height: 1.4;
}

.preview-url {
  font-size: 11px;
  color: var(--ion-color-step-400);
}

/* Specific styling when inside a message bubble column */
:deep(.bubble-col) .link-preview-container {
  margin-left: 0;
  margin-right: 0;
}
</style>
