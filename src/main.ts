import { createApp } from 'vue'
import { IonicVue } from '@ionic/vue'
import App from './App.vue'
import router from './router'

import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Keyboard, KeyboardResize } from '@capacitor/keyboard'
import { supabase } from '@/plugins/supabaseClient'
import { initAdMob } from '@/lib/admob'
import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import id from './locales/id.json'
import zh from './locales/zh.json'
import ms from '@/locales/ms.json'
import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'
import '@ionic/vue/css/padding.css'
import '@ionic/vue/css/float-elements.css'
import '@ionic/vue/css/text-alignment.css'
import '@ionic/vue/css/text-transformation.css'
import '@ionic/vue/css/flex-utils.css'
import '@ionic/vue/css/display.css'
import '@ionic/vue/css/palettes/dark.class.css'

import './theme/variables.css'

import { defineCustomElements } from '@ionic/pwa-elements/loader'
import { scheduleBannerUpdate } from '@/plugins/admob'
import { initSafeArea } from "@/plugins/safeArea";
import { initRevenueCat } from '@/plugins/RevenueCat';
import { Purchases } from '@revenuecat/purchases-capacitor';

// ✅ unified user profile composable
import {
    loadDonorFromCache,
    loadUserRoleFromCache,
    loadPublicLeaderboardFromCache,
    loadUserProfile,
    currentUser, resetUserProfileState
} from "@/composables/userProfile"

import { loadCountriesFromCache } from "@/composables/useCountries"
import OneSignal from 'onesignal-cordova-plugin';
import { refreshSubscriptionStatus } from "@/composables/useSubscriptionStatus";

defineCustomElements(window)

// ✅ Init safe areas & system bars
if (Capacitor.isNativePlatform()) {
    try {
        initSafeArea()
    } catch (e) {
        console.warn('[SafeArea] init skipped:', e)
    }
}

/* Native-only setup */
if (Capacitor.isNativePlatform()) {
    Keyboard.setResizeMode({ mode: 'body' as KeyboardResize })
    Keyboard.setScroll({ isDisabled: false })
    Keyboard.addListener('keyboardWillShow', () => document.body.classList.add('keyboard-visible'))
    Keyboard.addListener('keyboardWillHide', () => document.body.classList.remove('keyboard-visible'))
    initAdMob().catch((e) => console.warn('AdMob init skipped/failed:', e))
}

const i18n = createI18n({
    legacy: false,
    locale: localStorage.getItem('lang') || 'en',
    fallbackLocale: 'en',
    messages: {
        en,
        id,
        ms,
        zh
    }
})

/* Create app */
const app = createApp(App).use(IonicVue).use(router).use(i18n)

// AdMob refresh after route changes
router.afterEach(() => scheduleBannerUpdate())

// 1. Load from cache first → no flicker
loadCountriesFromCache()

/* Android hardware back button handling */
if (Capacitor.isNativePlatform()) {
    CapacitorApp.addListener('backButton', () => {
        const currentPath = router.currentRoute.value.path;

        console.info('[BackButton] pressed on:', currentPath);

        // ✅ Only block if overlay is ACTUALLY visible
        const activeOverlay = document.querySelector(
            'ion-modal.overlay-visible, ion-alert.overlay-visible, ion-action-sheet.overlay-visible, ion-popover.overlay-visible'
        );

        if (activeOverlay) {
            console.info('[BackButton] active overlay visible → Ionic will close it');
            return;
        }

        // 🔙 Not home → go back
        if (currentPath !== '/home') {
            router.back();
            return;
        }

        // 🚪 Home → exit app
        console.info('[BackButton] exiting app');
        CapacitorApp.exitApp();
    });
}



