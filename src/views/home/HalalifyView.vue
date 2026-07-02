<template>
  <ion-page>
    <ion-header>
      <app-header
        title="Halalify"
        :icon="languageOutline"
        :showBack="true"
        backRoute="/home"
      />
      
      <!-- Search & Voice Controls Header -->
      <div class="controls-row ion-padding-horizontal">
        <ion-searchbar
          v-model="searchQuery"
          placeholder="Search phrases..."
          class="phrase-searchbar"
          mode="ios"
        />
        
        <!-- Voice Selector -->
        <div v-if="availableVoices.length > 0" class="voice-selector-wrapper">
          <ion-icon :icon="volumeMediumOutline" class="voice-icon" />
          <ion-select
            v-model="selectedVoiceName"
            interface="popover"
            class="voice-select"
            selected-text="Change Voice"
          >
            <ion-select-option
              v-for="voice in availableVoices"
              :key="voice.name"
              :value="voice.name"
            >
              {{ voice.name === selectedVoiceName ? '✓ ' : '' }}{{ getFriendlyVoiceName(voice) }}
            </ion-select-option>
          </ion-select>
        </div>
      </div>

      <!-- Categories Selector -->
      <div class="categories-scroll ion-padding-horizontal">
        <ion-button
          v-for="cat in categories"
          :key="cat.id"
          size="small"
          :fill="selectedCategory === cat.id ? 'solid' : 'outline'"
          color="carrot"
          class="category-btn"
          @click="selectCategory(cat.id)"
        >
          {{ cat.name }}
        </ion-button>
      </div>
    </ion-header>

    <ion-content class="ion-padding">
      <div v-if="filteredPhrases.length === 0" class="empty-state">
        <ion-icon :icon="bookOutline" class="empty-icon" />
        <h3>No Phrases Found</h3>
        <p v-if="selectedCategory === 'favorites'">You haven't favorited any phrases yet (maximum of 10).</p>
        <p v-else>Try adjusting your search term.</p>
      </div>

      <div v-else class="phrases-list">
        <div
          v-for="(p, index) in filteredPhrases"
          :key="'phrase-' + index"
          :class="['phrase-card', { 'locked-card': isPhrasePremium(p) && !isDonor }]"
        >
          <div class="phrase-header">
            <span class="phrase-tag">{{ p.category }}</span>
            <div class="phrase-actions">
              <ion-button
                fill="clear"
                size="small"
                color="carrot"
                class="phrase-action-btn"
                @click="isPhrasePremium(p) && !isDonor ? presentRcPaywall() : toggleFavorite(p)"
              >
                <ion-icon slot="icon-only" :icon="isPhrasePremium(p) && !isDonor ? lockClosed : (isFavorite(p.chinese) ? star : starOutline)" />
              </ion-button>
              <ion-button
                fill="clear"
                size="small"
                color="carrot"
                class="phrase-action-btn"
                @click="isPhrasePremium(p) && !isDonor ? presentRcPaywall() : copyPhrase(p.chinese)"
              >
                <ion-icon slot="icon-only" :icon="copyOutline" />
              </ion-button>
              <ion-button
                v-if="isAdmin"
                fill="clear"
                size="small"
                color="medium"
                class="phrase-action-btn"
                @click="router.push({ path: '/admin/halalify-phrases', query: { phraseId: p.id } })"
              >
                <ion-icon slot="icon-only" :icon="createOutline" />
              </ion-button>
            </div>
          </div>

          <div class="phrase-body">
            <h4 class="phrase-english">{{ getLocalizedExplanation(p.english) }}</h4>
            <template v-if="isPhrasePremium(p) && !isDonor">
              <div class="locked-content-placeholder" @click="presentRcPaywall">
                <ion-icon :icon="lockClosed" class="lock-placeholder-icon" />
                <span class="lock-placeholder-text">Unlock Pro to see translation & pronunciation</span>
              </div>
            </template>
            <template v-else>
              <div class="phrase-chinese-row">
                <div class="phrase-chinese-box">
                  <div class="phrase-chinese-segments">
                    <div
                      v-for="(seg, segIdx) in segmentPhrase(p)"
                      :key="segIdx"
                      class="chinese-segment"
                    >
                      <div class="chinese-segment-chars">
                        <span
                          v-for="(char, charIdx) in seg.text.split('')"
                          :key="charIdx"
                          :class="{ 'highlight-active': isCharHighlighted(p, seg.start + charIdx) }"
                          class="align-char"
                        >{{ char }}</span>
                      </div>
                      <span v-if="seg.gloss" class="segment-gloss">{{ seg.gloss }}</span>
                    </div>
                  </div>
                </div>
                <ion-button
                  fill="solid"
                  color="carrot"
                  class="play-btn"
                  :class="{ 'speaking': activeSpeechText === p.chinese }"
                  @click="playPhrase(p.chinese)"
                >
                  <ion-icon slot="icon-only" :icon="activeSpeechText === p.chinese ? pauseCircleOutline : playCircleOutline" />
                </ion-button>
              </div>
              <p class="phrase-pinyin">
                <span class="label">Pinyin:</span>
                <span
                  v-for="(word, wordIdx) in p.pinyin.split(' ')"
                  :key="wordIdx"
                  :class="{ 'highlight-active': isPinyinWordHighlighted(p, wordIdx) }"
                  style="margin-right: 4px;"
                >{{ word.replace(/-/g, '') }}</span>
              </p>
              <p class="phrase-pronunciation">
                <span class="label">Pronounce:</span> "{{ p.pronunciation }}"
              </p>
            </template>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  IonPage, IonHeader,
  IonContent, IonSearchbar, IonSelect, IonSelectOption, IonButton, IonIcon, toastController
} from '@ionic/vue'
import {
  volumeMediumOutline, copyOutline, playCircleOutline, pauseCircleOutline, bookOutline, star, starOutline, lockClosed, createOutline, languageOutline
} from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import { useHalalifyFavorites } from '@/composables/useHalalifyFavorites'
import { useHalalifyPhrases } from '@/composables/useHalalifyPhrases'
import type { HalalifyPhrase } from '@/data/halalifyPhrases'
import { isDonor, refreshSubscriptionStatus } from '@/composables/useSubscriptionStatus'
import { isAdmin } from '@/composables/userProfile'
import { RevenueCatUI, PAYWALL_RESULT } from '@revenuecat/purchases-capacitor-ui'
import { Capacitor } from '@capacitor/core'
import { ActivityLogService } from '@/services/ActivityLogService'
import { supabase } from '@/plugins/supabaseClient'

