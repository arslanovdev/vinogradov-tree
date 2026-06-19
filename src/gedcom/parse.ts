import type { Tree, Indi, Fam, GEvent } from './types';

/** «N53.179910» / «E55.186229» / «-55.19» → десятичные градусы. */
function parseCoord(v: string): number | undefined {
  const m = v.trim().match(/([NSEW])?\s*(-?[\d.]+)/i);
  if (!m) return undefined;
  let n = parseFloat(m[2]);
  if (m[1] && /[SW]/i.test(m[1])) n = -n;
  return Number.isFinite(n) ? n : undefined;
}

/** Парсер GEDCOM 5.5.1 + наши кастомные теги (_CONF, _TODO) и OBJE/RELI/QUAY/MAP. */
export function parseGedcom(text: string): Tree {
  const indi: Record<string, Indi> = {};
  const fam: Record<string, Fam> = {};
  let cur: Indi | Fam | null = null;
  let curType: 'I' | 'F' | null = null;
  let sub: GEvent | null = null;

  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const parts = raw.split(' ');
    const level = +parts[0];
    let xref: string | null = null;
    let tag: string;
    let value: string | null;
    if (parts[1] && parts[1][0] === '@' && parts[1].slice(-1) === '@') {
      xref = parts[1];
      tag = parts[2];
      value = parts.slice(3).join(' ') || null;
    } else {
      tag = parts[1];
      value = parts.slice(2).join(' ') || null;
    }

    if (level === 0) {
      sub = null;
      if (tag === 'INDI' && xref) {
        cur = indi[xref] = { id: xref, notes: [], sources: [], todo: [], fams: [], famc: null, media: [], documents: [] };
        curType = 'I';
      } else if (tag === 'FAM' && xref) {
        cur = fam[xref] = { id: xref, chil: [], notes: [] };
        curType = 'F';
      } else {
        cur = null;
        curType = null;
      }
    } else if (level === 1 && cur) {
      sub = null;
      if (curType === 'I') {
        const p = cur as Indi;
        switch (tag) {
          case 'NAME': p.name = value ?? undefined; break;
          case 'SEX': p.sex = value ?? undefined; break;
          case 'OCCU': p.occu = value ?? undefined; break;
          case 'RELI': p.reli = value ?? undefined; break;
          case '_CONF': p.conf = value ?? undefined; break;
          case '_TODO': if (value) p.todo.push(value); break;
          case 'NOTE': if (value) p.notes.push(value); break;
          case 'SOUR': if (value) p.sources.push(value); break;
          case 'FAMC': p.famc = value; break;
          case 'FAMS': if (value) p.fams.push(value); break;
          case 'BIRT': p.birt = {}; sub = p.birt; break;
          case 'DEAT': p.deat = {}; sub = p.deat; break;
          case 'BURI': p.buri = {}; sub = p.buri; break;
          case 'RESI': p.resi = {}; sub = p.resi; break;
          case 'OBJE': { const o: GEvent = {}; p.media.push(o); sub = o; break; }
        }
      } else {
        const f = cur as Fam;
        if (tag === 'HUSB') f.husb = value ?? undefined;
        else if (tag === 'WIFE') f.wife = value ?? undefined;
        else if (tag === 'CHIL' && value) f.chil.push(value);
        else if (tag === 'NOTE' && value) f.notes.push(value);
      }
    } else if (level === 2) {
      if (sub) {
        if (tag === 'DATE') sub.date = value ?? undefined;
        else if (tag === 'PLAC') sub.plac = value ?? undefined;
        else if (tag === 'TYPE') sub.type = value ?? undefined;
        else if (tag === 'FILE') sub.file = value ?? undefined;
        else if (tag === 'TITL') sub.titl = value ?? undefined;
        else if (tag === 'FORM') sub.form = value ?? undefined;
      } else if (curType === 'I' && cur) {
        const p = cur as Indi;
        if (tag === 'SURN') p.surn = value ?? undefined;
        else if (tag === 'GIVN') p.givn = value ?? undefined;
        else if (tag === 'QUAY' && value != null) p.quay = +value;
      }
    } else if (level >= 3 && sub) {
      // координаты места: 3 MAP / 4 LATI N53.18 / 4 LONG E55.19
      if (tag === 'LATI' && value) sub.lat = parseCoord(value);
      else if (tag === 'LONG' && value) sub.lon = parseCoord(value);
    }
  }

  // отделяем портрет (аватар) от сканов документов по имени файла/подписи
  const isDocument = (m: GEvent) =>
    /(nagradnoy|kartoteka|donesenie|plena|nagrazhdenie)/i.test(m.file || '') ||
    /(наградн|донесен|карточк|картотек)/i.test(m.titl || '');
  for (const k of Object.keys(indi)) {
    const p = indi[k];
    const withFile = p.media.filter((m) => m.file);
    const portrait = withFile.find((m) => !isDocument(m));
    p.photo = portrait?.file;
    p.documents = withFile.filter((m) => isDocument(m));
  }

  return { indi, fam };
}

export interface Issue {
  level: 'error' | 'warn';
  msg: string;
}

/** Лёгкая валидация: висячие ссылки, отсутствие пробанда, фото без файла-ссылки. */
export function validate(tree: Tree): Issue[] {
  const issues: Issue[] = [];
  const { indi, fam } = tree;
  if (!indi['@I1@']) issues.push({ level: 'error', msg: 'нет отправной персоны @I1@' });
  for (const p of Object.values(indi)) {
    if (p.famc && !fam[p.famc]) issues.push({ level: 'warn', msg: `${p.id}: FAMC ${p.famc} не найдена` });
    for (const fs of p.fams) if (!fam[fs]) issues.push({ level: 'warn', msg: `${p.id}: FAMS ${fs} не найдена` });
  }
  for (const f of Object.values(fam)) {
    for (const c of f.chil) if (!indi[c]) issues.push({ level: 'warn', msg: `${f.id}: ребёнок ${c} не найден` });
    if (f.husb && !indi[f.husb]) issues.push({ level: 'warn', msg: `${f.id}: HUSB ${f.husb} не найден` });
    if (f.wife && !indi[f.wife]) issues.push({ level: 'warn', msg: `${f.id}: WIFE ${f.wife} не найдена` });
  }
  return issues;
}
