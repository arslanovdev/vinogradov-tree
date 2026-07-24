<script lang="ts">
  import { onMount } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import Supercluster from 'supercluster';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import type { Tree } from '../gedcom/types';
  import type { Layout } from '../model/layout';
  import {
    filterMapPlaces,
    mapPlaces,
    mapArrows,
    placeColor,
    placeIntro,
    type MapFilter,
    type MapPlace,
  } from '../model/places';
  import { nameParts } from '../model/derive';
  import { relationFor } from '../model/detail';
  import { X } from '@lucide/svelte';

  let { tree, layout, mobile = false, ongoto }:
    { tree: Tree; layout: Layout; mobile?: boolean; ongoto: (id: string) => void } = $props();

  let mapEl: HTMLDivElement;
  const places = $derived(mapPlaces(tree));
  let filter = $state<MapFilter>('all');
  const visiblePlaces = $derived(filterMapPlaces(places, filter));
  const filters = $derived([
    { id: 'all' as const, label: 'Все места', count: places.length },
    { id: 'family' as const, label: 'Семейный путь', count: filterMapPlaces(places, 'family').length },
    { id: 'war' as const, label: 'Военная история', count: filterMapPlaces(places, 'war').length },
  ]);
  const atlasCopy = $derived(
    filter === 'family'
      ? 'Родные места и переселения между поколениями.'
      : filter === 'war'
        ? 'Из Фёдоровки — к местам боёв, ранений и захоронений.'
        : 'География семьи — от мест происхождения до фронтовых судеб.',
  );
  let place = $state<string | null>(null);
  let refreshAtlas = $state<((nodes: MapPlace[]) => void) | null>(null);

  const placeNode = $derived(places.find((n) => n.key === place));
  const placeList = $derived.by(() => {
    if (!placeNode) return [];
    return placeNode.people.map((id) => ({
      id,
      name: (() => { const np = nameParts(tree.indi[id]); return [np.main, np.sub].filter(Boolean).join(' '); })(),
      rel: relationFor(tree, id, layout),
      events: placeNode.events.filter((e) => e.personId === id).map((e) => [e.label, e.date].filter(Boolean).join(' · ')).join('; '),
    }));
  });
  const placeStats = $derived.by(() => placeNode ? Object.entries(placeNode.counts).sort((a, b) => b[1] - a[1]) : []);

  function chooseFilter(next: MapFilter) {
    filter = next;
    place = null;
  }

  $effect(() => {
    const nodes = visiblePlaces;
    refreshAtlas?.(nodes);
  });

  onMount(() => {
    const carto = ['a', 'b', 'c'].map((h) => `https://${h}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png`);
    const map = new maplibregl.Map({
      container: mapEl,
      attributionControl: { compact: true },
      style: { version: 8, sources: { base: { type: 'raster', tiles: carto, tileSize: 256, attribution: '© OpenStreetMap · © CARTO' } }, layers: [{ id: 'base', type: 'raster', source: 'base', paint: { 'raster-saturation': -0.25, 'raster-opacity': 0.92 } }] },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-left');
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();

    let markers: maplibregl.Marker[] = [];
    let index: Supercluster<{ key: string; name: string; kind: string; color: string; ppl: number }, { ppl: number }> | null = null;

    const renderClusters = () => {
      if (!index) return;
      markers.forEach((m) => m.remove());
      markers = [];
      const b = map.getBounds();
      const bbox: [number, number, number, number] = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
      for (const c of index.getClusters(bbox, Math.round(map.getZoom()))) {
        const [lon, lat] = c.geometry.coordinates;
        const pr = c.properties as Record<string, unknown>;
        let el: HTMLElement;
        if (pr.cluster) {
          const n = pr.ppl as number;
          const r = 36 + Math.min(n, 30) * 1.3;
          const button = document.createElement('button');
          button.type = 'button';
          button.setAttribute('aria-label', `Раскрыть группу: ${n} человек`);
          const color = filter === 'war' ? 'rgba(164,85,63,.94)' : 'rgba(177,148,76,.94)';
          button.style.cssText = `display:flex;align-items:center;justify-content:center;width:${r}px;height:${r}px;padding:0;border-radius:50%;background:${color};border:3px solid #fffdf9;box-shadow:0 4px 14px rgba(60,48,34,.28);color:#fffdf9;font:800 ${n > 9 ? 15 : 17}px Manrope,sans-serif;cursor:pointer`;
          el = button;
          el.textContent = String(n);
          el.addEventListener('click', () => {
            const ez = index!.getClusterExpansionZoom(pr.cluster_id as number);
            map.easeTo({ center: [lon, lat], zoom: Math.min(ez, 12) });
          });
        } else {
          const n = pr.ppl as number;
          const r = 26 + Math.min(n, 20) * 2.2;
          const button = document.createElement('button');
          button.type = 'button';
          button.setAttribute('aria-label', `${pr.name}: ${n} человек`);
          button.style.cssText = 'display:flex;flex-direction:column;align-items:center;padding:0;border:0;background:transparent;cursor:pointer;font-family:Manrope,sans-serif';
          el = button;
          const dot = document.createElement('div');
          dot.style.cssText = `width:${r}px;height:${r}px;border-radius:50%;background:${pr.color};opacity:.94;border:3px solid #fffdf9;box-shadow:0 3px 10px rgba(60,48,34,.26);display:flex;align-items:center;justify-content:center;color:#fffdf9;font:800 ${n > 9 ? 12 : 14}px Manrope,sans-serif`;
          dot.textContent = String(n);
          const lbl = document.createElement('div');
          lbl.style.cssText = 'margin-top:4px;font:700 11px Spectral,serif;color:#322c24;background:rgba(255,253,249,.9);padding:2px 7px;border-radius:7px;white-space:nowrap;box-shadow:0 2px 7px rgba(60,48,34,.11)';
          lbl.textContent = pr.name as string;
          el.append(dot, lbl);
          el.addEventListener('click', () => (place = pr.key as string));
        }
        markers.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lon, lat]).addTo(map));
      }
    };

    const fit = (nodes: MapPlace[], duration = 450) => {
      if (!nodes.length) return;
      const bounds = new maplibregl.LngLatBounds();
      nodes.forEach((node) => bounds.extend([node.lon, node.lat]));
      try {
        map.fitBounds(bounds, {
          padding: { top: mobile ? 225 : 205, bottom: 90, left: mobile ? 34 : 70, right: mobile ? 34 : 90 },
          maxZoom: 7,
          duration,
        });
      } catch { /* карта ещё меняет размер */ }
    };

    const activeArrows = () => {
      const wanted = filter === 'family' ? 'mig' : filter === 'war' ? 'war' : null;
      return mapArrows(places)
        .filter((arrow) => !wanted || arrow.kind === wanted);
    };

    const arrowFeatures = () =>
      activeArrows().map((arrow) => ({
          type: 'Feature' as const,
          properties: { kind: arrow.kind },
          geometry: { type: 'LineString' as const, coordinates: [[arrow.from.lon, arrow.from.lat], [arrow.to.lon, arrow.to.lat]] },
        }));

    const rebuild = (nodes: MapPlace[], duration = 450) => {
      index = new Supercluster<{ key: string; name: string; kind: string; color: string; ppl: number }, { ppl: number }>({
        radius: 56,
        maxZoom: 11,
        map: (props) => ({ ppl: props.ppl }),
        reduce: (acc, props) => { acc.ppl += props.ppl; },
      });
      index.load(nodes.map((node) => ({
        type: 'Feature',
        properties: { key: node.key, name: node.name, kind: node.kind, color: placeColor(node.kind), ppl: node.people.length },
        geometry: { type: 'Point', coordinates: [node.lon, node.lat] },
      })));
      const source = map.getSource('arrows') as maplibregl.GeoJSONSource | undefined;
      source?.setData({ type: 'FeatureCollection', features: arrowFeatures() as never[] });
      renderClusters();
      const fitPlaces = filter === 'war'
        ? Array.from(new Map([...nodes, ...activeArrows().flatMap((arrow) => [arrow.from, arrow.to])].map((node) => [node.key, node])).values())
        : nodes;
      fit(fitPlaces, duration);
    };

    map.on('moveend', renderClusters);

    map.on('load', () => {
      map.addSource('arrows', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'mig', type: 'line', source: 'arrows', filter: ['==', ['get', 'kind'], 'mig'], layout: { 'line-cap': 'round' }, paint: { 'line-color': '#b0876a', 'line-width': 2.4, 'line-opacity': 0.75 } });
      map.addLayer({ id: 'war', type: 'line', source: 'arrows', filter: ['==', ['get', 'kind'], 'war'], paint: { 'line-color': '#a4553f', 'line-width': 1.8, 'line-opacity': 0.55, 'line-dasharray': [2, 2.5] } });
      map.resize();
      refreshAtlas = (nodes) => rebuild(nodes);
      rebuild(visiblePlaces, 0);
    });
    const resizeTimer = window.setTimeout(() => map.resize(), 120);
    return () => {
      window.clearTimeout(resizeTimer);
      refreshAtlas = null;
      map.remove();
    };
  });