/* Native: refresh on resume (LOG-ONLY VERSION) */
if (Capacitor.isNativePlatform()) {
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) return;

        const startedAt = Date.now();

        console.info('[Resume] appStateChange fired');
        console.info('[Resume] navigator.onLine =', navigator.onLine);

        scheduleBannerUpdate();

        supabase.auth
            .getSession()
            .then(({ data, error }) => {
                const elapsed = Date.now() - startedAt;

                if (error) {
                    console.warn('[Resume] getSession error after', elapsed, 'ms:', error);
                    return;
                }

                console.info(
                    '[Resume] getSession resolved after',
                    elapsed,
                    'ms'
                );

                console.info('[Resume] raw session =', data?.session);

                const session = data?.session;

                if (!session) {
                    console.info('[Resume] No session (user logged out)');
                    return;
                }

                if (!session.user) {
                    console.info('[Resume] Session exists but no user');
                    return;
                }

                console.info(
                    '[Resume] User restored:',
                    session.user.id
                );

                currentUser.value = session.user;

                // ⛔ do NOT await — just log when it finishes
                loadUserProfile(session.user.id)
                    .then(() => {
                        console.info(
                            '[Resume] loadUserProfile finished after',
                            Date.now() - startedAt,
                            'ms'
                        );
                    })
                    .catch((e) => {
                        console.warn('[Resume] loadUserProfile failed:', e);
                    });
            })
            .catch((e) => {
                console.error('[Resume] getSession threw:', e);
            });
    });
}

// ✅ Restore session once on boot (non-blocking)
supabase.auth.getSession().then(({ data }) => {
    const session = data.session;
    if (session?.user) {
        currentUser.value = session.user;
        loadDonorFromCache(session.user.id);
        loadUserRoleFromCache(session.user.id);
        loadPublicLeaderboardFromCache(session.user.id);
        // loadUserProfile and refreshSubscriptionStatus are moved to bootstrap
    } else {
        currentUser.value = null;
    }
});

// ✅ Auth events (still needed for sign-in/out within app)
supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
        try { await Purchases.logOut() } catch { /* empty */ }
        resetUserProfileState()
        currentUser.value = null
        router.replace('/login')
        return
    }

    if (event === 'SIGNED_IN' && session?.user) {
        // ✅ always set immediately
        currentUser.value = session.user

        // ✅ redirect IMMEDIATELY (don’t wait for RevenueCat/network)
        if (['/login', '/signup'].includes(router.currentRoute.value.path)) {
            const rawRedirect = router.currentRoute.value.query.redirect
            router.replace(
                typeof rawRedirect === 'string' && rawRedirect.trim()
                    ? rawRedirect
                    : '/profile'
            )
        }

        // ✅ do the rest AFTER redirect (non-blocking)
        Promise.resolve().then(async () => {
            try {
                loadDonorFromCache(session.user.id)
                loadUserRoleFromCache(session.user.id)
                loadPublicLeaderboardFromCache(session.user.id)
            } catch (e) {
                console.warn('[Post-login cache] failed', e)
            }
        })

        // Native plugins: never block
        if (Capacitor.isNativePlatform()) {
            Purchases.logIn({ appUserID: session.user.id }).catch(console.warn)
            refreshSubscriptionStatus({ syncToServer: true }).catch(console.warn)
        }
    }
})


let lastHandledUrl: string | null = null;

/* 🧩 OneSignal v5 Initialization (Capacitor Native + Vue) */
document.addEventListener('deviceready', async () => {
    try {
        // Enable verbose logs (disable in production)
        OneSignal.Debug.setLogLevel(6);

        // Initialize your OneSignal App ID
        await OneSignal.initialize(import.meta.env.VITE_ONESIGNAL_APP_ID);

        // Wait for OneSignal to finish setting up the push service
        const deviceState = await OneSignal.User.pushSubscription.getIdAsync();
        console.log('📱 OneSignal Player ID:', deviceState);

        // Prompt for permission if needed
        const hasPermission = await OneSignal.Notifications.hasPermission();
        if (!hasPermission) {
            const accepted = await OneSignal.Notifications.requestPermission(false);
            console.log('🔔 User accepted notifications:', accepted);
        }

        // 🧭 Handle incoming push when tapped/opened
        OneSignal.Notifications.addEventListener('click', (event: any) => {
            console.log('📬 [OneSignal] Notification opened:', JSON.stringify(event, null, 2));

            const link =
                event?.notification?.additionalData?.link ||
                event?.notification?.url ||
                event?.notification?.launchURL;

            if (link) {
                handleDeepLink(link);
            }
        });

        // 🏷️ Tag the logged-in user for targeting
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await OneSignal.User.addTag('user_id', user.id);
            console.log('🏷️ Tagged user_id:', user.id);
        }

        console.log('✅ OneSignal v5 initialized');
    } catch (err) {
        console.warn('⚠️ OneSignal init failed:', err);
    }
});

