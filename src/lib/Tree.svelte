<script lang="ts">
  import type { Tree } from '../gedcom/types';
  import type { Layout } from '../model/layout';
  import { relAnc, nameParts, confOf, isMil, lifespan, colorOf, softOf, roman, ACCENT } from '../model/derive';
  import { Star, Cross } from '@lucide/svelte';

  let { tree, layout, selected = null, onselect }:
    { tree: Tree; layout: Layout; selected?: string | null; onselect: (id: string) => void } = $props();

  let view = $state({ x: 0, y: 0, s: 0.85 });
  let animate = $state(false);
  let drawn = $state(false);
  let vw = $state(typeof window !== 'undefined' ? window.innerWidth : 1200);
  let vh = $state(typeof window !== 'undefined' ? window.innerHeight : 800);
  let vp: HTMLDivElement;
  const mobile = $derived(vw <= 640);

  const cards = $derived.by(() =>
    Object.values(layout.nodeById).map((n) => {
      const p = tree.indi[n.id];
      const np = nameParts(p);
      const side = layout.sideById[n.id] || 'self';
      let relation = '';
      if (n.id === '@I1@') relation = 'Это вы';
      else if (layout.rel[n.id]) relation = relAnc(layout.rel[n.id].depth, p.sex, layout.rel[n.id].side);
      else if (n.isSibling) relation = p.sex === 'F' ? 'Сестра' : 'Брат';
      const c = confOf(p);
      return {
        id: n.id, x: n.x, y: n.y, accent: colorOf(side), soft: softOf(side),
        main: np.main, sub: np.sub, mono: np.mono, photo: p.photo || null, relation,
        lifespan: lifespan(p), conf: c.letter, confShade: c.shade,
        mil: isMil(p), deceased: !!(p.deat && (p.deat.date || p.deat.type)),
        gen: n.gen, delay: (n.gen * 0.08 + 0.15) + 's',
      };
    })
  );

  // полосы-колонки по поколениям
  const bands = $derived.by(() => {
    const out = [];
    const half = (layout.COL - layout.CW) / 2;
    for (let g = 0; g <= layout.maxGen; g++) out.push({ g, x: g * layout.COL + layout.PAD - half });
    return out;
  });
  // липкие подписи поколений (экранные координаты)
  const genLabels = $derived.by(() => {
    const headerW = mobile ? vw * 0.6 : 360;
    const out = [];
    for (let g = 0; g <= layout.maxGen; g++) {
      const gx = g * layout.COL + layout.PAD + layout.CW / 2;
      const sx = gx * view.s + view.x;
      if (sx < 30 || sx > vw - 14) continue;
      out.push({ g, sx, label: roman(g + 1), first: g === 0, dim: sx < headerW });
    }
    return out;
  });

  const photoLoaded = $state<Record<string, boolean>>({});
  function tryPhoto(src: string) {
    if (photoLoaded[src] !== undefined) return;
    photoLoaded[src] = false;
    const img = new Image();
    img.onload = () => (photoLoaded[src] = true);
    img.src = src;
  }
  $effect(() => { cards.forEach((c) => { if (c.photo) tryPhoto(c.photo); }); });

  // ---- pan / zoom ----
  const pointers = new Map<number, { x: number; y: number }>();
  let drag = false, moved = false;
  let st = { x: 0, y: 0, vx: 0, vy: 0 };
  let pinch: { dist: number; wx: number; wy: number; s: number } | null = null;

  function rect() { return vp.getBoundingClientRect(); }
  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const r = rect(), mx = e.clientX - r.left, my = e.clientY - r.top, old = view.s;
    const ns = Math.min(2.4, Math.max(0.22, old * (e.deltaY < 0 ? 1.1 : 0.9)));
    animate = false;
    view.x = mx - (mx - view.x) * (ns / old);
    view.y = my - (my - view.y) * (ns / old);
    view.s = ns;
  }
  function onDown(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) { drag = true; moved = false; st = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; }
    else if (pointers.size === 2) { drag = false; startPinch(); }
  }
  function onMove(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size >= 2) { moved = true; doPinch(); return; }
    if (!drag) return;
    const dx = e.clientX - st.x, dy = e.clientY - st.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    animate = false; view.x = st.vx + dx; view.y = st.vy + dy;
  }
  function onUp(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 1) { const p = [...pointers.values()][0]; drag = true; st = { x: p.x, y: p.y, vx: view.x, vy: view.y }; }
    if (pointers.size === 0) drag = false;
  }
  function two() { const a = [...pointers.values()]; return [a[0], a[1]]; }
  function startPinch() {
    const r = rect(), [a, b] = two();
    const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
    pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), wx: (mx - view.x) / view.s, wy: (my - view.y) / view.s, s: view.s };
  }
  function doPinch() {
    if (!pinch) { startPinch(); return; }
    const r = rect(), [a, b] = two();
    const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
    const ns = Math.min(2.4, Math.max(0.18, pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.dist));
    animate = false; view.s = ns; view.x = mx - pinch.wx * ns; view.y = my - pinch.wy * ns;
  }

  export function zoom(f: number) {
    const r = rect(), cx = r.width / 2, cy = r.height / 2, old = view.s;
    const ns = Math.min(2.4, Math.max(0.22, old * f));
    animate = true; view.x = cx - (cx - view.x) * (ns / old); view.y = cy - (cy - view.y) * (ns / old); view.s = ns;
  }
  export function fit() {
    const r = rect(), pad = mobile ? 0.95 : 0.9;
    const s = Math.min(r.width / layout.WW, r.height / layout.WH) * pad;
    animate = true; view.s = s; view.x = (r.width - layout.WW * s) / 2; view.y = (r.height - layout.WH * s) / 2;
  }
  export function focus(id: string, scale?: number, posX?: number) {
    const n = layout.nodeById[id]; if (!n || !vp) return;
    const r = rect(), s = scale || Math.max(view.s, 0.8);
    animate = true; view.s = s; view.x = r.width * (posX != null ? posX : 0.42) - n.x * s;
    view.y = r.height * 0.5 - (n.y + layout.CH / 2) * s;
  }
  export function findMe() { focus('@I1@', 0.95, mobile ? 0.5 : 0.18); }

  function cardClick(id: string) { if (moved) return; onselect(id); }

  $effect(() => {
    const onResize = () => { vw = window.innerWidth; vh = window.innerHeight; };
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    const t = setTimeout(() => {
      if (mobile) focus('@I1@', 0.72, 0.5); else focus('@I1@', 0.92, 0.18);
      drawn = true;
    }, 80);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  });
