# Разделённые ветви предков — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Отображать отцовскую и материнскую линии в непересекающихся вертикальных диапазонах, включая добавленных братьев и сестёр.

**Architecture:** `buildLayout` по-прежнему строит исходный порядок прямых предков рекурсивно. Второй этап размещения создаёт карточки братьев и сестёр с желаемой позицией рядом с прямым ребёнком, уплотняет карточки в пределах одного поколения и одной линии, а затем сдвигает всю материнскую линию ниже отцовской на безопасный зазор. Пробанд остаётся по центру итоговых диапазонов.

**Tech Stack:** TypeScript, Svelte 5, Vitest.

## Global Constraints

- Менять только `src/model/layout.ts` и `tests/model.test.ts`; не затрагивать пользовательские изменения в GEDCOM, галерее сканов и `App.svelte`.
- Не менять семейные связи, цвета, подписи родства, размеры карточек или SVG-связи.
- Не добавлять зависимости.
- Рабочая папка уже содержит несвязанные изменения; не включать их в staging или commit.

---

### Task 1: Зафиксировать разделение линий тестом

**Files:**

- Modify: `tests/model.test.ts`
- Uses: `parseGedcom(text: string): Tree`, `buildLayout(tree: Tree, showSiblings?: boolean): Layout`
- Produces: регрессионный тест, который падает для текущей общей раскладки.

- [ ] **Step 1: Добавить вспомогательную функцию для диапазонов сторон**

В блок `describe('layout')` добавить функцию, извлекающую слоты всех карточек отцовской или материнской стороны.

```ts
function sideSlots(layout: ReturnType<typeof buildLayout>, side: 'paternal' | 'maternal') {
  return Object.values(layout.nodeById)
    .filter((node) => layout.sideById[node.id] === side)
    .map((node) => node.slot);
}
```

- [ ] **Step 2: Добавить проверку настоящего дерева и подтвердить RED**

Добавить тест, который проверяет диапазоны на уже загруженном `tree` и подтверждает, что Маиса Белова остаётся в материнской линии. До исправления он обязан упасть: диагностическая команда уже показала `max(paternal) = 20`, `min(maternal) = 18.75`.

```ts
it('keeps added relatives inside their branch in the family GEDCOM', () => {
  const layout = buildLayout(tree);
  const paternal = sideSlots(layout, 'paternal');
  const maternal = sideSlots(layout, 'maternal');

  expect(layout.siblingIds.has('@I86@')).toBe(true);
  expect(layout.sideById['@I86@']).toBe('maternal');
  expect(Math.max(...paternal)).toBeLessThan(Math.min(...maternal));
});
```

Run: `npm test -- --reporter=verbose -t "separate vertical ranges|inside their branch"`

Expected: тест падает только на последней проверке диапазонов; существующие проверки GEDCOM не должны выдавать ошибку разбора.

### Task 2: Разместить боковые карточки внутри раздельных линий

**Files:**

- Modify: `src/model/layout.ts`
- Test: `tests/model.test.ts`
- Consumes: `nodeById` с исходными слотами прямых предков, `rel`, `sideById`, `fam`.
- Produces: слоты всех карточек, в которых отцовская область находится выше материнской, а братья и сёстры уплотнены в своей области.

- [ ] **Step 1: Заменить глобальный поиск свободного слота на сбор кандидатов братьев и сестёр**

Вместо `colOcc` и цикла с `base - delta` / `base + delta` добавить кандидата в соответствующую сторону линии. Для каждого прямого ребёнка `bb` использовать его поколение, сторону и исходный слот; у каждого добавляемого брата или сестры желаемый слот — на `0.75` ниже предыдущей карточки той же семьи.

```ts
const desiredSlot = new Map<string, number>();
Object.values(nodeById).forEach((node) => desiredSlot.set(node.id, node.slot));

Object.values(fam).forEach((family) => {
  const directChild = family.chil.find((id) => nodeById[id]);
  if (!directChild) return;
  const anchor = nodeById[directChild];
  const side = sideById[directChild] || 'self';
  let ordinal = 0;
  family.chil.forEach((id) => {
    if (id === directChild || !indi[id] || nodeById[id]) return;
    ordinal += 1;
    nodeById[id] = { id, gen: anchor.gen, slot: anchor.slot + ordinal * 0.75, x: 0, y: 0, isSibling: true };
    desiredSlot.set(id, nodeById[id].slot);
    siblingIds.add(id);
    sideById[id] = side;
  });
});
```

