<template>
  <ion-page>
    <ion-header>
      <app-header
        title="Translation Alignments"
        :icon="linkOutline"
        :showBack="true"
        backRoute="/admin/master-data"
      />
    </ion-header>

    <ion-content class="ion-padding bg-light">
      <div class="admin-container">
        <!-- List View -->
        <div v-if="!editingPhrase" class="fade-in">
          <ion-card class="search-card">
            <ion-card-content>
              <div class="search-header">
                <h2>Manage Translation Word Alignments</h2>
                <p>Search phrases to edit individual word mappings and translations across all supported languages.</p>
              </div>
              <ion-searchbar
                v-model="searchQuery"
                placeholder="Search by Chinese or English phrase..."
                animated
                :debounce="300"
              />
            </ion-card-content>
          </ion-card>

          <div v-if="loading" class="spinner-container">
            <ion-spinner name="crescent" color="carrot" />
            <p>Loading phrases...</p>
          </div>

          <div v-else-if="filteredPhrases.length === 0" class="empty-state">
            <ion-icon :icon="searchOutline" size="large" />
            <h3>No Phrases Found</h3>
            <p>Try refining your search query.</p>
          </div>

          <ion-list v-else class="phrases-list">
            <ion-item
              v-for="phrase in filteredPhrases"
              :key="phrase.id"
              button
              :detail="true"
              class="phrase-item"
              @click="editPhrase(phrase)"
            >
              <ion-label>
                <div class="phrase-header">
                  <span class="category-badge">{{ phrase.category }}</span>
                  <span class="phrase-id">ID: {{ phrase.id }}</span>
                </div>
                <h2 class="chinese-text">{{ phrase.chinese }}</h2>
                <p class="english-text">{{ phrase.english }}</p>
                <div class="alignment-count" v-if="phrase.alignments">
                  <ion-icon :icon="linkOutline" />
                  <span>{{ phrase.alignments.length }} words matched</span>
                </div>
              </ion-label>
            </ion-item>
          </ion-list>
        </div>

        <!-- Edit View -->
        <div v-else class="fade-in">
          <div class="back-link" @click="cancelEdit">
            <ion-icon :icon="arrowBackOutline" />
            <span>Back to Phrases List</span>
          </div>

          <ion-card class="edit-card">
            <ion-card-header>
              <div class="edit-title-row">
                <ion-card-title>Edit Phrase #{{ editingPhrase.id }}</ion-card-title>
                <div class="action-buttons">
                  <ion-button fill="outline" color="medium" @click="cancelEdit">Cancel</ion-button>
                  <ion-button color="carrot" @click="savePhrase" :disabled="saving">
                    <ion-spinner v-if="saving" name="crescent" size="small" slot="start" />
                    Save Changes
                  </ion-button>
                </div>
              </div>
            </ion-card-header>

            <ion-card-content>
              <!-- Chinese Reference & Sentence Details -->
              <div class="sentence-hero">
                <div class="hero-label">Chinese Sentence</div>
                <div class="hero-chinese">{{ editingPhrase.chinese }}</div>
                <div class="hero-subtext">
                  <strong>Pinyin:</strong> {{ editingPhrase.pinyin }} | 
                  <strong>Pronunciation:</strong> {{ editingPhrase.pronunciation }}
                </div>
              </div>

              <!-- General Fields Grid -->
              <div class="form-grid">
                <ion-item lines="full" class="grid-item">
                  <ion-label position="stacked">Chinese Phrase</ion-label>
                  <ion-input v-model="editingPhrase.chinese" />
                </ion-item>

                <ion-item lines="full" class="grid-item">
                  <ion-label position="stacked">English Translation</ion-label>
                  <ion-input v-model="editingPhrase.english" />
                </ion-item>

                <ion-item lines="full" class="grid-item">
                  <ion-label position="stacked">Pinyin</ion-label>
                  <ion-input v-model="editingPhrase.pinyin" />
                </ion-item>

                <ion-item lines="full" class="grid-item">
                  <ion-label position="stacked">Pronunciation Helper</ion-label>
                  <ion-input v-model="editingPhrase.pronunciation" />
                </ion-item>

                <ion-item lines="full" class="grid-item">
                  <ion-label position="stacked">Category Display</ion-label>
                  <ion-input v-model="editingPhrase.category" />
                </ion-item>

                <ion-item lines="full" class="grid-item">
                  <ion-label position="stacked">Category ID Key</ion-label>
                  <ion-input v-model="editingPhrase.catId" />
                </ion-item>
              </div>

              <h3 class="section-title">Sentence Translations (by Language)</h3>
              <div class="translations-grid">
                <ion-item v-for="lang in supportedLangs" :key="lang.code" lines="full">
                  <ion-label position="stacked">{{ lang.name }} ({{ lang.code }})</ion-label>
                  <ion-input v-model="editingPhrase.translations[lang.code]" />
                </ion-item>
              </div>

              <!-- Alignments Builder -->
              <div class="alignments-section-header">
                <h3 class="section-title">Word-by-Word Translation Alignments</h3>
                <div class="alignment-actions">
                  <ion-button fill="outline" size="small" color="carrot" @click="runAutoAlign">
                    <ion-icon :icon="sparklesOutline" slot="start" />
                    Auto-Match from Dict
                  </ion-button>
                  <ion-button fill="solid" size="small" color="success" @click="addAlignmentBlock">
                    <ion-icon :icon="addOutline" slot="start" />
                    Add Word Match
                  </ion-button>
                </div>
              </div>

              <p class="section-instruction">
                Map specific words/phrases inside the Chinese sentence to their translated glosses. 
                This will display gloss translations directly beneath each segment in the user interface.
              </p>

              <div class="alignments-list">
                <div 
                  v-for="(align, index) in editingPhrase.alignments" 
                  :key="index" 
                  class="alignment-block-card"
                >
                  <div class="alignment-block-header">
                    <div class="segment-pill">Match Segment #{{ index + 1 }}</div>
                    <ion-button 
                      fill="clear" 
                      color="danger" 
                      size="small" 
                      @click="removeAlignmentBlock(index)"
                    >
                      <ion-icon :icon="trashOutline" slot="icon-only" />
                    </ion-button>
                  </div>

                  <div class="alignment-fields-grid">
                    <!-- Chinese term -->
                    <ion-item lines="none" class="chinese-match-item">
                      <ion-label position="stacked">Chinese Word/Segment</ion-label>
                      <ion-input 
                        v-model="align.zh" 
                        placeholder="e.g. 嗎" 
                        class="chinese-match-input"
                        @ionInput="onChineseWordInput(align)"
                      />
                      <div class="highlight-check" v-if="align.zh && editingPhrase.chinese.includes(align.zh)">
                        <ion-icon :icon="checkmarkCircleOutline" color="success" />
                        <span>Matches in sentence</span>
                      </div>
                      <div class="highlight-check warning" v-else-if="align.zh">
                        <ion-icon :icon="alertCircleOutline" color="warning" />
                        <span>Not found in sentence</span>
                      </div>
                    </ion-item>

                    <!-- Glosses in other languages -->
                    <div class="gloss-inputs-grid">
                      <div v-for="lang in supportedLangs" :key="lang.code" class="gloss-input-wrapper">
                        <span class="lang-label">{{ lang.code.toUpperCase() }}</span>
                        <input 
                          v-model="align[lang.code]" 
                          :placeholder="`Gloss in ${lang.name}`" 
                          class="simple-input"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div v-if="editingPhrase.alignments.length === 0" class="no-alignments-notice">
                  <ion-icon :icon="unlinkOutline" />
                  <p>No word alignments configured yet for this phrase. Use <strong>Auto-Match</strong> or <strong>Add Word Match</strong> to get started.</p>
                </div>
              </div>

              <!-- Footer Save Actions -->
              <div class="form-footer-actions">
                <ion-button fill="outline" color="medium" @click="cancelEdit">Cancel</ion-button>
                <ion-button color="carrot" @click="savePhrase" :disabled="saving">
                  <ion-spinner v-if="saving" name="crescent" size="small" slot="start" />
                  Save Changes
                </ion-button>
              </div>
            </ion-card-content>
          </ion-card>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '@/plugins/supabaseClient'
