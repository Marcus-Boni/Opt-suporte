import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@server': fileURLToPath(new URL('../server/src', import.meta.url)),
    },
  },
  build: {
    // Bibliotecas de gráfico e de UI em chunks próprios: cacheiam entre deploys e não bloqueiam o primeiro paint.
    rollupOptions: { output: { manualChunks: { recharts: ['recharts'], ui: ['radix-ui', 'cmdk', 'lucide-react', 'sonner'] } } },
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:4000', '/docs': 'http://localhost:4000' },
  },
});
