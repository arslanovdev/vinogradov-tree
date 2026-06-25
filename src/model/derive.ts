import type { Indi, Side } from '../gedcom/types';

export function plural(n: number, forms: [string, string, string]): string {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
  return forms[2];
}

export function roman(n: number): string {
  const map: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}

/** Подпись родства; глубже прапрапрадеда — компактно «Пра⁶-дед». */
export function relAnc(depth: number, sex: string | undefined, side: Side): string {
  const suf = side === 'paternal' ? ' по папе' : side === 'maternal' ? ' по маме' : '';
  if (depth === 1) return sex === 'F' ? 'Мама' : 'Папа';
  if (depth === 2) return (sex === 'F' ? 'Бабушка' : 'Дедушка') + suf;
  const c = depth - 2;
  const base = sex === 'F' ? 'бабушка' : 'дед';
  if (c <= 3) { const w = 'пра'.repeat(c) + base; return w.charAt(0).toUpperCase() + w.slice(1) + suf; }
  const sup = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const s = ('' + c).replace(/\d/g, (d) => sup.charAt(+d));
  return 'Пра' + s + '-' + base + suf;
}

const CONF_MAP: Record<string, { shade: string; label: string }> = {
  A: { shade: '#5b5347', label: 'Архивно подтверждено' },
  B: { shade: '#9a9082', label: 'Вероятно · частично' },
  C: { shade: '#bdb4a5', label: 'Мало данных · тупик' },
};

export function confOf(p: Indi): { letter: string; shade: string; label: string } {
  let letter: string | null = null;
  if (p.conf && /^[ABC]$/i.test(p.conf.trim())) letter = p.conf.trim().toUpperCase();
  else if (p.quay != null) letter = ({ 3: 'A', 2: 'B', 1: 'C', 0: 'C' } as Record<number, string>)[p.quay] || null;
  else {
    const m = p.notes.map((n) => n.match(/\[ТОЧНОСТЬ\s+([ABC])\]/)).find(Boolean);
    letter = m ? m[1] : null;
  }
  return {
    letter: letter || '?',
    shade: letter ? CONF_MAP[letter].shade : '#bdb4a5',
    label: letter ? CONF_MAP[letter].label : 'Без оценки',
  };
}

export function isMil(p: Indi): boolean {
  const occu = p.occu || '';
  const txt = p.notes.join(' ');
  return /сержант|рядов|красноарм|старшина|кавалер|телефонист|стрелков|дивизи|гвард/i.test(occu) ||
    /«За отвагу»|За боевые заслуги|Орден|подвиг|Пропал без вести|РВК|фронт|плен/i.test(txt) ||
    !!(p.deat && p.deat.type);
}

export function isRetroSurn(p: Indi): boolean {
  return p.notes.some((n) => /\[ФАМИЛИЯ\s+РЕТРО\]|дофамильн|проставлен[аоы]?\s+ретроспективн|ретроспективн[ао]\s+по\s+селу|фамилии\s+ещё\s+нет/i.test(n));
}

export interface NameParts { main: string; sub: string; mono: string; retroSurn: string; }

function initialsFromText(text: string, max = 2): string {
  const words = text
    .replace(/\([^)]*\)/g, ' ')
    .match(/\p{L}+/gu) || [];
  return (words.slice(0, max).map((w) => w[0]).join('') || '?').toUpperCase();
}

function personInitials(surn: string, givn: string, fallback: string): string {
  if (!surn) return initialsFromText(fallback);
  const mono = (initialsFromText(surn, 1) + initialsFromText(givn, 1)).replace(/\?/g, '');
  return mono || initialsFromText(fallback, 1);
}

export function nameParts(p: Indi): NameParts {
  const surn = p.surn || '', givn = p.givn || '';
  if (isRetroSurn(p)) {
    const main = givn || (p.name ? p.name.replace(/\//g, '').trim() : 'Неизвестно');
    return { main, sub: '', mono: initialsFromText(main), retroSurn: surn };
  }
  const m = surn || givn || 'Неизвестно';
  return { main: m, sub: surn ? givn : '', mono: personInitials(surn, givn, m), retroSurn: '' };
}

export function yr(d?: string): string | null {
  if (!d) return null;
  const m = ('' + d).match(/(\d{4})/);
  return m ? m[1] : null;
}

export function lifespan(p: Indi): string {
  const by = yr(p.birt?.date), dy = yr(p.deat?.date);
  const abt = !!(p.birt?.date && /^ABT/i.test(p.birt.date));
  if (by && dy) return (abt ? '≈' : '') + by + ' – ' + dy;
  if (by) return (abt ? '≈ ' : 'р. ') + by;
  if (dy) return '† ' + dy;
  if (p.deat?.type) return p.deat.type;
  return '—';
}

const MG: Record<string, string> = { JAN: 'января', FEB: 'февраля', MAR: 'марта', APR: 'апреля', MAY: 'мая', JUN: 'июня', JUL: 'июля', AUG: 'августа', SEP: 'сентября', OCT: 'октября', NOV: 'ноября', DEC: 'декабря' };
const MN: Record<string, string> = { JAN: 'январь', FEB: 'февраль', MAR: 'март', APR: 'апрель', MAY: 'май', JUN: 'июнь', JUL: 'июль', AUG: 'август', SEP: 'сентябрь', OCT: 'октябрь', NOV: 'ноябрь', DEC: 'декабрь' };

export function fmtDate(d?: string): string | null {
  if (!d) return null;
  let s = ('' + d).trim(), pre = '';
  const between = s.match(/^BET\s+(.+?)\s+AND\s+(.+)$/i);
  if (between) {
    const a = yr(between[1]) || between[1].trim();
    const b = yr(between[2]) || between[2].trim();
    return `${a}–${b}`;
  }
  if (/^ABT/i.test(s)) { pre = 'около '; s = s.replace(/^ABT\s*/i, ''); }
  else if (/^BEF/i.test(s)) { pre = 'до '; s = s.replace(/^BEF\s*/i, ''); }
  else if (/^AFT/i.test(s)) { pre = 'после '; s = s.replace(/^AFT\s*/i, ''); }
  const t = s.split(/\s+/);
  let out = s;
  if (t.length === 3) out = +t[0] + ' ' + (MG[t[1].toUpperCase()] || t[1]) + ' ' + t[2];
  else if (t.length === 2) out = (MN[t[0].toUpperCase()] || t[0]) + ' ' + t[1];
  return pre + out;
}

export function linkifySource(t: string): { text: string; url: string | null } {
  const m = t.match(/((?:person-hero|podvig-chelovek_nagrazhdenie|dopolnitelnoe_donesenie|nagrazhdenie)\d{5,})/);
  return { text: t, url: m ? 'https://pamyat-naroda.ru/heroes/' + m[1] + '/' : null };
}

export const ACCENT = {
  paternal: '#b0876a', paternalSoft: '#f0e8df',
  maternal: '#84a096', maternalSoft: '#e7efeb',
  self: '#b1944c', selfSoft: '#f1ead6',
  line: '#d3c8b7',
};
export const colorOf = (s: Side) => s === 'paternal' ? ACCENT.paternal : s === 'maternal' ? ACCENT.maternal : ACCENT.self;
export const softOf = (s: Side) => s === 'paternal' ? ACCENT.paternalSoft : s === 'maternal' ? ACCENT.maternalSoft : ACCENT.selfSoft;