// Categories list
const categories = [
  { id: 'all', name: 'All' },
  { id: 'favorites', name: 'Favorites' },
  { id: 'dining', name: 'Dietary & Dining' },
  { id: 'shopping', name: 'Shopping & Ingredients' },
  { id: 'travel', name: 'Hotel & Travel' },
  { id: 'emergency', name: 'Emergency & Help' }
]

const router = useRouter()

const selectedCategory = ref('all')
const searchQuery = ref('')
const activeSpeechText = ref<string | null>(null)
const availableVoices = ref<SpeechSynthesisVoice[]>([])
const selectedVoiceName = ref<string>('')

const currentSpeechCharIndex = ref(-1)
const currentSpeechCharLength = ref(0)

const { phrases, initPhrases } = useHalalifyPhrases()
const { locale } = useI18n()
const { favorites, loadFavorites, toggleFavorite, isFavorite } = useHalalifyFavorites()

function segmentPhrase(phrase: HalalifyPhrase): Array<{ text: string; gloss: string; start: number }> {
  if (!phrase.alignments || phrase.alignments.length === 0) {
    return phrase.chinese.split('').map((char, idx) => ({ text: char, gloss: '', start: idx }))
  }

  const currentLang = (locale.value || 'en').split('-')[0].toLowerCase()
  const segments: Array<{ text: string; gloss: string; start: number }> = []
  const matchedRanges: Array<{ start: number; end: number }> = []
  const sortedAlignments = [...phrase.alignments].sort((a, b) => (b.zh?.length || 0) - (a.zh?.length || 0))
  
  for (const align of sortedAlignments) {
    if (!align.zh) continue
    let pos = phrase.chinese.indexOf(align.zh)
    while (pos !== -1) {
      const end = pos + align.zh.length
      const overlap = matchedRanges.some(r => (pos >= r.start && pos < r.end) || (end > r.start && end <= r.end))
      if (!overlap) {
        matchedRanges.push({ start: pos, end })
        const glossWord = align[currentLang] || align['en'] || ''
        segments.push({
          text: align.zh,
          gloss: glossWord,
          start: pos
        })
      }
      pos = phrase.chinese.indexOf(align.zh, pos + 1)
    }
  }
  
  for (let i = 0; i < phrase.chinese.length; i++) {
    const isMapped = matchedRanges.some(r => i >= r.start && i < r.end)
    if (!isMapped) {
      segments.push({
        text: phrase.chinese[i],
        gloss: '',
        start: i
      })
    }
  }
  
  segments.sort((a, b) => a.start - b.start)
  return segments
}

function isCharHighlighted(phrase: HalalifyPhrase, charIdx: number): boolean {
  if (activeSpeechText.value !== phrase.chinese) return false
  return charIdx >= currentSpeechCharIndex.value && 
         charIdx < (currentSpeechCharIndex.value + currentSpeechCharLength.value)
}

function getCleanIndex(text: string, rawCharIdx: number): number {
  let cleanIdx = 0
  for (let i = 0; i < rawCharIdx; i++) {
    const char = text[i]
    if (char && !/[，。？、！；：()[\]{}""'',.!?／]/.test(char)) {
      cleanIdx++
    }
  }
  return cleanIdx
}

function isPinyinWordHighlighted(phrase: any, wordIdx: number): boolean {
  if (activeSpeechText.value !== phrase.chinese) return false
  
  const pinyinWords = phrase.pinyin.split(' ')
  let charStart = 0
  for (let i = 0; i < wordIdx; i++) {
    const word = pinyinWords[i]
    const syllableCount = word.split('-').length
    charStart += syllableCount
  }
  
  const currentWord = pinyinWords[wordIdx]
  const syllableCount = currentWord.split('-').length
  const charEnd = charStart + syllableCount
  
  const cleanSpeakStart = getCleanIndex(phrase.chinese, currentSpeechCharIndex.value)
  const cleanSpeakEnd = cleanSpeakStart + currentSpeechCharLength.value
  
  return cleanSpeakStart < charEnd && cleanSpeakEnd > charStart
}

