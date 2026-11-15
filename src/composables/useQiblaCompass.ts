import { onUnmounted, ref, getCurrentInstance } from 'vue'
import { onIonViewWillLeave } from "@ionic/vue";

const KAABA_LAT = 21.422487;
const KAABA_LNG = 39.826206;
const SMOOTHING = 0.12;
const ALIGN_THRESHOLD = 5;

export function calculateQiblaBearing(lat: number, lng: number): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const toDeg = (r: number) => (r * 180) / Math.PI;

    const φ1 = toRad(lat);
    const φ2 = toRad(KAABA_LAT);
    const Δλ = toRad(KAABA_LNG - lng);

    const y = Math.sin(Δλ);
    const x = Math.cos(φ1) * Math.tan(φ2) - Math.sin(φ1) * Math.cos(Δλ);

    return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function shortestAngleDiff(a: number, b: number) {
    return ((((b - a) % 360) + 540) % 360) - 180;
}

export function useQiblaCompass() {
    const loading = ref(false);
    const hasCompass = ref(false);
    const sensorSupported = ref(true);
    const qiblaBearing = ref(0);
    const compassRotation = ref(0);
    const aligned = ref(false);

    let listener: ((e: any) => void) | null = null;
    let timeoutId: any = null;
    let initialized = false;
    let vx = 0;
    let vy = 0;
    let visualRotation = 0;
    let lastAngle = 0;

    async function requestPermission(): Promise<boolean> {
        const DeviceOrientation = (window as any).DeviceOrientationEvent;
        if (typeof DeviceOrientation?.requestPermission === 'function') {
            try {
                const res = await DeviceOrientation.requestPermission();
                return res === 'granted';
            } catch (err) {
                console.warn('[QiblaCompass] Permission error:', err);
                return false;
            }
        }
        return true;
    }

    async function start(lat: number, lng: number) {
        if (listener) cleanup();

        loading.value = true;
        sensorSupported.value = true;
        initialized = false;
        qiblaBearing.value = calculateQiblaBearing(lat, lng);

        const allowed = await requestPermission();
        if (!allowed) {
            loading.value = false;
            hasCompass.value = false;
            return false;
        }

        listener = (e: any) => {
            let heading: number | null = null;

            // 1. iOS Safari / WKWebView compass heading
            if (e.webkitCompassHeading != null && !isNaN(e.webkitCompassHeading)) {
                heading = Number(e.webkitCompassHeading);
            }
            // 2. Android absolute or relative alpha
            else if (e.alpha != null && !isNaN(e.alpha)) {
                let rawHeading = (360 - Number(e.alpha)) % 360;
                
                // Adjust for screen orientation angle (e.g. landscape vs portrait)
                const screenAngle = typeof screen !== 'undefined' && screen.orientation?.angle != null
                    ? screen.orientation.angle
                    : (typeof window !== 'undefined' && (window as any).orientation != null
                        ? Number((window as any).orientation)
                        : 0);

                heading = (rawHeading + screenAngle + 360) % 360;
            }

            if (heading === null) return;

            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }

            // --- Vector Smoothing ---
            const rad = (heading * Math.PI) / 180;
            const hx = Math.cos(rad);
            const hy = Math.sin(rad);

            if (!initialized) {
                vx = hx; vy = hy;
                visualRotation = heading;
                lastAngle = heading;
                initialized = true;
                loading.value = false;
                hasCompass.value = true;
                compassRotation.value = heading;

                const diff = Math.abs(shortestAngleDiff(heading, qiblaBearing.value));
                aligned.value = diff <= ALIGN_THRESHOLD;
                return;
            }

            vx = vx * (1 - SMOOTHING) + hx * SMOOTHING;
            vy = vy * (1 - SMOOTHING) + hy * SMOOTHING;

            const smoothedHeading = (Math.atan2(vy, vx) * 180 / Math.PI + 360) % 360;
            const delta = shortestAngleDiff(lastAngle, smoothedHeading);

            visualRotation += delta;
            lastAngle = smoothedHeading;
            compassRotation.value = visualRotation;

            const diff = Math.abs(shortestAngleDiff(smoothedHeading, qiblaBearing.value));
            aligned.value = diff <= ALIGN_THRESHOLD;
        };

        // Attach listeners for both deviceorientationabsolute (Android absolute) and deviceorientation (iOS/Fallback)
        if (typeof window !== 'undefined') {
            window.addEventListener('deviceorientationabsolute', listener, true);
            window.addEventListener('deviceorientation', listener, true);
        }

        // Set a 3.5s timeout: If no valid orientation event with heading arrives, update state gracefully
        timeoutId = setTimeout(() => {
            if (!initialized) {
                loading.value = false;
                hasCompass.value = false;
                sensorSupported.value = false;
            }
        }, 3500);

        return true;
    }

    function cleanup() {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        if (listener && typeof window !== 'undefined') {
            window.removeEventListener('deviceorientationabsolute', listener, true);
            window.removeEventListener('deviceorientation', listener, true);
            listener = null;
        }
    }

    if (getCurrentInstance()) {
        onIonViewWillLeave(cleanup);
        onUnmounted(cleanup);
    }

    return {
        loading,
        hasCompass,
        sensorSupported,
        qiblaBearing,
        compassRotation,
        aligned,
        start,
        stop: cleanup,
        requestPermission
    };
}