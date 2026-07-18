# Genealogy Autoresearch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Провести воспроизводимый аудит прямой линии `@I1@`, исследовать одну перспективную тупиковую ветвь и сохранить адаптированный к GEDCOM набор процессов `autoresearch-genealogy`.

**Architecture:** `public/fedorovka_family.ged` остаётся единственным источником данных о древе. Каталог `research/` содержит только аудит, журнал, открытые вопросы, исследовательские предложения и повторно используемые промпты; первый цикл не изменяет GEDCOM и перед любым патчем останавливается на человеческую проверку.

**Tech Stack:** GEDCOM 5.5.1, Markdown, Node.js для одноразовых read-only проверок, Git, Vitest, Vite.

## Global Constraints

- Главный и единственный источник данных о древе: `public/fedorovka_family.ged`.
- Исследовать прямых предков Надежды Виноградовой (`@I1@`); боковых родственников использовать только как доказательства прямой линии или зацепки к следующему прямому предку.
- Первый исследовательский цикл не изменяет GEDCOM; найденные факты сначала оформляются как предложения с источниками и уровнем уверенности.
- Не перезаписывать и не переформатировать несвязанные пользовательские изменения GEDCOM.
- Не повторять в публичных отчётах точные даты, адреса или другие частные сведения живых и, возможно, живых людей.
- Не подставлять неизвестные места, координаты и родство догадками.
- Первичный документ добавлять в `public/photos/` только вместе с одобренным GEDCOM-патчем; не создавать отсутствующих ссылок `FILE`.
- Не изменять `src/`, `tests/` и конфигурацию приложения: задача касается исследовательского процесса, а не приложения.
- После любых изменений репозитория выполнить `npm test` и `npm run build` до завершения работы.

---

### Task 1: Audit the direct ancestral line

**Files:**
- Create: `research/audit.md`
- Read: `public/fedorovka_family.ged`
- Read: `public/photos/`
- Verify with: `tests/model.test.ts`

**Interfaces:**
- Consumes: GEDCOM individuals, families, events, `_CONF`, `_TODO`, `SOUR`, `OBJE`, `PLAC`, `MAP` and media paths.
- Produces: `research/audit.md` with stable issue statuses `OPEN`, `RESOLVED`, `ACCEPTED_AS_UNKNOWN`, plus a ranked expansion-target table consumed by Task 2.

- [ ] **Step 1: Record and verify the baseline without editing data**

Run:

```bash
git status --short
npm test
```

Expected: note the exact `git status` output in the work log before editing. Vitest exits `0`, and `tests/model.test.ts` reports no structural GEDCOM errors. If the worktree already contains user changes, keep them unstaged and do not include them in later commits.

- [ ] **Step 2: Enumerate the direct pedigree from `@I1@`**

Run this read-only command from the repository root:

```bash
node --input-type=module -e '
import { readFileSync } from "node:fs";
const text = readFileSync("public/fedorovka_family.ged", "utf8");
const indi = new Map();
const fam = new Map();
let current = null;
for (const raw of text.split(/\r?\n/)) {
  const match = raw.match(/^(\d+)\s+(?:(@[^@]+@)\s+)?(\S+)(?:\s+(.*))?$/);
  if (!match) continue;
  const level = Number(match[1]);
  const xref = match[2];
  const tag = match[3];
  const value = match[4] || "";
  if (level === 0) {
    if (tag === "INDI" && xref) {
      current = { type: "I", id: xref, name: "", famc: null };
      indi.set(xref, current);
    } else if (tag === "FAM" && xref) {
      current = { type: "F", id: xref, husb: null, wife: null };
      fam.set(xref, current);
    } else {
      current = null;
    }
    continue;
  }
  if (!current || level !== 1) continue;
  if (current.type === "I" && tag === "NAME") current.name = value;
  if (current.type === "I" && tag === "FAMC") current.famc = value;
  if (current.type === "F" && tag === "HUSB") current.husb = value;
  if (current.type === "F" && tag === "WIFE") current.wife = value;
}
const rows = [];
const seen = new Set();
function visit(id, generation) {
  if (!id || seen.has(id)) return;
  seen.add(id);
  const person = indi.get(id);
  if (!person) return;
  const family = person.famc ? fam.get(person.famc) : null;
  const parents = family ? [family.husb, family.wife].filter(Boolean) : [];
  rows.push({ generation, id, name: person.name, parents });
  for (const parent of parents) visit(parent, generation + 1);
}
visit("@I1@", 0);
rows.sort((a, b) => a.generation - b.generation || a.id.localeCompare(b.id, undefined, { numeric: true }));
console.log(`pedigree_people_including_I1=${rows.length}`);
for (const row of rows) console.log(`${row.generation}\t${row.id}\t${row.name}\t${row.parents.join(",") || "LEAF"}`);
'
```