import {
  IonPage,
  IonHeader,
  IonContent,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonSearchbar,
  IonList,
  IonItem,
  IonLabel,
  IonSpinner,
  IonIcon,
  IonInput,
  toastController
} from '@ionic/vue'
import {
  searchOutline,
  linkOutline,
  unlinkOutline,
  arrowBackOutline,
  trashOutline,
  addOutline,
  sparklesOutline,
  checkmarkCircleOutline,
  alertCircleOutline
} from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'

// Mapped Languages
const supportedLangs = [
  { code: 'en', name: 'English' },
  { code: 'id', name: 'Indonesian' },
  { code: 'ms', name: 'Malay' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'th', name: 'Thai' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'ar', name: 'Arabic' }
]

// Embedded dictionary for "Auto-Align from Dict"
const dictionary: Record<string, Record<string, string[]>> = {
  "清真認證": {
    en: ["halal-certified", "halal certified"],
    id: ["sertifikasi halal", "sertifikat halal"],
    ms: ["pensijilan halal", "sertifikat halal"],
    ja: ["ハラール認証", "ハラル認証"],
    ko: ["할랄 인증"],
    th: ["รับรองฮาลาล"],
    vi: ["chứng nhận halal"],
    ar: ["شهادة حلال"]
  },
  "請問": {
    en: ["excuse me", "please"],
    id: ["permisi", "tanya"],
    ms: ["tanya", "permisi"],
    ja: ["すみません", "お尋ね"],
    ko: ["실례합니다", "여쭤"],
    th: ["ขอถาม", "ขอโทษ"],
    vi: ["xin hỏi"],
    ar: ["من فضلك", "لو سمحت"]
  },
  "嗎": {
    en: ["[ques]"],
    id: ["-kah"],
    ms: ["-kah"],
    ja: ["か"],
    ko: ["입니까", "?"],
    th: ["ไหม"],
    vi: ["không"],
    ar: ["هل"]
  },
  "的": {
    en: ["'s", "of", "[de]"],
    id: ["yang", "punya"],
    ms: ["yang", "punya"],
    ja: ["の"],
    ko: ["의"],
    th: ["ของ", "ที่"],
    vi: ["của"],
    ar: ["من"]
  },
  "這個": {
    en: ["this"],
    id: ["ini"],
    ms: ["ini"],
    ja: ["これ"],
    ko: ["이것", "이"],
    th: ["นี้"],
    vi: ["này"],
    ar: ["هذا"]
  },
  "這": {
    en: ["this"],
    id: ["ini"],
    ms: ["ini"],
    ja: ["これ", "この"],
    ko: ["이것", "이"],
    th: ["นี้"],
    vi: ["này"],
    ar: ["هذا"]
  },
  "雞": {
    en: ["chicken"],
    id: ["ayam"],
    ms: ["ayam"],
    ja: ["鶏肉", "鶏", "チキン"],
    ko: ["닭고기", "닭", "치킨"],
    th: ["ไก่"],
    vi: ["thịt gà", "gà"],
    ar: ["دجاج"]
  },
  "牛": {
    en: ["beef", "cow"],
    id: ["sapi", "daging sapi"],
    ms: ["sapi", "daging sapi"],
    ja: ["牛肉", "牛", "ビーフ"],
    ko: ["소고기", "소"],
    th: ["เนื้อวัว", "วัว"],
    vi: ["thịt bò", "bò"],
    ar: ["لحم البقر", "بقر"]
  },
  "菜": {
    en: ["dish", "food"],
    id: ["hidangan", "makanan"],
    ms: ["hidangan", "makanan"],
    ja: ["料理"],
    ko: ["요리"],
    th: ["อาหาร"],
    vi: ["món"],
    ar: ["طبق"]
  },
  "含有": {
    en: ["contain"],
    id: ["mengandung"],
    ms: ["mengandungi"],
    ja: ["含む"],
    ko: ["포함"],
    th: ["มี", "ผสม"],
    vi: ["chứa"],
    ar: ["يحتوي"]
  },
  "含": {
    en: ["contain"],
    id: ["mengandung"],
    ms: ["mengandungi"],
    ja: ["含む"],
    ko: ["포함"],
    th: ["มี", "ผสม"],
    vi: ["chứa"],
    ar: ["يحتوي"]
  },
  "豬肉": {
    en: ["pork"],
    id: ["babi"],
    ms: ["babi"],
    ja: ["豚肉"],
    ko: ["돼지고기"],
    th: ["หมู"],
    vi: ["thịt lợn", "lợn"],
    ar: ["الخنزير", "خنزير"]
  },
  "豬油": {
    en: ["lard"],
    id: ["lemak babi"],
    ms: ["lemak babi"],
    ja: ["ラード", "豚脂"],
    ko: ["라드", "돈지"],
    th: ["มันหมู"],
    vi: ["mỡ lợn", "mỡ"],
    ar: ["شحم"]
  },
  "還是": {
    en: ["or"],
    id: ["atau"],
    ms: ["atau"],
    ja: ["または", "か"],
    ko: ["또는", "아니면"],
    th: ["หรือ"],
    vi: ["hoặc", "hay"],
    ar: ["أو"]
  },
  "或": {
    en: ["or"],
    id: ["atau"],
    ms: ["atau"],
    ja: ["または", "か"],
    ko: ["또는", "아니면"],
    th: ["หรือ"],
    vi: ["hoặc", "hay"],
    ar: ["أو"]
  },
  "有": {
    en: ["contain", "contains", "have", "serve", "has", "are", "is", "there"],
    id: ["mengandung", "ada", "memiliki"],
    ms: ["mengandungi", "ada", "mempunyai"],
    ja: ["入して", "ある", "含んで", "使用"],
    ko: ["들어", "있습", "있어"],
    th: ["มี", "ผสม"],
    vi: ["chứa", "có"],
    ar: ["يحتوي", "فيه"]
  },
  "加": {
    en: ["add", "contain", "contains", "put"],
    id: ["tambah", "mengandung", "memakai"],
    ms: ["tambah", "mengandungi", "memakai"],
    ja: ["入して", "加える", "使用"],
    ko: ["넣", "들어", "추가"],
    th: ["ใส่", "ผสม"],
    vi: ["thêm", "cho", "chứa"],
    ar: ["إضافة", "يحتوي"]
  },
  "和": {
    en: ["and"],
    id: ["dan"],
    ms: ["dan"],
    ja: ["と"],
    ko: ["와", "과", "하고"],
    th: ["และ"],
    vi: ["và"],
    ar: ["و"]
  },
  "與": {
    en: ["and"],
    id: ["dan"],
    ms: ["dan"],
    ja: ["と"],
    ko: ["와", "과", "하고"],
    th: ["และ"],
    vi: ["và"],
    ar: ["و"]
  },
  "跟": {
    en: ["and"],
    id: ["dan"],
    ms: ["dan"],
    ja: ["と"],
    ko: ["와", "과", "하고"],
    th: ["และ"],
    vi: ["và"],
    ar: ["و"]
  },
  "是": {
    en: ["is", "are", "am", "be"],
    id: ["adalah", "apakah"],
    ms: ["adalah", "adakah"],
    ja: ["です", "である"],
    ko: ["입니까", "이다", "예요", "이에요"],
    th: ["คือ", "เป็น"],
    vi: ["là"],
    ar: ["هو", "هي"]
  },
  "在": {
    en: ["in", "at", "on", "nearby", "near"],
    id: ["di", "dekat"],
    ms: ["di", "dekat"],
    ja: ["に", "で", "近く"],
    ko: ["에", "에서", "근처"],
    th: ["ใน", "ที่", "ใกล้"],
    vi: ["ở", "trong", "gần"],
    ar: ["في", "قريب"]
  },
  "酒精": {
    en: ["alcohol"],
    id: ["alkohol"],
    ms: ["alkohol"],
    ja: ["アルコール"],
    ko: ["알코올"],
    th: ["แอลกอฮоล์"],
    vi: ["cồn"],
    ar: ["الكحول", "كحول"]
  },
  "酒": {
    en: ["alcohol", "wine"],
    id: ["alkohol", "arak"],
    ms: ["alkohol", "arak"],
    ja: ["お酒", "酒", "アルコール"],
    ko: ["술", "알코올"],
    th: ["แอลกоฮоล์", "เหล้า"],
    vi: ["rượu", "cồn"],
    ar: ["كحول", "نبيذ"]
  },
  "素食": {
    en: ["vegetarian", "vegan"],
    id: ["vegetaris", "vegan"],
    ms: ["vegetarian", "vegan"],
    ja: ["ベジタリアン", "素食"],
    ko: ["채식", "비건"],
    th: ["มังสวิรัติ", "เจ"],
    vi: ["chay"],
    ar: ["نباتي"]
  },
  "清真": {
    en: ["halal"],
    id: ["halal"],
    ms: ["halal"],
    ja: ["ハラール", "ハラル"],
    ko: ["할랄"],
    th: ["ฮาลาล"],
    vi: ["halal"],
    ar: ["حلال"]
  },
  "認證": {
    en: ["certified", "certification"],
    id: ["sertifikasi", "bersertifikat"],
    ms: ["pensijilan", "disahkan"],
    ja: ["認証"],
    ko: ["인증"],
    th: ["รับรอง"],
    vi: ["chứng nhận"],
    ar: ["معتمد", "شهادة"]
  },
  "食物": {
    en: ["food", "meals"],
    id: ["makanan"],
    ms: ["makanan"],
    ja: ["食べ物", "食品", "食事"],
    ko: ["음식", "식품"],
    th: ["อาหาร"],
    vi: ["thức ăn", "đồ ăn", "món"],
    ar: ["طعام", "أغذية"]
  },
  "肉": {
    en: ["meat"],
    id: ["daging"],
    ms: ["daging"],
    ja: ["肉"],
    ko: ["고기", "육"],
    th: ["เนื้อ"],
    vi: ["thịt"],
    ar: ["لحم", "لحوم"]
  },
  "麵包": {
    en: ["bread"],
    id: ["roti"],
    ms: ["roti"],
    ja: ["パン"],
    ko: ["빵"],
    th: ["ขนมปัง"],
    vi: ["bánh mì"],
    ar: ["خبز"]
  },
  "吉利丁": {
    en: ["gelatine", "gelatin"],
    id: ["gelatin"],
    ms: ["gelatin"],
    ja: ["ゼラチン", "吉利丁"],
    ko: ["젤라틴"],
    th: ["เจลาติน"],
    vi: ["gelatin"],
    ar: ["جيلاتين"]
  },
  "明膠": {
    en: ["gelatin"],
    id: ["gelatin"],
    ms: ["gelatin"],
    ja: ["ゼラチン"],
    ko: ["젤라틴"],
    th: ["เจลาติน"],
    vi: ["gelatin"],
    ar: ["جيلاتين"]
  },
  "植物": {
    en: ["plants", "plant", "vegetable"],
    id: ["tumbuhan", "nabati", "tanaman"],
    ms: ["tumbuhan", "tumbuhan", "tanaman"],
    ja: ["植物", "植物性"],
    ko: ["식물"],
    th: ["พืช"],
    vi: ["thực vật"],
    ar: ["نبات", "نبات意"]
  },
  "動物": {
    en: ["animal", "animal-based", "animals"],
    id: ["hewani", "hewan"],
    ms: ["haiwan"],
    ja: ["動物", "動物性"],
    ko: ["동물"],
    th: ["สัตว์"],
    vi: ["động vật"],
    ar: ["حيوان", "حيواني"]
  },
  "哪裡": {
    en: ["where"],
    id: ["dimana", "di mana"],
    ms: ["di mana"],
    ja: ["どこ"],
    ko: ["어디"],
    th: ["ที่ไหน"],
    vi: ["đâu"],
    ar: ["أين"]
  },
  "需要": {
    en: ["need"],
    id: ["butuh", "memerlukan"],
    ms: ["perlu", "memerlukan"],
    ja: ["必要", "要り"],
    ko: ["필요"],
    th: ["ต้องการ"],
    vi: ["cần"],
    ar: ["أحتاج", "بحاجة"]
  },
  "幫助": {
    en: ["help", "assistance"],
    id: ["bantuan", "bantu"],
    ms: ["bantuan", "bantu"],
    ja: ["助け", "手伝って"],
    ko: ["도움", "도와"],
    th: ["ช่วย", "ช่วยเหลือ"],
    vi: ["giúp", "giúp đỡ"],
    ar: ["مساعدة", "عون"]
  },
  "謝謝": {
    en: ["thank"],
    id: ["terima kasih"],
    ms: ["terima kasih"],
    ja: ["ありがとう", "感謝"],
    ko: ["감사", "고맙"],
    th: ["ขอบคุณ"],
    vi: ["cảm ơn"],
    ar: ["شكرا"]
  },
  "醫生": {
    en: ["doctor"],
    id: ["dokter"],
    ms: ["doktor"],
    ja: ["医師", "医者"],
    ko: ["의사"],
    th: ["หม้อ", "แพทย์"],
    vi: ["bác sĩ"],
    ar: ["طبيب"]
  },
  "藥": {
    en: ["medicine"],
    id: ["obat"],
    ms: ["ubat"],
    ja: ["薬"],
    ko: ["약"],
    th: ["ยา"],
    vi: ["thuốc"],
    ar: ["دواء", "أدوية"]
  },
  "醫院": {
    en: ["hospital"],
    id: ["rumah sakit"],
    ms: ["hospital"],
    ja: ["病院"],
    ko: ["병원"],
    th: ["โรงพยาบาล"],
    vi: ["bệnh viện"],
    ar: ["مستشفى"]
  },
  "警察": {
    en: ["police"],
    id: ["polisi"],
    ms: ["polis"],
    ja: ["警察"],
    ko: ["경찰"],
    th: ["ตำรวจ"],
    vi: ["cảnh sát"],
    ar: ["شرطة"]
  },
  "派出所": {
    en: ["station"],
    id: ["kantor polisi"],
    ms: ["balai polis"],
    ja: ["交番", "警察署"],
    ko: ["파출소", "경찰서"],
    th: ["สถานีตำรวจ", "ป้อมตำรวจ"],
    vi: ["đồn cảnh sát"],
    ar: ["مركز شرطة"]
  }
}

