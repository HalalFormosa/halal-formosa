import { onUnmounted, ref } from 'vue'
import { onIonViewWillLeave } from "@ionic/vue";

const KAABA_LAT = 21.422487;
const KAABA_LNG = 39.826206;
const SMOOTHING = 0.12;
const ALIGN_THRESHOLD = 5;

function calculateQiblaBearing(lat: number, lng: number): number {
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
    const qiblaBearing = ref(0);
    const compassRotation = ref(0);
    const aligned = ref(false);

    let listener: ((e: any) => void) | null = null;
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
            } catch {
                return false;
            }
        }
        return true;
    }

    async function start(lat: number, lng: number) {
        if (listener) cleanup();

        loading.value = true;
        initialized = false;
        qiblaBearing.value = calculateQiblaBearing(lat, lng);

        const allowed = await requestPermission();
        if (!allowed) {
            loading.value = false;
            return;
        }

        listener = (e: any) => {
            let heading: number | null = null;

            if (e.webkitCompassHeading != null) {
                heading = e.webkitCompassHeading;
            } else if (e.alpha != null) {
                // For Android, we use 360 - alpha to get clockwise rotation
                heading = 360 - e.alpha;
            }

            if (heading === null) return;

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

        // Define the event name based on browser support
        const eventName = 'ondeviceorientationabsolute' in window
            ? 'deviceorientationabsolute'
            : 'deviceorientation';

        // Use a type guard to ensure listener is not null
        if (listener) {
            (window as any).addEventListener(eventName, listener, true);
        }
    }

    function cleanup() {
        if (listener) {
            window.removeEventListener('deviceorientation', listener);
            window.removeEventListener('deviceorientationabsolute', listener);
            listener = null;
        }
    }

    onIonViewWillLeave(cleanup);

    onUnmounted(cleanup);

    return { loading, hasCompass, qiblaBearing, compassRotation, aligned, start };
}