Expected for the approved-design baseline: `pedigree_people_including_I1=68`, meaning `@I1@` plus 67 direct ancestors. If the count differs, use the fresh result and explain the difference in the audit rather than forcing 68.

- [ ] **Step 3: Check structural links and media paths mechanically**

Run:

```bash
npm test
while IFS= read -r media_path; do
  test -f "public/$media_path" || echo "MISSING $media_path"
done < <(sed -n 's/^2 FILE //p' public/fedorovka_family.ged)
```

Expected: Vitest exits `0`; the media loop prints no `MISSING` lines. Record any failure as `CRITICAL | OPEN` in the audit before doing anything else.

- [ ] **Step 4: Inspect facts, sources, confidence and next steps for the enumerated IDs**

For each ID emitted in Step 2, inspect its complete `INDI` block and its `FAMC` family. Check:

```text
BIRT, DEAT, BURI, RESI -> DATE, PLAC, MAP/LATI/LONG
substantial fact or relationship -> SOUR
uncertainty or conflict -> _CONF plus explanatory NOTE
known next search -> concrete _TODO
OBJE -> FILE exists, TITL is informative, document has _KIND doc
```

Use these baseline examples to calibrate the audit, then continue through all 68 records:

```text
@I4@: DEAT has a date but no PLAC; BURI has PLAC and MAP.
@I10@: DEAT has a date but no PLAC.
@I20@: BIRT and DEAT have dates but no PLAC; no SOUR is attached to the person.
@I23@: leaf direct ancestor with a concrete metric-book search in _TODO.
@I26@: leaf direct ancestor with a 1917 census and parish-metric search in _TODO.
```

Do not copy exact modern dates for living people into the report. IDs and structural findings are sufficient.

- [ ] **Step 5: Write `research/audit.md`**

Use this exact report structure:

```markdown
# Аудит прямой линии @I1@

Дата проверки: 2026-07-18
Источник: `public/fedorovka_family.ged`
Область: `@I1@` и 67 прямых предков; боковые персоны оцениваются только по доказательной ценности.

## Базовая проверка

| Проверка | Результат |
|---|---|
| Персон в прямой цепи вместе с @I1@ | 68 |
| Структурные ошибки `validate()` | 0 |
| Отсутствующие локальные медиа | 0 |

## Критические ошибки

| Type | Severity | Status | GEDCOM ID | Проверка | Основание | Следующее действие |
|---|---|---|---|---|---|---|

## Недостающие места и координаты

| Type | Severity | Status | GEDCOM ID | Событие | Что известно | Чего не хватает | Не подставлять без источника |
|---|---|---|---|---|---|---|---|

## Недостающие и слабые источники

| Type | Severity | Status | GEDCOM ID | Факт | Текущее основание | Требуемый источник |
|---|---|---|---|---|---|---|

## Противоречия и гипотезы

| Type | Severity | Status | GEDCOM ID | Версии | Текущая уверенность | Решающий документ |
|---|---|---|---|---|---|---|

## Боковые свидетельства

| Type | GEDCOM ID | Ценность для прямой линии | Решение |
|---|---|---|---|

## Хорошо оформленные записи

| GEDCOM ID | Почему запись проходит аудит |
|---|---|

## Кандидаты на следующий поиск

| Rank | GEDCOM ID | Прямая задача | Место | Диапазон | Решающий источник | Балл |
|---|---|---|---|---|---|---|
```

