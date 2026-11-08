import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.potok.fitness',
  appName: 'ПОТОК',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

// Isolated manual-test APK: separate storage/application ID and local-only entry.
if (process.env.POTOK_MANUAL_TEST === '1') {
  config.appId = 'com.potok.fitness.menutest';
  config.appName = 'POTOK Меню ТЕСТ';
  config.webDir = 'dist-manual-test';
  config.android = { path: 'android-manual-test' };
}

export default config;
