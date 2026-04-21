/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vitest/config'


import pkg from './package.json' assert { type: 'json' }

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        legacy()
    ],
    optimizeDeps: {
        include: ['vue-advanced-cropper'],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
    },
    build: {
        minify: 'terser',
        terserOptions: {
            compress: {
                keep_fnames: false,
                keep_classnames: false,
            },
            mangle: {
                keep_fnames: false,
                keep_classnames: false,
                reserved: [
                    // html5-qrcode related names
                    'Html5Qrcode',
                    'Html5QrcodeScanner',
                    'Html5QrcodeScanType',
                    'Html5QrcodeSupportedFormats',
                    'QrDimensions',
                    'QrDimensionFunction',
                    'CameraDevice',
                    'Html5QrcodeResult',
                    'Html5QrcodeError',
                    'Html5QrcodeErrorFactory',
                    'Html5QrcodeCameraScanConfig',
                    'Html5QrcodeFileScanConfig',
                    'Html5QrcodeFullConfig',
                    'QrcodeSuccessCallback',
                    'QrcodeErrorCallback',
                    'Html5QrcodeConfigs',
                    // ZXing related (used internally by html5-qrcode)
                    'BrowserMultiFormatReader',
                    'MultiFormatReader',
                    'BarcodeFormat',
                    'DecodeHintType',
                    'Exception',
                    'ChecksumException',
                    'FormatException',
                    'NotFoundException',
                    'ReaderException',
                    // Common method names that shouldn't be mangled
                    'start',
                    'stop',
                    'clear',
                    'scanFile',
                    'scanFileV2',
                    'getState',
                    'getCameras',
                    'render',
                ],
            },
        },
        rollupOptions: {
            output: {
                manualChunks: {
                    // Isolate html5-qrcode in its own chunk to reduce minification impact
                    'html5-qrcode': ['html5-qrcode'],
                },
            },
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
    },
})
