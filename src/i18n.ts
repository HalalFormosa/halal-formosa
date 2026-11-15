import { createI18n } from 'vue-i18n'
import en from '@/locales/en.json'
import id from '@/locales/id.json'
import zh from '@/locales/zh.json'
import ms from '@/locales/ms.json'
import hi from '@/locales/hi.json'
import ur from '@/locales/ur.json'
import bn from '@/locales/bn.json'
import ar from '@/locales/ar.json'
import tr from '@/locales/tr.json'
import tl from '@/locales/tl.json'
import th from '@/locales/th.json'
import zhCN from '@/locales/zh-CN.json'
import vi from '@/locales/vi.json'
import ko from '@/locales/ko.json'
import ja from '@/locales/ja.json'
import msBn from '@/locales/ms-bn.json'

export const i18n = createI18n({
    legacy: false,
    locale: localStorage.getItem('lang') || 'en',
    fallbackLocale: 'en',
    messages: {
        en,
        id,
        ms,
        zh,
        hi,
        ur,
        bn,
        ar,
        tr,
        tl,
        th,
        'zh-CN': zhCN,
        vi,
        ko,
        ja,
        'ms-bn': msBn
    }
})