interface EditablePhrase {
  id: number;
  category: string;
  catId: string;
  english: string;
  chinese: string;
  pinyin: string;
  pronunciation: string;
  translations: Record<string, string>;
  alignments: Array<Record<string, string>>;
}

const phrases = ref<any[]>([])
const loading = ref(false)
const saving = ref(false)
const searchQuery = ref('')
const editingPhrase = ref<EditablePhrase | null>(null)

// Load all phrases
async function loadPhrases() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('halalify_phrases')
      .select('id, category, cat_id, english, chinese, pinyin, pronunciation, translations, alignments')
      .order('id', { ascending: true })

    if (error) throw error
    phrases.value = (data || []).map(p => ({
      ...p,
      translations: typeof p.translations === 'string' ? JSON.parse(p.translations) : (p.translations || {}),
      alignments: typeof p.alignments === 'string' ? JSON.parse(p.alignments) : (p.alignments || [])
    }))
  } catch (e: any) {
    showToast(e.message || 'Error fetching phrases', 'danger')
  } finally {
    loading.value = false
  }
}

const filteredPhrases = computed(() => {
  if (!searchQuery.value) return phrases.value
  const query = searchQuery.value.toLowerCase()
  return phrases.value.filter(p => 
    p.chinese.includes(query) || 
    p.english.toLowerCase().includes(query)
  )
})

