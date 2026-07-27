<script lang="ts">
  import { onMount } from 'svelte';
  import {
    ArrowLeft,
    ArrowRight,
    ChevronLeft,
    ChevronRight,
    Columns3,
    Fullscreen,
    Grid2X2,
    Keyboard,
    Maximize,
    Minus,
    Plus,
    RotateCw,
    RotateCcw,
    Search,
    X,
  } from '@lucide/svelte';
  import {
    buildScanPages,
    fitScanImage,
    filterScanPages,
    nextScanIndex,
    rotateScanView,
    restoreScanView,
    type ScanParity,
    type ScanPage,
    type ScanSize,
    type ScanView,
  } from '../model/scanGallery';

  let { onclose }: { onclose: () => void } = $props();

  const pages = buildScanPages(188);
  const storageKey = 'vinogradov-tree.scan-gallery.v1';
  let query = $state('');
  let parity = $state<ScanParity>('all');
  let currentNumber = $state(1);
  let pageInput = $state('1');
  let view = $state<ScanView>({ scale: 1, x: 0, y: 0, rotation: 0 });
  let thumbsOpen = $state(true);
  let dragging = $state(false);
  let showShortcuts = $state(false);
  let failedThumbs = $state(new Set<number>());
  let stage = $state<HTMLElement | null>(null);
  let imageLoaded = $state(false);
  let imageNatural = $state<ScanSize>({ width: 0, height: 0 });
  let stageSize = $state<ScanSize>({ width: 0, height: 0 });
  let dragOrigin = { pointerX: 0, pointerY: 0, x: 0, y: 0 };
  let viewByPage = new Map<number, ScanView>();

  const filtered = $derived(filterScanPages(pages, query, parity));
  const currentPage = $derived(pages.find((page) => page.number === currentNumber) ?? pages[0]);
  const filteredIndex = $derived(Math.max(0, filtered.findIndex((page) => page.number === currentNumber)));
  const zoomPercent = $derived(Math.round(view.scale * 100));
  const fit = $derived(
    imageNatural.width > 0 && stageSize.width > 0
      ? fitScanImage(imageNatural, stageSize, view.rotation, 52)
      : null,
  );

  $effect(() => {
    if (filtered.length && !filtered.some((page) => page.number === currentNumber)) {
      selectPage(filtered[0]);
    }
    pageInput = String(currentNumber);
  });

  function persist() {
    if (typeof sessionStorage === 'undefined') return;
    const storedViews = Object.fromEntries(viewByPage.entries());
    sessionStorage.setItem(storageKey, JSON.stringify({ query, parity, currentNumber, views: storedViews }));
  }

  function saveCurrentView() {
    if (!currentPage) return;
    viewByPage.set(currentPage.number, restoreScanView(view));
    persist();
  }

  function selectPage(page: ScanPage) {
    if (page.number === currentNumber) return;
    saveCurrentView();
    currentNumber = page.number;
    imageLoaded = false;
    imageNatural = { width: 0, height: 0 };
    view = restoreScanView(viewByPage.get(page.number));
    persist();
  }

  function movePage(step: number) {
    const index = nextScanIndex(filtered, filteredIndex, step);
    if (index >= 0) selectPage(filtered[index]);
  }

  function setZoom(scale: number) {
    view = { ...view, scale: Math.min(8, Math.max(1, scale)) };
    saveCurrentView();
  }

  function resetView() {
    view = { scale: 1, x: 0, y: 0, rotation: 0 };
    saveCurrentView();
  }

  function rotateView(degrees: 90 | -90) {
    view = rotateScanView(view, degrees);
    saveCurrentView();
  }

  function jumpToPage() {
    const number = Number(pageInput);
    const page = filtered.find((candidate) => candidate.number === number);
    if (page) selectPage(page);
    else pageInput = String(currentNumber);
  }

  function setParity(next: ScanParity) {
    parity = next;
    persist();
  }

  function clearQuery() {
    query = '';
    persist();
  }

  function measureStage() {
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    stageSize = { width: rect.width, height: rect.height };
  }

  function handleImageLoad(event: Event) {
    const loadedImage = event.currentTarget as HTMLImageElement;
    imageNatural = { width: loadedImage.naturalWidth, height: loadedImage.naturalHeight };
    imageLoaded = true;
    measureStage();
  }

  function startPan(event: PointerEvent) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, input, label')) return;
    dragging = true;
    dragOrigin = { pointerX: event.clientX, pointerY: event.clientY, x: view.x, y: view.y };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function pan(event: PointerEvent) {
    if (!dragging) return;
    view = {
      ...view,
      x: dragOrigin.x + event.clientX - dragOrigin.pointerX,
      y: dragOrigin.y + event.clientY - dragOrigin.pointerY,
    };
  }

  function endPan() {
    if (!dragging) return;
    dragging = false;
    saveCurrentView();
  }

  function zoomWithWheel(event: WheelEvent) {
    event.preventDefault();
    setZoom(view.scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12));
  }

  async function toggleFullscreen() {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.target instanceof HTMLInputElement) {
      if (event.key !== 'Escape') return;
    }
    if (event.key === 'ArrowLeft') { event.preventDefault(); movePage(-1); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); movePage(1); }
    else if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(view.scale * 1.25); }
    else if (event.key === '-') { event.preventDefault(); setZoom(view.scale / 1.25); }
    else if (event.key === '0' || event.key.toLowerCase() === 'r') { event.preventDefault(); resetView(); }
    else if (event.key === '1') { event.preventDefault(); setZoom(2); }
    else if (event.key === '[') { event.preventDefault(); rotateView(-90); }
    else if (event.key === ']') { event.preventDefault(); rotateView(90); }
    else if (event.key.toLowerCase() === 'f') { event.preventDefault(); void toggleFullscreen(); }
    else if (event.key === 'Escape') { event.preventDefault(); onclose(); }
  }

  function markThumbFailed(page: ScanPage) {
    failedThumbs = new Set(failedThumbs).add(page.number);
  }

  onMount(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as {
        query?: string;
        parity?: ScanParity;
        currentNumber?: number;
        views?: Record<string, ScanView>;
      } | null;
      if (saved) {
        query = saved.query ?? '';
        parity = saved.parity ?? 'all';
        currentNumber = pages.some((page) => page.number === saved.currentNumber) ? saved.currentNumber! : 1;
        viewByPage = new Map(Object.entries(saved.views ?? {}).map(([key, value]) => [Number(key), restoreScanView(value)]));
        view = restoreScanView(viewByPage.get(currentNumber));
      }
    } catch {
      sessionStorage.removeItem(storageKey);
    }
    measureStage();
    const resizeObserver = typeof ResizeObserver === 'undefined' || !stage
      ? null
      : new ResizeObserver(measureStage);
    resizeObserver?.observe(stage!);
    window.addEventListener('keydown', handleKeydown);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