// Translation mappings for details explanations (Only Traditional Chinese used)
const phraseTranslations: Record<string, Record<string, string>> = {
  "Does this contain pork or lard?": {
    en: "Does this contain pork or lard?",
    id: "Apakah ini mengandung babi atau minyak babi?",
    ms: "Adakah ini mengandungi babi atau minyak babi?",
    zh: "這個含有豬肉或豬油嗎？",
    "zh-CN": "這個含有豬肉或豬油嗎？",
    ar: "هل يحتوي هذا على لحم الخنزير أو دهن الخنزير؟",
    ja: "これには豚肉やラードが含まれていますか？",
    ko: "이것은 돼지고기나 돼지기름을 포함하고 있습니까?",
    th: "สิ่งนี้มีส่วนผสมของหมูหรือน้ำมันหมูหรือไม่?",
    vi: "Cái này có chứa thịt lợn hoặc mỡ lợn không?"
  },
  "Does this dish contain alcohol?": {
    en: "Does this dish contain alcohol?",
    id: "Apakah hidangan ini mengandung alkohol?",
    ms: "Adakah hidangan ini mengandungi alkohol?",
    zh: "這道菜含有酒精嗎？",
    "zh-CN": "這道菜含有酒精嗎？",
    ar: "هل يحتوي هذا الطبق على الكحول؟",
    ja: "この料理にはアルコールが含まれていますか？",
    ko: "이 요리에 알코올이 들어있습니까?",
    th: "อาหารจานนี้มีแอลกอールหรือไม่?",
    vi: "Món ăn này có chứa rượu/cồn không?"
  },
  "I cannot eat pork, lard, or alcohol.": {
    en: "I cannot eat pork, lard, or alcohol.",
    id: "Saya tidak bisa makan babi, minyak babi, atau alkohol.",
    ms: "Saya tidak boleh makan babi, minyak babi, atau alkohol.",
    zh: "我不吃豬肉、豬油或含有酒精的的食物。",
    "zh-CN": "我不吃豬肉、豬油或含有酒精的食物。",
    ar: "لا يمكنني تناول لحم الخنزير أو دهنه أو الكحول.",
    ja: "私は豚肉、ラード、アルコールを食べられません。",
    ko: "저는 돼지고기, 돼지기름, 알코올을 먹을 수 없습니다.",
    th: "ฉันไม่สามารถทานหมู น้ำมันหมู หรือแอลกอฮอล์ได้",
    vi: "Tôi không thể ăn thịt lợn, mỡ lợn hoặc rượu/cồn."
  },
  "Is this vegetarian / vegan?": {
    en: "Is this vegetarian / vegan?",
    id: "Apakah ini vegetarian / vegan?",
    ms: "Adakah ini vegetarian / vegan?",
    zh: "這是素食嗎？",
    "zh-CN": "這是素食嗎？",
    ar: "هل هذا نباتي؟",
    ja: "こちらはベジタリアン/ビーガンですか？",
    ko: "이것은 채식입니까?",
    th: "นี่เป็นอาหารเจ / มังสวิรัติหรือไม่?",
    vi: "Đây có phải là đồ ăn chay không?"
  },
  "Do you have any Halal-certified food?": {
    en: "Do you have any Halal-certified food?",
    id: "Apakah Anda memiliki makanan bersertifikat Halal?",
    ms: "Adakah anda mempunyai makanan diperakui Halal?",
    zh: "請問有清真認證的食物嗎？",
    "zh-CN": "請問有清真認證的食物嗎？",
    ar: "هل لديكم طعام معتمد حلال？",
    ja: "ハラール認証の食品はありますか？",
    ko: "할랄 인증 식품이 있습니까?",
    th: "คุณมีอาหารที่ได้รับการรับรองฮาลาลหรือไม่?",
    vi: "Bạn có đồ ăn được chứng nhận Halal không?"
  },
  "Can you prepare this without alcohol or pork?": {
    en: "Can you prepare this without alcohol or pork?",
    id: "Bisakah Anda menyiapkan ini tanpa alkohol atau babi?",
    ms: "Bolehkah anda menyediakan ini tanpa alkohol atau babi?",
    zh: "可以不加酒或豬肉來製作嗎？",
    "zh-CN": "可以不加酒或豬肉來製作嗎？",
    ar: "هل يمكنك إعداد هذا بدون كحول أو لحم خنزير؟",
    ja: "アルコールや豚肉なしで調理していただけますか？",
    ko: "알코올이나 돼지고기 없이 준비해 주실 수 있나요？",
    th: "ช่วยปรุงอาหารนี้โดยไม่มีแอลกอฮอล์หรือหมูได้ไหม？",
    vi: "Bạn có thể chuẩn bị món này mà không có rượu/cồn hoặc thịt lợn không？"
  },
  "Are the utensils and cookware used for pork?": {
    en: "Are the utensils and cookware used for pork?",
    id: "Apakah peralatan makan dan masak digunakan untuk babi?",
    ms: "Adakah peralatan makan dan memasak digunakan untuk babi?",
    zh: "這些餐具和鍋子有用來煮過豬肉嗎？",
    "zh-CN": "這些餐具和鍋子有用來煮過豬肉嗎？",
    ar: "هل أدوات المائدة والطهي مستخدمة للحم الخنزير؟",
    ja: "食器や調理器具は豚肉に使用されていますか？",
    ko: "식기와 조리기구가 돼지고기용으로 사용되나요？",
    th: "อุปกรณ์ทานอาหารและภาชนะปรุงอาหารใช้ร่วมกับหมูหรือไม่？",
    vi: "Các dụng cụ ăn uống và nấu nướng có được dùng cho thịt lợn không？"
  },
  "Is the meat Halal (slaughtered according to Islamic rites)?": {
    en: "Is the meat Halal (slaughtered according to Islamic rites)?",
    id: "Apakah dagingnya Halal (disembelih sesuai syariat Islam)?",
    ms: "Adakah dagingnya Halal (disembelih mengikut syariat Islam)?",
    zh: "請問這個肉是清真處理的嗎？",
    "zh-CN": "請問這個肉是清真處理的嗎？",
    ar: "هل اللحم حلال (مذبوح وفقاً للشريعة الإسلامية)؟",
    ja: "この肉はハラール（イスラムの儀式に従って屠殺されたもの）ですか？",
    ko: "이 고기는 할랄(이슬람 의식에 따라 도축된 고기)인가요？",
    th: "เนื้อสัตว์นี้เป็นฮาลาล (เชือดตามหลักศาสนาอิสลาม) หรือไม่？",
    vi: "Thịt này có phải là Halal (được giết mổ theo nghi thức Hồi giáo) không？"
  },
  "Does this product have gelatin?": {
    en: "Does this product have gelatin?",
    id: "Apakah produk ini mengandung gelatin?",
    ms: "Adakah produk ini mengandungi gelatin?",
    zh: "這個產品含有明膠（吉利丁）嗎？",
    "zh-CN": "這個產品含有明膠（吉利丁）嗎？",
    ar: "هل يحتوي هذا المنتج على الجيلاتين؟",
    ja: "この製品にはゼラチンが含まれていますか？",
    ko: "이 제품에 젤라틴이 들어있습니까？",
    th: "ผลิตภัณฑ์นี้มีเจลาตินหรือไม่？",
    vi: "Sản phẩm này có chứa gelatin không？"
  },
  "Is the gelatin from plants or animals?": {
    en: "Is the gelatin from plants or animals?",
    id: "Apakah gelatinnya berasal dari tumbuhan atau hewan?",
    ms: "Adakah gelatinnya berasal dari tumbuhan atau haiwan?",
    zh: "這裡面的明膠是植物性還是動物性的？",
    "zh-CN": "這裡面的明膠是植物性還是動物性的？",
    ar: "هل الجيلاتين من مصدر نباتي أم حيواني؟",
    ja: "ゼラチンは植物性ですか、それとも動物性ですか？",
    ko: "젤라틴은 식물성인가요, 동물성인가요？",
    th: "เจลาตินมาจากพืชหรือสัตว์？",
    vi: "Gelatin này có nguồn gốc từ thực vật hay động vật？"
  },
  "Is the emulsifier from plant origin?": {
    en: "Is the emulsifier from plant origin?",
    id: "Apakah pengemulsinya berasal dari tumbuhan?",
    ms: "Adakah pengemulsinya berasal dari tumbuhan?",
    zh: "這個乳化劑是植物來源的嗎？",
    "zh-CN": "這個乳化劑是植物來源的嗎？",
    ar: "هل المستحلب من مصدر نباتي؟",
    ja: "乳化剤は植物由来ですか？",
    ko: "유화제는 식물성인가요？",
    th: "สารอิมัลซิไฟเออร์มาจากพืชหรือไม่？",
    vi: "Chất nhũ hóa có nguồn gốc từ thực vật không？"
  },
  "Does this contain any animal derivatives?": {
    en: "Does this contain any animal derivatives?",
    id: "Apakah ini mengandung bahan turunan hewan?",
    ms: "Adakah ini mengandungi bahan terbitan haiwan?",
    zh: "這個含有任何動物成分嗎？",
    "zh-CN": "這個含有任何動物成分嗎？",
    ar: "هل يحتوي هذا على أي مشتقات حيوانية؟",
    ja: "これには動物由来の成分が含まれていますか？",
    ko: "이것은 동물 유래 성분을 포함하고 있습니까？",
    th: "สิ่งนี้มีส่วนผสมที่มาจากสัตว์หรือไม่？",
    vi: "Sản phẩm này có chứa bất kỳ dẫn xuất động vật nào không？"
  },
  "Which of these contains meat?": {
    en: "Which of these contains meat?",
    id: "Yang mana dari ini yang mengandung daging?",
    ms: "Yang mana satu daripada ini mengandungi daging?",
    zh: "請問哪一個裡面有含肉？",
    "zh-CN": "請問哪一個裡面有含肉？",
    ar: "أي من هذه يحتوي على اللحم؟",
    ja: "この中で肉が含まれているのはどれですか？",
    ko: "이 중 어느 것에 고기가 들어있나요？",
    th: "อันไหนในนี้มีเนื้อสัตว์ผสมอยู่บ้าง？",
    vi: "Cái nào trong số này có chứa thịt？"
  },
  "Where is the nearest mosque / prayer room?": {
    en: "Where is the nearest mosque / prayer room?",
    id: "Di mana masjid / ruang sholat terdekat?",
    ms: "Di mana masjid / bilik sembahyang terdekat?",
    zh: "請問最近的清真寺或祈禱室在哪裡？",
    "zh-CN": "請問最近的清真寺或祈禱室在哪裡？",
    ar: "أين هو أقرب مسجد / مصلى؟",
    ja: "最寄りのモスク/礼拝堂はどこですか？",
    ko: "가장 가까운 모스크/기도실은 어디인가요？",
    th: "มัสยิดหรือห้องละหมาดที่ใกล้ที่สุดอยู่ที่ไหน？",
    vi: "Nhà thờ Hồi giáo / phòng cầu nguyện gần nhất ở đâu？"
  },
  "Which direction is the Qibla (Kaaba)?": {
    en: "Which direction is the Qibla (Kaaba)?",
    id: "Kearah mana Kiblat (Ka'bah)?",
    ms: "Ke arah mana Kiblat (Kaabah)?",
    zh: "請問麥加朝向（吉卜拉）是哪一個方向？",
    "zh-CN": "請問麥加朝向（吉卜拉）是哪一個方向？",
    ar: "أي اتجاه هو القبلة (الكعبة)؟",
    ja: "キブラ（カアバ）の方向はどちらですか？",
    ko: "키블라(카바) 방향은 어느 쪽인가요？",
    th: "กิบลาต (กะอบะฮ์) อยู่ทิศทางไหน？",
    vi: "Hướng Qibla (Kaaba) là hướng nào？"
  },
  "Do you have a clean prayer rug I can use?": {
    en: "Do you have a clean prayer rug I can use?",
    id: "Apakah Anda memiliki sajadah bersih yang bisa saya gunakan?",
    ms: "Adakah anda mempunyai sejadah bersih yang boleh saya gunakan?",
    zh: "請問有乾淨的禮拜毯可以借用嗎？",
    "zh-CN": "請問有乾淨的禮拜毯可以借用嗎？",
    ar: "هل لديكم سجادة صلاة نظيفة يمكنني استخدامها؟",
    ja: "使用できる清潔な礼拝用マットはありますか？",
    ko: "제가 사용할 수 있는 깨끗한 기도용 매트가 있습니까？",
    th: "คุณมีพรมปูละหมาดที่สะอาดให้ฉันยืมใช้ไหม？",
    vi: "Bạn có thảm cầu nguyện sạch sẽ nào tôi có thể dùng không？"
  },
  "Can you remove alcohol from my room's mini-bar?": {
    en: "Can you remove alcohol from my room's mini-bar?",
    id: "Bisakah Anda mengeluarkan alkohol dari mini-bar kamar saya?",
    ms: "Bolehkah anda mengeluarkan alkohol dari mini-bar bilik saya?",
    zh: "可以幫我把房間小冰箱裡的酒拿走嗎？",
    "zh-CN": "可以幫我把房間小冰箱裡的酒拿走嗎？",
    ar: "هل يمكنك إزالة الكحول من الثلاجة الصغيرة في غرفتي؟",
    ja: "部屋のミニバーからアルコールを取り除いていただけますか？",
    ko: "객실 미니바에서 알코올을 치워주실 수 있나요？",
    th: "ช่วยนำเครื่องดื่มแอลกอฮอล์ออกจากตู้เย็นในห้องพักได้ไหม？",
    vi: "Bạn có thể lấy rượu khỏi tủ lạnh nhỏ trong phòng tôi không？"
  },
  "Is there a halal breakfast option?": {
    en: "Is there a halal breakfast option?",
    id: "Apakah ada pilihan sarapan halal?",
    ms: "Adakah terdapat pilihan sarapan halal?",
    zh: "請問有提供清真早餐嗎？",
    "zh-CN": "請問有提供清真早餐嗎？",
    ar: "هل هناك خيار إفطار حلال؟",
    ja: "ハラールの朝食オプションはありますか？",
    ko: "할랄 조식 옵션이 있나요？",
    th: "มีเมนูอาหารเช้าที่เป็นฮาลาลหรือไม่？",
    vi: "Có lựa chọn bữa sáng halal không？"
  },
  "I need help. I am a Muslim.": {
    en: "I need help. I am a Muslim.",
    id: "Saya butuh bantuan. Saya seorang Muslim.",
    ms: "Saya perlukan bantuan. Saya seorang Muslim.",
    zh: "我需要幫助，我是穆斯林。",
    "zh-CN": "我需要幫助，我是穆斯林。",
    ar: "أحتاج إلى المساعدة. أنا مسلم.",
    ja: "助けが必要です。私はムスリムです。",
    ko: "도움이 필요합니다. 저는 무슬림입니다？",
    th: "ฉันต้องการความช่วยเหลือ ฉันเป็นชาวมุสลิม？",
    vi: "Tôi cần giúp đỡ. Tôi là một tín đồ Hồi giáo？"
  },
  "Where is the hospital?": {
    en: "Where is the hospital?",
    id: "Di mana rumah sakit?",
    ms: "Di mana hospital?",
    zh: "請問醫院在哪裡？",
    "zh-CN": "請問醫院在哪裡？",
    ar: "أين هو المستشفى؟",
    ja: "病院はどこですか？",
    ko: "병원이 어디인가요？",
    th: "โรงพยาบาลอยู่ที่ไหน？",
    vi: "Bệnh viện ở đâu？"
  },
  "I am feeling unwell.": {
    en: "I am feeling unwell.",
    id: "Saya merasa kurang sehat.",
    ms: "Saya berasa kurang sihat.",
    zh: "我身體不太舒服。",
    "zh-CN": "我身體不太舒服。",
    ar: "أشعر أنني لست بخير.",
    ja: "体調が悪いです。",
    ko: "몸이 좋지 않습니다？",
    th: "ฉันรู้สึกไม่สบาย？",
    vi: "Tôi cảm thấy không khỏe？"
  },
  "Is there a prayer room nearby?": {
    en: "Is there a prayer room nearby?",
    id: "Apakah ada ruang sholat di dekat sini?",
    ms: "Adakah terdapat bilik sembahyang berhampiran?",
    zh: "請問附近有祈禱室嗎？",
    "zh-CN": "請問附近有祈禱室嗎？",
    ar: "هل توجد غرفة صلاة قريبة؟",
    ja: "近くに礼拝室はありますか？",
    ko: "근처에 기도실이 있습니까？",
    th: "มีห้องละหมาดแถวนี้ไหม？",
    vi: "Có phòng cầu nguyện nào gần đây không？"
  },
  "Is the prayer room open / available for use now?": {
    en: "Is the prayer room open / available for use now?",
    id: "Apakah ruang sholat buka / bisa digunakan sekarang?",
    ms: "Adakah bilik sembahyang dibuka / boleh digunakan sekarang?",
    zh: "請問祈禱室現在可以借用／開放使用嗎？",
    "zh-CN": "請問祈禱室現在可以借用／開放使用嗎？",
    ar: "هل غرفة الصلاة مفتوحة / متاحة للاستخدام الآن？",
    ja: "礼拝室は今開いていますか/使用できますか？",
    ko: "지금 기도실을 사용할 수 있나요/개방되어 있나요？",
    th: "ห้องละหมาดเปิด / สามารถใช้งานได้ตอนนี้ไหม？",
    vi: "Phòng cầu nguyện hiện có mở cửa / sẵn sàng sử dụng không？"
  }
}