function editPhrase(phrase: any) {
  // Clone to prevent direct reactivity edit side effects
  const cloned = JSON.parse(JSON.stringify(phrase))
  // Ensure translations key values exist for each supported language
  if (!cloned.translations) {
    cloned.translations = {}
  }
  for (const lang of supportedLangs) {
    if (!cloned.translations[lang.code]) {
      cloned.translations[lang.code] = ''
    }
  }
  editingPhrase.value = cloned
}

function cancelEdit() {
  editingPhrase.value = null
}

function addAlignmentBlock() {
  if (!editingPhrase.value) return
  const newBlock: Record<string, string> = { zh: '' }
  for (const lang of supportedLangs) {
    newBlock[lang.code] = ''
  }
  editingPhrase.value.alignments.push(newBlock)
}

function removeAlignmentBlock(index: number) {
  if (!editingPhrase.value) return
  editingPhrase.value.alignments.splice(index, 1)
}

function onChineseWordInput(align: any) {
  // Optional real-time updates or auto-suggestions can go here
}

function runAutoAlign() {
  const phrase = editingPhrase.value
  if (!phrase) return

  const zhSentence = phrase.chinese
  const newAlignments: any[] = []
  const sortedKeys = Object.keys(dictionary).sort((a, b) => b.length - a.length)
  const matchedRanges: Array<{ start: number; end: number }> = []

  for (const key of sortedKeys) {
    let pos = zhSentence.indexOf(key)
    while (pos !== -1) {
      const end = pos + key.length
      const overlap = matchedRanges.some(r => (pos >= r.start && pos < r.end) || (end > r.start && end <= r.end))
      if (!overlap) {
        matchedRanges.push({ start: pos, end })

        const alignObj: Record<string, string> = { zh: key }
        const mapping = dictionary[key]

        for (const lang of supportedLangs) {
          const sentenceTranslation = (phrase.translations[lang.code] || '').toLowerCase()
          let matchedTerm = null
          for (const dictTerm of mapping[lang.code] || []) {
            if (sentenceTranslation.includes(dictTerm.toLowerCase())) {
              matchedTerm = dictTerm
              break
            }
          }
          alignObj[lang.code] = matchedTerm || (mapping[lang.code] ? mapping[lang.code][0] : '')
        }
        newAlignments.push(alignObj)
      }
      pos = zhSentence.indexOf(key, pos + 1)
    }
  }

  // Preserve any custom alignments that are not covered by dictionary
  for (const existing of phrase.alignments) {
    if (!existing.zh) continue
    const alreadyMatched = newAlignments.some(a => a.zh === existing.zh)
    if (!alreadyMatched) {
      newAlignments.push({ ...existing })
    }
  }

  // Sort alignments by their occurrence in the Chinese sentence
  newAlignments.sort((a, b) => zhSentence.indexOf(a.zh) - zhSentence.indexOf(b.zh))
  phrase.alignments = newAlignments

  showToast('Auto-align complete! Verify and save your changes.', 'primary')
}