<div class="gallery">
  <header class="topbar">
    <div class="brand">
      <button class="icon-btn" onclick={onclose} title="Вернуться к дереву" aria-label="Вернуться к дереву"><ArrowLeft size={19} /></button>
      <div>
        <div class="eyebrow">Временный просмотр архива</div>
        <h1>Сканы · r473op1d4496</h1>
      </div>
    </div>

    <div class="filter-row">
      <label class="search-box">
        <Search size={15} />
        <input value={query} oninput={(event) => { query = (event.currentTarget as HTMLInputElement).value; persist(); }} placeholder="Номер листа" aria-label="Фильтр по номеру листа" />
        {#if query}<button class="clear-search" onclick={clearQuery} title="Очистить фильтр" aria-label="Очистить фильтр"><X size={14} /></button>{/if}
      </label>
      <div class="segmented" aria-label="Фильтр страниц">
        <button class:active={parity === 'all'} onclick={() => setParity('all')}>Все</button>
        <button class:active={parity === 'even'} onclick={() => setParity('even')}>Чётные</button>
        <button class:active={parity === 'odd'} onclick={() => setParity('odd')}>Нечётные</button>
      </div>
      <span class="result-count">{filtered.length} из {pages.length}</span>
    </div>

    <div class="top-actions">
      <button class="icon-btn" class:active={showShortcuts} onclick={() => (showShortcuts = !showShortcuts)} title="Шорткаты" aria-label="Шорткаты"><Keyboard size={18} /></button>
      <button class="icon-btn" class:active={thumbsOpen} onclick={() => (thumbsOpen = !thumbsOpen)} title="Показать миниатюры" aria-label="Показать миниатюры"><Columns3 size={18} /></button>
      <button class="icon-btn" onclick={() => void toggleFullscreen()} title="Полный экран (F)" aria-label="Полный экран"><Fullscreen size={18} /></button>
    </div>
  </header>

  <main class="viewer">
    <div
      class="stage"
      bind:this={stage}
      class:dragging
      role="application"
      onpointerdown={startPan}
      onpointermove={pan}
      onpointerup={endPan}
      onpointercancel={endPan}
      onwheel={zoomWithWheel}
      aria-label="Поле просмотра скана"
    >
      <div class="stage-topline">
        <span class="page-pill">Лист <b>{currentPage.label}</b></span>
        <span class="stage-hint">{zoomPercent}% · тяните кадр мышью</span>
      </div>

      <img
        class="scan"
        src={import.meta.env.BASE_URL + currentPage.url}
        alt={`Скан ${currentPage.label}`}
        draggable="false"
        onload={handleImageLoad}
        style={`${fit ? `width:${fit.width}px;height:${fit.height}px;` : ''}transform: translate3d(${view.x}px, ${view.y}px, 0) rotate(${view.rotation}deg) scale(${view.scale});`}
      />

      <div class="side-nav">
        <button class="nav-btn" onclick={() => movePage(-1)} title="Предыдущий лист (←)" aria-label="Предыдущий лист"><ChevronLeft size={24} /></button>
        <button class="nav-btn" onclick={() => movePage(1)} title="Следующий лист (→)" aria-label="Следующий лист"><ChevronRight size={24} /></button>
      </div>

      <div class="zoom-controls">
        <button onclick={() => setZoom(view.scale / 1.25)} title="Уменьшить (−)" aria-label="Уменьшить"><Minus size={17} /></button>
        <button class="zoom-value" onclick={resetView} title="Сбросить вид (0)">{zoomPercent}%</button>
        <button onclick={() => setZoom(view.scale * 1.25)} title="Увеличить (+)" aria-label="Увеличить"><Plus size={17} /></button>
        <button onclick={resetView} title="Вписать кадр (0)" aria-label="Вписать кадр"><Maximize size={16} /></button>
        <span class="control-divider"></span>
        <button onclick={() => rotateView(-90)} title="Повернуть против часовой ([)" aria-label="Повернуть против часовой"><RotateCcw size={16} /></button>
        <span class="rotation-value" aria-label={`Поворот ${view.rotation} градусов`}>{view.rotation}°</span>
        <button onclick={() => rotateView(90)} title="Повернуть по часовой (])" aria-label="Повернуть по часовой"><RotateCw size={16} /></button>
      </div>

      {#if !imageLoaded}
        <div class="loading">загрузка листа…</div>
      {/if}
    </div>

    <div class="bottom-bar">
      <div class="transport">
        <button class="transport-btn" onclick={() => movePage(-1)} title="Предыдущий лист"><ArrowLeft size={17} /></button>
        <label class="page-jump">Лист <input bind:value={pageInput} onkeydown={(event) => event.key === 'Enter' && jumpToPage()} inputmode="numeric" aria-label="Перейти к листу" /> <span>/ {pages.length}</span></label>
        <button class="transport-btn" onclick={() => movePage(1)} title="Следующий лист"><ArrowRight size={17} /></button>
      </div>
      <div class="shortcut-line"><span>← →</span> листы <span>+</span><span>−</span> зум <span>[ ]</span> поворот <span>0</span> сброс <span>F</span> экран</div>
      <button class="reset-btn" onclick={resetView}><RotateCcw size={14} /> Сбросить кадр</button>
    </div>

    {#if thumbsOpen}
      <section class="thumbs" aria-label="Миниатюры сканов">
        {#each filtered as page (page.number)}
          <button class="thumb" class:selected={page.number === currentNumber} onclick={() => selectPage(page)} title={`Лист ${page.label}`} aria-label={`Лист ${page.label}`}>
            {#if failedThumbs.has(page.number)}
              <span class="thumb-placeholder">{page.label}</span>
            {:else}
              <img src={import.meta.env.BASE_URL + page.thumbUrl} alt="" loading="lazy" onerror={() => markThumbFailed(page)} />
            {/if}
            <span>{page.label}</span>
          </button>
        {:else}
          <div class="empty">Ничего не найдено. Очистите фильтр или введите другой номер.</div>
        {/each}
      </section>
    {/if}
  </main>

  {#if showShortcuts}
    <aside class="shortcut-popover">
      <button class="popover-close" onclick={() => (showShortcuts = false)} aria-label="Закрыть"><X size={15} /></button>
      <strong>Быстрый просмотр</strong>
      <div><kbd>←</kbd><kbd>→</kbd> листать выбранные</div>
      <div><kbd>+</kbd><kbd>−</kbd> менять зум</div>
      <div><kbd>[</kbd><kbd>]</kbd> повернуть лист</div>
      <div><kbd>0</kbd> вписать · <kbd>1</kbd> 200%</div>
      <div><kbd>F</kbd> полный экран · <kbd>Esc</kbd> выйти</div>
      <div class="popover-note">Зум и позиция кадра запоминаются отдельно для каждого листа.</div>
    </aside>
  {/if}
</div>

<style>
  :global(html, body) { margin: 0; height: 100%; overflow: hidden; background: #211f1c; }
  :global(body) { -webkit-font-smoothing: antialiased; }
  .gallery { position: fixed; inset: 0; display: flex; flex-direction: column; color: #eee9e0; background: #211f1c; font-family: Manrope, system-ui, sans-serif; }
  .topbar { min-height: 72px; display: flex; align-items: center; justify-content: space-between; gap: 22px; padding: 0 24px; background: rgba(34, 31, 27, 0.95); border-bottom: 1px solid rgba(255,255,255,0.08); z-index: 4; }
  .brand, .top-actions, .filter-row { display: flex; align-items: center; gap: 12px; }
  .brand { min-width: 250px; }
  .eyebrow { color: #b7a58d; font-size: 9px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
  h1 { margin: 3px 0 0; font: 600 17px/1.1 Spectral, Georgia, serif; color: #f4efe6; }
  button { font: inherit; }
  .icon-btn, .nav-btn, .transport-btn { display: inline-flex; align-items: center; justify-content: center; color: #cfc5b7; background: transparent; border: 1px solid transparent; cursor: pointer; transition: background-color .16s ease, color .16s ease, transform .16s ease; }
  .icon-btn { width: 40px; height: 40px; border-radius: 12px; }
  .icon-btn:hover, .icon-btn.active { color: #fff; background: rgba(255,255,255,.1); }
  .icon-btn:active, .nav-btn:active, .transport-btn:active { transform: scale(.96); }
  .search-box { display: flex; align-items: center; gap: 8px; min-width: 180px; height: 38px; padding: 0 11px; color: #a89d8e; background: #2d2925; border: 1px solid #494139; border-radius: 11px; }
  .search-box input { width: 110px; color: #f2ece2; background: transparent; border: 0; outline: 0; font-size: 12px; }
  .search-box input::placeholder { color: #958a7d; }
  .clear-search { display: flex; margin-left: auto; padding: 2px; color: #a89d8e; background: transparent; border: 0; cursor: pointer; }
  .segmented { display: flex; padding: 3px; background: #2d2925; border: 1px solid #494139; border-radius: 11px; }
  .segmented button { height: 30px; padding: 0 9px; color: #a89d8e; background: transparent; border: 0; border-radius: 8px; cursor: pointer; font-size: 11px; }
  .segmented button:hover { color: #f5f0e8; }
  .segmented button.active { color: #2c2925; background: #d9c2a3; }
  .result-count { color: #887d70; font-size: 11px; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .viewer { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .stage { position: relative; flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; touch-action: none; cursor: grab; background: radial-gradient(ellipse at 50% 44%, #4b443b 0%, #312d28 42%, #211f1c 100%); }
  .stage.dragging { cursor: grabbing; }
  .stage::before { position: absolute; inset: 24px; border: 1px solid rgba(255,255,255,.04); border-radius: 14px; content: ''; pointer-events: none; }
  .stage-topline { position: absolute; top: 18px; left: 22px; right: 22px; display: flex; align-items: center; justify-content: space-between; z-index: 2; pointer-events: none; }
  .page-pill { padding: 7px 10px; color: #bdb1a2; background: rgba(28,25,22,.78); border: 1px solid rgba(255,255,255,.1); border-radius: 9px; font-size: 11px; backdrop-filter: blur(8px); }
  .page-pill b { color: #f1e9dd; font-variant-numeric: tabular-nums; }
  .stage-hint { color: #a2988b; font-size: 10px; }
  .scan { max-width: min(74vw, 840px); max-height: calc(100% - 52px); object-fit: contain; user-select: none; transform-origin: center center; box-shadow: 0 16px 60px rgba(0,0,0,.45); outline: 1px solid rgba(255,255,255,.12); transition: transform .12s ease-out; }
  .stage.dragging .scan { transition: none; }
  .side-nav { position: absolute; inset: 0 18px; display: flex; align-items: center; justify-content: space-between; pointer-events: none; }
  .nav-btn { width: 42px; height: 42px; color: #d8cebf; background: rgba(28,25,22,.72); border-color: rgba(255,255,255,.1); border-radius: 50%; pointer-events: auto; backdrop-filter: blur(8px); }
  .nav-btn:hover { color: #fff; background: rgba(71,62,52,.92); }
  .zoom-controls { position: absolute; right: 24px; bottom: 22px; display: flex; align-items: center; gap: 2px; padding: 4px; color: #d5cbbd; background: rgba(28,25,22,.82); border: 1px solid rgba(255,255,255,.1); border-radius: 12px; backdrop-filter: blur(8px); }
  .zoom-controls button { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 30px; color: inherit; background: transparent; border: 0; border-radius: 8px; cursor: pointer; }
  .zoom-controls button:hover { background: rgba(255,255,255,.1); }
  .zoom-controls .zoom-value { width: 48px; color: #eee5d9; font-size: 10px; font-variant-numeric: tabular-nums; }
  .control-divider { width: 1px; height: 20px; margin: 0 3px; background: rgba(255,255,255,.14); }
  .rotation-value { display: inline-flex; align-items: center; justify-content: center; width: 30px; color: #eee5d9; font-size: 10px; font-variant-numeric: tabular-nums; }
  .loading { position: absolute; top: 50%; left: 50%; padding: 9px 12px; color: #c6bbad; background: rgba(28,25,22,.82); border-radius: 8px; transform: translate(-50%, -50%); font-size: 12px; }
  .bottom-bar { display: flex; align-items: center; justify-content: space-between; min-height: 52px; padding: 0 24px; background: #292520; border-top: 1px solid rgba(255,255,255,.08); }
  .transport { display: flex; align-items: center; gap: 8px; }
  .transport-btn { width: 30px; height: 30px; color: #cfc3b4; border-radius: 8px; }
  .transport-btn:hover { background: rgba(255,255,255,.08); }
  .page-jump { display: flex; align-items: center; gap: 5px; color: #a89c8c; font-size: 11px; }
  .page-jump input { width: 42px; padding: 5px 4px; color: #f3ece2; text-align: center; background: #3a332c; border: 1px solid #55493d; border-radius: 6px; outline: 0; font-size: 11px; font-variant-numeric: tabular-nums; }
  .page-jump span { color: #776d61; }
  .shortcut-line { color: #84796d; font-size: 10px; }
  .shortcut-line span { display: inline-flex; align-items: center; justify-content: center; min-width: 17px; margin: 0 3px; padding: 2px 3px; color: #d4c7b5; background: #3a332c; border-radius: 4px; font-size: 9px; }
  .reset-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 8px; color: #a89c8c; background: transparent; border: 0; cursor: pointer; font-size: 10px; }
  .reset-btn:hover { color: #eee5d9; }
  .thumbs { display: flex; gap: 8px; height: 104px; padding: 9px 24px 10px; overflow-x: auto; background: #211e1b; border-top: 1px solid rgba(255,255,255,.06); scrollbar-color: #5b5045 transparent; }
  .thumb { position: relative; flex: 0 0 61px; display: flex; flex-direction: column; gap: 4px; align-items: center; padding: 3px 3px 4px; color: #897d70; background: transparent; border: 1px solid transparent; border-radius: 8px; cursor: pointer; font-size: 9px; font-variant-numeric: tabular-nums; }
  .thumb:hover { color: #ddd3c6; background: rgba(255,255,255,.05); }
  .thumb.selected { color: #f1e7d8; background: rgba(217,194,163,.13); border-color: #c8aa84; }
  .thumb img, .thumb-placeholder { width: 52px; height: 72px; object-fit: cover; background: #39332d; outline: 1px solid rgba(255,255,255,.1); }
  .thumb-placeholder { display: flex; align-items: center; justify-content: center; color: #a89c8c; font-size: 9px; }
  .empty { align-self: center; color: #958a7d; font-size: 12px; }
  .shortcut-popover { position: absolute; top: 62px; right: 70px; z-index: 8; display: flex; flex-direction: column; gap: 8px; width: 210px; padding: 15px 17px; color: #b9ad9f; background: rgba(42,37,32,.97); border: 1px solid #574c41; border-radius: 13px; box-shadow: 0 12px 35px rgba(0,0,0,.35); font-size: 11px; }
  .shortcut-popover strong { color: #eee5d9; font-size: 12px; }
  .popover-close { position: absolute; top: 8px; right: 8px; display: flex; padding: 3px; color: #988d80; background: transparent; border: 0; cursor: pointer; }
  kbd { display: inline-flex; align-items: center; justify-content: center; min-width: 16px; height: 17px; margin-right: 3px; color: #ede3d6; background: #564a3e; border-radius: 4px; font: 9px/1 Manrope, system-ui, sans-serif; }
  .popover-note { margin-top: 3px; padding-top: 9px; color: #94887b; border-top: 1px solid rgba(255,255,255,.08); line-height: 1.45; }
  @media (max-width: 800px) {
    .topbar { flex-wrap: wrap; gap: 8px; padding: 10px 12px; }
    .brand { min-width: 0; flex: 1; }
    .filter-row { order: 3; width: 100%; overflow: auto; }
    .top-actions { gap: 2px; }
    .result-count { margin-left: auto; }
    .stage-hint { display: none; }
    .stage::before { inset: 12px; }
    .scan { max-width: 88vw; max-height: calc(100% - 35px); }
    .side-nav { inset: 0 8px; }
    .zoom-controls { right: 12px; bottom: 14px; }
    .bottom-bar { min-height: 48px; padding: 0 12px; }
    .shortcut-line, .reset-btn { display: none; }
    .thumbs { height: 94px; padding-left: 12px; padding-right: 12px; }
    .thumb img, .thumb-placeholder { height: 64px; }
    .shortcut-popover { top: 108px; right: 12px; }
  }
</style>
