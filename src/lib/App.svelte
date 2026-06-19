<script lang="ts">
  import { onMount } from 'svelte';

  let count = $state<number | null>(null);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const res = await fetch(import.meta.env.BASE_URL + 'fedorovka_family.ged', { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      count = (text.match(/^0 @I\d+@ INDI/gm) || []).length;
    } catch (e) {
      error = (e as Error).message;
    }
  });
</script>

<main>
  <div class="eyebrow">Генеалогическое древо</div>
  <h1>Семья Виноградовых</h1>
  {#if error}
    <p class="err">Не удалось загрузить данные: {error}</p>
  {:else if count === null}
    <p class="muted">Загрузка…</p>
  {:else}
    <p class="muted">{count} человек · каркас v2 (Vite + Svelte + TS)</p>
  {/if}
</main>

<style>
  main { font-family: Manrope, system-ui, sans-serif; padding: 40px; color: #322c24; }
  .eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: #a08f5f; }
  h1 { font-family: Spectral, serif; font-weight: 600; font-size: 28px; margin: 6px 0 10px; }
  .muted { color: #7d7468; }
  .err { color: #8a4b4b; }
</style>
