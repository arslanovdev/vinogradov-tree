import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseGedcom, validate } from '../src/gedcom/parse';
import { buildLayout } from '../src/model/layout';
import { relAnc, nameParts, confOf, linkifySource } from '../src/model/derive';

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
  it('hides retrospective surname', () => {
    const np = nameParts(tree.indi['@I70@']);
    expect(np.main).toBe('Иван Павлов');
    expect(np.retroSurn).toBe('Камышлов');
  });
  it('reads confidence from [ТОЧНОСТЬ]/RELI/QUAY', () => {
    expect(confOf(tree.indi['@I1@']).letter).toBe('A');
  });
  it('linkifies pamyat-naroda ids', () => {
    expect(linkifySource('person-hero122489359').url).toContain('/heroes/person-hero122489359/');
    expect(linkifySource('ЦАМО').url).toBeNull();
  });
});
