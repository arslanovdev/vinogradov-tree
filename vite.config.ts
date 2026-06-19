import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Pages serves the project at /vinogradov-tree/; dev serves at root so previews work.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/vinogradov-tree/' : '/',
  plugins: [svelte()],
  build: { target: 'es2020', chunkSizeWarningLimit: 1200 },
}));
