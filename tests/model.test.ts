import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseGedcom, validate } from '../src/gedcom/parse';
import { buildLayout } from '../src/model/layout';
import { relAnc, nameParts, confOf, linkifySource, fmtDate } from '../src/model/derive';
import { filterMapPlaces, mapArrows, mapPlaces, placesMissingCoords } from '../src/model/places';
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
  function sideSlots(layout: ReturnType<typeof buildLayout>, side: 'paternal' | 'maternal') {
    return Object.values(layout.nodeById)
      .filter((node) => layout.sideById[node.id] === side)
      .map((node) => node.slot);
  }

  it('builds a multi-generation pedigree', () => {
    const L = buildLayout(tree);
    expect(L.generations).toBeGreaterThanOrEqual(10);
    expect(Object.keys(L.nodeById).length).toBeGreaterThan(60);
    expect(L.sideById['@I1@']).toBe('self');
  });

  it('keeps added relatives inside their branch in the family GEDCOM', () => {
    const layout = buildLayout(tree);
    const paternal = sideSlots(layout, 'paternal');
    const maternal = sideSlots(layout, 'maternal');

    expect(layout.siblingIds.has('@I86@')).toBe(true);
    expect(layout.sideById['@I86@']).toBe('maternal');
    expect(Math.max(...paternal)).toBeLessThan(Math.min(...maternal));
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
  it('does not silently omit named places from the real family map', () => {
    expect(placesMissingCoords(tree)).toEqual([]);
  });
  it('filters the atlas into family and military stories', () => {
    const places = mapPlaces(tree);
    expect(filterMapPlaces(places, 'all')).toHaveLength(places.length);
    expect(filterMapPlaces(places, 'family').every((place) => place.kind !== 'war')).toBe(true);
    expect(filterMapPlaces(places, 'war').every((place) => place.kind === 'war')).toBe(true);
    expect(mapArrows(places).filter((arrow) => arrow.kind === 'war')).toHaveLength(2);
  });
});

