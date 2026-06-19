import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Pages serves the project at /vinogradov-tree/
export default defineConfig({
  base: '/vinogradov-tree/',
  plugins: [svelte()],
  build: { target: 'es2020', chunkSizeWarningLimit: 1200 },
});