async function savePhrase() {
  const phrase = editingPhrase.value
  if (!phrase) return
  saving.value = true

  try {
    const payload = {
      chinese: phrase.chinese,
      english: phrase.english,
      pinyin: phrase.pinyin,
      pronunciation: phrase.pronunciation,
      category: phrase.category,
      cat_id: phrase.catId,
      translations: phrase.translations,
      alignments: phrase.alignments
    }

    const { error } = await supabase
      .from('halalify_phrases')
      .update(payload)
      .eq('id', phrase.id)

    if (error) throw error

    showToast('Phrase alignments and translations saved successfully!', 'success')
    
    // Reload local list and reset editing view
    await loadPhrases()
    editingPhrase.value = null
  } catch (e: any) {
    showToast(e.message || 'Failed to save phrase', 'danger')
  } finally {
    saving.value = false
  }
}

async function showToast(message: string, color: 'success' | 'danger' | 'warning' | 'primary') {
  const toast = await toastController.create({
    message,
    duration: 3000,
    color,
    position: 'bottom'
  })
  await toast.present()
}

const route = useRoute()

onMounted(async () => {
  await loadPhrases()
  // Auto-open phrase if navigated with phraseId query param
  const phraseId = route.query.phraseId
  if (phraseId) {
    const target = phrases.value.find((p: any) => String(p.id) === String(phraseId))
    if (target) {
      editPhrase(target)
    }
  }
})
</script>

