import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import SourceCard from '../src/lib/SourceCard.svelte';
import type { SourceRef } from '../src/model/detail';

describe('source card', () => {
  it('shows only stable source metadata and keeps personal citation text out of the card', () => {
    const source: SourceRef = {
      title: 'Книга «Они вернулись с Победой»',
      description: 'Т. 11 (Уфа: Китап, 2004)',
      citations: [
        'с. 548: Камышлов Алексей Романович; запись противоречит донесению о гибели',
      ],
      detail: 'Т. 11 (Уфа: Китап, 2004) с. 548: Камышлов Алексей Романович',
      repository: 'НБ Республики Башкортостан',
      url: '/sources/oni-vernulis-s-pobedoy-t11.pdf#page=548',
    };

    const { body } = render(SourceCard, { props: { source } });

    expect(body).toContain('Книга «Они вернулись с Победой»');
    expect(body).toContain('Т. 11 (Уфа: Китап, 2004)');
    expect(body).toContain('НБ Республики Башкортостан');
    expect(body).not.toContain('Камышлов Алексей Романович');
    expect(body).not.toContain('с. 548');
  });
});