describe('person details', () => {
  it('keeps one SOUR with semicolons as one source card', () => {
    const parsed = parseGedcom([
      '0 @I1@ INDI',
      '1 NAME Тестов Тест',
      '1 SOUR Первый фрагмент; второй фрагмент; третий фрагмент',
    ].join('\n'));

    const detail = buildDetail(parsed, '@I1@', buildLayout(parsed));

    expect(detail?.sources).toHaveLength(1);
    expect(detail?.sources[0].title).toBe('Первый фрагмент');
    expect(detail?.sources[0].detail).toBe('; второй фрагмент; третий фрагмент');
  });

  it('opens a bundled PDF from a local source citation', () => {
    const parsed = parseGedcom([
      '0 @S1@ SOUR',
      '1 TITL «Они вернулись с Победой», т. 11',
      '0 @I1@ INDI',
      '1 NAME Белов Егор Назарович',
      '1 SOUR @S1@',
      '2 PAGE с. 513; /sources/oni-vernulis-s-pobedoy-t11.pdf#page=513',
    ].join('\n'));

    const detail = buildDetail(parsed, '@I1@', buildLayout(parsed));

    expect(detail?.sources[0].url).toBe('/sources/oni-vernulis-s-pobedoy-t11.pdf#page=513');
    expect(detail?.sources[0].detail).toContain('с. 513');
    expect(detail?.sources[0].detail).not.toContain('/sources/');
  });

  it('uses the canonical SOUR title instead of renaming the source after its citation', () => {
    const parsed = parseGedcom([
      '0 @S1@ SOUR',
      '1 TITL «Подвиг народа» — электронный банк наградных документов (podvignaroda.ru)',
      '0 @I1@ INDI',
      '1 NAME Камышлов Николай Романович',
      '1 SOUR @S1@',
      '2 PAGE запись о награждении 36095128; наградной лист к приказу №13/н; https://podvignaroda.ru/?#id=36095128',
    ].join('\n'));

    const detail = buildDetail(parsed, '@I1@', buildLayout(parsed));

    expect(detail?.sources[0]).toMatchObject({
      title: '«Подвиг народа»',
      description: 'электронный банк наградных документов (podvignaroda.ru)',
      citations: ['запись о награждении 36095128; наградной лист к приказу №13/н;'],
      repository: 'Память народа / ЦАМО',
      url: 'https://podvignaroda.ru/?#id=36095128',
    });
  });

  it('merges repeated citations to the same document without inventing event labels', () => {
    const parsed = parseGedcom([
      '0 @S1@ SOUR',
      '1 TITL «Они вернулись с Победой. Списки военнослужащих, вернувшихся живыми с ВОВ 1941–1945 гг.», т. 11 (Уфа: Китап, 2004)',
      '0 @I1@ INDI',
      '1 NAME Белов Николай Егорович',
      '1 BIRT',
      '2 SOUR @S1@',
      '3 PAGE с. 513: «БЕЛОВ Николай Егорович, 1925 г. р.»; /sources/oni-vernulis-s-pobedoy-t11.pdf#page=513',
      '1 EVEN',
      '2 TYPE Уволен из Красной армии',
      '2 SOUR @S1@',
      '3 PAGE с. 513: рядовой, уволен в 1944 г.; /sources/oni-vernulis-s-pobedoy-t11.pdf#page=513',
    ].join('\n'));

    const detail = buildDetail(parsed, '@I1@', buildLayout(parsed));

    expect(detail?.sources).toHaveLength(1);
    expect(detail?.sources[0]).toMatchObject({
      title: 'Книга «Они вернулись с Победой»',
      citations: [
        'с. 513: «БЕЛОВ Николай Егорович, 1925 г. р.»;',
        'с. 513: рядовой, уволен в 1944 г.;',
      ],
      url: '/sources/oni-vernulis-s-pobedoy-t11.pdf#page=513',
    });
    expect(detail?.sources[0].citations.join(' ')).not.toMatch(/рождение|демобилизация/i);
  });

  it('resolves SOUR XREF records with TITL and PAGE under the record and under BIRT', () => {
    const parsed = parseGedcom([
      '0 @S1@ SOUR',
      '1 TITL Метрическая книга прихода с. Фёдоровка, 1916–1919 — НА РБ, ф. И-294, оп. 7, д. 1522',
      '0 @I1@ INDI',
      '1 NAME Камышлов Василий Романович',
      '1 BIRT',
      '2 DATE 6 JAN 1916',
      '2 SOUR @S1@',
      '3 PAGE запись №3 мужского пола: Василий, рожд. 06.01.1916',
      '1 SOUR @S1@',
      '2 PAGE фотография листа из личного архива',
    ].join('\n'));

    const sources = parsed.indi['@I1@'].sources;
    expect(sources).toHaveLength(2);
    expect(sources[0]).toContain('Метрическая книга прихода с. Фёдоровка, 1916–1919');
    expect(sources[0]).toContain('запись №3 мужского пола: Василий, рожд. 06.01.1916');
    expect(sources[1]).toContain('Метрическая книга прихода с. Фёдоровка, 1916–1919');
    expect(sources[1]).toContain('фотография листа из личного архива');
  });

  it('keeps unknown SOUR XREF as-is when the record is missing', () => {
    const parsed = parseGedcom([
      '0 @I1@ INDI',
      '1 NAME Тестов Тест',
      '1 SOUR @S999@',
    ].join('\n'));
    expect(parsed.indi['@I1@'].sources).toEqual(['@S999@']);
  });

  it('renders clean card titles for structured citation records', () => {
    const parsed = parseGedcom([
      '0 @S1@ SOUR',
      '1 TITL «Память народа» — электронный банк документов (pamyat-naroda.ru)',
      '0 @S2@ SOUR',
      '1 TITL Рабочая индексация «МК Федоровки 1845-1857.xlsx»',
      '0 @S3@ SOUR',
      '1 TITL Базилевское товарищество Крестьянского поземельного банка, 1903 — НА РБ, ф. И-336, оп. 1, д. 1218',
      '0 @I1@ INDI',
      '1 NAME Тестов Тест',
      '1 SOUR @S1@',
      '2 PAGE запись 66068316; https://pamyat-naroda.ru/heroes/x',
      '1 SOUR @S2@',
      '2 PAGE вкладка «Рождение», строка 1465',
      '1 SOUR @S3@',
      '2 PAGE список Базилевского товарищества, 1903',
    ].join('\n'));

    const detail = buildDetail(parsed, '@I1@', buildLayout(parsed));
    expect(detail?.sources.map((s) => s.title)).toEqual([
      '«Память народа»',
      'Рабочая индексация МК Фёдоровки',
      'Базилевское товарищество КПБ, 1903',
    ]);
  });

  it('keeps Bekin scans as documents without listing the Red Book as a source', () => {
    const egor = buildDetail(tree, '@I17@', buildLayout(tree));

    expect(egor?.sources.some((source) => /красн.*книг|бекин/i.test(`${source.title} ${source.detail ?? ''}`))).toBe(false);
    expect(egor?.documents.map((document) => document.file)).toEqual(expect.arrayContaining([
      'photos/bekin_late_arrivals_list_p263.jpg',
      'photos/bekin_belov_family_p268.jpg',
    ]));
  });

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
    expect(detail?.timeline).toEqual(expect.arrayContaining([
      {
        label: 'Бой на Миус-фронте',
        date: '17 июля 1943',
        place: 'с. Русское, Куйбышевский р-н, Ростовская обл.',
        kind: 'military',
      },
    ]));
    expect(detail?.timeline.some((event) => event.label === 'Пустое событие')).toBe(false);
  });

  it('orders Valentin Vinogradov’s documented moves around his marriage', () => {
    const valentin = buildDetail(tree, '@I4@', buildLayout(tree));

    expect(valentin?.timeline.map((event) => event.label)).toEqual([
      'Рождение',
      'Переезд в Салават',
      'Брак',
      'Переезд в Фёдоровку',
      'Смерть',
      'Захоронение',
    ]);
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