</script>

<div class="map" bind:this={mapEl}></div>

<div class="atlas">
  <div class="eyebrow">Семейный атлас</div>
  <div class="h">Путь семьи</div>
  <div class="cap">{atlasCopy}</div>
  <div class="filters" role="group" aria-label="Слой семейной карты">
    {#each filters as option}
      <button
        class:active={filter === option.id}
        aria-pressed={filter === option.id}
        onclick={() => chooseFilter(option.id)}
      >
        <span>{option.label}</span><b>{option.count}</b>
      </button>
    {/each}
  </div>
  <div class="routelegend">
    {#if filter !== 'war'}<span><i class="family"></i>переселения</span>{/if}
    {#if filter !== 'family'}<span><i class="war"></i>военный путь из Фёдоровки</span>{/if}
  </div>
</div>

{#if place && placeNode}
  <div class="panel" class:mobile>
    <button class="close" onclick={() => (place = null)} aria-label="Закрыть"><X size={16} strokeWidth={2} /></button>
    <div class="pname">{placeNode.name}</div>
    <div class="psub">{placeList.length} чел.</div>
    <div class="pbio">{placeIntro(placeNode)}</div>
    {#if placeStats.length}
      <div class="pstats">
        {#each placeStats as [label, count]}
          <span>{label}: {count}</span>
        {/each}
      </div>
    {/if}
    {#each placeList as r}
      <button class="prow" onclick={() => ongoto(r.id)}>
        <span class="rmain"><span class="rn">{r.name}</span>{#if r.events}<span class="re">{r.events}</span>{/if}</span><span class="rr">{r.rel}</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .map { position: fixed; inset: 0; background: #efe8dd; z-index: 30; }
  .atlas { position: fixed; left: 26px; top: 22px; z-index: 31; width: min(370px, calc(100vw - 110px)); box-sizing: border-box; padding: 17px 18px 14px; border: 1px solid rgba(232,223,210,.88); border-radius: 18px; background: rgba(255,253,249,.9); box-shadow: 0 14px 38px rgba(67,53,38,.13); backdrop-filter: blur(14px); -webkit-font-smoothing: antialiased; }
  .eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: #a08f5f; }
  .h { font-family: Spectral, serif; font-size: 25px; font-weight: 600; color: #322c24; margin-top: 3px; line-height: 1.08; }
  .cap { max-width: 34ch; font-size: 12px; color: #756c60; margin-top: 6px; line-height: 1.45; text-wrap: pretty; }
  .filters { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 5px; margin-top: 13px; }
  .filters button { min-width: 0; min-height: 43px; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 2px; padding: 7px 8px; border: 1px solid transparent; border-radius: 10px; background: #f3eee5; color: #756c60; cursor: pointer; font-family: inherit; text-align: left; transition: background-color .18s ease, border-color .18s ease, color .18s ease, box-shadow .18s ease; }
  .filters button:hover { background: #eee6d9; color: #4d463d; }
  .filters button.active { border-color: #d9ccb5; background: #fffdf9; color: #4f4535; box-shadow: 0 3px 10px rgba(70,55,40,.08); }
  .filters span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 9.5px; font-weight: 700; }
  .filters b { font-size: 12px; line-height: 1; font-variant-numeric: tabular-nums; }
  .routelegend { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 11px; color: #8d8478; font-size: 10.5px; }
  .routelegend span { display: inline-flex; align-items: center; gap: 6px; }
  .routelegend i { width: 22px; height: 0; border-top: 2px solid #b0876a; }
  .routelegend i.war { border-top-color: #a4553f; border-top-style: dashed; }
  .panel { position: fixed; top: 0; right: 0; height: 100%; width: 360px; max-width: 92vw; box-sizing: border-box; background: #fffdf9; border-left: 1px solid #ece5da; box-shadow: -20px 0 50px rgba(60,48,34,0.14); padding: 24px; overflow-y: auto; overflow-x: hidden; z-index: 60; font-family: Manrope, sans-serif; animation: din 0.4s cubic-bezier(0.2,0.7,0.2,1) both; }
  .panel.mobile { top: auto; bottom: 0; left: 0; right: 0; width: 100%; max-width: none; height: 64%; border-left: none; border-top: 1px solid #ece5da; border-radius: 22px 22px 0 0; padding-bottom: max(24px, env(safe-area-inset-bottom)); }
  .close { position: absolute; right: 16px; top: 16px; width: 40px; height: 40px; border-radius: 50%; border: 1px solid #ece5da; background: #fff; color: #8d8478; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .close:hover { background: #f5efe6; color: #554c42; }
  .pname { font-family: Spectral, serif; font-size: 23px; font-weight: 600; color: #2f2a22; line-height: 1.15; padding-right: 38px; text-wrap: balance; }
  .psub { font-size: 12.5px; color: #8d8478; margin-bottom: 14px; }
  .pbio { font-size: 13px; line-height: 1.62; color: #4a443b; background: #fbf7ef; border: 1px solid #efe7d8; border-radius: 12px; padding: 12px 14px; margin: 12px 0; text-wrap: pretty; }
  .pstats { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; }
  .pstats span { border-radius: 999px; background: #f1eadb; color: #806f4a; padding: 4px 8px; font-size: 10.5px; font-weight: 700; }
  .prow { display: flex; width: 100%; text-align: left; gap: 10px; align-items: center; background: none; border: none; border-bottom: 1px solid #f1ece3; padding: 9px 2px; cursor: pointer; font-family: inherit; }
  .rmain { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .rn { font-size: 14px; color: #352f28; }
  .re { font-size: 11px; color: #8d8478; line-height: 1.35; }
  .rr { font-size: 11px; color: #a08f5f; }
  @media (max-width: 640px) {
    .atlas { left: 12px; top: 12px; width: calc(100vw - 80px); padding: 14px 14px 12px; border-radius: 16px; }
    .h { font-size: 22px; }
    .cap { font-size: 11.5px; }
    .filters { margin-top: 10px; }
    .filters button { min-height: 40px; padding: 6px; }
    .filters span { overflow: visible; white-space: normal; font-size: 9px; line-height: 1.15; }
    .routelegend { display: none; }
  }
  @keyframes din { from { transform: translateX(46px); opacity: 0; } to { transform: none; opacity: 1; } }
</style>