<style scoped>
.admin-container {
  max-width: 1000px;
  margin: 0 auto;
  padding-bottom: 3rem;
}

.search-card {
  margin-bottom: 20px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.search-header h2 {
  font-weight: 700;
  color: var(--ion-color-carrot);
  margin-top: 0;
  margin-bottom: 6px;
}

.search-header p {
  color: var(--ion-color-medium);
  margin-bottom: 20px;
  font-size: 0.9rem;
}

.spinner-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 4rem;
}

.spinner-container p {
  color: var(--ion-color-medium);
  margin-top: 10px;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--ion-color-medium);
}

.empty-state h3 {
  font-weight: 600;
  margin-top: 1rem;
}

.phrases-list {
  background: transparent;
}

.phrase-item {
  --background: var(--ion-card-background, #ffffff);
  margin-bottom: 8px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.phrase-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.category-badge {
  background: rgba(var(--ion-color-carrot-rgb), 0.15);
  color: var(--ion-color-carrot);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.phrase-id {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.chinese-text {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--ion-color-dark);
  margin: 4px 0;
}

.english-text {
  font-size: 0.9rem;
  color: var(--ion-color-step-600);
}

.alignment-count {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--ion-color-carrot);
  font-size: 0.8rem;
  margin-top: 6px;
  font-weight: 600;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ion-color-carrot);
  cursor: pointer;
  font-weight: 600;
  margin-bottom: 16px;
  transition: opacity 0.2s;
}

.back-link:hover {
  opacity: 0.8;
}

.edit-card {
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
}

.edit-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.sentence-hero {
  --hero-bg-start: #ffecd2;
  --hero-bg-end: #fff7ed;
  --hero-border: #ffd8a8;
  background: linear-gradient(135deg, var(--hero-bg-start) 0%, var(--hero-bg-end) 100%);
  padding: 1.5rem;
  border-radius: 10px;
  margin-bottom: 1.5rem;
  border: 1px solid var(--hero-border);
}

@media (prefers-color-scheme: dark) {
  .sentence-hero {
    --hero-bg-start: #2b1f15;
    --hero-bg-end: #1e140d;
    --hero-border: #4a2f1b;
  }
}

:host-context(.ion-palette-dark) .sentence-hero,
.ion-palette-dark .sentence-hero {
  --hero-bg-start: #2b1f15;
  --hero-bg-end: #1e140d;
  --hero-border: #4a2f1b;
}

.hero-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--ion-color-carrot);
  font-weight: 700;
  margin-bottom: 6px;
}

