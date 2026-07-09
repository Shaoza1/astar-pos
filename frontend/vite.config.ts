import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// TODO: configure vite-plugin-pwa in Phase 2
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // @ maps to ./src for clean absolute imports throughout the app
      '@': path.resolve(__dirname, './src'),
    },
  },
});
