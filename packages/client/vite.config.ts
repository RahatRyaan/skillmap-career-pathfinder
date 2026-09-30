import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Dev requests go through Vite so the browser sees one origin and the
      // CORS allow-list stays honest.
      '/api': {
        target: process.env.VITE_API_PROXY ?? 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        /**
         * Only the framework is split out by hand.
         *
         * Recharts and the flow graph were previously listed here too, which
         * had the opposite of the intended effect: Vite preloads every chunk
         * named in `manualChunks` on the entry page, so a 416 KB charting
         * library was downloaded by every visitor, including the landing page
         * that has no charts.
         *
         * Route-level `React.lazy` already keeps them out of the entry chunk,
         * and the bundle sizes confirm it. Listing a library here is only
         * correct when every route needs it.
         */
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
