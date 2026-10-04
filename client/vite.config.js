import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const here = path.dirname(fileURLToPath(import.meta.url));
const apiPort = process.env.PORT || 5000;

export default defineConfig({
  root: here,
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.resolve(here, '..', 'server', 'public'),
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2020',
    // three.js and its React bindings are ~965 kB minified, and they are
    // already isolated in their own chunk and only fetched when the Platforms
    // section needs them. Raising the ceiling stops the warning without
    // pretending the number is smaller than it is; lowering it would only
    // hide a chunk that is deliberately split out already.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          motion: ['framer-motion'],
          three: ['three', '@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
});
