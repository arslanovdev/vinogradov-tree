# Исправление карточек источников — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Показывать каждую строку `1 SOUR` одной карточкой и убрать только строку источника «Красной книги» Бекина, сохранив её сканы в `OBJE`.

**Architecture:** Модель деталей будет форматировать каждое значение `p.sources` ровно один раз; внутренние `;` останутся частью библиографического текста. GEDCOM изменится только в блоке `@I17@`: удаляется один `1 SOUR`, а два последующих `OBJE` не меняются.

**Tech Stack:** TypeScript, Svelte, Vitest, Vite, GEDCOM 5.5.1.

## Global Constraints

- Один `1 SOUR` GEDCOM отображается как одна карточка.
- Не удалять `OBJE` со сканами `photos/bekin_late_arrivals_list_p263.jpg` и `photos/bekin_belov_family_p268.jpg`.
- Не менять несвязанные пользовательские изменения в рабочем дереве.
- После изменений запустить `npm test` и `npm run build`.
- Проверить структурную целостность GEDCOM и наличие всех добавленных/сохранённых медиафайлов.

---

### Task 1: Зафиксировать регрессию группировки источников

**Files:**
- Modify: `tests/model.test.ts` в блоке `person details`

**Interfaces:**
- Consumes: `parseGedcom`, `buildLayout`, `buildDetail`.
- Produces: тест, который не проходит при текущем разбиении `SOUR` по `;`.

- [ ] **Step 1: Write the failing test**

Добавить тест:

```ts
it('keeps one SOUR with semicolons as one source card', () => {
  const parsed = parseGedcom([
    '0 @I1@ INDI',
    '1 NAME Тестов Тест',
    '1 SOUR Первый фрагмент; второй фрагмент; третий фрагмент',
  ].join('\n'));

  const detail = buildDetail(parsed, '@I1@', buildLayout(parsed));

  expect(detail?.sources).toHaveLength(1);
  expect(detail?.sources[0].detail).toContain('Первый фрагмент; второй фрагмент; третий фрагмент');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/model.test.ts`

Expected: FAIL because the current `buildDetail` splits the single source into three cards.

---

### Task 2: Исправить модель источников

**Files:**
- Modify: `src/model/detail.ts` around source collection in `buildDetail`

**Interfaces:**
- Consumes: `p.sources: string[]` and existing `formatSource(text: string): SourceRef`.
- Produces: `Detail.sources` with exactly one `SourceRef` per parsed `SOUR` value.

- [ ] **Step 1: Implement the minimal change**

Заменить вложенный обход:

```ts
p.sources.forEach((s) => s.split(/\s*;\s*/).forEach((t) => {
  const v = t.trim();
  if (v) sources.push(formatSource(v));
}));
```

на обход, сохраняющий границу `SOUR`:

```ts
p.sources.forEach((s) => {
  const v = s.trim();
  if (v) sources.push(formatSource(v));
});
```

- [ ] **Step 2: Run the focused test to verify it passes**

Run: `npm test -- --run tests/model.test.ts`

Expected: PASS, включая новый тест и существующие тесты модели.

---

### Task 3: Удалить дублирующее описание «Красной книги» из GEDCOM

**Files:**
- Modify: `public/fedorovka_family.ged` в блоке `0 @I17@ INDI`
- Test: `tests/model.test.ts` в блоке `person details`

**Interfaces:**
- Consumes: реальный GEDCOM и `parseGedcom`.
- Produces: у Егора Белова нет `SOUR` с «Красной книгой», но остаются два документа Бекина.

- [ ] **Step 1: Write the failing data regression test**

Добавить тест для уже загруженного `tree`:

```ts
it('keeps Bekin scans as documents without listing the Red Book as a source', () => {
  const egor = buildDetail(tree, '@I17@', buildLayout(tree));

  expect(egor?.sources.some((source) => /красн.*книг|бекин/i.test(`${source.title} ${source.detail ?? ''}`))).toBe(false);
  expect(egor?.documents.map((document) => document.file)).toEqual(expect.arrayContaining([
    'photos/bekin_late_arrivals_list_p263.jpg',
    'photos/bekin_belov_family_p268.jpg',
  ]));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run tests/model.test.ts`

Expected: FAIL because `@I17@` currently still has the `1 SOUR` line for the Red Book.

- [ ] **Step 3: Remove only the source line**

Удалить строку:

```gedcom
1 SOUR А. М. Бекин, рукописная «Красная книга» жителей Фёдоровки, список отдельных семей, с.263, и схема Беловых, с.268: https://disk.yandex.ru/d/xRwTb0c8cWG-Tw/263%2B.jpg ; https://disk.yandex.ru/d/xRwTb0c8cWG-Tw/268.jpg
```

Не менять следующие строки `OBJE`, `FILE`, `TITL` и `_KIND doc`.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npm test -- --run tests/model.test.ts`

Expected: PASS, включая проверку двух документов Бекина.

---

### Task 4: Провести полную проверку и передать результат

**Files:**
- Verify: `public/fedorovka_family.ged`
- Verify: `public/photos/bekin_late_arrivals_list_p263.jpg`
- Verify: `public/photos/bekin_belov_family_p268.jpg`

**Interfaces:**
- Consumes: изменённый GEDCOM, модель парсинга, исходные npm-скрипты.
- Produces: свежие результаты тестов, сборки и проверки целостности.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: exit code 0 and all tests passing.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: exit code 0 and successful Vite build.

- [ ] **Step 3: Verify GEDCOM links and media files**

Run:

```bash
test -f public/photos/bekin_late_arrivals_list_p263.jpg
test -f public/photos/bekin_belov_family_p268.jpg
npm test -- --run tests/model.test.ts
```

Expected: оба `test -f` успешны, модельные тесты проходят, а `validate(tree)` не сообщает структурных ошибок.

- [ ] **Step 4: Review the diff**

Run: `git diff -- src/model/detail.ts tests/model.test.ts public/fedorovka_family.ged`

Проверить, что diff содержит только удаление деления `SOUR`, регрессионные тесты и удаление одной строки источника Бекина; пользовательские изменения в других файлах не затронуты.