Populate every issue row with a real GEDCOM ID and evidence from the file. Use `OPEN` for an actionable gap, `RESOLVED` only when the current GEDCOM already resolves the issue, and `ACCEPTED_AS_UNKNOWN` when the missing value is explicitly preserved because no source exists.

Use the fixed `Type` values `CRITICAL`, `PLACE`, `SOURCE`, `CONFLICT` and `COLLATERAL` so later prompts can filter the report mechanically.

Rank expansion targets with this fixed score:

```text
+2 specific settlement or parish
+2 target record range no wider than two years
+2 named archive, fund, collection or exact record type
+2 record would identify the next direct ancestor
+1 at least one independent existing source supports the identity
```

With the current data, expect `@I23@` (Назар Белов, through the birth record of Егор Назарович around 1901 in Фёдоровка) to rank first or tie for first. If fresh evidence changes the ranking, document the scores and select the actual highest-scoring target.

- [ ] **Step 6: Verify the audit artifact**

Run:

```bash
test -s research/audit.md
rg -n '^## (Базовая проверка|Критические ошибки|Недостающие места и координаты|Недостающие и слабые источники|Противоречия и гипотезы|Боковые свидетельства|Хорошо оформленные записи|Кандидаты на следующий поиск)$' research/audit.md
rg -q '@I23@' research/audit.md
rg -q '@I26@' research/audit.md
git diff --check
```

Expected: the file is non-empty; all eight headings are found; the candidate table mentions both `@I23@` and `@I26@`; `git diff --check` exits `0`.

- [ ] **Step 7: Commit only the audit**

```bash
git add research/audit.md
git diff --cached --name-only
git commit -m "Audit direct Vinogradov ancestry"
```

Expected staged file list: only `research/audit.md`.

---

### Task 2: Research the highest-ranked leaf and prepare a review packet

**Files:**
- Create: `research/research-log.md`
- Create: `research/open-questions.md`
- Create: `research/proposals/nazar-belov.md`
- Read: `research/audit.md`
- Read: `public/fedorovka_family.ged`

**Interfaces:**
- Consumes: ranked target table from Task 1 and the existing records `@I17@`, `@I23@`, `@F14@`.
- Produces: a reproducible search log, one status-tracked research question and a human-review packet that either contains a source-backed proposed GEDCOM change or explicitly says no patch is justified.

- [ ] **Step 1: Confirm the research target from the audit**

Read the ranking table. If `@I23@` is highest-scoring, use this exact question:

```text
Каковы полное имя, отчество, годы жизни и семья Назара, отца Белова Егора Назаровича, родившегося около 1901 года в селе Фёдоровка?
```

The decisive record is the birth or baptism entry for Егор Назарович Белов around 1901. Before searching names, verify which parish, archive and fond actually hold the metric book; do not assume the existing `_TODO` archive reference is correct.

If another target outranks `@I23@`, stop and update this plan with that concrete ID, question and decisive record before continuing. Do not silently substitute a different branch.

- [ ] **Step 2: Initialize the research log and open question**

Create `research/research-log.md` with:

```markdown
# Журнал генеалогического поиска

## 2026-07-18 — @I23@ Назар Белов

- Цель: установить следующего прямого предка через запись о рождении Егора Назаровича Белова около 1901 года.
- Исходные факты: Егор носит отчество Назарович; в GEDCOM указан как уроженец с. Фёдоровка.
- Не считать доказательством: совпадение фамилии или отчества без первичной записи и семейного контекста.

### Проверенные каталоги и запросы

### Положительные результаты

### Отрицательные результаты

### Недоступные источники

### Итог итерации
```

Create `research/open-questions.md` with:

