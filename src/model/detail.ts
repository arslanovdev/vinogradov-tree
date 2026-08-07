import type { Tree, Indi, Side } from '../gedcom/types';
import type { Layout } from './layout';
import { relAnc, confOf, lifespan, fmtDate, nameParts, linkifySource, colorOf, softOf } from './derive';

export interface Chip { id: string; name: string; }
export interface Fact { label: string; value: string; }
export interface TimelineEntry {
  label: string;
  date: string | null;
  place: string | null;
  kind: 'life' | 'military';
}
export interface Archival { date: string | null; body: string; }
export interface SourceRef { title: string; detail: string | null; repository: string | null; url: string | null; }
export interface Group { title: string; items: Chip[]; }
export interface DocRef { file: string; title: string; }

export interface Detail {
  id: string;
  accent: string; soft: string;
  main: string; sub: string; mono: string; photo: string | null;
  relation: string; sideLabel: string;
  lifespan: string;
  conf: { letter: string; shade: string; label: string };
  methodology: string | null;
  notes: string[];
  archival: Archival[];
  sources: SourceRef[];
  todo: string[];
  facts: Fact[];
  timeline: TimelineEntry[];
  groups: Group[];
  documents: DocRef[];
}

function docLabel(file: string, titl?: string): string {
  if (titl) return titl;
  if (/nagradnoy|nagrazhdenie/i.test(file)) return 'Наградной лист';
  if (/kartoteka_plena|plena/i.test(file)) return 'Карточка военнопленного';
  if (/kartoteka/i.test(file)) return 'Учётная картотека';
  if (/donesenie/i.test(file)) return 'Донесение о потерях';
  return 'Документ';
}

