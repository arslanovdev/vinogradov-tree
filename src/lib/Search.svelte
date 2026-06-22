<script lang="ts">
  import type { Tree } from '../gedcom/types';
  import type { Layout } from '../model/layout';
  import { nameParts, lifespan } from '../model/derive';
  import { relationFor } from '../model/detail';
  import { Search, X } from '@lucide/svelte';

  let { tree, layout, mobile = false, onpick }: { tree: Tree; layout: Layout; mobile?: boolean; onpick: (id: string) => void } = $props();

  let q = $state('');
  let active = $state(0);
  let inputEl: HTMLInputElement;
  const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

  const results = $derived.by(() => {
    const query = norm(q.trim());
    if (query.length < 2) return [];
    const out: { id: string; main: string; sub: string; rel: string; life: string; score: number; full: string }[] = [];
    for (const id of Object.keys(tree.indi)) {
      const p = tree.indi[id];
      const np = nameParts(p);
      const full = norm([np.main, np.sub].filter(Boolean).join(' '));
      const i = full.indexOf(query);
      if (i < 0) continue;
      out.push({ id, main: np.main, sub: np.sub, rel: relationFor(tree, id, layout), life: lifespan(p), score: i === 0 ? 0 : 1, full });
    }
    out.sort((a, b) => a.score - b.score || a.full.localeCompare(b.full));
    return out.slice(0, 8);
  });

  $effect(() => { void results; active = 0; });

  function pick(id: string) { onpick(id); q = ''; inputEl?.blur(); }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { q = ''; inputEl?.blur(); return; }
    if (!results.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % results.length; }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + results.length) % results.length; }
    else if (e.key === 'Enter') { e.preventDefault(); pick(results[active].id); }
  }
</script>

<div class="search" class:mob={mobile} class:desk={!mobile}>
  <div class="box">
    <Search size={16} strokeWidth={2.2} color="#a08f5f" />
    <input
      bind:this={inputEl}
      bind:value={q}
      onkeydown={onKey}
      placeholder="Поиск по имени…"
      spellcheck="false"
      autocomplete="off"
    />
    {#if q}<button class="clr" onclick={() => { q = ''; inputEl?.focus(); }} aria-label="Очистить"><X size={15} strokeWidth={2} /></button>{/if}
  </div>

  {#if results.length}
    <div class="list">
      {#each results as r, i (r.id)}
        <button class="row" class:active={i === active} onclick={() => pick(r.id)} onmouseenter={() => (active = i)}>
          <div class="nm"><span class="main">{r.main}</span>{#if r.sub}<span class="sub">{r.sub}</span>{/if}</div>
          <div class="meta"><span class="rel">{r.rel}</span><span class="life">{r.life}</span></div>
        </button>
      {/each}
    </div>
  {:else if norm(q.trim()).length >= 2}
    <div class="list"><div class="empty">Никого не нашлось</div></div>
  {/if}
</div>

<style>
  .search { position: absolute; z-index: 47; font-family: Manrope, sans-serif; }
  .search.desk { left: 30px; bottom: 26px; width: 300px; }
  /* мобайл: широкая нижняя полоса; инфо и контролы подняты над ней */
  .search.mob { left: 14px; right: 14px; bottom: 14px; }
  .box { display: flex; align-items: center; gap: 8px; background: rgba(255,253,249,0.96); backdrop-filter: blur(8px); border: 1px solid #e7decb; border-radius: 13px; padding: 9px 12px; box-shadow: 0 6px 20px rgba(70,55,40,0.1); }
  .box:focus-within { border-color: #cdbd96; box-shadow: 0 8px 26px rgba(70,55,40,0.16); }
  input { flex: 1; border: none; outline: none; background: none; font-family: inherit; font-size: 14px; color: #352f28; min-width: 0; }
  input::placeholder { color: #a99f8f; }
  .clr { display: flex; border: none; background: none; color: #b3a995; cursor: pointer; padding: 0; }
  .clr:hover { color: #6a6358; }
  /* выпадение ВВЕРХ (поиск стоит внизу) */
  .list { position: absolute; bottom: calc(100% + 7px); left: 0; right: 0; background: #fffdf9; border: 1px solid #ece5da; border-radius: 13px; box-shadow: 0 -14px 38px rgba(70,55,40,0.16); overflow: hidden; max-height: 56vh; overflow-y: auto; }
  .row { display: block; width: 100%; text-align: left; background: none; border: none; border-bottom: 1px solid #f3eee5; padding: 9px 13px; cursor: pointer; font-family: inherit; }
  .row:last-child { border-bottom: none; }
  .row.active { background: #f6f1e8; }
  .nm { display: flex; gap: 7px; align-items: baseline; }
  .main { font-family: Spectral, serif; font-size: 14.5px; font-weight: 600; color: #322c24; }
  .sub { font-size: 12px; color: #6a6358; }
  .meta { display: flex; gap: 8px; align-items: center; margin-top: 1px; }
  .rel { font-size: 10px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #a08f5f; }
  .life { font-size: 11px; color: #8d8478; font-variant-numeric: tabular-nums; }
  .empty { padding: 12px 14px; font-size: 13px; color: #8d8478; }
</style>