function getLocalizedExplanation(englishText: string): string {
  const currentLang = (locale.value || 'en').split('-')[0].toLowerCase()
  const translations = phraseTranslations[englishText]
  if (!translations) return englishText
  
  if (translations[locale.value]) return translations[locale.value]
  if (translations[currentLang]) return translations[currentLang]
  return translations['en'] || englishText
}

// All Phrases List from shared module
// Filtered Phrases
const filteredPhrases = computed(() => {
  return phrases.value.filter(p => {
    // Filter by Category
    if (selectedCategory.value === 'favorites') {
      if (!isFavorite(p.chinese)) return false
    } else if (selectedCategory.value !== 'all' && p.catId !== selectedCategory.value) {
      return false
    }
    
    // Filter by Search Query
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim()
      const matchesEnglish = p.english.toLowerCase().includes(q)
      const matchesChinese = p.chinese.toLowerCase().includes(q)
      const matchesPinyin = p.pinyin.toLowerCase().includes(q)
      return matchesEnglish || matchesChinese || matchesPinyin
    }
    
    return true
  })
})

function getFriendlyVoiceName(voice: SpeechSynthesisVoice): string {
  const nameLower = voice.name.toLowerCase()
  const langLower = voice.lang.toLowerCase()
  
  if (nameLower.includes('meijia') || nameLower.includes('mei-jia')) {
    return 'Meijia (Taiwan Female)'
  }
  if (nameLower.includes('tingting') || nameLower.includes('ting-ting')) {
    return 'Tingting (Mainland Female)'
  }
  if (nameLower.includes('yunjhe')) return 'Yunjhe (Taiwan Male)'
  if (nameLower.includes('liao')) return 'Liao (Taiwan Male)'
  if (nameLower.includes('yunxi')) return 'Yunxi (Mainland Male)'
  if (nameLower.includes('yunjian')) return 'Yunjian (Mainland Male)'
  if (nameLower.includes('yunyang')) return 'Yunyang (Mainland Male)'
  if (nameLower.includes('kangkang')) return 'Kangkang (Mainland Male)'
  
  const isTaiwan = langLower.includes('tw') || langLower.includes('hant')
  const isHongKong = langLower.includes('hk') || langLower.includes('yue') || langLower.includes('hong')
  const isMainland = langLower.includes('cn') || langLower.includes('hans')
  
  // Try to guess gender from voice name
  let gender = ''
  if (nameLower.includes('male') || nameLower.includes('man') || nameLower.includes('yunjhe') || nameLower.includes('yunxi') || nameLower.includes('yunjian') || nameLower.includes('yunyang') || nameLower.includes('kangkang')) {
    gender = 'Male'
  } else if (nameLower.includes('female') || nameLower.includes('woman') || nameLower.includes('meijia') || nameLower.includes('tingting') || nameLower.includes('yating') || nameLower.includes('sinji') || nameLower.includes('lili') || nameLower.includes('lilian') || nameLower.includes('hsaio')) {
    gender = 'Female'
  }
  
  const genderLabel = gender ? ` ${gender}` : ''
  const cleanName = voice.name.replace(/Microsoft/g, '').replace(/Google/g, '').replace(/Apple/g, '').replace(/Siri/g, '').replace(/[\(\)]/g, '').trim()
  
  if (isTaiwan) {
    return `${cleanName || 'System'} (Taiwan${genderLabel})`
  }
  if (isHongKong) {
    return `${cleanName || 'System'} (Hong Kong${genderLabel})`
  }
  if (isMainland) {
    return `${cleanName || 'System'} (Mainland${genderLabel})`
  }
  
  return `${cleanName || 'System'} (${voice.lang}${genderLabel})`
}

