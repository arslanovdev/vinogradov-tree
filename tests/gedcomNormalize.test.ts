import { describe, expect, it } from 'vitest';
import { normalizeGedcom } from '../src/gedcom/normalize';

describe('GEDCOM normalization', () => {
  it('moves literal record sources into reusable SOUR records without losing text', () => {
    const input = [
      '0 HEAD',
      '1 CHAR UTF-8',
      '0 @I1@ INDI',
      '1 NAME Иван /Иванов/',
      '2 SURN Иванов',
      '2 GIVN Иван',
      '1 SEX M',
      '1 _CONF A',
      '1 SOUR НА РБ, ф. И-10, оп. 1, д. 552 — точная ссылка',
      '0 @I2@ INDI',
      '1 NAME Пётр /Иванов/',
      '2 SURN Иванов',
      '2 GIVN Пётр',
      '1 SEX M',
      '1 _CONF A',
      '1 SOUR НА РБ, ф. И-10, оп. 1, д. 552 — точная ссылка',
      '0 @S43@ SOUR',
      '1 TITL Существующий источник',
      '1 ABBR Существующий',
      '0 TRLR',
    ].join('\n');

    const normalized = normalizeGedcom(input);

    expect(normalized.match(/^1 SOUR @S44@$/gm)).toHaveLength(2);
    expect(normalized).toContain('0 @S44@ SOUR\n1 TITL НА РБ, ф. И-10, оп. 1, д. 552 — точная ссылка');
    expect(normalized).toMatch(/\n1 ABBR НА РБ, ф\. И-10, оп\. 1, д\. 552\n0 TRLR$/);
    expect(normalizeGedcom(normalized)).toBe(normalized);
  });
});