```markdown
# Открытые вопросы прямой линии

| ID | Type | Status | Priority | Solvability | GEDCOM ID | Вопрос | Решающий документ |
|---|---|---|---|---|---|---|---|
| Q-001 | PARENTAGE | OPEN | HIGH | HIGH | @I23@ | Полное имя, отчество, годы жизни и семья Назара Белова | Запись о рождении или крещении Егора Назаровича Белова около 1901 года, с. Фёдоровка |
```

- [ ] **Step 3: Verify the jurisdiction and record location first**

Search current official archive catalogs and authoritative finding aids in this order:

```text
"село Федоровка" "метрическая книга" 1901 Стерлитамакский уезд
"Фёдоровка" "И-294" метрические книги
"Фёдоровка" "фонд 173" "опись 16" метрические книги
site:archives.gov.ru Федоровка метрические книги Стерлитамакский
site:familysearch.org Федоровка Уфимская губерния church records
```

For every catalog page, record the page title, direct URL, archive, fond, inventory, file, year span, confession/parish and access condition. A catalog description proves that a record exists, not that Назар is in it.

If a source is inaccessible because login, payment or in-person access is required, log it under `Недоступные источники`, not `Отрицательные результаты`.

- [ ] **Step 4: Search for the person only after jurisdiction is established**

Run and log these queries, adding spelling and old-administration variants learned in Step 3:

```text
"Егор Назарович Белов" Федоровка
"Белов Егор Назарович" 1901
"Егор Назаров" Федоровка Стерлитамакский уезд
"Назар Белов" Федоровка
site:familio.org "Егор Назарович Белов"
site:forum.vgd.ru "Назар Белов" Федоровка
```

Treat Familio, VGD, user trees and snippets only as leads. Open the underlying source whenever possible. Reject same-name candidates unless name, time, settlement/parish and family context align.

- [ ] **Step 5: Classify every candidate and preserve negative results**

Use exactly these classifications in the log:

```text
CONFIRMED: one authoritative primary record directly states the relationship, or two independent records jointly establish it.
PROBABLE: evidence aligns on name, time, place and family, but a decisive primary record is still missing.
HYPOTHESIS: a useful lead supported by only one indirect or user-contributed source.
REJECTED: identity, date, place or family context conflicts.
INACCESSIBLE: the relevant collection exists but could not be inspected.
NO_RESULT: the stated query or inspected range produced no relevant record.
```

For `NO_RESULT`, record the exact query or archive range and date checked. Do not write only “ничего не найдено”.

- [ ] **Step 6: Prepare `research/proposals/nazar-belov.md`**

The review packet must contain these headings:

```markdown
# Предложение по @I23@ Назару Белову

## Исследовательский вопрос
## Исходные данные GEDCOM
## Проверенные источники
## Сопоставление личности
## Классификация результата
## Предлагаемое изменение GEDCOM
## Предлагаемые медиа
## Противоречия и отрицательные результаты
## Что проверить человеку
## Запрос в архив, если онлайн-доступа нет
```

If evidence does not reach `CONFIRMED`, write this exact sentence under `Предлагаемое изменение GEDCOM`:

```text
GEDCOM-патч не предлагается: доказательств недостаточно для изменения прямой линии.
```

If the decisive collection exists but is not online, include this archive-request body, corrected only with the verified archive references from Step 3:

```text
Здравствуйте. Прошу проверить запись о рождении или крещении Белова Егора Назаровича, предположительно родившегося около 1901 года в селе Фёдоровка Стерлитамакского уезда Уфимской губернии. Цель запроса — установить полные имена родителей, прежде всего отца Назара, а также сословие, место жительства и восприемников. Прошу сообщить архивный шифр записи и возможность получить цифровую копию листа с записью.
```

Do not add media or edit GEDCOM in this task.

- [ ] **Step 7: Verify the research packet**

Run:

