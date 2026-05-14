<template>
  <div ref="sectionRef" :style="{ minHeight: isLoaded ? 'auto' : placeholderHeight }">
    <slot v-if="isLoaded"></slot>
    <div v-else class="lazy-placeholder">
      <!-- Optional: You can put a generic skeleton here if needed -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  placeholderHeight: {
    type: String,
    default: '100px'
  },
  rootMargin: {
    type: String,
    default: '200px' // Load 200px before it enters the viewport
  }
});

const emit = defineEmits(['load']);

const sectionRef = ref<HTMLElement | null>(null);
const isLoaded = ref(false);

let observer: IntersectionObserver | null = null;

onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      isLoaded.value = true;
      emit('load');
      if (observer) {
        observer.disconnect();
      }
    }
  }, {
    rootMargin: props.rootMargin
  });

  if (sectionRef.value) {
    observer.observe(sectionRef.value);
  }
});

onBeforeUnmount(() => {
  if (observer) {
    observer.disconnect();
  }
});
</script>

<style scoped>
.lazy-placeholder {
  width: 100%;
}
</style>
