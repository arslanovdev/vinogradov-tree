import type { Tree, GEvent } from '../gedcom/types';
import { fmtDate, nameParts } from './derive';

export type PlaceKind = 'home' | 'home2' | 'origin' | 'war' | 'other';

export interface MapPlace {
  key: string;
  lat: number;
  lon: number;
  name: string;
  fullNames: string[];
  kind: PlaceKind;
  people: string[]; // ids
  events: PlaceEvent[];
  counts: Record<string, number>;
}

export interface PlaceEvent {
  personId: string;
  person: string;
  label: string;
  date: string | null;
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

function eventLabel(p: ReturnType<typeof indiEvents>[number], slot: number): string {
  if (slot === 0) return 'Рождение';
  if (slot === 1) return p.type || 'Смерть';
  if (slot === 2) return 'Захоронение';
  if (slot === 3) return 'Жительство';
  return p.type || 'Событие';
}

function placeText(p: MapPlace): string {
  return [p.name, ...p.fullNames].join(' ');
}

function families(p: MapPlace): string[] {
  const counts: Record<string, number> = {};
  for (const e of p.events) {
    const surname = e.person.split(/\s+/)[0]?.replace(/[(),.]/g, '');
    if (!surname || surname.length < 3 || /^[А-ЯЁ][а-яё]+вич/.test(surname)) continue;
    counts[surname] = (counts[surname] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name]) => name);
}

function familyLine(p: MapPlace): string {
  const names = families(p);
  return names.length ? `В дереве с этим местом связаны ${names.join(', ')}.` : '';
}

function knownPlaceIntro(p: MapPlace): string | null {
  const text = placeText(p);
  if (/Ф[её]доровк|Нижн[иі]е?\s+Балыкл/i.test(text)) {
    return 'Фёдоровка раньше называлась Нижние Балыклы. Это старое мордовское селение на реке Балыклы; в конце XVIII века сюда переселялись мордва-новокрещёные, в том числе люди из Алмантаево/Камышлы. Для нашей ветви это главный узел: здесь жили Камышловы, Ларины, Пашины, Бекины и Беловы, а линии из Камышлы и Кузьминовки сходятся уже в фёдоровском приходе.';
  }
  if (/Камышл|Алмантаев|Камышлыкулев/i.test(text)) {
    return 'Камышлы — это прежняя деревня Алмантаева, она же Камышлыкулева. Здесь виден ранний мордовский исток Камышловых: Иван Моисеев, его отец Павел Исеников и сын Андрей жили здесь до перехода семьи в Фёдоровку около 1795 года.';
  }
  if (/Молчанов/i.test(text)) {
    return 'Молчаново — раннее мокшанское место линии Антона Макеевича. Здесь жили Макей, Антон Макеевич и его сын Кузьма; отсюда семья Антона в 1815 году была переведена в Стерлитамакский уезд, в деревню Татлыбай Балыклы, позднее Кузьминовку.';
  }
  if (/Кузьминовк|Татлыбай|Балыклы/i.test(text)) {
    return 'Кузьминовка встречается в документах как Татлыбай Балыклы / Балаклы, Кузьминовка тож. Это мокшанское село переселенцев из Пензенской губернии: сюда по указу Оренбургской казённой палаты 1816 года пришли семьи сыновей Антона Макеевича из Молчанова. Здесь фамилия Антошкин закрепляется уже в ревизских сказках, а позднее через Кузьминовку эта ветвь соединяется с Лариными и фёдоровским кругом.';
  }
  if (/Никольск|Самар|Ставропольск/i.test(text)) {
    return 'Никольское — более глубокий след Камышловых до уфимской Фёдоровки. Это часть вероятного пути мордовских переселений Пенза/Самара → Уфа: от старых мест к Камышлы, а затем к Фёдоровке.';
  }
  if (/Талач|Мокшин/i.test(text)) {
    return 'Талачёво, оно же Талач-Мокшино, связано с материнской линией Рахматуллиных. Отсюда Закарьян Файзуллович переехал в Фёдоровку, поэтому место показывает не древний исток, а семейный переход уже в XX веке.';
  }
  if (/Ивановк/i.test(text)) {
    return 'Ивановка — фёдоровская Ивановка, важная для линии Сидоровых. В данных это место специально отделено от одноимённых Ивановок губернии: наша привязка идет к Фёдоровской волости и переписи 1917 года.';
  }
  if (/Кандалакш/i.test(text)) {
    return 'Кандалакша — северная точка линии Виноградовых. Отсюда пришлая для Фёдоровки ветвь Валентина Фёдоровича Виноградова; дальше корни, вероятно, надо искать в севернорусском направлении, возможно в Вологодской области.';
  }
  if (/Покровк/i.test(text)) {
    return 'Покровка — соседнее фёдоровское место в семейной памяти и документах. Для дерева это не отдельный древний исток, а локальная точка внутри того же сельского круга Фёдоровского района.';
  }
  if (/Верхнеяушев|Яушев/i.test(text)) {
    return 'Яушево/Верхнеяушево появляется в военных документах рядом с Фёдоровкой. Для Камышловых это, вероятно, административная или учетная путаница: основная родина ветви по метрикам и книгам памяти — Фёдоровка.';
  }
  if (/Городок/i.test(text)) {
    return 'Городок в Витебской области — место захоронения Егора Назаровича Белова из Фёдоровки. Он погиб 28 ноября 1943 года, когда 32-я Смоленская кавалерийская дивизия вела тяжелые бои на ближних подступах к Городку, еще до большой декабрьской Городокской операции. Точную точку гибели донесение не называет; надежно известно место первичного захоронения: в 2 км западнее г. Городок.';
  }
  if (/Сыч[её]в|Нетертовк|Смоленск/i.test(text)) {
    return 'Нетертовка в Сычёвском районе Смоленской области — место гибели Николая Романовича Камышлова. В Книге памяти и карточке «Памяти народа» он указан как телефонист, младший сержант, погибший 12 марта 1943 года и похороненный у деревни Нетертовка. В донесении ближайшим родственником названа жена Нина Андреевна, поэтому это место подтверждает его военную судьбу, но не само родство с Романом.';
  }
  if (/Беларус/i.test(text)) {
    return 'Беларусское направление в дереве относится к боям 1943 года. Для Егора Назаровича Белова это путь от фёдоровского призыва к 121-му кавалерийскому полку 32-й Смоленской кавдивизии и гибели на подступах к Городку.';
  }
  return null;
}

