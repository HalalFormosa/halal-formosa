import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import { supabase } from '@/plugins/supabaseClient';

import {
    isAdmin,
    isContributor,
    isProfileComplete,
    profileLoaded
} from '@/composables/userProfile'


// Preload SearchView in the background
import SearchView from '@/views/search/SearchView.vue';
import ExploreView from '@/views/explore/ExploreView.vue';
import ScanIngredientsView from '@/views/scan/ScanIngredientsView.vue';

const ALLOWED_WHEN_PROFILE_INCOMPLETE = [
    '/profile',
    '/profile/edit',
    '/logout',
    '/legal',
    '/credits'
]

const routes: Array<RouteRecordRaw> = [
    {
        path: '/',
        component: () => import('@/views/MainView.vue'),
        children: [
            { path: '', redirect: '/home' },
            { path: 'home', component: () => import('@/views/home/HomeView.vue') },
            { path: 'search', component: SearchView, meta: { adSpaceId: 'ad-space-search', adId: import.meta.env.VITE_ADMOB_SEARCH_BANNER_ID } },
            { path: 'explore', component: ExploreView, meta: { adSpaceId: 'ad-space-explore', adId: import.meta.env.VITE_ADMOB_EXPLORE_BANNER_ID } },
            {
                path: 'trip',
                component: () => import('@/views/trip/TripListView.vue'),
                meta: { noAds: false }
            },
            {
                path: 'store',
                component: () => import('@/views/store/StoreView.vue'),
                meta: { noAds: true }
            },
            { path: 'add', component: () => import('@/views/add-product/AddProductView.vue'), meta: { requiresAuth: true } },
            { path: 'profile', component: () => import('@/views/profile/ProfileView.vue'), meta: { noAds: true } },
        ],
    },
    {
        path: '/profile/edit',
        name: 'EditProfile',
        component: () => import('@/views/profile/EditProfileView.vue'),
        meta: { requiresAuth: true, noTabs: true, noAds: true }
    },
    {
        path: '/profile/saved-items',
        name: 'SavedItems',
        component: () => import('@/views/profile/SavedItemsView.vue'),
        meta: { requiresAuth: true, noTabs: true, noAds: true }
    },

    { path: '/place/:id', name: 'PlaceDetail', component: () => import('@/views/explore/PlaceDetailsView.vue'), props: true, meta: { noAds: true } },
    { path: '/place/:id/edit', name: 'EditPlace', component: () => import('@/views/explore/AddPlaceView.vue'), },
    { path: '/place/:id/report', name: 'ReportPlaceView', component: () => import('@/views/explore/ReportPlaceView.vue'), props: true },

    { path: '/item/:barcode', name: 'item-details', component: () => import('@/views/search/ItemDetailsView.vue'), meta: { noAds: true } },

    {
        path: '/partners',
        name: 'PartnersList',
        component: () => import('@/views/partner/PartnersListView.vue'),
        meta: { noAds: true }
    },
    {
        path: '/partner/:id',
        name: 'PartnerDetail',
        component: () => import('@/views/partner/PartnerDetailView.vue'),
        props: true,
        meta: { noAds: true }
    },
    {
        path: '/qibla',
        name: 'Qibla',
        component: () => import('@/views/utilities/QiblaFinderView.vue')
    },

    { path: '/scan', component: ScanIngredientsView, meta: { requiresAuth: true, noAds: true } },
    { path: '/scan/auto', component: () => import('@/views/scan/AutoScanView.vue'), meta: { requiresAuth: true, noAds: true, noTabs: true } },

    { path: '/news', component: () => import('@/views/news/NewsListView.vue') },
    { path: '/news/:id', name: 'news-detail', component: () => import('@/views/news/NewsDetailView.vue'), props: true, meta: { adSpaceId: 'ad-space-news-detail', adId: import.meta.env.VITE_ADMOB_NEWS_BANNER_ID } },
    { path: '/news/add', component: () => import('@/views/news/AddNewsView.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
    { path: '/news/edit/:id', component: () => import('@/views/news/AddNewsView.vue'), meta: { requiresAuth: true, requiresAdmin: true } },

    { path: '/explore/add', name: 'ExploreAdd', component: () => import('@/views/explore/AddPlaceView.vue'), meta: { requiresAuth: true } },

    { path: '/report/:barcode', name: 'report', component: () => import('@/views/search/ReportView.vue'), meta: { requiresAuth: true }, props: true },

    { path: '/settings', component: () => import('@/views/profile/SettingsView.vue') },
    { path: '/legal', component: () => import('@/views/legal/LegalView.vue') },
    { path: '/credits', component: () => import('@/views/profile/CreditsView.vue') },
    { path: '/signup', component: () => import('@/views/auth/SignUpView.vue') },
    { path: '/login', component: () => import('@/views/auth/LoginView.vue') },
    {
        path: '/admin/review-products',
        component: () => import('@/views/admin/ReviewProductsView.vue'),
        meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
        path: '/admin/review-locations',
        name: 'ReviewLocations',
        component: () => import('@/views/admin/ReviewLocationsView.vue')
    },
    {
        path: '/admin/points-logs',
        component: () => import('@/views/admin/PointsLogsView.vue'),
        meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
        path: '/admin/scan-logs',
        component: () => import('@/views/admin/ScanLogsView.vue'),
        meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
        path: '/admin/analytics',
        name: 'AnalyticsDashboard',
        component: () => import('@/views/admin/AnalyticsDashboardView.vue'),
        meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
        path: '/admin/master-data',
        component: () => import('@/views/admin/AdminMasterData.vue'),
        meta: { requiresAdmin: true }
    },
    {
        path: '/admin/master-data/:table',
        component: () => import('@/views/admin/AdminMasterDataEditor.vue'),
        meta: { requiresAdmin: true }
    },
    {
        path: '/admin/users',
        name: 'UsersList',
        component: () => import('@/views/admin/UsersListView.vue'),
        meta: { requiresAdmin: true }
    },
    {
        path: '/admin/users/:id',
        name: 'UserDetail',
        component: () => import('@/views/admin/UserDetailView.vue')
    },
    {
        path: '/admin/merchant/applications',
        name: 'AdminMerchantApplications',
        component: () => import('@/views/admin/MerchantApplicationsView.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, noAds: true }
    },
    {
        path: '/admin/location-reports',
        name: 'LocationReports',
        component: () => import('@/views/admin/LocationReportsView.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, noAds: true }
    },
    {
        path: '/admin/product-reports',
        name: 'ProductReports',
        component: () => import('@/views/admin/ProductReportsView.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, noAds: true }
    },


    // Store sub-routes (outside tabs)
    {
        path: '/store/product/:id',
        name: 'StoreProductDetail',
        component: () => import('@/views/store/StoreProductDetailView.vue'),
        props: true,
        meta: { noAds: true }
    },
    {
        path: '/store/merchant/:id',
        name: 'MerchantStore',
        component: () => import('@/views/store/MerchantStoreView.vue'),
        props: true,
        meta: { noAds: true }
    },
    {
        path: '/store/checkout',
        name: 'StoreCheckout',
        component: () => import('@/views/store/StoreCheckoutView.vue'),
        meta: { requiresAuth: true, noAds: true }
    },
    {
        path: '/store/order-success',
        name: 'StoreOrderSuccess',
        component: () => import('@/views/store/StoreOrderSuccessView.vue'),
        meta: { requiresAuth: true, noAds: true }
    },
    {
        path: '/store/payment-result/:orderId?',
        name: 'PaymentResult',
        component: () => import('@/views/store/PaymentResultView.vue'),
        meta: { noAds: true }
    },
    {
        path: '/store/my-orders',
        name: 'UserOrders',
        component: () => import('@/views/store/UserOrdersView.vue'),
        meta: { requiresAuth: true, noAds: true }
    },
    {
        path: '/merchant/store/product/add',
        name: 'MerchantAddProduct',
        component: () => import('@/views/store/MerchantAddProductView.vue'),
        meta: { requiresAuth: true, noAds: true }
    },
    {
        path: '/merchant/store/product/edit/:id',
        name: 'MerchantEditProduct',
        component: () => import('@/views/store/MerchantAddProductView.vue'),
        props: true,
        meta: { requiresAuth: true, noAds: true }
    },
    {
        path: '/admin/store/orders',
        name: 'AdminStoreOrders',
        component: () => import('@/views/store/AdminStoreOrdersView.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, noAds: true }
    },
    {
        path: '/store/chat/:conversationId',
        name: 'StoreChat',
        component: () => import('@/views/store/StoreChatView.vue'),
        meta: { requiresAuth: true, noAds: true }
    },
    {
        path: '/admin/store/chat-inbox',
        name: 'AdminStoreChatInbox',
        component: () => import('@/views/store/AdminStoreChatInboxView.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, noAds: true }
    },
    {
        path: '/store/chat-inbox',
        name: 'UserStoreChatInbox',
        component: () => import('@/views/store/UserStoreChatInboxView.vue'),
        meta: { requiresAuth: true, noAds: true }
    },
    {
        path: '/merchant/store/settings',
        name: 'MerchantStoreSettings',
        component: () => import('@/views/store/MerchantStoreSettingsView.vue'),
        meta: { requiresAuth: true, noAds: true }
    },
    {
        path: '/merchant/store/products',
        name: 'MerchantProductList',
        component: () => import('@/views/store/MerchantProductListView.vue'),
        meta: { requiresAuth: true, noAds: true }
    },
    {
        path: '/merchant/store/orders',
        name: 'MerchantStoreOrders',
        component: () => import('@/views/store/AdminStoreOrdersView.vue'),
        meta: { requiresAuth: true, noAds: true }
    },
    {
        path: '/merchant/store/chat-inbox',
        name: 'MerchantStoreChatInbox',
        component: () => import('@/views/store/AdminStoreChatInboxView.vue'),
        meta: { requiresAuth: true, noAds: true }
    },
    {
        path: '/merchant/register',
        name: 'MerchantRegistration',
        component: () => import('@/views/store/MerchantRegistrationView.vue'),
        meta: { requiresAuth: true, noAds: true }
    }

];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes
});

// ✅ Cleaner guard
router.beforeEach(async (to, from, next) => {
    let session = null;
    try {
        const { data } = await supabase.auth.getSession()
        session = data.session;
    } catch (e) {
        console.warn('⚠️ [Router] getSession timeout/error:', e);
    }

    // 🚫 Needs auth but not logged in
    if (to.meta.requiresAuth && !session) {
        return next({
            path: '/login',
            query: { redirect: to.fullPath }
        })
    }

    // 🔐 Admin / Contributor guard
    if (to.meta.requiresAdmin && !(isAdmin.value || isContributor.value)) {
        return next('/home')
    }

    // ⏳ Wait until profile is loaded
    if (session?.user && !profileLoaded.value) {
        return next()
    }

    // 🚨 Enforce profile completion
    if (
        session?.user &&
        !isProfileComplete.value &&
        !ALLOWED_WHEN_PROFILE_INCOMPLETE.includes(to.path)
    ) {
        return next({
            path: '/profile/edit',
            replace: true,
            query: { redirect: to.fullPath }
        })
    }

    next()
})



export default router;