```bash
test -s research/research-log.md
test -s research/open-questions.md
test -s research/proposals/nazar-belov.md
rg -n 'CONFIRMED|PROBABLE|HYPOTHESIS|REJECTED|INACCESSIBLE|NO_RESULT' research/research-log.md research/proposals/nazar-belov.md
rg -n '^## (Предлагаемое изменение GEDCOM|Противоречия и отрицательные результаты|Что проверить человеку|Запрос в архив, если онлайн-доступа нет)$' research/proposals/nazar-belov.md
git diff --check
```

Expected: all three files are non-empty; at least one explicit classification is present; all required review sections exist; `git diff --check` exits `0`.

- [ ] **Step 8: Commit the research packet**

```bash
git add research/research-log.md research/open-questions.md research/proposals/nazar-belov.md
git diff --cached --name-only
git commit -m "Research Nazar Belov ancestry"
```

Expected staged files: exactly the three research files named above.

- [ ] **Step 9: Present the proposal and stop for human review**

Present `research/proposals/nazar-belov.md` to the user. Do not edit `public/fedorovka_family.ged` until the user explicitly approves a concrete patch. An approved evidence packet requires a short follow-up plan containing the exact GEDCOM lines and media filenames learned during research.

---

### Task 3: Add the reusable GEDCOM-first autoresearch kit

**Files:**
- Create: `research/README.md`
- Create: `research/prompts/01-gedcom-audit.md`
- Create: `research/prompts/02-cross-reference-audit.md`
- Create: `research/prompts/03-source-citation-audit.md`
- Create: `research/prompts/04-timeline-gap-analysis.md`
- Create: `research/prompts/05-open-question-resolution.md`
- Create: `research/prompts/06-source-backed-expansion.md`
- Read: `docs/superpowers/specs/2026-07-18-genealogy-autoresearch-design.md`

**Interfaces:**
- Consumes: the report formats and status vocabulary established in Tasks 1 and 2.
- Produces: a repeatable six-prompt workflow whose source of truth is the GEDCOM and whose outputs stay under `research/` until human approval.

- [ ] **Step 1: Write `research/README.md` with the fixed run order**

The README must state:

```markdown
# Исследовательский контур древа Виноградовых

Источник правды: `public/fedorovka_family.ged`.

## Порядок запуска

1. `prompts/01-gedcom-audit.md`
2. `prompts/02-cross-reference-audit.md`
3. `prompts/03-source-citation-audit.md`
4. `prompts/04-timeline-gap-analysis.md`
5. `prompts/05-open-question-resolution.md`
6. `prompts/06-source-backed-expansion.md`

Проверка предшествует расширению. Исследовательские отчёты и гипотезы не импортируются в GEDCOM автоматически.

## Обязательная человеческая проверка

- открыть каждый источник;
- проверить имя, время, место и семейный контекст;
- отклонить совпадение только по имени или фамилии;
- сохранить противоречия и отрицательные результаты;
- одобрить точный GEDCOM-патч и имена медиафайлов до применения.

## Проверка после принятого патча

```bash
npm test
npm run build
```

## Происхождение методики

Процесс адаптирован из MIT-проекта `mattprusak/autoresearch-genealogy`: https://github.com/mattprusak/autoresearch-genealogy
```

- [ ] **Step 2: Create all six prompts with the same required schema**

Every prompt must contain these exact headings:

```markdown
## Goal
## Metric
## Direction
## Verify
## Guard
## Iterations
## Protocol
## Human Review Gate
```

Use the following fixed configuration:

