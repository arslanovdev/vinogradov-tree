<script lang="ts">
  import { onMount } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import type { Tree } from '../gedcom/types';
  import type { Layout } from '../model/layout';
  import { mapPlaces, mapArrows, placeColor, placesMissingCoords } from '../model/places';
  import { nameParts } from '../model/derive';
  import { relationFor } from '../model/detail';
  import { X } from '@lucide/svelte';

  let { tree, layout, mobile = false, ongoto }:
    { tree: Tree; layout: Layout; mobile?: boolean; ongoto: (id: string) => void } = $props();

  let mapEl: HTMLDivElement;
  const places = mapPlaces(tree);
  const missing = placesMissingCoords(tree);
  let place = $state<string | null>(null);

  const placeNode = $derived(places.find((n) => n.key === place));
  const placeList = $derived.by(() => {
    if (!placeNode) return [];
    return placeNode.people.map((id) => ({
      id,
      name: (() => { const np = nameParts(tree.indi[id]); return [np.main, np.sub].filter(Boolean).join(' '); })(),
      rel: relationFor(tree, id, layout),
    }));
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

    const bounds = new maplibregl.LngLatBounds();
    for (const n of places) {
      bounds.extend([n.lon, n.lat]);
      const cnt = n.people.length;
      const r = 26 + Math.min(cnt, 20) * 2.2;
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer';
      const dot = document.createElement('div');
      dot.style.cssText = `width:${r}px;height:${r}px;border-radius:50%;background:${placeColor(n.kind)};opacity:.92;border:3px solid #fffdf9;box-shadow:0 3px 10px rgba(60,48,34,.3);display:flex;align-items:center;justify-content:center;color:#fffdf9;font:800 ${cnt > 9 ? 12 : 14}px Manrope,sans-serif`;
      dot.textContent = String(cnt);
      const lbl = document.createElement('div');
      lbl.style.cssText = 'margin-top:3px;font:700 11px Spectral,serif;color:#322c24;background:rgba(255,253,249,.82);padding:1px 6px;border-radius:6px;white-space:nowrap;box-shadow:0 1px 3px rgba(60,48,34,.12)';
      lbl.textContent = n.name + (n.kind === 'war' ? ' ✝' : '');
      wrap.append(dot, lbl);
      wrap.addEventListener('click', () => (place = n.key));
      new maplibregl.Marker({ element: wrap, anchor: 'center' }).setLngLat([n.lon, n.lat]).addTo(map);
    }
    const fit = () => { if (!places.length) return; try { map.fitBounds(bounds, { padding: { top: 150, bottom: 80, left: 70, right: 70 }, maxZoom: 7, duration: 0 }); } catch { /* */ } };
    fit();
    setTimeout(() => { map.resize(); fit(); }, 120);

    map.on('load', () => {
      map.resize(); fit();
      const feats = mapArrows(places).map((a) => ({
        type: 'Feature' as const, properties: { kind: a.kind },
        geometry: { type: 'LineString' as const, coordinates: [[a.from.lon, a.from.lat], [a.to.lon, a.to.lat]] },
      }));
      map.addSource('arrows', { type: 'geojson', data: { type: 'FeatureCollection', features: feats as never } });
      map.addLayer({ id: 'mig', type: 'line', source: 'arrows', filter: ['==', ['get', 'kind'], 'mig'], layout: { 'line-cap': 'round' }, paint: { 'line-color': '#b0876a', 'line-width': 2.4, 'line-opacity': 0.75 } });
      map.addLayer({ id: 'war', type: 'line', source: 'arrows', filter: ['==', ['get', 'kind'], 'war'], paint: { 'line-color': '#a4553f', 'line-width': 1.8, 'line-opacity': 0.55, 'line-dasharray': [2, 2.5] } });
    });
    return () => map.remove();
  });
</script>

<div class="map" bind:this={mapEl}></div>

<div class="title">
  <div class="eyebrow">Карта рода</div>
  <div class="h">Откуда мы</div>
  <div class="cap">{places.length} мест с координатами; размер — число людей. Линии — переселение рода, пунктир — фронтовые судьбы.</div>
  {#if missing.length}
    <div class="miss" title={missing.map((m) => `${m.name} (${m.people})`).join(', ')}>
      ⚠ {missing.length} мест без координат ({missing.reduce((s, m) => s + m.people, 0)} чел.) — не показаны
    </div>
  {/if}
</div>

{#if place && placeNode}
  <div class="panel" class:mobile>
    <button class="close" onclick={() => (place = null)} aria-label="Закрыть"><X size={16} strokeWidth={2} /></button>
    <div class="pname">{placeNode.name}</div>
    <div class="psub">{placeList.length} чел.</div>
    {#each placeList as r}
      <button class="prow" onclick={() => ongoto(r.id)}>
        <span class="rn">{r.name}</span><span class="rr">{r.rel}</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .map { position: absolute; inset: 0; background: #efe8dd; z-index: 30; }
  .title { position: absolute; left: 30px; top: 26px; pointer-events: none; z-index: 31; max-width: 340px; }
  .eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: #a08f5f; }
  .h { font-family: Spectral, serif; font-size: 24px; font-weight: 600; color: #322c24; margin-top: 4px; }
  .cap { font-size: 12px; color: #7d7468; margin-top: 6px; line-height: 1.5; background: rgba(255,253,249,0.7); border-radius: 8px; padding: 4px 8px; }
  .miss { font-size: 11.5px; color: #8a6d3b; margin-top: 6px; background: rgba(255,248,235,0.9); border: 1px solid #ecdcc0; border-radius: 8px; padding: 4px 8px; pointer-events: auto; }
  .panel { position: absolute; top: 0; right: 0; height: 100%; width: 360px; max-width: 92vw; background: #fffdf9; border-left: 1px solid #ece5da; box-shadow: -20px 0 50px rgba(60,48,34,0.14); padding: 24px; overflow-y: auto; z-index: 32; font-family: Manrope, sans-serif; animation: din 0.4s cubic-bezier(0.2,0.7,0.2,1) both; }
  .panel.mobile { top: auto; bottom: 0; left: 0; right: 0; width: 100%; height: 62%; border-left: none; border-top: 1px solid #ece5da; border-radius: 22px 22px 0 0; }
  .close { position: absolute; right: 16px; top: 16px; width: 32px; height: 32px; border-radius: 50%; border: 1px solid #ece5da; background: #fff; color: #8d8478; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .pname { font-family: Spectral, serif; font-size: 21px; font-weight: 600; color: #2f2a22; padding-right: 30px; }
  .psub { font-size: 12.5px; color: #8d8478; margin-bottom: 14px; }
  .prow { display: flex; width: 100%; text-align: left; gap: 10px; align-items: center; background: none; border: none; border-bottom: 1px solid #f1ece3; padding: 9px 2px; cursor: pointer; font-family: inherit; }
  .rn { font-size: 14px; color: #352f28; flex: 1; }
  .rr { font-size: 11px; color: #a08f5f; }
  @keyframes din { from { transform: translateX(46px); opacity: 0; } to { transform: none; opacity: 1; } }
</style>
