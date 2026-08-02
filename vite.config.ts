import { createReadStream, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const temporaryScanRoot = '/private/tmp/r473op1d4430-gallery/normalized';

function temporaryScanFiles(command: 'serve' | 'build') {
  if (command !== 'serve') return null;
  return {
    name: 'temporary-scan-gallery-files',
    apply: 'serve' as const,
    configureServer(server: { middlewares: { use: (path: string, handler: (req: any, res: any, next: () => void) => void) => void } }) {
      server.middlewares.use('/r473op1d4430', (req, res, next) => {
        const requestPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
        const filePath = resolve(temporaryScanRoot, `.${requestPath}`);
        if (!filePath.startsWith(temporaryScanRoot + sep)) return next();
        try {
          if (!statSync(filePath).isFile()) return next();
          res.statusCode = 200;
          const contentType = filePath.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg';
          res.setHeader('Content-Type', contentType);
          createReadStream(filePath).pipe(res);
        } catch {
          next();
        }
      });
    },
  };
}

// Pages serves the project at /vinogradov-tree/; dev serves at root so previews work.
export default defineConfig(({ command }) => {
  const temporaryGalleryPlugin = temporaryScanFiles(command);
  return {
    base: command === 'build' ? '/vinogradov-tree/' : '/',
    plugins: [svelte(), ...(temporaryGalleryPlugin ? [temporaryGalleryPlugin] : [])],
    build: { target: 'es2020', chunkSizeWarningLimit: 1200 },
  };
});
