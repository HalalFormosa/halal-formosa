import { ref, onMounted } from 'vue';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/plugins/supabaseClient';

export function useAppUpdate() {
    const isUpdateRequired = ref(false);
    const storeUrl = ref('');
    const currentVersion = ref('');
    const minVersion = ref('');

    /**
     * Compare two semantic versions (e.g., "1.5.0", "1.5.1")
     * Returns:
     *  1 if v1 > v2
     * -1 if v1 < v2
     *  0 if v1 == v2
     */
    const compareVersions = (v1: string, v2: string): number => {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);

        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const num1 = parts1[i] || 0;
            const num2 = parts2[i] || 0;
            if (num1 > num2) return 1;
            if (num1 < num2) return -1;
        }
        return 0;
    };

    const checkForUpdate = async () => {
        try {
            const platform = Capacitor.getPlatform(); // 'android', 'ios', or 'web'

            // Get current version
            let currentVer = '0.0.0';
            if (Capacitor.isNativePlatform()) {
                const info = await CapacitorApp.getInfo();
                currentVer = info.version;
            } else {
                currentVer = import.meta.env.VITE_APP_VERSION || '1.5.0';
            }
            currentVersion.value = currentVer;

            const versionKey = platform === 'ios' ? 'min_ios_version' : 'min_android_version';
            const urlKey = platform === 'ios' ? 'ios_store_url' : 'android_store_url';


            // Fetch from app_config table
            const { data, error } = await supabase
                .from('app_config')
                .select('key, value')
                .in('key', [versionKey, urlKey]);

            if (error) {
                console.warn('[useAppUpdate] Supabase query returned an error (Table might not exist yet):', error.message);
                return;
            }
            if (!data || data.length === 0) {
                console.warn('[useAppUpdate] No configuration data found in app_config table.');
                return;
            }

            const minVersionVal = data.find(item => item.key === versionKey)?.value;
            const storeUrlVal = data.find(item => item.key === urlKey)?.value;

            if (minVersionVal) {
                minVersion.value = minVersionVal;
                const comparison = compareVersions(currentVer, minVersionVal);

                if (comparison < 0) {
                    console.warn(`⚠️ Update Required! Current version (${currentVer}) is lower than minimum (${minVersionVal})`);
                    if (Capacitor.isNativePlatform()) {
                        isUpdateRequired.value = true;
                        storeUrl.value = storeUrlVal || '';
                    }
                } else {
                    console.log('✅ Version is up to date.');
                }
            }
        } catch (err) {
            console.error('❌ Force Update Check failed spectacularly:', err);
        }
    };

    onMounted(checkForUpdate);

    return {
        isUpdateRequired,
        storeUrl,
        currentVersion,
        minVersion,
        checkForUpdate
    };
}