function loadVoices() {
  if ('speechSynthesis' in window) {
    const voices = window.speechSynthesis.getVoices()
    
    // Filter to retain all Chinese language voices
    const rawFiltered = voices.filter(v => {
      const langLower = v.lang.toLowerCase()
      return langLower.startsWith('zh')
    })
    
    const seen = new Set<string>()
    const uniqueVoices = rawFiltered.filter(v => {
      if (seen.has(v.name)) return false
      seen.add(v.name)
      return true
    })
    
    availableVoices.value = uniqueVoices.length > 0 ? uniqueVoices : voices.filter(v => v.lang.toLowerCase().startsWith('zh'))
    
    if (availableVoices.value.length > 0) {
      if (!selectedVoiceName.value) {
        const preferred = availableVoices.value.find(v => v.name.toLowerCase().includes('meijia')) 
                       || availableVoices.value[0]
        selectedVoiceName.value = preferred.name
      }
    }
  }
}

function getWordLengthAt(phrase: any, cleanIdx: number): number {
  const pinyinWords = phrase.pinyin.split(' ')
  let charStart = 0
  for (let i = 0; i < pinyinWords.length; i++) {
    const word = pinyinWords[i]
    const syllableCount = word.split('-').length
    const charEnd = charStart + syllableCount
    if (cleanIdx >= charStart && cleanIdx < charEnd) {
      return syllableCount
    }
    charStart = charEnd
  }
  return 1
}