| File | Goal | Metric | Direction | Verify | Iterations |
|---|---|---|---|---|---|
| `01-gedcom-audit.md` | Audit direct ancestors of `@I1@` without editing GEDCOM | `OPEN` rows in `research/audit.md` | Minimize | `rg -c '\| OPEN \|' research/audit.md` | 1 |
| `02-cross-reference-audit.md` | Preserve and explain conflicting names, dates, places and relationships | Open conflict rows in `research/audit.md` | Minimize | `rg -c '^\| CONFLICT .*\| OPEN \|' research/audit.md` | 8 |
| `03-source-citation-audit.md` | Identify substantial direct-line claims without a supporting source | Open source rows in `research/audit.md` | Minimize | `rg -c '^\| SOURCE .*\| OPEN \|' research/audit.md` | 8 |
| `04-timeline-gap-analysis.md` | Identify expected primary records missing from the direct line | Open timeline-gap questions in `research/open-questions.md` | Minimize | `rg -c '^\| Q-[^|]* \| TIMELINE \| OPEN \|' research/open-questions.md` | 8 |
| `05-open-question-resolution.md` | Research the highest-priority solvable direct-line question | Questions with status `OPEN` | Minimize | `rg -c '\| OPEN \|' research/open-questions.md` | 10 |
| `06-source-backed-expansion.md` | Review and classify candidates for the next direct ancestor | Reviewed candidates classified by evidence tier | Maximize reviewed classifications, never raw person count | Count `CONFIRMED`, `PROBABLE`, `HYPOTHESIS`, `REJECTED`, `INACCESSIBLE`, `NO_RESULT` entries added to `research/research-log.md` in the current iteration | 8 |

- [ ] **Step 3: Put concrete guards into every prompt**

Repeat these rules in each `Guard` section so every file remains self-contained:

```text
- Read `public/fedorovka_family.ged` as the only tree source of truth.
- Restrict the pedigree to direct ancestors of `@I1@`; use collateral people only when their value to the direct line is explained.
- Do not edit GEDCOM, add media or resolve a conflict automatically.
- Do not search living or possibly living people on the web or repeat their exact private data in reports.
- Do not treat user trees, forums or name-only matches as proof.
- Cite a direct URL or exact archive reference for every substantial finding.
- Log unavailable sources separately from true negative searches.
- Keep `PLAC` and `MAP` unknown until supported by a source.
```

- [ ] **Step 4: Put an executable protocol into each prompt**

Use these exact protocol sequences:

```text
01 GEDCOM audit:
1. Enumerate @I1@ and every parent recursively through FAMC/HUSB/WIFE.
2. Validate INDI/FAM references and local OBJE/FILE paths.
3. Check SOUR, _CONF, _TODO, PLAC and MAP for each direct-line record.
4. Write or update research/audit.md with evidence and status for every issue.
5. Stop without editing GEDCOM.

02 Cross-reference audit:
1. Read all conflict notes and alternative names/dates/places for direct-line people.
2. List every version and the source that states it.
3. Rank primary records above derivative trees without deleting the losing version.
4. Mark RESOLVED only when the cited evidence justifies the choice; otherwise leave OPEN.
5. Record the reasoning in research/audit.md and stop before GEDCOM edits.

03 Source citation audit:
1. Inventory SOUR entries for every direct-line person and family relationship.
2. Separate independent sources from copies of the same underlying record.
3. Add OPEN source rows for substantial unsupported claims.
4. Search only deceased people and prefer primary or exact archival sources.
5. Record findings and failed searches without changing GEDCOM.

04 Timeline gap analysis:
1. Build expected birth, marriage, residence, military, death and burial record opportunities from known dates and places.
2. Compare expected records with existing SOUR and OBJE entries.
3. Add only actionable gaps with date range, jurisdiction and decisive record to research/open-questions.md.
4. Rank gaps by source availability and value for reaching the next direct ancestor.
5. Do not fill a gap with inferred facts.

05 Open question resolution:
1. Select HIGH priority and HIGH solvability OPEN questions first.
2. Verify archive jurisdiction before searching a person by name.
3. Run and log exact queries, URLs, record ranges and access barriers.
4. Classify results with the shared six-status vocabulary.
5. Mark RESOLVED only for CONFIRMED evidence; otherwise use PARTIALLY_RESOLVED or keep OPEN.
6. Prepare a human-review proposal and stop before GEDCOM edits.

06 Source-backed expansion:
1. Select the highest-ranked direct-line leaf from research/audit.md.
2. Define one decisive parentage record and search strategy.
3. Require alignment of name, time, place and family context.
4. Classify every candidate as CONFIRMED, PROBABLE, HYPOTHESIS, REJECTED, INACCESSIBLE or NO_RESULT.
5. Put weak leads in research/open-questions.md, not in the tree.
6. Prepare an exact proposal with citations and stop for human review.
```

