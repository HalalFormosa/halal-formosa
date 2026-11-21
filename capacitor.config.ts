import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rcreative.halalformosa',
  appName: 'Halal Formosa',
  webDir: 'dist',
  // White behind the WebView (matches the launch splash) so nothing flashes before the web splash paints.
  backgroundColor: '#FFFFFF',
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
