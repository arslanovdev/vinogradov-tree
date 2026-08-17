import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';
import { auditGedcom } from '../src/gedcom/audit';
import { parseGedcom } from '../src/gedcom/parse';

const publicDir = fileURLToPath(new URL('../public', import.meta.url));
const familyGedcom = readFileSync(join(publicDir, 'fedorovka_family.ged'), 'utf8');

function publicFiles(directory = publicDir): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    return entry.isDirectory()
      ? publicFiles(absolute)
      : [relative(publicDir, absolute).split(sep).join('/')];
  });
}

describe('GEDCOM audit', () => {
  it('reports broken cross-references and asymmetric family links', () => {
    const result = auditGedcom([
      '0 HEAD',
      '1 CHAR UTF-8',
      '0 @I1@ INDI',
      '1 NAME Иван /Иванов/',
      '2 SURN Иванов',
      '2 GIVN Иван',
      '1 SEX M',
      '1 _CONF A',
      '1 FAMC @F1@',
      '1 SOUR @S404@',
      '0 @I1@ INDI',
      '1 NAME Дубль /Иванов/',
      '2 SURN Иванов',
      '2 GIVN Дубль',
      '1 SEX M',
      '1 _CONF C',
      '0 @F1@ FAM',
      '1 HUSB @I2@',
      '0 TRLR',
    ].join('\n'));

    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'DUPLICATE_XREF',
      'DANGLING_SOURCE',
      'DANGLING_PERSON',
      'ASYMMETRIC_FAMC',
    ]));
  });

  it('reports malformed place maps and absent media', () => {
    const result = auditGedcom([
      '0 HEAD',
      '1 CHAR UTF-8',
      '0 @I1@ INDI',
      '1 NAME Иван /Иванов/',
      '2 SURN Иванов',
      '2 GIVN Иван',
      '1 SEX M',
      '1 _CONF A',
      '1 BIRT',
      '2 PLAC с. Фёдоровка',
      '3 MAP',
      '4 LATI N53.179910',
      '1 OBJE',
      '2 FILE photos/absent.jpg',
      '0 TRLR',
    ].join('\n'), { mediaFiles: new Set(['photos/present.jpg']) });

    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'INCOMPLETE_MAP',
      'MISSING_MEDIA',
    ]));
  });

  it('enforces the project formatting conventions', () => {
    const result = auditGedcom([
      '0 HEAD',
      '1 CHAR UTF-8',
      '',
      '0 @I1@ INDI',
      '1 NAME Иванов Иван',
      '2 SURN Иванов',
      '2 GIVN Иван',
      '1 SOUR Архивное дело с очень длинным описанием',
      '0 TRLR',
    ].join('\n'), { maxLineLength: 30 });

    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'BLANK_LINE',
      'LONG_LINE',
      'NONCANONICAL_NAME',
      'LITERAL_SOURCE',
      'MISSING_CONF',
    ]));
  });

  it('accepts a minimal internally consistent tree', () => {
    const result = auditGedcom([
      '0 HEAD',
      '1 CHAR UTF-8',
      '0 @I1@ INDI',
      '1 NAME Иван /Иванов/',
      '2 SURN Иванов',
      '2 GIVN Иван',
      '1 SEX M',
      '1 _CONF A',
      '1 FAMC @F1@',
      '0 @I2@ INDI',
      '1 NAME Пётр /Иванов/',
      '2 SURN Иванов',
      '2 GIVN Пётр',
      '1 SEX M',
      '1 _CONF A',
      '1 FAMS @F1@',
      '0 @F1@ FAM',
      '1 HUSB @I2@',
      '1 CHIL @I1@',
      '0 TRLR',
    ].join('\n'));

    expect(result.issues).toEqual([]);
    expect(result.counts).toMatchObject({ individuals: 2, families: 1, sources: 0 });
  });

  it('keeps every real family link reciprocal and every referenced media file present', () => {
    const result = auditGedcom(familyGedcom, { mediaFiles: new Set(publicFiles()) });
    const blockingCodes = new Set([
      'DANGLING_PERSON',
      'DANGLING_FAMILY',
      'ASYMMETRIC_FAMC',
      'ASYMMETRIC_FAMS',
      'ASYMMETRIC_CHILD',
      'ASYMMETRIC_SPOUSE',
      'MISSING_MEDIA',
    ]);

    expect(result.issues.filter((issue) => blockingCodes.has(issue.code))).toEqual([]);
  });

  it('uses structured sources and confidence grades throughout the real tree', () => {
    const result = auditGedcom(familyGedcom);
    const policyCodes = new Set(['LITERAL_SOURCE', 'MISSING_CONF', 'INVALID_CONF']);

    expect(result.issues.filter((issue) => policyCodes.has(issue.code))).toEqual([]);
  });

  it('places a documented birth in the event instead of leaving it only in NOTE', () => {
    const tree = parseGedcom(familyGedcom);

    expect(tree.indi['@I149@'].birt?.plac).toBe('с. Фёдоровка, Стерлитамакский у., Оренбургская губ., Российская империя');
    expect(tree.indi['@I149@'].birt?.lat).toBeCloseTo(53.17991, 5);
    expect(tree.indi['@I149@'].birt?.lon).toBeCloseTo(55.186229, 5);
  });
});