Every `Human Review Gate` must require the user to open the sources, approve the identity match, approve any archive scan filename and approve exact GEDCOM lines before application.

- [ ] **Step 5: Verify the reusable kit mechanically**

Run:

```bash
test -s research/README.md
test "$(find research/prompts -maxdepth 1 -name '*.md' | wc -l | tr -d ' ')" = "6"
for prompt in research/prompts/*.md; do
  for heading in '## Goal' '## Metric' '## Direction' '## Verify' '## Guard' '## Iterations' '## Protocol' '## Human Review Gate'; do
    rg -q -F "$heading" "$prompt" || exit 1
  done
  rg -q -F 'public/fedorovka_family.ged' "$prompt" || exit 1
done
rg -n 'public/fedorovka_family.ged' research/README.md research/prompts/*.md
rg -n 'autoresearch-genealogy' research/README.md
git diff --check
```

Expected: README is non-empty; exactly six prompt files exist; every prompt contains all eight headings; every prompt names the GEDCOM source of truth; attribution is present; `git diff --check` exits `0`.

- [ ] **Step 6: Commit only the reusable research kit**

```bash
git add research/README.md research/prompts
git diff --cached --name-only
git commit -m "Add GEDCOM-first genealogy research workflow"
```

Expected staged files: `research/README.md` and the six files under `research/prompts/`, with no GEDCOM or application files.

---

### Task 4: Verify the repository and hand off the evidence gate

**Files:**
- Verify: `research/audit.md`
- Verify: `research/research-log.md`
- Verify: `research/open-questions.md`
- Verify: `research/proposals/nazar-belov.md`
- Verify: `research/README.md`
- Verify: `research/prompts/*.md`
- Verify unchanged unless separately approved: `public/fedorovka_family.ged`

**Interfaces:**
- Consumes: all artifacts from Tasks 1–3.
- Produces: a clean, tested research workflow and a clear human decision: reject the candidate, request an archive record, or authorize a separate exact GEDCOM patch.

- [ ] **Step 1: Recheck design coverage**

Run:

```bash
rg -n '^## (Этап 1: безопасный аудит|Этап 2: поиск следующего прямого предка|Этап 3: постоянная интеграция|Ошибки и спорные случаи|Проверка|Критерии приёмки)$' docs/superpowers/specs/2026-07-18-genealogy-autoresearch-design.md
test -s research/audit.md
test -s research/research-log.md
test -s research/open-questions.md
test -s research/proposals/nazar-belov.md
test -s research/README.md
```

Expected: all design sections are found and every required artifact is non-empty.

- [ ] **Step 2: Run the full project verification required by `AGENTS.md`**

Run:

```bash
npm test
npm run build
```

Expected: both commands exit `0`. Report the exact test count and build result; do not summarize from an earlier run.

- [ ] **Step 3: Recheck GEDCOM media and repository diff**

Run:

```bash
while IFS= read -r media_path; do
  test -f "public/$media_path" || echo "MISSING $media_path"
done < <(sed -n 's/^2 FILE //p' public/fedorovka_family.ged)
git diff --check
git status --short
```

Expected: no `MISSING` lines; `git diff --check` exits `0`; status contains no uncommitted files created by this plan. Pre-existing user changes, if any, remain untouched and are reported separately.

- [ ] **Step 4: Present the human evidence decision**

Summarize only evidence supported by `research/proposals/nazar-belov.md`:

```text
CONFIRMED -> offer a separate exact GEDCOM/media patch plan.
PROBABLE or HYPOTHESIS -> keep the relationship out of GEDCOM and state the decisive missing record.
INACCESSIBLE -> provide the completed archive request and access instructions.
NO_RESULT or REJECTED -> preserve the exact negative result and move to the next ranked target only after user approval.
```

Do not claim that a new ancestor was found unless the packet is `CONFIRMED` and the user has reviewed the source.
