import { ref, readonly } from 'vue'
import { supabase } from '@/plugins/supabaseClient'
import { Preferences } from '@capacitor/preferences'
import { masterPhrases as staticPhrases, type HalalifyPhrase } from '@/data/halalifyPhrases'

const CACHE_KEY = 'halalify_phrases_cache'

const phrasesRef = ref<HalalifyPhrase[]>(staticPhrases)
const loadingRef = ref(false)
const errorRef = ref<string | null>(null)

// Initialize: load from cache, then fetch fresh
async function initPhrases() {
  // 1. Load from cache if exists to show content instantly
  try {
    const cached = await Preferences.get({ key: CACHE_KEY })
    if (cached.value) {
      phrasesRef.value = JSON.parse(cached.value)
    }
  } catch (e) {
    console.error('Failed to load halalify phrases from cache:', e)
  }

  // 2. Fetch from Supabase in the background
  await refreshPhrases()
}

async function refreshPhrases() {
  loadingRef.value = true
  errorRef.value = null
  try {
    const { data, error } = await supabase
      .from('halalify_phrases')
      .select('id, category, cat_id, english, chinese, pinyin, pronunciation, translations, alignments')
      .order('id', { ascending: true })

    if (error) throw error

    if (data && data.length > 0) {
      const mapped: HalalifyPhrase[] = data.map(item => ({
        id: item.id,
        category: item.category,
        catId: item.cat_id,
        english: item.english,
        chinese: item.chinese,
        pinyin: item.pinyin,
        pronunciation: item.pronunciation,
        translations: typeof item.translations === 'string' 
          ? JSON.parse(item.translations) 
          : item.translations,
        alignments: typeof item.alignments === 'string'
          ? JSON.parse(item.alignments)
          : item.alignments
      }))

      phrasesRef.value = mapped
      // Update cache
      await Preferences.set({
        key: CACHE_KEY,
        value: JSON.stringify(mapped)
      })
    }
  } catch (err: any) {
    console.error('Failed to fetch halalify phrases from Supabase:', err)
    errorRef.value = err.message || 'Failed to fetch phrases'
  } finally {
    loadingRef.value = false
  }
}

export function useHalalifyPhrases() {
  return {
    phrases: readonly(phrasesRef),
    loading: readonly(loadingRef),
    error: readonly(errorRef),
    initPhrases,
    refreshPhrases
  }
}
