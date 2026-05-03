import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  // Use /vipos/ in production builds (deployed at http://<host>/vipos/),
  // and / in dev for convenience (localhost:5173).
  base: mode === 'production' ? '/vipos/' : '/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
}));