function playPhrase(text: string) {
  if ('speechSynthesis' in window) {
    if (activeSpeechText.value === text) {
      window.speechSynthesis.cancel()
      activeSpeechText.value = null
      currentSpeechCharIndex.value = -1
      currentSpeechCharLength.value = 0
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    
    const chosenVoice = availableVoices.value.find(v => v.name === selectedVoiceName.value)
    if (chosenVoice) {
      utterance.voice = chosenVoice
      utterance.lang = chosenVoice.lang
    } else {
      utterance.lang = 'zh-TW'
    }
    
    utterance.rate = 0.75
    utterance.onstart = () => {
      activeSpeechText.value = text
      currentSpeechCharIndex.value = -1
      currentSpeechCharLength.value = 0
    }
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        currentSpeechCharIndex.value = event.charIndex
        const phraseObj = phrases.value.find(pr => pr.chinese === text)
        if (phraseObj) {
          const cleanIdx = getCleanIndex(text, event.charIndex)
          currentSpeechCharLength.value = getWordLengthAt(phraseObj, cleanIdx)
        } else {
          currentSpeechCharLength.value = event.charLength || 1
        }
      }
    }
    utterance.onend = () => {
      setTimeout(() => {
        if (activeSpeechText.value === text) {
          activeSpeechText.value = null
          currentSpeechCharIndex.value = -1
          currentSpeechCharLength.value = 0
        }
      }, 500)
    }
    utterance.onerror = () => {
      activeSpeechText.value = null
      currentSpeechCharIndex.value = -1
      currentSpeechCharLength.value = 0
    }
    window.speechSynthesis.speak(utterance)
  }
}