// 🔗 Unified Deep Link Handler
const handleDeepLink = async (url: string, isColdBoot = false) => {
    if (!url) return;
    console.log(`🌐 [DeepLink] ${isColdBoot ? 'Cold Boot' : 'Open'}:`, url);

    lastHandledUrl = url;

    try {
        let path = '';
        if (url.startsWith('myapp://')) {
            path = url.replace('myapp://', '/');
        } else if (url.includes('app.halalformosa.com') || url.includes('halalformosa.com')) {
            const urlObj = new URL(url);
            path = urlObj.pathname + urlObj.search;
        }

        if (path && path !== '/') {
            await router.isReady();
            console.log('➡️ [DeepLink] Navigating to:', path);
            if (isColdBoot) {
                router.replace(path);
            } else {
                router.push(path);
            }
        }

        // Handle OAuth callback
        if (url.startsWith('myapp://callback') || url.includes('/callback')) {
            const hash = new URL(url).hash.substring(1);
            const params = new URLSearchParams(hash);
            const access_token = params.get('access_token');
            const refresh_token = params.get('refresh_token');
            if (access_token && refresh_token) {
                supabase.auth.setSession({ access_token, refresh_token });
                console.log('🔐 [DeepLink] OAuth session restored.');
            }
        }
    } catch (err) {
        console.warn('⚠️ [DeepLink] Invalid URL:', url, err);
    }
};

// 🔗 Handle OS-level deep link (when app is already running)
CapacitorApp.addListener('appUrlOpen', ({ url }) => {
    handleDeepLink(url);
});

// 🚀 Start verification and handle Cold Boot
async function bootstrap() {
    // Check if app was launched by a URL (Cold Boot)
    CapacitorApp.getLaunchUrl().then((launchData) => {
        if (launchData?.url) {
            handleDeepLink(launchData.url, true);
        }
    });

    // Mount the app IMMEDIATELY so the user sees the UI even if plugins are slow
    router.isReady().then(() => {
        app.mount('#app');
        scheduleBannerUpdate();
    });

    // 2️⃣ Background initialization (Native Plugins & Heavy Data)
    try {
        // We use a slight timeout on getSession to prevent complete freeze if auth lock hangs
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) => setTimeout(() => resolve({ data: { session: null } }), 2000));

        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);

        if (session?.user) {
            currentUser.value = session.user;

            // Logged in: Load profile data in background
            loadDonorFromCache(session.user.id);
            loadUserRoleFromCache(session.user.id);
            loadPublicLeaderboardFromCache(session.user.id);

            loadUserProfile(session.user.id).catch(e => console.error("Profile load failed", e));

            if (Capacitor.isNativePlatform()) {
                // Initialize RevenueCat & Subscriptions without blocking the mount
                initRevenueCat(session.user.id)
                    .then(() => refreshSubscriptionStatus({ syncToServer: true }))
                    .catch(e => console.warn('RevenueCat/Sub init failed:', e));
            }
        } else {
            currentUser.value = null;
            if (Capacitor.isNativePlatform()) {
                // Anonymous initialization
                initRevenueCat().catch(e => console.warn('Anon RevenueCat init failed:', e));
            }
        }
    } catch (err) {
        console.error('Bootstrap error:', err);
    }
}

bootstrap();