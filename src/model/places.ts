import type { Tree } from '../gedcom/types';

export type PlaceKind = 'home' | 'home2' | 'origin' | 'war' | 'other';

export interface PlaceNode { key: string; lat: number; lon: number; name: string; sub: string; kind: PlaceKind; }

export const PLACE_NODES: PlaceNode[] = [
  { key: 'gorodok', lat: 55.47, lon: 29.99, name: 'Городок', sub: 'Беларусь · фронт', kind: 'war' },
  { key: 'sychevka', lat: 55.83, lon: 34.28, name: 'Сычёвка', sub: 'Смоленщина · фронт', kind: 'war' },
  { key: 'nikolskoe', lat: 53.52, lon: 49.40, name: 'Никольское', sub: 'Самарское Заволжье · истоки рода', kind: 'origin' },
  { key: 'kamyshly', lat: 54.05, lon: 55.70, name: 'Камышлы', sub: 'Уфимский у. · отсюда фамилия', kind: 'origin' },
  { key: 'fedorovsky', lat: 53.13, lon: 55.33, name: 'Фёдоровский район', sub: 'родовое гнездо', kind: 'home' },
  { key: 'sterli', lat: 53.47, lon: 55.65, name: 'Бузат · Талачёво', sub: 'Стерлибашевский / Стерлитамакский', kind: 'home2' },
  { key: 'kandalaksha', lat: 67.15, lon: 32.41, name: 'Кандалакша', sub: 'Мурманская обл.', kind: 'other' },
];

export const PLACE_ARROWS: { from: string; to: string; kind: 'mig' | 'war' }[] = [
  { from: 'nikolskoe', to: 'kamyshly', kind: 'mig' },
  { from: 'kamyshly', to: 'fedorovsky', kind: 'mig' },
  { from: 'sterli', to: 'fedorovsky', kind: 'mig' },
  { from: 'fedorovsky', to: 'gorodok', kind: 'war' },
  { from: 'fedorovsky', to: 'sychevka', kind: 'war' },
];

export function nodeKey(s: string | undefined): string | null {
  if (!s) return null;
  if (/Верхнеяушево|Ф[её]доровка|Ивановка|Покровка/i.test(s)) return 'fedorovsky';
  if (/Бузат|Талач[её]во|Кузьминовка/i.test(s)) return 'sterli';
  if (/Камышлы/i.test(s)) return 'kamyshly';
  if (/Никольское/i.test(s)) return 'nikolskoe';
  if (/Городок/i.test(s)) return 'gorodok';
  if (/Сыч[её]в|Нетертовка/i.test(s)) return 'sychevka';
  if (/Кандалакша/i.test(s)) return 'kandalaksha';
  return null;
}

export const placeColor = (k: PlaceKind) =>
  ({ home: '#b1944c', home2: '#84a096', origin: '#b0876a', war: '#a4553f', other: '#9a9183' }[k]);

/** key → массив id людей, у кого место рождения/смерти/захоронения/жительства попадает в узел. */
export function peopleByPlace(tree: Tree): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  PLACE_NODES.forEach((n) => (out[n.key] = []));
  for (const id of Object.keys(tree.indi)) {
    const p = tree.indi[id];
    const seen = new Set<string>();
    (['birt', 'deat', 'buri', 'resi'] as const).forEach((f) => {
      const plac = p[f]?.plac;
      const k = plac ? nodeKey(plac) : null;
      if (k && !seen.has(k)) { seen.add(k); out[k].push(id); }
    });
  }
  return out;
}
