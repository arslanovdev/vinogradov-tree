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

interface IndiEvent {
  event: GEvent;
  label: string;
  kind?: PlaceKind;
}

const WAR_EVENT = /бой|боев|служб|ранен|плен|освобожд.*плен|мобилизац|переправ/i;

const indiEvents = (tree: Tree, id: string): IndiEvent[] => {
  const p = tree.indi[id];
  const events: IndiEvent[] = [];
  if (p.birt) events.push({ event: p.birt, label: 'Рождение' });
  if (p.deat) events.push({ event: p.deat, label: p.deat.type || 'Смерть' });
  if (p.buri) events.push({ event: p.buri, label: 'Захоронение' });
  if (p.resi) events.push({ event: p.resi, label: 'Жительство' });
  for (const event of p.events) {
    events.push({
      event,
      label: event.type || 'Событие',
      kind: WAR_EVENT.test(event.type || '') ? 'war' : undefined,
    });
  }
  return events;
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
    return 'Фёдоровка, в документах также Нижняя Балыкла, — главный семейный узел этого древа. Село складывалось из нескольких переселенческих потоков: из Армиёва, Стерли и Мукатаева, через Изяк-Никитино, а в 1812 году — из Алмантаева, Камышлы тож. Соглашение 1812 года перечисляет переселенцев поимённо; среди мордвы назван Андрей Иванов, будущий родоначальник фёдоровских Камышловых по наиболее сильной документальной версии. Здесь сошлись Камышловы, Ларины, Пашины, Бекины и Беловы.';
  }
  if (/Камышл|Алмантаев|Камышлыкулев/i.test(text)) {
    return 'Камышлы — прежнее Алмантаево, встречающееся также как Камышлыкулево, — уфимский исток Камышловых. Поселенцы получили эту землю от башкир Минской волости в 1779 году на шестьдесят лет. В ревизии 1795 года здесь жил шестнадцатилетний Андрей, сын Ивана Моисеева. В январе 1812 года жители Камышлы заключили соглашение перед уходом на земли Стерлитамакского уезда; среди переселенцев назван Андрей Иванов, а одним из пунктов назначения стала Фёдоровка, Нижняя Балыкла тож.';
  }
  if (/Молчанов/i.test(text)) {
    return 'Молчаново, оно же Тумалей Молчаново тож в старых описаниях, — мокшанский пензенский исток Антошкиных. Здесь жили Макей (Макейка Учкин), Антон Макеевич и его сыновья Иван, Кузьма и Илья; РС 1811 фиксирует этот двор ещё до переселения. Место важно не только как точка рождения рода: рядом с Мокшей были корабельные леса, пристани и лашманная повинность, а около Каменного Брода существовала пристань, куда вывозили дубняк для флота. Из этого мира казённых повинностей семьи сыновей Антона в 1816 году переходят в оренбургскую Кузьминовку.';
  }
  if (/Кузьминовк|Татлыбай|Балыклы/i.test(text)) {
    return 'Кузьминовка в ревизиях называется Татлыбай Балыклы / Балаклы, Кузьминовка тож. Это мокшанское село переселенцев из Пензенской губернии и главный оренбургский узел Антошкиных: в 1816 году сюда по указу Оренбургской казённой палаты пришли семьи Ивана, Кузьмы и Ильи, сыновей Антона Макеевича из Молчанова. Сам указ не найден, но контекст указывает на казённый перевод ясашных/государственных крестьян, связанных с рекрутской и лашманной повинностью, адмиралтейскими работами и заготовкой строевого леса. Здесь фамилия Антошкин закрепляется документально, здесь в ревизиях и метриках видны большие семьи Ивана, Кузьмы и Ильи, а позднее через Варвару Филипповну Антошкину эта ветвь соединяется с Лариными и фёдоровским кругом.';
  }
  if (/Никольск|Тояб|Таяб|Самар|Ставропольск/i.test(text)) {
    return 'Никольское, Тоябы тож — вероятный ранний исток Камышловых до Камышлы. Сейчас сильнее всего выглядит локализация как Новая Таяба в Челно-Вершинском районе Самарской области: у неё фиксируется позднее название Никольское, переселенческая связь с Большой/Старой Таябой и подселение мордвы в XVIII веке. Поэтому путь семьи читается как Тоябинский куст Среднего Поволжья → Камышлы → Фёдоровка.';
  }
  if (/Талач|Мокшин/i.test(text)) {
    return 'Талачёво, историческое Талач-Мокшино, — родное место материнской линии Рахматуллиных. В 1875 году селение составляло Талач-Мокшинское общество Верхне-Усинской волости, позднее вошло в Бегеняш-Абукановскую волость. Здесь вместе жили башкиры, тептяри, татары и мещеряки, а рождения жителей записывали в мусульманские метрические книги Стерлитамака. В 1914 году в Талаче насчитывалось 239 дворов; отсюда уже в XX веке Закарьян Файзуллович переехал в Фёдоровку.';
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
    for (const { event: e, label, kind } of indiEvents(tree, id)) {
      if (e.lat == null || e.lon == null) continue;
      const key = e.lat.toFixed(3) + ',' + e.lon.toFixed(3);
      if (!by[key]) {
        by[key] = { key, lat: e.lat, lon: e.lon, name: shortPlace(e.plac || ''), fullNames: [], kind: kind || kindOf(e.plac || ''), people: [], events: [], counts: {} };
      } else if ((e.plac || '').length && by[key].name.length < 3) {
        by[key].name = shortPlace(e.plac || '');
      }
      if (kind === 'war') by[key].kind = 'war';
      if (e.plac && !by[key].fullNames.includes(e.plac)) by[key].fullNames.push(e.plac);
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
    for (const { event: e } of indiEvents(tree, id)) {
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
  { from: /Молчаново/i, to: /Кузьминовка/i, kind: 'mig' },
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