- [ ] **Step 2: Уплотнить карточки отдельно по стороне и поколению**

После добавления кандидатов сгруппировать все не-self карточки по ключу `${side}:${gen}`. Отсортировать их по желаемому слоту; прямую карточку ставить раньше её боковой карточки при равенстве. Назначать следующий слот не ниже предыдущего плюс `0.78`, чтобы две карточки в одной колонке не накладывались.

```ts
const packed = new Map<string, PlacedNode[]>();
Object.values(nodeById).forEach((node) => {
  const side = sideById[node.id] || 'self';
  if (side === 'self') return;
  const key = `${side}:${node.gen}`;
  const group = packed.get(key) || [];
  group.push(node);
  packed.set(key, group);
});

packed.forEach((group) => {
  group.sort((a, b) => (desiredSlot.get(a.id)! - desiredSlot.get(b.id)!) || Number(!!a.isSibling) - Number(!!b.isSibling));
  let previous = Number.NEGATIVE_INFINITY;
  group.forEach((node) => {
    node.slot = Math.max(desiredSlot.get(node.id)!, previous + 0.78);
    previous = node.slot;
  });
});
```

- [ ] **Step 3: Разделить области и отцентрировать пробанда**

Собрать слоты всех `paternal` и `maternal` карточек. Если обе стороны существуют, добавить ко всем материнским слотам одинаковый сдвиг, чтобы их минимальный слот был на `1.2` больше максимального отцовского. Затем поместить `@I1@` между крайними слотами двух областей. Делать это до вычисления `minS`, `maxS`, `x` и `y`.

```ts
const paternal = Object.values(nodeById).filter((node) => sideById[node.id] === 'paternal');
const maternal = Object.values(nodeById).filter((node) => sideById[node.id] === 'maternal');
if (paternal.length && maternal.length) {
  const paternalMax = Math.max(...paternal.map((node) => node.slot));
  const maternalMin = Math.min(...maternal.map((node) => node.slot));
  const shift = paternalMax + 1.2 - maternalMin;
  maternal.forEach((node) => { node.slot += shift; });
  nodeById['@I1@'].slot = (Math.min(...paternal.map((node) => node.slot)) + Math.max(...maternal.map((node) => node.slot))) / 2;
}
```

- [ ] **Step 4: Запустить RED/Green-проверки**

Run: `npm test -- --reporter=verbose -t "separate vertical ranges|inside their branch"`

Expected: PASS. До перехода к следующей задаче убедиться, что оба теста проходят без ослабления их проверок.

### Task 3: Проверить интеграцию и визуальную устойчивость

**Files:**

- Modify: `src/model/layout.ts` (только если это потребуется для TypeScript или пустых диапазонов)
- Verify: `tests/model.test.ts`, `src/lib/Tree.svelte`
- Consumes: новый расчёт слотов.
- Produces: подтверждённую сборку без изменений представления карточек.

- [ ] **Step 1: Прогнать полный набор модели и GEDCOM**

Run: `npm test`

Expected: все тесты проходят, в частности `parse has no structural errors`, оба новых теста раскладки и существующий тест построения десяти поколений.

- [ ] **Step 2: Проверить TypeScript и production-сборку**

Run: `npm run build`

Expected: `tsc --noEmit` и `vite build` завершаются с кодом 0.

- [ ] **Step 3: Проверить визуальную часть и детектор интерфейса**

Запустить dev-сервер, открыть дерево и убедиться, что коричневые карточки отцовской линии расположены одной непрерывной группой выше зелёных карточек материнской линии; Маиса Белова остаётся зелёной в материнской группе. Затем выполнить:

Run: `node /Users/albert/.agents/skills/impeccable/scripts/detect.mjs --json src/lib/Tree.svelte`

Expected: нет новых ошибок, относящихся к карточкам или доступности дерева. Если детектор указывает на существующий стиль вне области изменений, зафиксировать это отдельно и не менять визуальный язык без новой задачи.
