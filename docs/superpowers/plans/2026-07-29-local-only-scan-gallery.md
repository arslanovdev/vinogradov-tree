# Local-Only Scan Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the scan gallery available in local development while excluding its UI, component code, and temporary scan route from production.

**Architecture:** `App.svelte` will conditionally load the gallery module only in dev mode and render its control only when dev mode is active. The Vite middleware serving `/i294op1d587` will be registered only for the dev command, so the production build has no temporary scan server route.

**Tech Stack:** Svelte 5, TypeScript, Vite 6, Vitest.

## Global Constraints

- Production must not show the gallery button or import `ScanGallery`.
- Local `npm run dev` must retain the gallery button and the WebP route `/i294op1d587`.
- Existing GEDCOM, photo, and scan-gallery behavior must remain unchanged.
- Do not modify the user's existing unrelated working-tree changes.

---

### Task 1: Gate the gallery UI and module import by dev mode

**Files:**
- Modify: `src/lib/App.svelte:1-125`

**Interfaces:**
- Consumes: Vite's compile-time `import.meta.env.DEV` boolean.
- Produces: A dev-only `ScanGallery` component reference and dev-only gallery button.

- [ ] **Step 1: Replace the static gallery import with a dev-only component reference**

Remove `import ScanGallery from './ScanGallery.svelte';`. Add `let ScanGallery = $state<Component<any> | null>(null);` beside `MapView`, then load it in `onMount` only when `import.meta.env.DEV` is true:

```ts
if (import.meta.env.DEV) {
  ScanGallery = (await import('./ScanGallery.svelte')).default as Component<any>;
}
```

Keep the existing `Component` type import.

- [ ] **Step 2: Guard gallery mode and render path**

Change the gallery branch to require the component reference:

```svelte
{:else if mode === 'gallery' && ScanGallery}
  <ScanGallery onclose={() => (mode = 'tree')} />
```

Keep `mode` as-is so the existing close behavior remains unchanged.

- [ ] **Step 3: Render the gallery control only in dev mode**

Wrap the existing gallery button in a Svelte conditional:

```svelte
{#if import.meta.env.DEV}
  <button class="ctl light" onclick={toggleGallery} title="Временная галерея сканов" aria-label="Временная галерея сканов">
    <Grid2X2 size={19} strokeWidth={2} />
  </button>
{/if}
```

- [ ] **Step 4: Run the typecheck and tests**

Run: `npm test`

Expected: all existing test files pass; no gallery-specific runtime test should regress.

Run: `npm run build`

Expected: TypeScript and Vite production build exit with code 0.

### Task 2: Register the temporary scan middleware only during dev

**Files:**
- Modify: `vite.config.ts:8-36`

**Interfaces:**
- Consumes: Vite's `command` value from `defineConfig`.
- Produces: The existing `/i294op1d587` WebP/JPEG middleware only when `command === 'serve'`.

- [ ] **Step 1: Pass the command into the middleware factory**

Change the factory signature to `temporaryScanFiles(command: 'serve' | 'build')` and return no plugin when the command is not `serve`:

```ts
function temporaryScanFiles(command: 'serve' | 'build') {
  if (command !== 'serve') return null;
  return {
    name: 'temporary-scan-gallery-files',
    apply: 'serve' as const,
    // existing configureServer implementation
  };
}
```

- [ ] **Step 2: Add only the non-null plugin to the Vite plugin list**

Update the config callback to build the plugin list without a null entry:

```ts
export default defineConfig(({ command }) => {
  const temporaryGalleryPlugin = temporaryScanFiles(command);
  return {
    base: command === 'build' ? '/vinogradov-tree/' : '/',
    plugins: [svelte(), ...(temporaryGalleryPlugin ? [temporaryGalleryPlugin] : [])],
    build: { target: 'es2020', chunkSizeWarningLimit: 1200 },
  };
});
```

- [ ] **Step 3: Verify dev and production boundaries**

Run: `npm run build && ! rg -n "ScanGallery|i294op1d587|Временная галерея" dist`

Expected: production build succeeds and `rg` finds no gallery-specific strings in `dist`.

Run the dev server and request: `curl -I http://127.0.0.1:5173/i294op1d587/0001.webp`

Expected: HTTP 200 with `Content-Type: image/webp`.

- [ ] **Step 4: Run the complete verification suite**

Run: `npm test && npm run build`

Expected: all tests pass and the production build exits with code 0. Existing unrelated Svelte unused-selector warnings may remain, but there must be no TypeScript or build errors.
