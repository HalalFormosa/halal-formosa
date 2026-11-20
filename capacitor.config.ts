import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rcreative.halalformosa',
  appName: 'Halal Formosa',
  webDir: 'dist',
  // Brand orange behind the WebView so there is no black/white flash before the web splash paints.
  backgroundColor: '#E67E22',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    CapacitorHttp: {
      enabled: false,
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