</script>

<!-- sticky generation ruler -->
<div class="ruler">
  {#each genLabels as l (l.g)}
    <div class="genlbl" style="left:{l.sx}px;opacity:{l.dim ? 0 : 0.92}">
      {l.label}{#if l.first}<span class="genword">&nbsp;ПОКОЛЕНИЕ</span>{/if}
    </div>
  {/each}
</div>

<div class="vp" bind:this={vp} onwheel={onWheel} onpointerdown={onDown} role="application" tabindex="-1">
  <div class="world" style="width:{layout.WW}px;height:{layout.WH}px;transform:translate({view.x}px,{view.y}px) scale({view.s});transition:{animate ? 'transform .5s cubic-bezier(.2,.7,.2,1)' : 'none'}">
    {#each bands as b (b.g)}
      <div class="band" class:alt={b.g % 2 === 1} style="left:{b.x}px;width:{layout.COL}px;height:{layout.WH}px"></div>
    {/each}
    <svg width={layout.WW} height={layout.WH} class="links">
      {#each layout.links as l, i (i)}
        <path d={l.d} style="stroke:{ACCENT.line};stroke-opacity:{l.sib ? 0.68 : 0.9};stroke-width:{l.sib ? 1.45 : 1.8};stroke-linecap:round;fill:none;stroke-dasharray:4000;stroke-dashoffset:{drawn ? 0 : 4000};transition:stroke-dashoffset 1.1s ease;transition-delay:{(l.gen * 0.09 + 0.5)}s" />
      {/each}
    </svg>
    {#each cards as c (c.id)}
      <div class="cardwrap" style="left:{c.x}px;top:{c.y}px;width:{layout.CW}px;--accent:{c.accent};--soft:{c.soft};--conf:{c.confShade};--delay:{c.delay}">
        <button class="card" class:sel={selected === c.id} onclick={() => cardClick(c.id)}>
          {#if c.photo && photoLoaded[c.photo]}
            <div class="ava" style="background:#f0ebe2 center/cover no-repeat url('{c.photo}');box-shadow:inset 0 0 0 2px var(--soft)"></div>
          {:else}
            <div class="ava mono">{c.mono}</div>
          {/if}
          <div class="body">
            <div class="rel">{c.relation}</div>
            <div class="name">{c.main}</div>
            <div class="givn">{c.sub}</div>
            <div class="meta">
              <span class="years">{c.lifespan}</span>
              <span class="conf">{c.conf}</span>
              {#if c.mil}<Star size={11} strokeWidth={2.2} color="var(--accent)" />{/if}
              {#if c.deceased}<Cross size={11} strokeWidth={2.2} color="#a59a8c" />{/if}
            </div>
          </div>
        </button>
      </div>
    {/each}
  </div>
</div>

<style>
  .vp { position: absolute; inset: 0; cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
  .vp * { user-select: none; -webkit-user-select: none; -webkit-user-drag: none; }
  .vp:active { cursor: grabbing; }
  .world { position: absolute; left: 0; top: 0; transform-origin: 0 0; will-change: transform; }
  .band { position: absolute; top: 0; pointer-events: none; border-right: 1px solid rgba(120,96,58,0.06); }
  .band.alt { background: rgba(120,96,58,0.035); }
  .links { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
  .ruler { position: absolute; top: 0; left: 0; right: 0; height: 0; pointer-events: none; z-index: 15; user-select: none; -webkit-user-select: none; }
  .genlbl { position: absolute; top: 13px; transform: translateX(-50%); font: 800 11px/1 Manrope, sans-serif; letter-spacing: 0.14em; color: #bfae8a; white-space: nowrap; transition: opacity 0.25s; user-select: none; -webkit-user-select: none; }
  .genword { font: 700 8px/1 Manrope, sans-serif; letter-spacing: 0.12em; color: #cabd9f; }
  .cardwrap { position: absolute; }
  .card { width: 100%; text-align: left; font-family: inherit; cursor: pointer; background: #fffdf9; border: 1px solid #ece5da; border-left: 5px solid var(--accent); border-radius: 18px; padding: 12px 14px; display: flex; gap: 11px; align-items: center; box-shadow: 0 6px 18px rgba(70,55,40,0.07); transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease; animation: cardIn 0.55s cubic-bezier(0.2,0.7,0.2,1) both; animation-delay: var(--delay); }
  .card:hover { transform: translateY(-4px); box-shadow: 0 16px 34px rgba(70,55,40,0.15); border-color: var(--accent); }
  .card.sel { box-shadow: 0 0 0 3px var(--accent); border-radius: 20px; }
  .ava { width: 44px; height: 44px; border-radius: 50%; flex: none; }
  .ava.mono { background: var(--soft); color: var(--accent); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; }
  .body { min-width: 0; flex: 1; }
  .rel { font-size: 9px; font-weight: 700; letter-spacing: 0.11em; text-transform: uppercase; color: var(--accent); margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .name { font-family: Spectral, serif; font-size: 15px; font-weight: 600; color: #352f28; line-height: 1.12; }
  .givn { font-size: 11.5px; color: #6a6358; line-height: 1.2; }
  .meta { display: flex; align-items: center; gap: 6px; margin-top: 5px; }
  .years { font-size: 11px; color: #8d8478; font-variant-numeric: tabular-nums; }
  .conf { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border-radius: 5px; background: #f0ebe2; color: var(--conf); font-size: 9px; font-weight: 800; flex: none; }
  .mil { font-size: 10px; color: var(--accent); }
  .dead { font-size: 10px; color: #a59a8c; }
  @keyframes cardIn { from { opacity: 0; transform: translateY(16px) scale(0.95); } to { opacity: 1; transform: none; } }
</style>
