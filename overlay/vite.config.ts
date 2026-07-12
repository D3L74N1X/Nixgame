import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    fs: {
      // @nixgame/shared liegt als TS-Quelle außerhalb des Overlay-Roots
      allow: ['..'],
    },
  },
});
