import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rcreative.halalformosa',
  appName: 'Halal Formosa',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    Keyboard: {
      resize: 'body',           // or 'native' for Android 12+
      resizeOnFullScreen: true, // helpful for fullscreen mode
    },
    SystemBars: {
      insetsHandling: 'css',
    },
  },
};

export default config;
