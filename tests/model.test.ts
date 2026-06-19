import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseGedcom, validate } from '../src/gedcom/parse';
import { buildLayout } from '../src/model/layout';
import { relAnc, nameParts, confOf, linkifySource } from '../src/model/derive';
import { mapPlaces } from '../src/model/places';

const ged = readFileSync(fileURLToPath(new URL('../public/fedorovka_family.ged', import.meta.url)), 'utf-8');
const tree = parseGedcom(ged);

describe('parse', () => {
  it('reads all individuals and the proband', () => {
    expect(Object.keys(tree.indi).length).toBeGreaterThanOrEqual(80);
    expect(tree.indi['@I1@']).toBeTruthy();
    expect(tree.indi['@I1@'].photo).toBe('photos/nadezhda.jpg');
  });
  it('has no structural errors', () => {
    expect(validate(tree).filter((i) => i.level === 'error')).toHaveLength(0);
  });
});

describe('layout', () => {
  it('builds a multi-generation pedigree', () => {
    const L = buildLayout(tree);
    expect(L.generations).toBeGreaterThanOrEqual(10);
    expect(Object.keys(L.nodeById).length).toBeGreaterThan(60);
    expect(L.sideById['@I1@']).toBe('self');
  });
});

describe('derive', () => {
  it('compacts deep ancestor labels', () => {
    expect(relAnc(1, 'M', 'paternal')).toBe('Папа');
    expect(relAnc(5, 'M', 'paternal')).toBe('Прапрапрадед по папе');
    expect(relAnc(8, 'M', 'paternal')).toBe('Пра⁶-дед по папе');
  });
  it('hides retrospective surname', () => {
    const np = nameParts(tree.indi['@I70@']);
    expect(np.main).toBe('Иван Павлов');
    expect(np.retroSurn).toBe('Камышлов');
  });
  it('reads confidence from [ТОЧНОСТЬ]/RELI/QUAY', () => {
    expect(confOf(tree.indi['@I1@']).letter).toBe('A');
  });
  it('linkifies pamyat-naroda ids', () => {
    expect(linkifySource('person-hero122489359').url).toContain('/heroes/person-hero122489359/');
    expect(linkifySource('ЦАМО').url).toBeNull();
  });
});

describe('map coordinates', () => {
  it('parses MAP/LATI/LONG into events', () => {
    expect(tree.indi['@I1@'].birt?.lat).toBeCloseTo(53.179, 2);
    expect(tree.indi['@I1@'].birt?.lon).toBeCloseTo(55.186, 2);
  });
  it('builds map places from real coordinates', () => {
    const places = mapPlaces(tree);
    expect(places.length).toBeGreaterThan(3);
    expect(places.every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && p.people.length > 0)).toBe(true);
  });
});

describe('clustering', async () => {
  const Supercluster = (await import('supercluster')).default;
  const places = mapPlaces(tree);
  const build = () => {
    const idx = new Supercluster({ radius: 56, maxZoom: 11 });
    idx.load(places.map((n) => ({ type: 'Feature' as const, properties: { key: n.key }, geometry: { type: 'Point' as const, coordinates: [n.lon, n.lat] } })));
    return idx;
  };
  it('merges nearby places when zoomed out, splits when zoomed in', () => {
    const idx = build();
    const world: [number, number, number, number] = [-180, -85, 180, 85];
    const zoomedOut = idx.getClusters(world, 3);
    const zoomedIn = idx.getClusters(world, 14);
    // при отдалении бабблов меньше, чем мест (есть кластеры); при приближении — все по отдельности
    expect(zoomedOut.length).toBeLessThan(places.length);
    expect(zoomedOut.some((f) => (f.properties as { cluster?: boolean }).cluster)).toBe(true);
    expect(zoomedIn.length).toBe(places.length);
  });
});
