<script lang="ts">
  import type { Tree } from '../gedcom/types';
  import type { Layout } from '../model/layout';
  import { buildDetail } from '../model/detail';
  import { X, Search, Square, FileText, Landmark } from '@lucide/svelte';

  let { tree, layout, id, mobile = false, onclose, ongoto }:
    { tree: Tree; layout: Layout; id: string; mobile?: boolean; onclose: () => void; ongoto: (id: string) => void } = $props();

  const d = $derived(buildDetail(tree, id, layout));
  let photoOk = $state(false);
  let lightbox = $state<{ src: string; caption: string } | null>(null);
  let docLoaded = $state<Record<string, boolean>>({});

  $effect(() => {
    photoOk = false;
    lightbox = null;
    if (d?.photo) { const im = new Image(); im.onload = () => (photoOk = true); im.src = d.photo; }
  });
  // проверяем, какие сканы документов реально доступны (файл загружается)
  $effect(() => {
    for (const doc of d?.documents ?? []) {
      if (docLoaded[doc.file] !== undefined) continue;
      docLoaded[doc.file] = false;
      const im = new Image();
      im.onload = () => (docLoaded[doc.file] = true);
      im.src = doc.file;
    }
  });
  $effect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') lightbox = null; };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

{#if d}
  <button class="backdrop" onclick={onclose} aria-label="Закрыть"></button>
  <div class="drawer" class:mobile style="--accent:{d.accent};--soft:{d.soft};--conf:{d.conf.shade}">
    {#if mobile}<button class="grab" onclick={onclose} aria-label="Закрыть"><span></span></button>{/if}
    <button class="close" onclick={onclose} aria-label="Закрыть"><X size={17} strokeWidth={2} /></button>

    <div class="head">
      {#if d.photo && photoOk}
        <button class="ava avabtn" style="background:#f0ebe2 center/cover no-repeat url('{d.photo}');box-shadow:inset 0 0 0 2px var(--soft)" onclick={() => (lightbox = { src: d.photo!, caption: [d.main, d.sub].filter(Boolean).join(' · ') })} title="Увеличить фото" aria-label="Увеличить фото"></button>
      {:else}
        <div class="ava mono">{d.mono}</div>
      {/if}
      <div class="ht">
        <div class="rel">{d.relation}</div>
        <div class="name">{d.main}</div>
        <div class="givn">{d.sub}</div>
      </div>
    </div>

    <div class="pills">
      <span class="pill soft">{d.sideLabel}</span>
      <span class="pill grey nums">{d.lifespan}</span>
      <span class="pill grey" title={d.methodology ?? d.conf.label}><span class="cbadge">{d.conf.letter}</span>{d.conf.label}</span>
    </div>

    {#each d.facts as f}
      <div class="fact"><div class="flabel">{f.label}</div><div class="fval">{f.value}</div></div>
    {/each}

    {#each d.notes as t}<div class="note">{t}</div>{/each}

    {#if d.todo.length}
      <div class="box todo">
        <div class="boxh green ic"><Search size={12} strokeWidth={2.4} />Что искать дальше</div>
        {#each d.todo as t}<div class="todorow"><Square size={13} strokeWidth={2} color="#84a096" /><span>{t}</span></div>{/each}
      </div>
    {/if}

    {#if d.archival.length}
      <div class="sec">
        <div class="sech">Архивные заметки</div>
        {#each d.archival as a}
          <div class="acard">
            <div class="atag"><span class="pn"><Landmark size={11} strokeWidth={2} />Память народа</span>{#if a.date}<span class="adate">{a.date}</span>{/if}</div>
            <div class="abody">{a.body}</div>
          </div>
        {/each}
      </div>
    {/if}

    {#if d.documents.length}
      <div class="sec">
        <div class="sech">Документы</div>
        <div class="docgrid">
          {#each d.documents as doc}
            {#if docLoaded[doc.file]}
              <button class="doctile" onclick={() => (lightbox = { src: doc.file, caption: doc.title })} title={doc.title}>
                <img src={doc.file} alt={doc.title} loading="lazy" />
                <span class="doccap">{doc.title}</span>
              </button>
            {:else}
              <div class="doctile pending" title="{doc.title} — скан ещё не прикреплён">
                <div class="docph"><FileText size={22} strokeWidth={1.6} /></div>
                <span class="doccap">{doc.title}</span>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {/if}

    {#if d.sources.length}
      <div class="sec">
        <div class="sech">Источники</div>
        {#each d.sources as s}
          <div class="srow sourcecard">
            <span class="sx"><FileText size={13} strokeWidth={2} /></span>
            <div class="sbody">
              {#if s.url}<a class="stitle" href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>{:else}<span class="stitle">{s.title}</span>{/if}
              {#if s.detail}<span class="sdetail">{s.detail}</span>{/if}
              {#if s.repository}<span class="srepo">{s.repository}</span>{/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}

    {#each d.groups as g}
      <div class="sec">
        <div class="sech">{g.title}</div>
        <div class="chips">
          {#each g.items as r}<button class="chip" onclick={() => ongoto(r.id)}>{r.name}</button>{/each}
        </div>
      </div>
    {/each}
    <div style="height:20px"></div>
  </div>

  {#if lightbox}
    <div class="lightbox" role="dialog" aria-modal="true" aria-label={lightbox.caption}>
      <button class="lightboxhit" onclick={() => (lightbox = null)} aria-label="Закрыть"></button>
      <figure>
        <img src={lightbox.src} alt={lightbox.caption} />
        <figcaption>{lightbox.caption}</figcaption>
      </figure>
      <button class="lclose" onclick={() => (lightbox = null)} aria-label="Закрыть"><X size={22} strokeWidth={2} /></button>
    </div>
  {/if}
{/if}

<style>
  .backdrop { position: absolute; inset: 0; padding: 0; border: none; background: rgba(45,38,30,0.26); backdrop-filter: blur(2px); z-index: 55; animation: bin 0.3s ease both; cursor: pointer; }
  .drawer { position: absolute; top: 0; right: 0; height: 100%; width: 442px; max-width: 94vw; box-sizing: border-box; background: #fffdf9; border-left: 1px solid #ece5da; box-shadow: -20px 0 50px rgba(60,48,34,0.14); padding: 26px; overflow-y: auto; overflow-x: hidden; z-index: 60; animation: din 0.42s cubic-bezier(0.2,0.7,0.2,1) both; font-family: Manrope, sans-serif; }
  .drawer.mobile { top: auto; bottom: 0; right: 0; left: 0; width: 100%; max-width: none; height: 86%; border-left: none; border-top: 1px solid #ece5da; border-radius: 24px 24px 0 0; box-shadow: 0 -16px 50px rgba(60,48,34,0.2); padding: 8px 18px 20px; animation: sin 0.42s cubic-bezier(0.2,0.7,0.2,1) both; }
  .grab { display: flex; justify-content: center; width: 100%; padding: 4px 0 12px; cursor: pointer; border: none; background: transparent; }
  .grab span { width: 42px; height: 5px; border-radius: 3px; background: #ddd3c4; }
  .close { position: absolute; right: 18px; top: 18px; width: 34px; height: 34px; border-radius: 50%; border: 1px solid #ece5da; background: #fff; font-size: 17px; color: #8d8478; cursor: pointer; line-height: 1; }
  .close:hover { background: #f6f1e8; color: #5b5347; }
  .head { display: flex; gap: 16px; align-items: center; padding-right: 30px; }
  .ava { width: 64px; height: 64px; border-radius: 50%; flex: none; }
  .ava.mono { background: var(--soft); color: var(--accent); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 23px; }
  .avabtn { border: none; padding: 0; cursor: zoom-in; transition: transform 0.2s ease; }
  .avabtn:hover { transform: scale(1.05); }
  .docgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 9px; }
  .doctile { display: flex; flex-direction: column; gap: 5px; padding: 0; background: none; border: none; font-family: inherit; cursor: pointer; text-align: center; }
  .doctile.pending { cursor: default; }
  .doctile img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 10px; border: 1px solid #ece5da; box-shadow: 0 3px 10px rgba(70,55,40,0.1); transition: transform 0.2s ease; }
  .doctile:not(.pending):hover img { transform: translateY(-2px); box-shadow: 0 10px 22px rgba(70,55,40,0.18); }
  .docph { width: 100%; aspect-ratio: 1; border-radius: 10px; border: 1px dashed #d8cdba; background: #faf6ee; display: flex; align-items: center; justify-content: center; color: #bdae8e; }
  .doccap { font-size: 10px; line-height: 1.25; color: #8d8478; }
  .doctile.pending .doccap { color: #b3a995; }
  .lightbox { position: fixed; inset: 0; z-index: 80; display: flex; align-items: center; justify-content: center; background: rgba(28,23,18,0.82); backdrop-filter: blur(4px); animation: bin 0.25s ease both; padding: 24px; padding-top: max(24px, env(safe-area-inset-top)); padding-bottom: max(24px, env(safe-area-inset-bottom)); }
  .lightboxhit { position: absolute; inset: 0; border: none; background: transparent; cursor: zoom-out; }
  .lightbox figure { position: relative; z-index: 1; margin: 0; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .lightbox img { max-width: min(92vw, 540px); max-height: 76vh; border-radius: 14px; box-shadow: 0 24px 70px rgba(0,0,0,0.5); }
  .lightbox figcaption { font-family: Spectral, serif; font-size: 16px; color: #f4ece0; text-align: center; max-width: 92vw; }
  .lclose { position: absolute; top: max(16px, env(safe-area-inset-top)); right: 16px; width: 44px; height: 44px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.12); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .lclose:hover { background: rgba(255,255,255,0.22); }
  .rel { font-size: 9.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .name { font-family: Spectral, serif; font-size: 23px; font-weight: 600; color: #2f2a22; line-height: 1.1; margin-top: 2px; }
  .givn { font-size: 14px; color: #6a6358; }
  .pills { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
  .pill { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 5px 11px; font-size: 11.5px; font-weight: 600; }
  .pill.soft { background: var(--soft); color: var(--accent); }
  .pill.grey { background: #f3eee5; color: #6a6358; }
  .nums { font-variant-numeric: tabular-nums; }
  .cbadge { display: inline-flex; align-items: center; justify-content: center; width: 19px; height: 19px; border-radius: 7px; background: #fff; color: var(--conf); font-size: 10px; font-weight: 800; }
  .fact { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid #efe9df; }
  .flabel { font-size: 10px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: #a59a8c; min-width: 118px; padding-top: 2px; flex: none; }
  .fval { font-size: 13.5px; color: #3c362e; line-height: 1.45; }
  .note { font-size: 13.5px; color: #4a443b; line-height: 1.6; margin-top: 13px; }
  .box { margin-top: 14px; border-radius: 13px; padding: 12px 14px; }
  .todo { background: #f4f7f3; border: 1px solid #dfe9df; }
  .boxh { font-size: 9.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #a59a8c; margin-bottom: 5px; }
  .boxh.green { color: #7e9483; margin-bottom: 8px; }
  .boxh.ic { display: inline-flex; align-items: center; gap: 6px; }
  .todorow :global(svg) { flex: none; margin-top: 1px; }
  .close { display: flex; align-items: center; justify-content: center; }
  .todorow { display: flex; gap: 9px; align-items: flex-start; padding: 5px 0; font-size: 12.5px; color: #46514a; line-height: 1.55; }
  .todorow span:first-child { color: #84a096; }
  .sec { margin-top: 16px; }
  .sech { font-size: 9.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #a59a8c; margin-bottom: 8px; }
  .acard { background: #fbf8f2; border: 1px solid #efe7d8; border-radius: 13px; padding: 13px 15px; margin-bottom: 9px; }
  .atag { display: flex; align-items: center; gap: 8px; margin-bottom: 9px; }
  .pn { display: inline-flex; gap: 5px; font-size: 9px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent); background: var(--soft); border-radius: 6px; padding: 3px 8px; }
  .adate { font-size: 11px; color: #a59a8c; font-variant-numeric: tabular-nums; }
  .abody { font-size: 12.5px; color: #4a443b; line-height: 1.65; }
  .srow { display: flex; gap: 10px; align-items: flex-start; padding: 9px 0; border-bottom: 1px solid #f1ece3; }
  .sourcecard { border: 1px solid #efe9df; border-radius: 8px; padding: 10px 11px; margin-bottom: 7px; background: #fffbf5; }
  .sx { color: var(--accent); font-size: 13px; flex: none; }
  .sbody { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .srow a { color: var(--accent); text-underline-offset: 2px; }
  .stitle { font-size: 12.5px; font-weight: 700; color: #3f382f; line-height: 1.35; word-break: break-word; }
  .sdetail { font-size: 11.5px; color: #6a6358; line-height: 1.45; word-break: break-word; }
  .srepo { align-self: flex-start; margin-top: 2px; border-radius: 999px; background: var(--soft); color: var(--accent); padding: 2px 7px; font-size: 9.5px; font-weight: 700; }
  .chips { display: flex; flex-wrap: wrap; gap: 7px; }
  .chip { background: var(--soft); color: var(--accent); border: none; border-radius: 999px; padding: 7px 13px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .chip:hover { filter: brightness(0.96); transform: translateY(-1px); }
  @keyframes bin { from { opacity: 0; } to { opacity: 1; } }
  @keyframes din { from { transform: translateX(46px); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes sin { from { transform: translateY(60px); opacity: 0; } to { transform: none; opacity: 1; } }
</style>