function cleanupSourceText(text: string): string {
  return text
    .replace(/^Familio(?:\s*\([^)]*\))?\s*[—-]\s*/i, '')
    .replace(/^pamyat-naroda\.ru\s*[—-]\s*/i, '')
    .replace(/\s*https?:\/\/\S+\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sourceTitle(text: string): string {
  if (/наградн/i.test(text)) return 'Наградной лист';
  if (/донесен|потер/i.test(text)) return 'Донесение о потерях';
  if (/военноплен|плен/i.test(text)) return 'Карточка военнопленного';
  if (/перепис[ьи]\s*1917|подворн/i.test(text)) return 'Подворная карточка переписи 1917';
  if (/РС\s*1816\s*\/\s*1820|ревиз/i.test(text) && /1816/.test(text) && /1820/.test(text)) return 'Ревизская сказка 1816/1820';
  if (/РС\s*1850\s*\/\s*1856|ревиз/i.test(text) && /1850/.test(text) && /1856/.test(text)) return 'Ревизская сказка 1850/1856';
  if (/РС\s*1850|ревиз/i.test(text) && /1850/.test(text)) return 'Ревизская сказка 1850';
  if (/РС\s*1834|ревиз/i.test(text) && /1834/.test(text)) return 'Ревизская сказка 1834';
  if (/РС\s*1811|ревиз/i.test(text) && /1811/.test(text)) return 'Ревизская сказка 1811';
  if (/метрик|метрич/i.test(text)) return 'Метрическая книга';
  if (/Они вернулись с Победой/i.test(text)) return 'Книга «Они вернулись с Победой»';
  if (/Герои тыла/i.test(text)) return 'Книга «Герои тыла»';
  if (/Книга памяти/i.test(text)) return 'Книга памяти';
  const tree = text.match(/Familio\s*\((древо[^)]*)\)/i);
  if (tree) return tree[1][0].toUpperCase() + tree[1].slice(1);
  if (/Familio/i.test(text) && /familio\.org\/persons\//i.test(text)) return 'Профиль Familio';
  // Заголовки структурных SOUR-записей (TITL + PAGE), чтобы эвристика не резала
  // титул по точке внутри «pamyat-naroda.ru», «.xlsx» или архивного «ф. …».
  if (/РС\s*1795/i.test(text)) return 'Ревизская сказка 1795';
  if (/rsfedorovkamordva1795/i.test(text)) return 'Familio, каталог ревизий Фёдоровки';
  if (/Бекин.*«Красная книга»/i.test(text)) return '«Красная книга» А. М. Бекина';
  if (/Рабочая индексация «МК Федоровки/i.test(text)) return 'Рабочая индексация МК Фёдоровки';
  if (/Память народа/i.test(text)) return '«Память народа»';
  if (/ОБД\s*«Мемориал»/i.test(text)) return 'ОБД «Мемориал»';
  if (/«Подвиг народа»/i.test(text)) return '«Подвиг народа»';
  if (/Асфандияров/i.test(text)) return 'Асфандияров А. З.';
  if (/Кийков/i.test(text)) return 'Кийков А.';
  if (/Освобождение Беларуси/i.test(text)) return '«Освобождение Беларуси. 1943–1944»';
  if (/МБСУ «Ритуал»/i.test(text)) return 'МБСУ «Ритуал» г. Салавата';
  if (/Поселенный список переписи 1926/i.test(text)) return 'Поселенный список переписи 1926';
  if (/Базилевское товарищество Крестьянского поземельного банка/i.test(text)) return 'Базилевское товарищество КПБ, 1903';
  if (/Дела по крестьянскому землевладению Базилева/i.test(text)) return 'Землевладение Базилева (И-10-1-552)';
  if (/Книга учёта движения населения г\. Оренбурга/i.test(text)) return 'Книга учёта движения населения г. Оренбурга';
  if (/Соглашение жителей Алмантаева/i.test(text)) return 'Соглашение о переселении, 1812';
  if (/Причисление 52 душ/i.test(text)) return 'Причисление переселенцев, 1807';
  const first = cleanupSourceText(text).split(/[.;:]/)[0].trim();
  return first.length > 80 ? first.slice(0, 77) + '...' : first || 'Источник';
}

function sourceRepository(text: string): string | null {
  if (/pamyat-naroda|ЦАМО|person-hero|podvig-chelovek|donesenie|nagrazhdenie/i.test(text)) return 'Память народа / ЦАМО';
  if (/Familio/i.test(text)) return 'Familio';
  if (/НА РБ|ф\.[РИИ]-|фонд/i.test(text)) return 'НА РБ';
  if (/РГБ|viewer\.rsl/i.test(text)) return 'РГБ';
  if (/Яндекс|yandex/i.test(text)) return 'Яндекс Архив';
  return null;
}

function formatSource(text: string): SourceRef {
  const directUrl = text.match(/https?:\/\/\S+/)?.[0] ?? null;
  const linked = linkifySource(text);
  const url = directUrl || linked.url;
  const title = sourceTitle(text);
  let detail = cleanupSourceText(text);
  detail = detail.replace(title, '').replace(/^[\s:—-]+/, '').trim();
  const repository = /Familio/i.test(title) ? null : sourceRepository(text);
  return { title, detail: detail || null, repository, url };
}

export function relationFor(tree: Tree, id: string, layout: Layout): string {
  const p = tree.indi[id];
  if (layout.rel[id]) return relAnc(layout.rel[id].depth, p.sex, layout.rel[id].side);
  if (layout.siblingIds.has(id)) return p.sex === 'F' ? 'Сестра' : 'Брат';
  const pn = p.notes.filter((n) => !/^\s*\[/.test(n))[0];
  if (pn) { const t = pn.split('.')[0].trim(); if (t.length && t.length < 64) return t; }
  return p.sex === 'F' ? 'Родственница' : 'Родственник';
}

function displayName(p: Indi | undefined, rid: string): string {
  if (!p) return rid;
  const np = nameParts(p);
  return [np.main, np.sub].filter(Boolean).join(' ') || 'Неизвестно';
}

const MILITARY_EVENT = /бой|боев|служб|ранен|плен|мобилизац|переправ|фронт|убит|погиб/i;

function timelineYear(date?: string): number {
  const match = date?.match(/\b(\d{3,4})\b/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

export function buildDetail(tree: Tree, id: string, layout: Layout): Detail | null {
  const { indi, fam } = tree;
  const p = indi[id];
  if (!p) return null;
  const side: Side = layout.sideById[id] || 'self';
  const np = nameParts(p);
  const notes = p.notes;
  const methodology = notes.map((n) => { const m = n.match(/^\s*\[ТОЧНОСТЬ\s+[ABC]\]\s*(.*)$/); return m ? m[1] : null; }).find(Boolean) || null;
  // показываем все заметки, кроме служебных (достоверность/ПН/лиды/ретро-фамилия) — остальные теги ([СЕМЬЯ], [FAMILIO], [ДОРОГА ПАМЯТИ]…) видимы
  const SERVICE = /^\s*\[(?:ТОЧНОСТЬ|ПН|АРХИВ|ИСКАТЬ|ЛИДЫ|TODO|ФАМИЛИЯ)/i;
  const plain = notes.filter((n) => !SERVICE.test(n));
  const archival: Archival[] = notes.filter((n) => /^\s*\[ПН/.test(n)).map((n) => {
    const m = n.match(/^\s*\[ПН\s*([0-9.]+)?([^\]]*)\]\s*([\s\S]*)$/);
    return { date: (m && m[1]) || null, body: (m && m[3]) || n.replace(/^\s*\[[^\]]*\]\s*/, '') };
  });
  const todo = p.todo.slice();
  notes.forEach((n) => { const m = n.match(/^\s*\[(?:ИСКАТЬ|ЛИДЫ|TODO)\]\s*([\s\S]*)$/i); if (m && m[1].trim()) todo.push(m[1].trim()); });

  const sources: SourceRef[] = [];
  p.sources.forEach((s) => {
    const v = s.trim();
    if (v) sources.push(formatSource(v));
  });

  const facts: Fact[] = [];
  if (np.retroSurn) facts.push({ label: 'Фамилия', value: `«${np.retroSurn}» — ретроспективная, по селу; в эту эпоху фамилий ещё не было` });
  if (p.occu) facts.push({ label: 'Служба / занятие', value: p.occu });
  if (p.reli) facts.push({ label: 'Вероисповедание', value: p.reli });

  const timelineRows: Array<TimelineEntry & { rawDate?: string; order: number }> = [];
  const addTimeline = (label: string, date?: string, place?: string, forceMilitary = false) => {
    if (!date && !place) return;
    timelineRows.push({
      label,
      date: fmtDate(date),
      place: place || null,
      kind: forceMilitary || MILITARY_EVENT.test(label) ? 'military' : 'life',
      rawDate: date,
      order: timelineRows.length,
    });
  };
  if (p.birt) addTimeline('Рождение', p.birt.date, p.birt.plac);
  if (p.resi && (!p.birt || p.resi.plac !== p.birt.plac)) addTimeline('Место жительства', p.resi.date, p.resi.plac);
  for (const event of p.events) addTimeline(event.type || 'Событие', event.date, event.plac);
  if (p.deat) addTimeline(p.deat.type || 'Смерть', p.deat.date, p.deat.plac, MILITARY_EVENT.test(p.deat.type || ''));
  if (p.buri) addTimeline('Захоронение', p.buri.date, p.buri.plac);
  const timeline = timelineRows
    .sort((a, b) => timelineYear(a.rawDate) - timelineYear(b.rawDate) || a.order - b.order)
    .map(({ label, date, place, kind }) => ({ label, date, place, kind }));

  const chip = (rid: string): Chip => ({ id: rid, name: displayName(indi[rid], rid) });
  const fc = p.famc ? fam[p.famc] : null;
  const parents = fc ? [fc.husb, fc.wife].filter((x): x is string => !!x).map(chip) : [];
  const siblings = fc ? fc.chil.filter((c) => c !== id).map(chip) : [];
  const spouses: Chip[] = [], children: Chip[] = [];
  p.fams.forEach((fid) => {
    const f = fam[fid]; if (!f) return;
    [f.husb, f.wife].forEach((x) => { if (x && x !== id) spouses.push(chip(x)); });
    f.chil.forEach((c) => children.push(chip(c)));
  });
  const groups: Group[] = ([['Родители', parents], ['Супруг(а)', spouses], ['Дети', children], ['Братья и сёстры', siblings]] as [string, Chip[]][])
    .filter((g) => g[1].length).map((g) => ({ title: g[0], items: g[1] }));

  return {
    id,
    accent: colorOf(side), soft: softOf(side),
    main: np.main, sub: np.sub, mono: np.mono, photo: p.photo || null,
    relation: id === '@I1@' ? 'Это вы · точка отсчёта' : relationFor(tree, id, layout),
    sideLabel: side === 'paternal' ? 'Линия отца' : side === 'maternal' ? 'Линия матери' : 'Точка отсчёта',
    lifespan: lifespan(p),
    conf: confOf(p),
    methodology, notes: plain, archival, sources, todo, facts, timeline, groups,
    documents: p.documents.filter((m) => m.file).map((m) => ({ file: m.file!, title: docLabel(m.file!, m.titl) })),
  };
}
