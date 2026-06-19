import type { Tree, GEvent } from '../gedcom/types';

export type PlaceKind = 'home' | 'home2' | 'origin' | 'war' | 'other';

export interface MapPlace {
  key: string;
  lat: number;
  lon: number;
  name: string;
  kind: PlaceKind;
  people: string[]; // ids
}

export const placeColor = (k: PlaceKind) =>
  ({ home: '#b1944c', home2: '#84a096', origin: '#b0876a', war: '#a4553f', other: '#9a9183' }[k]);

function kindOf(s: string): PlaceKind {
  if (/Городок|Сыч[её]в|Нетертовка/i.test(s)) return 'war';
  if (/Никольское|Молчаново|Камышлы|Пенз/i.test(s)) return 'origin';
  if (/Бузат|Талач[её]во|Кузьминовка/i.test(s)) return 'home2';
  if (/Ф[её]доровка|Верхнеяушево|Ивановка|Покровка|Алёшкино/i.test(s)) return 'home';
  return 'other';
}

/** Короткое имя населённого пункта из строки PLAC (берём последнее «с./д./г. Название», иначе первый сегмент). */
export function shortPlace(s: string): string {
  const matches = [...s.matchAll(/\b(?:с|д|г|пос|дер|село|гор)\.?\s+([A-ЯЁ][А-Яа-яё-]+)/g)];
  if (matches.length) return matches[matches.length - 1][1];
  return s.split(',')[0].replace(/^(с|д|г|пос|дер|село|гор)\.?\s+/i, '').trim();
}

const indiEvents = (tree: Tree, id: string): GEvent[] => {
  const p = tree.indi[id];
  return [p.birt, p.deat, p.buri, p.resi].filter((e): e is GEvent => !!e);
};

/** Места с координатами (агрегируем по округлённым координатам), + кто с ними связан. */
export function mapPlaces(tree: Tree): MapPlace[] {
  const by: Record<string, MapPlace> = {};
  for (const id of Object.keys(tree.indi)) {
    const seen = new Set<string>();
    for (const e of indiEvents(tree, id)) {
      if (e.lat == null || e.lon == null) continue;
      const key = e.lat.toFixed(3) + ',' + e.lon.toFixed(3);
      if (!by[key]) {
        by[key] = { key, lat: e.lat, lon: e.lon, name: shortPlace(e.plac || ''), kind: kindOf(e.plac || ''), people: [] };
      } else if ((e.plac || '').length && by[key].name.length < 3) {
        by[key].name = shortPlace(e.plac || '');
      }
      if (!seen.has(key)) { seen.add(key); by[key].people.push(id); }
    }
  }
  return Object.values(by).sort((a, b) => b.people.length - a.people.length);
}

/** Места (по названию), у которых НИ В ОДНОЙ записи нет координат — их не видно на карте. */
export function placesMissingCoords(tree: Tree): { name: string; people: number }[] {
  const withCoord = new Set<string>();
  const without: Record<string, Set<string>> = {};
  for (const id of Object.keys(tree.indi)) {
    for (const e of indiEvents(tree, id)) {
      if (!e.plac) continue;
      const nm = shortPlace(e.plac);
      if (e.lat != null && e.lon != null) withCoord.add(nm);
      else (without[nm] = without[nm] || new Set()).add(id);
    }
  }
  return Object.entries(without)
    .filter(([nm]) => !withCoord.has(nm))
    .map(([name, ids]) => ({ name, people: ids.size }))
    .sort((a, b) => b.people - a.people);
}

/** Дуги-маршруты по ключевым словам — рисуем, только если обе точки есть в данных. */
const ARROW_DEFS: { from: RegExp; to: RegExp; kind: 'mig' | 'war' }[] = [
  { from: /Молчаново/i, to: /Камышлы/i, kind: 'mig' },
  { from: /Никольское/i, to: /Камышлы/i, kind: 'mig' },
  { from: /Камышлы/i, to: /Ф[её]доровка/i, kind: 'mig' },
  { from: /Кузьминовка/i, to: /Ф[её]доровка/i, kind: 'mig' },
  { from: /Ф[её]доровка/i, to: /Городок/i, kind: 'war' },
  { from: /Ф[её]доровка/i, to: /Сыч[её]в|Нетертовка/i, kind: 'war' },
];

export function mapArrows(places: MapPlace[]): { from: MapPlace; to: MapPlace; kind: 'mig' | 'war' }[] {
  const find = (re: RegExp) => places.find((p) => re.test(p.name));
  const out: { from: MapPlace; to: MapPlace; kind: 'mig' | 'war' }[] = [];
  for (const a of ARROW_DEFS) {
    const f = find(a.from), t = find(a.to);
    if (f && t && f.key !== t.key) out.push({ from: f, to: t, kind: a.kind });
  }
  return out;
}
