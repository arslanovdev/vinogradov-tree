import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseGedcom, validate } from '../src/gedcom/parse';
import { buildLayout } from '../src/model/layout';
import { relAnc, nameParts, confOf, linkifySource, fmtDate } from '../src/model/derive';
import { mapPlaces, placesMissingCoords } from '../src/model/places';
import { buildDetail } from '../src/model/detail';

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
  it('reads multiple GEDCOM events with map coordinates', () => {
    const parsed = parseGedcom([
      '0 @T1@ INDI',
      '1 NAME Тестов Тест',
      '1 EVEN',
      '2 TYPE Боевой эпизод',
      '2 DATE 17 JUL 1943',
      '2 PLAC с. Русское, Ростовская обл.',
      '3 MAP',
      '4 LATI N47.743889',
      '4 LONG E38.941389',
      '1 EVEN',
      '2 TYPE Ранение',
      '2 DATE 23 FEB 1944',
    ].join('\n'));

    expect(parsed.indi['@T1@'].events).toEqual([
      {
        type: 'Боевой эпизод',
        date: '17 JUL 1943',
        plac: 'с. Русское, Ростовская обл.',
        lat: 47.743889,
        lon: 38.941389,
      },
      { type: 'Ранение', date: '23 FEB 1944' },
    ]);
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
  it('does not use parentheses in fallback avatars', () => {
    const np = nameParts({
      id: '@TEST@',
      givn: 'Учка (Учай / Учан)',
      surn: 'Сидоров',
      notes: [],
      sources: [],
      todo: [],
      fams: [],
      famc: null,
      events: [],
      media: [],
      documents: [],
    });
    expect(np.mono).toBe('СУ');
    expect(np.mono).not.toContain('(');
  });
  it('ignores parenthetical aliases in retro-name avatars', () => {
    const np = nameParts({
      id: '@TEST_RETRO@',
      givn: 'Учка (Учай / Учан)',
      surn: 'Сидоров',
      notes: ['[ФАМИЛИЯ РЕТРО]'],
      sources: [],
      todo: [],
      fams: [],
      famc: null,
      events: [],
      media: [],
      documents: [],
    });
    expect(np.mono).toBe('У');
  });
  it('reads structured confidence', () => {
    expect(confOf(tree.indi['@I1@']).letter).toBe('A');
  });
  it('linkifies pamyat-naroda ids', () => {
    expect(linkifySource('person-hero122489359').url).toContain('/heroes/person-hero122489359/');
    expect(linkifySource('ЦАМО').url).toBeNull();
  });
  it('formats GEDCOM between ranges compactly', () => {
    expect(fmtDate('BET 1789 AND 1794')).toBe('1789\u20131794');
    expect(fmtDate('BEF 1695')).toBe('до 1695');
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
  it('maps a located military event as a war place', () => {
    const parsed = parseGedcom([
      '0 @I1@ INDI',
      '1 NAME Камышлов Тимофей Романович',
      '1 EVEN',
      '2 TYPE Бой на Миус-фронте',
      '2 DATE 17 JUL 1943',
      '2 PLAC с. Русское, Куйбышевский р-н, Ростовская обл.',
      '3 MAP',
      '4 LATI N47.743889',
      '4 LONG E38.941389',
    ].join('\n'));
    const ruskoe = mapPlaces(parsed).find((p) => p.name === 'Русское');
    expect(ruskoe?.kind).toBe('war');
    expect(ruskoe?.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        personId: '@I1@',
        label: 'Бой на Миус-фронте',
        date: '17 июля 1943',
      }),
    ]));
  });
  it('reports an event place that has no coordinates', () => {
    const parsed = parseGedcom([
      '0 @I1@ INDI',
      '1 NAME Тестов Тест',
      '1 EVEN',
      '2 TYPE Ранение',
      '2 PLAC Неустановленный госпиталь',
    ].join('\n'));

    expect(placesMissingCoords(parsed)).toEqual([
      { name: 'Неустановленный госпиталь', people: 1 },
    ]);
  });
});

describe('person details', () => {
  it('shows meaningful GEDCOM events and omits empty ones', () => {
    const parsed = parseGedcom([
      '0 @I1@ INDI',
      '1 NAME Камышлов Тимофей Романович',
      '2 SURN Камышлов',
      '2 GIVN Тимофей Романович',
      '1 EVEN',
      '2 TYPE Бой на Миус-фронте',
      '2 DATE 17 JUL 1943',
      '2 PLAC с. Русское, Куйбышевский р-н, Ростовская обл.',
      '1 EVEN',
      '2 TYPE Пустое событие',
    ].join('\n'));

    const detail = buildDetail(parsed, '@I1@', buildLayout(parsed));
    expect(detail?.facts).toEqual(expect.arrayContaining([
      {
        label: 'Бой на Миус-фронте',
        value: '17 июля 1943  ·  с. Русское, Куйбышевский р-н, Ростовская обл.',
      },
    ]));
    expect(detail?.facts.some((fact) => fact.label === 'Пустое событие')).toBe(false);
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