.hero-chinese {
  font-size: 1.8rem;
  font-weight: 800;
  color: var(--ion-color-dark);
  margin-bottom: 8px;
}

.hero-subtext {
  font-size: 0.85rem;
  color: var(--ion-color-step-700);
}

.section-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--ion-color-carrot);
  border-left: 4px solid var(--ion-color-carrot);
  padding-left: 8px;
  margin: 1.5rem 0 1rem 0;
}

.section-instruction {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  margin-top: -8px;
  margin-bottom: 1.5rem;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 1rem;
}

.translations-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

@media (max-width: 768px) {
  .form-grid, .translations-grid {
    grid-template-columns: 1fr;
  }
}

.alignments-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 2rem;
  margin-bottom: 1rem;
}

.alignment-actions {
  display: flex;
  gap: 8px;
}

.alignments-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.alignment-block-card {
  background: var(--ion-card-background, #fcfcfc);
  border: 1px solid var(--ion-color-step-200, #eaeaea);
  border-radius: 10px;
  padding: 12px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.alignment-block-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.04);
}

.alignment-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--ion-color-step-150, #f2f2f2);
  padding-bottom: 6px;
}

.segment-pill {
  font-size: 0.75rem;
  font-weight: 700;
  background: var(--ion-color-step-200);
  color: var(--ion-color-step-800);
  padding: 2px 8px;
  border-radius: 4px;
}

