import { describe, expect, it } from 'vitest';
import { parseGedcom } from '../src/gedcom/parse';

describe('GEDCOM CONT/CONC continuations', () => {
  it('reassembles continued notes, source titles and citation pages', () => {
    const input = [
      '0 HEAD',
      '1 CHAR UTF-8',
      '0 @I1@ INDI',
      '1 NAME Иван /Иванов/',
      '2 SURN Иванов',
      '2 GIVN Иван',
      '1 SEX M',
      '1 _CONF A',
      '1 NOTE Первая',
      '2 CONC  часть',
      '1 NOTE Первая строка',
      '2 CONT Вторая',
      '3 CONC  строка',
      '1 SOUR @S1@',
      '2 PAGE л. 1',
      '3 CONC –2',
      '0 @S1@ SOUR',
      '1 TITL Архивный',
      '2 CONC  источник',
      '0 TRLR',
    ].join('\n');

    const person = parseGedcom(input).indi['@I1@'];

    expect(person.notes).toEqual(['Первая часть', 'Первая строка\nВторая строка']);
    expect(person.sources).toEqual(['Архивный источник; л. 1–2']);
    expect(person.sourceCitations).toEqual([
      { sourceId: '@S1@', title: 'Архивный источник', page: 'л. 1–2' },
    ]);
  });
});