async function copyPhrase(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    const toast = await toastController.create({
      message: 'Copied Chinese phrase to clipboard!',
      duration: 2000,
      position: 'bottom',
      color: 'success'
    })
    await toast.present()
  } catch (err) {
    console.error('Failed to copy', err)
  }
}

function isCategoryPremium(catId: string): boolean {
  return catId !== 'all' && catId !== 'favorites' && catId !== 'dining'
}

function isPhrasePremium(p: HalalifyPhrase): boolean {
  if (p.catId !== 'dining') return true
  return p.id ? (p.id > 5) : false
}

function selectCategory(catId: string) {
  selectedCategory.value = catId
}

async function presentRcPaywall() {
  if (!Capacitor.isNativePlatform()) {
    console.warn("[RC] Paywall can only run on native apps.");
    const confirmUnlock = confirm("[DEV] Unlock Pro for testing?")
    if (confirmUnlock) {
      isDonor.value = true
      localStorage.setItem("user_pro_status", "true")
    }
    return;
  }

  try {
    const { result } = await RevenueCatUI.presentPaywall();
    if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
      await refreshSubscriptionStatus({ syncToServer: true });
      ActivityLogService.log('pro_purchase_success', {
        source: 'halalify_view'
      });
    }
  } catch (err) {
    console.error("Paywall failed:", err);
  }
}

onMounted(() => {
  loadFavorites()
  initPhrases()
  loadVoices()
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = loadVoices
  }
})
</script>

<style scoped>
.controls-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--ion-background-color);
  padding-top: 8px;
  padding-bottom: 8px;
}

