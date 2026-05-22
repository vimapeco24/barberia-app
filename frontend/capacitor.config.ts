import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.barbershop.app',
  appName: 'BarberShop',
  webDir: 'dist',
  server: {
    // For development: use local backend
    url: 'http://localhost:5173',
    cleartext: true,
  },
};

export default config;