export function placeIntro(p: MapPlace): string {
  const known = knownPlaceIntro(p);
  if (known) return known;
  const names = Object.entries(p.counts).sort((a, b) => b[1] - a[1]).map(([k]) => k.toLowerCase());
  const core = names.slice(0, 3).join(', ');
  const tail = familyLine(p);
  if (p.kind === 'origin') return `${p.name} — ранний исток ветви: ${core || 'связанные события'}. ${tail}`.trim();
  if (p.kind === 'home' || p.kind === 'home2') return `${p.name} — семейное место: ${core || 'жизнь нескольких поколений'}. ${tail}`.trim();
  if (p.kind === 'war') return `${p.name} — место фронтовой судьбы: ${core || 'военное событие'}. ${tail}`.trim();
  return `${p.name} — ${core || 'связанное место'} в дереве. ${tail}`.trim();
}

/** Места с координатами (агрегируем по округлённым координатам), + кто с ними связан. */
export function mapPlaces(tree: Tree): MapPlace[] {
  const by: Record<string, MapPlace> = {};
  for (const id of Object.keys(tree.indi)) {
    const seen = new Set<string>();
    const personName = (() => { const np = nameParts(tree.indi[id]); return [np.main, np.sub].filter(Boolean).join(' '); })();
    for (const [slot, e] of indiEvents(tree, id).entries()) {
      if (e.lat == null || e.lon == null) continue;
      const key = e.lat.toFixed(3) + ',' + e.lon.toFixed(3);
      if (!by[key]) {
        by[key] = { key, lat: e.lat, lon: e.lon, name: shortPlace(e.plac || ''), fullNames: [], kind: kindOf(e.plac || ''), people: [], events: [], counts: {} };
      } else if ((e.plac || '').length && by[key].name.length < 3) {
        by[key].name = shortPlace(e.plac || '');
      }
      if (e.plac && !by[key].fullNames.includes(e.plac)) by[key].fullNames.push(e.plac);
      const label = eventLabel(e, slot);
      by[key].counts[label] = (by[key].counts[label] || 0) + 1;
      by[key].events.push({ personId: id, person: personName, label, date: fmtDate(e.date) });
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