.alignment-fields-grid {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 16px;
}

@media (max-width: 768px) {
  .alignment-fields-grid {
    grid-template-columns: 1fr;
  }
}

.chinese-match-item {
  --background: transparent;
  border-right: 1px solid var(--ion-color-step-150, #f2f2f2);
  padding-right: 12px;
}

@media (max-width: 768px) {
  .chinese-match-item {
    border-right: none;
    padding-right: 0;
    border-bottom: 1px solid var(--ion-color-step-150, #f2f2f2);
    padding-bottom: 12px;
  }
}

.chinese-match-input {
  font-size: 1.1rem;
  font-weight: 700;
}

.highlight-check {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  margin-top: 6px;
  color: var(--ion-color-success);
}

.highlight-check.warning {
  color: var(--ion-color-warning);
}

.gloss-inputs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}

.gloss-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.lang-label {
  font-size: 0.7rem;
  font-weight: 800;
  color: var(--ion-color-medium);
}

.simple-input {
  border: 1px solid var(--ion-color-step-200, #dadada);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 0.85rem;
  background: var(--ion-background-color, #ffffff);
  color: var(--ion-text-color, #000000);
  outline: none;
  transition: border-color 0.2s;
}

.simple-input:focus {
  border-color: var(--ion-color-carrot);
}

.no-alignments-notice {
  text-align: center;
  padding: 3rem 1.5rem;
  background: var(--ion-color-step-50, #fafafa);
  border: 2px dashed var(--ion-color-step-200, #eaeaea);
  border-radius: 8px;
  color: var(--ion-color-medium);
}

.no-alignments-notice ion-icon {
  font-size: 2.5rem;
  margin-bottom: 10px;
}

.form-footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 2rem;
  border-top: 1px solid var(--ion-color-step-200);
  padding-top: 1.5rem;
}
</style>