.phrase-searchbar {
  flex: 1;
  min-width: 0;
  --background: var(--ion-color-step-100, #f3f4f6);
  --color: var(--ion-text-color, #1a202c);
  --placeholder-color: var(--ion-color-step-500, #718096);
  --icon-color: var(--ion-color-step-500, #718096);
  --border-radius: 20px;
  padding: 0;
}

.ion-palette-dark .phrase-searchbar {
  --background: var(--ion-color-step-150, #2d3748);
  --color: #ffffff;
  --placeholder-color: var(--ion-color-step-400, #a0aec0);
  --icon-color: var(--ion-color-step-400, #a0aec0);
}

.voice-selector-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--ion-color-step-100, #edf2f7);
  padding: 4px 12px;
  border-radius: 20px;
  flex-shrink: 0;
  max-width: 170px;
  box-sizing: border-box;
}

.ion-palette-dark .voice-selector-wrapper {
  background: var(--ion-color-step-150, #2d3748);
}

.voice-icon {
  font-size: 16px;
  color: var(--ion-color-carrot);
  flex-shrink: 0;
}

.voice-select {
  --padding-top: 0;
  --padding-bottom: 0;
  --padding-start: 0;
  --padding-end: 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ion-color-carrot, #e67e22);
  --color: var(--ion-color-carrot, #e67e22);
  min-height: 24px;
}

.categories-scroll {
  display: flex;
  overflow-x: auto;
  gap: 8px;
  padding-bottom: 12px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.categories-scroll::-webkit-scrollbar {
  display: none;
}

.category-btn {
  margin: 0;
  flex-shrink: 0;
  --border-radius: 20px;
  font-weight: 600;
}

.phrases-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.phrase-card {
  background: var(--ion-color-step-50, #f8f9fa);
  border: 1px solid var(--ion-color-step-150, #e2e8f0);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.03);
}

.ion-palette-dark .phrase-card {
  background: var(--ion-color-step-100, #1e1e1e);
  border-color: var(--ion-color-step-200, #2d2d2d);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
}

.phrase-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.phrase-actions {
  display: flex;
  gap: 4px;
}

.phrase-tag {
  font-size: 11px;
  font-weight: 700;
  color: var(--ion-color-carrot);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(var(--ion-color-carrot-rgb, 255, 159, 64), 0.1);
  padding: 4px 8px;
  border-radius: 6px;
}

.phrase-action-btn {
  --padding-start: 6px;
  --padding-end: 6px;
  height: 32px;
  margin: 0;
}

.phrase-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.phrase-english {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--ion-text-color);
  flex: 1;
}

.phrase-chinese-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.phrase-chinese-box {
  flex: 1;
  min-width: 0;
  background: rgba(var(--ion-color-carrot-rgb, 255, 159, 64), 0.05);
  border-left: 3px solid var(--ion-color-carrot);
  padding: 8px 12px;
  border-radius: 0 8px 8px 0;
}

.phrase-chinese {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--ion-text-color);
  letter-spacing: 0.5px;
}

.phrase-chinese span {
  transition: background-color 0.1s ease, color 0.1s ease;
  border-radius: 4px;
  padding: 0 1px;
}

.phrase-chinese span.highlight-active {
  background-color: rgba(var(--ion-color-carrot-rgb, 255, 159, 64), 0.25);
  color: var(--ion-color-carrot);
  font-weight: 900;
}

.play-btn {
  --background: var(--ion-color-carrot);
  --color: #ffffff;
  --border-radius: 50%;
  --box-shadow: 0 4px 10px rgba(217, 119, 6, 0.3);
  width: 46px;
  height: 46px;
  min-height: 46px;
  min-width: 46px;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  --padding-start: 0;
  --padding-end: 0;
}

.play-btn ion-icon {
  font-size: 24px;
}

.play-btn.speaking {
  --background: var(--ion-color-success, #2dd36f);
  --box-shadow: 0 4px 12px rgba(45, 211, 111, 0.4);
  animation: pulse-speaker 1.5s infinite;
}

@keyframes pulse-speaker {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.15); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
}

.phrase-pinyin,
.phrase-pronunciation {
  margin: 0;
  font-size: 0.8rem;
  color: var(--ion-color-step-600, #718096);
  line-height: 1.4;
}

.phrase-pinyin span {
  transition: background-color 0.1s ease, color 0.1s ease;
  border-radius: 4px;
  padding: 0 2px;
}

.phrase-pinyin span.highlight-active {
  background-color: rgba(var(--ion-color-carrot-rgb, 255, 159, 64), 0.25);
  color: var(--ion-color-carrot);
  font-weight: 700;
}

.ion-palette-dark .phrase-pinyin,
.ion-palette-dark .phrase-pronunciation {
  color: var(--ion-color-step-400, #a0aec0);
}

.phrase-pinyin .label,
.phrase-pronunciation .label {
  font-weight: 700;
  color: var(--ion-text-color);
  margin-right: 4px;
}

.phrase-pronunciation {
  font-style: italic;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 48px;
  color: var(--ion-color-medium);
  margin-bottom: 16px;
}

.empty-state h3 {
  margin: 0 0 8px;
  font-weight: 600;
}

.empty-state p {
  margin: 0;
  color: var(--ion-color-medium);
}

.phrase-card.locked-card {
  opacity: 0.85;
  border: 1px dashed var(--ion-color-medium, #92949c);
  background: var(--ion-color-step-50, #f7fafc);
}

.ion-palette-dark .phrase-card.locked-card {
  background: var(--ion-color-step-100, #1a202c);
}

.play-btn.locked-play {
  --background: var(--ion-color-medium, #92949c);
  --box-shadow: none;
}

.locked-content-placeholder {
  background: var(--ion-color-step-100, #edf2f7);
  border: 1px dashed var(--ion-color-medium, #92949c);
  border-radius: 12px;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  margin-top: 10px;
  transition: background-color 0.2s ease, transform 0.1s ease;
}

.locked-content-placeholder:active {
  transform: scale(0.98);
  background: var(--ion-color-step-150, #e2e8f0);
}

.lock-placeholder-icon {
  font-size: 28px;
  color: var(--ion-color-carrot, #e67e22);
}

.lock-placeholder-text {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ion-color-step-700, #4a5568);
  text-align: center;
}

.ion-palette-dark .locked-content-placeholder {
  background: var(--ion-color-step-150, #2d3748);
}

.ion-palette-dark .locked-content-placeholder:active {
  background: var(--ion-color-step-200, #4a5568);
}

.ion-palette-dark .lock-placeholder-text {
  color: var(--ion-color-step-400, #cbd5e0);
}

.phrase-chinese-segments {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px 12px;
  line-height: 1.2;
}

.chinese-segment {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.chinese-segment-chars {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.chinese-segment .align-char {
  font-size: 1.7rem;
  font-weight: 600;
  color: var(--ion-text-color, #2d3748);
  transition: background-color 0.15s ease, color 0.15s ease;
  border-radius: 4px;
  padding: 0 1px;
}

.chinese-segment .align-char.highlight-active {
  background-color: rgba(var(--ion-color-carrot-rgb, 255, 159, 64), 0.25);
  color: var(--ion-color-carrot);
}

.segment-gloss {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--ion-color-medium, #718096);
  margin-top: 5px;
  text-transform: lowercase;
  opacity: 0.85;
}
</style>
