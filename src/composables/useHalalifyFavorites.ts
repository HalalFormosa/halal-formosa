import { ref } from 'vue'
import { Preferences } from '@capacitor/preferences'
import { toastController } from '@ionic/vue'
import type { HalalifyPhrase } from '@/data/halalifyPhrases'

const favorites = ref<HalalifyPhrase[]>([])

export function useHalalifyFavorites() {
  const loadFavorites = async () => {
    try {
      const { value } = await Preferences.get({ key: 'halalify_favorites' })
      if (value) {
        favorites.value = JSON.parse(value)
      } else {
        favorites.value = []
      }
    } catch (err) {
      console.error('Error loading favorites', err)
      favorites.value = []
    }
  }

  const saveFavorites = async () => {
    try {
      await Preferences.set({
        key: 'halalify_favorites',
        value: JSON.stringify(favorites.value)
      })
    } catch (err) {
      console.error('Error saving favorites', err)
    }
  }

  const toggleFavorite = async (phrase: HalalifyPhrase) => {
    const index = favorites.value.findIndex(p => p.chinese === phrase.chinese)
    if (index > -1) {
      // Remove from favorites
      favorites.value.splice(index, 1)
      await saveFavorites()
      const toast = await toastController.create({
        message: 'Removed from favorites',
        duration: 1500,
        position: 'bottom',
        color: 'dark'
      })
      await toast.present()
    } else {
      // Add to favorites (max 10)
      if (favorites.value.length >= 10) {
        const toast = await toastController.create({
          message: 'Maximum of 10 favorites allowed!',
          duration: 2000,
          position: 'bottom',
          color: 'warning'
        })
        await toast.present()
        return
      }
      favorites.value.push(phrase)
      await saveFavorites()
      const toast = await toastController.create({
        message: 'Added to favorites',
        duration: 1500,
        position: 'bottom',
        color: 'success'
      })
      await toast.present()
    }
  }

  const isFavorite = (chineseText: string) => {
    return favorites.value.some(p => p.chinese === chineseText)
  }

  return {
    favorites,
    loadFavorites,
    toggleFavorite,
    isFavorite
  }
}
