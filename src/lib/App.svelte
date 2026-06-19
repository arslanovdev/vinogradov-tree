<script lang="ts">
  import { onMount } from 'svelte';
  import type { Tree as TreeData } from '../gedcom/types';
  import { parseGedcom } from '../gedcom/parse';
  import { buildLayout, type Layout } from '../model/layout';
  import { plural, ACCENT } from '../model/derive';
  import Tree from './Tree.svelte';
  import Detail from './Detail.svelte';
  import Search from './Search.svelte';
  import type { Component } from 'svelte';
  import { Map as MapIcon, TreePine, LocateFixed, Plus, Minus, Maximize, Info, Star, Cross } from '@lucide/svelte';

  let tree = $state<TreeData | null>(null);
  let layout = $state<Layout | null>(null);
  let selected = $state<string | null>(null);
  let error = $state<string | null>(null);
  let vw = $state(typeof window !== 'undefined' ? window.innerWidth : 1200);
  let legendOpen = $state(false);
  let mode = $state<'tree' | 'map'>('tree');
  let MapView = $state<Component<any> | null>(null);
  let treeRef: Tree | undefined = $state();

  const mobile = $derived(vw <= 640);
  const peopleCount = $derived(tree ? Object.keys(tree.indi).length : 0);

  onMount(async () => {
    try {
      const res = await fetch(import.meta.env.BASE_URL + 'fedorovka_family.ged', { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const t = parseGedcom(await res.text());
      if (!t.indi['@I1@']) throw new Error('в GEDCOM нет отправной персоны @I1@');
      layout = buildLayout(t);
      tree = t;
    } catch (e) {
      error = (e as Error).message;
    }
    const onR = () => (vw = window.innerWidth);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  });

  function select(id: string) { selected = id; }
  function goto(id: string, zoom = 0.85) {
    mode = 'tree';
    selected = id;
    setTimeout(() => treeRef?.focus(id, zoom, mobile ? 0.5 : 0.42), 0);
  }
  function locate(id: string) { goto(id, 1.0); } // поиск: ближе зум
  async function toggleMap() {
    mode = mode === 'map' ? 'tree' : 'map';
    if (mode === 'map') {
      selected = null;
      if (!MapView) MapView = (await import('./MapView.svelte')).default as Component<any>;
    }
  }
</script>

<div class="root" style="--pat:{ACCENT.paternal};--mat:{ACCENT.maternal};--self:{ACCENT.self}">
  <div class="blob a"></div>
  <div class="blob b"></div>

  {#if error}
    <div class="center err">Не удалось загрузить данные древа: {error}</div>
  {:else if !tree || !layout}
    <div class="center muted">Загрузка древа…</div>
  {:else}
    <Tree bind:this={treeRef} {tree} {layout} {selected} onselect={select} />

    {#if mode === 'map' && MapView}
      <MapView {tree} {layout} {mobile} ongoto={goto} />
    {/if}

    {#if mode === 'tree'}
      <Search {tree} {layout} {mobile} onpick={locate} />
    {/if}

    {#if mode === 'tree' && !selected}
      <div class="header" class:mobile>
        <div class="eyebrow">Генеалогическое древо</div>
        <div class="title">Семья Виноградовых</div>
        {#if !mobile || legendOpen}
          <div class="sub">Фёдоровский район, Башкортостан · {layout.generations} {plural(layout.generations, ['поколение', 'поколения', 'поколений'])} · {peopleCount} {plural(peopleCount, ['человек', 'человека', 'человек'])}.<br>Точка отсчёта — <b>Надежда Виноградова</b>.</div>
        {/if}
      </div>
    {/if}

    {#if mode === 'tree' && (!mobile || legendOpen)}
      <div class="legend" class:mobile>
        <div class="lcol">
          <div class="lh">Родственные линии</div>
          <div class="lrow"><span class="bar" style="background:var(--pat)"></span>линия отца</div>
          <div class="lrow"><span class="bar" style="background:var(--mat)"></span>линия матери</div>
          <div class="lrow"><span class="bar" style="background:var(--self)"></span>вы</div>
        </div>
        <div class="lcol">
          <div class="lh">Достоверность</div>
          <div class="lrow"><span class="cb" style="color:#5b5347">A</span>подтверждено</div>
          <div class="lrow"><span class="cb" style="color:#9a9082">B</span>вероятно</div>
          <div class="lrow"><span class="cb" style="color:#bdb4a5">C</span>мало данных</div>
        </div>
        <div class="lcol">
          <div class="lh">Метки</div>
          <div class="lrow"><Star size={13} strokeWidth={2} color="#8d8478" />военная служба</div>
          <div class="lrow"><Cross size={13} strokeWidth={2} color="#a59a8c" />погиб / умер</div>
        </div>
      </div>
    {/if}

    {#if mode === 'tree' && mobile && !selected}
      <button class="ctl light info" onclick={() => (legendOpen = !legendOpen)} title="Легенда" aria-label="Легенда"><Info size={20} strokeWidth={2} /></button>
    {/if}

    <div class="controls">
      <button class="ctl light" onclick={toggleMap} title={mode === 'map' ? 'К дереву' : 'Карта рода'} aria-label={mode === 'map' ? 'К дереву' : 'Карта рода'}>
        {#if mode === 'map'}<TreePine size={20} strokeWidth={2} />{:else}<MapIcon size={20} strokeWidth={2} />{/if}
      </button>
      {#if mode === 'tree'}
        <button class="ctl accent" onclick={() => treeRef?.findMe()} title="Найти меня" aria-label="Найти меня"><LocateFixed size={20} strokeWidth={2.2} /></button>
        <div class="zbox">
          <button onclick={() => treeRef?.zoom(1.2)} title="Приблизить" aria-label="Приблизить"><Plus size={19} strokeWidth={2} /></button>
          <button onclick={() => treeRef?.zoom(1 / 1.2)} title="Отдалить" aria-label="Отдалить"><Minus size={19} strokeWidth={2} /></button>
          <button onclick={() => treeRef?.fit()} title="Вписать целиком" aria-label="Вписать целиком"><Maximize size={17} strokeWidth={2} /></button>
        </div>
      {/if}
    </div>

    {#if selected}
      <Detail {tree} {layout} id={selected} {mobile} onclose={() => (selected = null)} ongoto={goto} />
    {/if}
  {/if}
</div>

<style>
  :global(html, body) { margin: 0; padding: 0; height: 100%; background: #f4f0e9; }
  .root { position: fixed; inset: 0; overflow: hidden; font-family: Manrope, system-ui, sans-serif; background: radial-gradient(1200px 800px at 22% 18%, #fbf9f4 0%, #f2ede5 55%, #ece5da 100%); }
  .blob { position: absolute; border-radius: 50%; filter: blur(8px); pointer-events: none; }
  .blob.a { width: 420px; height: 420px; left: -120px; top: -80px; background: radial-gradient(circle, rgba(194,137,92,0.13), transparent 70%); animation: floaty 22s ease-in-out infinite; }
  .blob.b { width: 520px; height: 520px; right: -160px; bottom: -140px; background: radial-gradient(circle, rgba(94,144,136,0.13), transparent 70%); animation: floaty 28s ease-in-out infinite reverse; }
  .center { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 40px; text-align: center; }
  .muted { color: #a08f5f; } .err { color: #8a4b4b; }
  .header { position: absolute; left: 30px; top: 26px; max-width: 380px; pointer-events: none; z-index: 20; animation: hdrIn 0.8s ease both; }
  .header.mobile { left: 16px; top: 16px; max-width: 70%; }
  .eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: #a08f5f; }
  .title { font-family: Spectral, serif; font-size: 26px; font-weight: 600; color: #322c24; line-height: 1.05; margin-top: 5px; }
  .sub { font-size: 12.5px; color: #7d7468; margin-top: 7px; line-height: 1.5; }
  .sub b { color: #322c24; font-weight: 600; }
  .legend { position: absolute; left: 30px; bottom: 82px; display: flex; gap: 20px; flex-wrap: wrap; background: rgba(255,253,249,0.86); backdrop-filter: blur(8px); border: 1px solid #ece5da; border-radius: 16px; padding: 13px 16px; box-shadow: 0 8px 24px rgba(70,55,40,0.08); font-size: 11.5px; color: #6a6358; z-index: 44; }
  .legend.mobile { left: 14px; right: 14px; bottom: 150px; }
  .lh { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #a59a8c; margin-bottom: 7px; }
  .lrow { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; white-space: nowrap; }
  .bar { width: 18px; height: 5px; border-radius: 3px; }
  .cb { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 5px; background: #f0ebe2; font-size: 9px; font-weight: 800; }
  /* единый стиль кнопок-иконок: ровный столбик шириной 46px */
  .ctl { width: 46px; height: 46px; display: flex; align-items: center; justify-content: center; border-radius: 14px; cursor: pointer; box-shadow: 0 6px 18px rgba(70,55,40,0.12); border: 1px solid #ece5da; }
  .ctl.light { background: rgba(255,253,249,0.95); backdrop-filter: blur(8px); color: #5b5347; }
  .ctl.light:hover { background: #f6f1e8; }
  .ctl.accent { background: var(--self); color: #fffdf9; border: none; box-shadow: 0 6px 18px rgba(70,55,40,0.18); }
  .ctl.accent:hover { filter: brightness(1.06); }
  .info { position: absolute; left: 16px; bottom: 26px; z-index: 45; }
  .controls { position: absolute; right: 26px; bottom: 26px; display: flex; flex-direction: column; align-items: center; gap: 9px; z-index: 46; }
  .zbox { display: flex; flex-direction: column; width: 46px; background: rgba(255,253,249,0.9); backdrop-filter: blur(8px); border: 1px solid #ece5da; border-radius: 14px; overflow: hidden; box-shadow: 0 6px 18px rgba(70,55,40,0.08); }
  .zbox button { display: flex; align-items: center; justify-content: center; background: none; border: none; border-bottom: 1px solid #efe9df; width: 46px; height: 42px; color: #5b5347; cursor: pointer; font-family: inherit; }
  .zbox button:last-child { border-bottom: none; }
  .zbox button:hover { background: #f6f1e8; }
  @keyframes floaty { 0% { transform: translate(0,0); } 50% { transform: translate(26px,-30px); } 100% { transform: translate(0,0); } }
  @keyframes hdrIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: none; } }
</style>
