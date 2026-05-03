<template>
  <div class="lang-picker-container">
    <!-- Slot for the trigger. The parent can pass a custom button if needed. -->
    <slot name="trigger" :openModal="openModal" :currentLang="currentLang">
      <ion-button fill="clear" class="lang-trigger-btn" @click="openModal">
        <span class="flag-icon" v-if="currentLang?.flag">
          <img :src="currentLang.flag" :alt="currentLang.name" />
        </span>
        {{ currentLang?.name }}
      </ion-button>
    </slot>

    <!-- Language Picker Modal -->
    <ion-modal :is-open="isOpen" @didDismiss="isOpen = false" :initial-breakpoint="0.75" :breakpoints="[0, 0.75, 1]">
      <ion-header>
        <ion-toolbar>
          <ion-title>{{ $t('settings.language', 'Language') }}</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="isOpen = false">{{ $t('common.close', 'Close') }}</ion-button>
          </ion-buttons>
        </ion-toolbar>
        <ion-toolbar>
          <ion-searchbar 
            v-model="searchQuery" 
            :placeholder="$t('common.search', 'Search')"
            animated
          ></ion-searchbar>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <ion-list>
          <ion-item 
            v-for="l in filteredLanguages" 
            :key="l.code" 
            button 
            @click="selectLanguage(l.code)"
          >
            <div slot="start" class="flag-container">
              <img :src="l.flag" :alt="l.name" class="flag-img" />
            </div>
            <ion-label style="font-weight: 500;">{{ l.name }}</ion-label>
            <ion-icon 
              v-if="l.code === currentLocale" 
              :icon="checkmarkOutline" 
              slot="end" 
              color="primary"
            ></ion-icon>
          </ion-item>
        </ion-list>
      </ion-content>
    </ion-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { 
  IonButton, 
  IonModal, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonButtons, 
  IonSearchbar, 
  IonContent, 
  IonList, 
  IonItem, 
  IonLabel, 
  IonIcon 
} from '@ionic/vue';
import { checkmarkOutline } from 'ionicons/icons';
import { useI18n } from 'vue-i18n';

const { locale } = useI18n();

const isOpen = ref(false);
const searchQuery = ref('');

const emit = defineEmits(['update']);

const props = defineProps({
  modelValue: {
    type: String,
    default: null
  }
});

// Use modelValue if provided, otherwise fallback to vue-i18n locale
const currentLocale = computed(() => props.modelValue || locale.value);

const languages = [
  { code: 'en', name: 'English', flag: 'https://flagcdn.com/w80/us.png' },
  { code: 'zh', name: 'Chinese (Traditional)', flag: 'https://flagcdn.com/w80/tw.png' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', flag: 'https://flagcdn.com/w80/cn.png' },
  { code: 'ja', name: 'Japanese', flag: 'https://flagcdn.com/w80/jp.png' },
  { code: 'ko', name: 'Korean', flag: 'https://flagcdn.com/w80/kr.png' },
  { code: 'th', name: 'Thai', flag: 'https://flagcdn.com/w80/th.png' },
  { code: 'vi', name: 'Vietnamese', flag: 'https://flagcdn.com/w80/vn.png' },
  { code: 'tl', name: 'Filipino', flag: 'https://flagcdn.com/w80/ph.png' },
  { code: 'id', name: 'Indonesian', flag: 'https://flagcdn.com/w80/id.png' },
  { code: 'ms', name: 'Malay', flag: 'https://flagcdn.com/w80/my.png' },
  { code: 'ms-bn', name: 'Malay (Brunei)', flag: 'https://flagcdn.com/w80/bn.png' },
  { code: 'hi', name: 'Hindi', flag: 'https://flagcdn.com/w80/in.png' },
  { code: 'ur', name: 'Urdu', flag: 'https://flagcdn.com/w80/pk.png' },
  { code: 'bn', name: 'Bengali', flag: 'https://flagcdn.com/w80/bd.png' },
  { code: 'ar', name: 'Arabic', flag: 'https://flagcdn.com/w80/sa.png' },
  { code: 'tr', name: 'Turkish', flag: 'https://flagcdn.com/w80/tr.png' }
];

const currentLang = computed(() => {
  return languages.find(l => l.code === currentLocale.value) || languages[0];
});

const filteredLanguages = computed(() => {
  const sorted = [...languages].sort((a, b) => a.name.localeCompare(b.name));
  if (!searchQuery.value) return sorted;
  const q = searchQuery.value.toLowerCase();
  return sorted.filter(l => 
    l.name.toLowerCase().includes(q) || 
    l.code.toLowerCase().includes(q)
  );
});

const openModal = () => {
  isOpen.value = true;
};

const selectLanguage = (code: string) => {
  if (code) {
    locale.value = code;
    localStorage.setItem('lang', code);
    document.documentElement.dir = ['ar', 'ur'].includes(code) ? 'rtl' : 'ltr';
    emit('update', code);
  }
  isOpen.value = false;
  searchQuery.value = ''; // Reset search on close
};
</script>

<style scoped>
.lang-trigger-btn {
  --color: inherit;
  font-weight: 500;
}

.flag-icon {
  display: inline-block;
  width: 20px;
  height: 14px;
  margin-right: 8px;
  border-radius: 2px;
  overflow: hidden;
  border: 1px solid rgba(0,0,0,0.1);
  vertical-align: middle;
}

.flag-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.flag-container {
  width: 32px; 
  height: 22px; 
  border-radius: 4px; 
  overflow: hidden; 
  border: 1px solid rgba(0,0,0,0.1); 
  margin-right: 12px;
}

.flag-img {
  width: 100%; 
  height: 100%; 
  object-fit: cover;
}
</style>
