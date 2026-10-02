<template>
  <ion-page>
    <ion-header>
      <app-header :title="article?.title || 'Ingredient'" show-back back-route="/profile/ingredient-encyclopedia" />
    </ion-header>

    <ion-content class="ion-padding">
      <div v-if="loading" class="ion-text-center ion-margin-top">
        <ion-spinner name="crescent" color="carrot" />
      </div>

      <template v-else-if="article">
        <div v-if="article.image_url" class="hero-image-wrapper">
          <img :src="article.image_url" :alt="article.title" class="hero-image" />
          <p v-if="article.image_credit" class="hero-image-credit">{{ article.image_credit }}</p>
        </div>

        <span :class="['status-badge', article.status]">{{ statusLabel(article.status) }}</span>
        <h1 class="article-title">{{ article.title }}</h1>
        <p class="article-summary">{{ article.summary }}</p>

        <div v-if="article.aliases.length" class="alias-row">
          <span v-for="alias in article.aliases" :key="alias.id" class="alias-chip">
            {{ alias.alias_en }}<span v-if="alias.alias_zh_hant" class="alias-zh"> {{ alias.alias_zh_hant }}</span>
          </span>
        </div>

        <div class="article-body" v-html="renderedBody" @click="onBodyClick"></div>

        <template v-if="article.products.length">
          <h3 class="section-title">Commonly found in</h3>
          <ul class="product-list">
            <li v-for="p in article.products" :key="p.id">{{ p.example }}</li>
          </ul>
        </template>

        <template v-if="article.sources.length">
          <h3 class="section-title">Sources &amp; opinions</h3>
          <div
            v-for="s in article.sources"
            :key="s.id"
            :id="`source-${s.sort_order}`"
            class="source-card"
          >
            <div class="source-header">
              <span class="source-number">[{{ s.sort_order }}]</span>
              <strong>{{ s.organization }}</strong>
              <span :class="['stance-badge', s.stance]">{{ s.stance }}</span>
            </div>
            <p v-if="s.note" class="source-note">{{ s.note }}</p>
            <a v-if="s.url" :href="s.url" target="_blank" rel="noopener noreferrer" class="source-link">View source</a>
          </div>
        </template>
      </template>

      <div v-else class="empty-state">
        <p>Article not found.</p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { IonPage, IonHeader, IonContent, IonSpinner } from '@ionic/vue'
import AppHeader from '@/components/AppHeader.vue'
import {
  fetchIngredientArticleBySlug,
  type IngredientArticleDetail,
  type IngredientArticleStatus
} from '@/composables/useIngredientArticles'

const props = defineProps<{ slug: string }>()

const loading = ref(true)
const article = ref<IngredientArticleDetail | null>(null)

function statusLabel(status: IngredientArticleStatus) {
  if (status === 'haram') return 'Haram'
  if (status === 'syubhah') return 'Syubhah'
  return 'Muslim-friendly'
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Body is authored by us (admin-only, via Supabase), never user-generated,
// so rendering the escaped+markup-injected result as HTML is safe here.
const renderedBody = computed(() => {
  if (!article.value) return ''
  const escaped = escapeHtml(article.value.body)
    .replace(/\[\^(\d+)\]/g, (_match, n) => `<sup><a href="#source-${n}" class="citation-link" data-source="${n}">[${n}]</a></sup>`)
  return escaped
    .split(/\n\n+/)
    .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('')
})

function onBodyClick(event: MouseEvent) {
  const link = (event.target as HTMLElement).closest('.citation-link') as HTMLElement | null
  if (!link) return
  event.preventDefault()

  const sourceNumber = link.dataset.source
  const target = document.getElementById(`source-${sourceNumber}`)
  if (!target) return

  target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  target.classList.add('source-highlight')
  setTimeout(() => target.classList.remove('source-highlight'), 1600)
}

onMounted(async () => {
  try {
    article.value = await fetchIngredientArticleBySlug(props.slug)
  } catch (err) {
    console.error('Error loading ingredient article:', err)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.hero-image-wrapper {
  margin: -16px -16px 16px;
}

.hero-image {
  width: 100%;
  height: 200px;
  object-fit: cover;
  display: block;
}

.hero-image-credit {
  font-size: 10px;
  color: var(--ion-color-medium);
  text-align: right;
  margin: 4px 16px 0 0;
}

.status-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.status-badge.haram {
  background: rgba(var(--ion-color-danger-rgb), 0.1);
  color: var(--ion-color-danger);
}

.status-badge.syubhah {
  background: rgba(var(--ion-color-warning-rgb), 0.1);
  color: var(--ion-color-warning);
}

.status-badge.muslim_friendly {
  background: rgba(var(--ion-color-success-rgb), 0.1);
  color: var(--ion-color-success);
}

.article-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 4px 0 8px;
}

.article-summary {
  font-size: 1rem;
  color: var(--ion-color-medium);
  line-height: 1.5;
  margin-bottom: 16px;
}

.alias-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 20px;
}

.alias-chip {
  font-size: 12px;
  background: var(--ion-color-light);
  color: var(--ion-color-dark);
  padding: 4px 10px;
  border-radius: 12px;
}

.alias-zh {
  color: var(--ion-color-carrot, var(--ion-color-primary));
  font-weight: 600;
}

.article-body {
  font-size: 15px;
  line-height: 1.7;
  margin-bottom: 24px;
}

.article-body :deep(p) {
  margin: 0 0 14px;
}

.article-body :deep(.citation-link) {
  color: var(--ion-color-carrot, var(--ion-color-primary));
  font-weight: 700;
  text-decoration: none;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-top: 24px;
  margin-bottom: 8px;
}

.product-list {
  padding-left: 20px;
  margin: 0 0 16px;
}

.product-list li {
  font-size: 14px;
  line-height: 1.6;
}

.source-card {
  background: var(--ion-color-light);
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 10px;
  scroll-margin-top: 60px;
  transition: background-color 0.3s ease;
}

.source-card.source-highlight {
  background: rgba(var(--ion-color-carrot-rgb, var(--ion-color-primary-rgb)), 0.18);
}

.source-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.source-header strong {
  flex: 1;
}

.source-number {
  font-size: 12px;
  font-weight: 700;
  color: var(--ion-color-medium);
}

.stance-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 6px;
}

.stance-badge.haram {
  background: rgba(var(--ion-color-danger-rgb), 0.15);
  color: var(--ion-color-danger);
}

.stance-badge.permissible {
  background: rgba(var(--ion-color-success-rgb), 0.15);
  color: var(--ion-color-success);
}

.stance-badge.disputed {
  background: rgba(var(--ion-color-warning-rgb), 0.15);
  color: var(--ion-color-warning);
}

.source-note {
  font-size: 13px;
  color: var(--ion-color-medium);
  margin: 6px 0;
}

.source-link {
  font-size: 13px;
  color: var(--ion-color-carrot, var(--ion-color-primary));
  font-weight: 600;
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--ion-color-medium);
}
</style>
