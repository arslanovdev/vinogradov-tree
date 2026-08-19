import { describe, expect, it } from 'vitest';
import { parseGedcom } from '../src/gedcom/parse';
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

  it('canonicalizes names, custom name types, blank lines and long values', () => {
    const longNote = `Подтверждённый факт: ${'длинное описание '.repeat(24)}`.trimEnd();
    const input = [
      '0 HEAD',
      '1 CHAR UTF-8',
      '',
      '0 @I1@ INDI',
      '1 NAME Иванов Иван Иванович',
      '2 SURN Иванов',
      '2 GIVN Иван Иванович',
      '1 NAME Иван Иванович /Петров/',
      '2 TYPE maiden',
      '2 SURN Петров',
      '2 GIVN Иван Иванович',
      '1 SEX M',
      '1 _CONF A',
      `1 NOTE ${longNote}`,
      '0 TRLR',
    ].join('\n');

    const normalized = normalizeGedcom(input);
    const person = parseGedcom(normalized).indi['@I1@'];

    expect(normalized).toContain('1 NAME Иван Иванович /Иванов/');
    expect(normalized).toContain('2 _TYPE maiden');
    expect(normalized).not.toMatch(/^2 TYPE maiden$/m);
    expect(normalized).not.toContain('\n\n');
    expect(normalized.split('\n').every((line) => [...line].length <= 255)).toBe(true);
    expect(normalized).not.toMatch(/[ \t]+$/m);
    expect(person.notes).toEqual([longNote]);
    expect(normalizeGedcom(normalized)).toBe(normalized);
  });
});
