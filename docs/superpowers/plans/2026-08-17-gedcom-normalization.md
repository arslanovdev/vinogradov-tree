# GEDCOM Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Исправить структурные дефекты семейного GEDCOM и добавить постоянную автоматическую проверку без потери исторических данных.

**Architecture:** Чистый TypeScript-аудитор проверяет текст и получает список медиа извне; Node CLI связывает его с файловой системой. Парсер сворачивает `CONT/CONC`, а идемпотентный нормализатор выполняет только механические миграции, после чего фактические `PLAC` и `_CONF` редактируются вручную.

**Tech Stack:** TypeScript, Vitest, Node.js ESM, GEDCOM 5.5.1 + `_CONF/_TODO/_KIND/_TYPE`, npm.

## Global Constraints

- Источник истины: `public/fedorovka_family.ged`.
- Не создавать места, родство или уверенность из догадки.
- Архивный документ оформляется как `@Sxx@ SOUR`; цитата использует `SOUR` и при наличии `PAGE`.
- Устные сведения остаются в `NOTE`.
- PNG/WebP сохраняются как разрешённое расширение проекта.
- Не staging посторонние изменения `src/lib/ScanGallery.svelte`, `src/model/places.ts`, `vite.config.ts`.

---

### Task 1: Pure GEDCOM audit library and CLI

**Files:**
- Create: `src/gedcom/audit.ts`
- Create: `tests/gedcomAudit.test.ts`
- Create: `scripts/validate-gedcom.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `auditGedcom(text: string, options?: { mediaFiles?: ReadonlySet<string>; maxLineLength?: number }): GedcomAuditResult`.
- Produces: `GedcomAuditResult` with `issues`, `counts`, and issue severities `error | warning`.

- [ ] **Step 1: Write failing tests** for a dangling child link, asymmetric `FAMC/CHIL`, duplicate XREF, missing source pointer, incomplete MAP, absent media, blank lines, long lines, literal record sources, and missing `_CONF`.
- [ ] **Step 2: Run `npm test -- tests/gedcomAudit.test.ts`** and confirm failure because `src/gedcom/audit.ts` does not exist.
- [ ] **Step 3: Implement the minimal pure audit module** with no filesystem imports.
- [ ] **Step 4: Run `npm test -- tests/gedcomAudit.test.ts`** and confirm all audit fixtures pass.
- [ ] **Step 5: Add CLI and `validate:gedcom` script**, passing `public/photos/**` as a normalized set of `photos/...` paths.
- [ ] **Step 6: Run `npm run validate:gedcom`** and confirm it reports the known pre-fix failures with a non-zero exit code.

### Task 2: Structural links and media

**Files:**
- Modify: `public/fedorovka_family.ged`
- Restore: `public/photos/alexey_kamyshlov_loss_1944.jpg`
- Restore: `public/photos/bekin_red_book_lariny_p175.webp`
- Restore: `public/photos/mk_fedorovka_1857_varvara_antoshkina_record_95.jpg`
- Modify: `tests/gedcomAudit.test.ts`

**Interfaces:**
- Consumes: `auditGedcom` from Task 1.

- [ ] **Step 1: Add a real-file assertion** that family reciprocity and media references contain no errors; verify it fails.
- [ ] **Step 2: Add `1 CHIL @I201@` to `@F65@`** and restore the three versioned media files.
- [ ] **Step 3: Re-run the focused test** and confirm reciprocity/media pass.

### Task 3: Structured sources, confidence and documented places

**Files:**
- Create: `src/gedcom/normalize.ts`
- Create: `scripts/normalize-gedcom.ts`
- Modify: `public/fedorovka_family.ged`
- Modify: `tests/gedcomAudit.test.ts`

**Interfaces:**
- Produces: `normalizeGedcom(text: string): string`, an idempotent source and name normalization over a GEDCOM string.

- [ ] **Step 1: Add real-file assertions** for zero literal record-level `SOUR` values and exactly one `_CONF A|B|C` per `INDI`; verify they fail.
- [ ] **Step 2: Implement structured-source migration** assigning unused IDs after `@S43@`, adding `TITL/ABBR`, and replacing each literal citation with a pointer without changing the source text.
- [ ] **Step 3: Assign the 18 missing confidence values manually** from the evidence in each card.
- [ ] **Step 4: Add literal `PLAC` values only to events whose NOTE/source states the place**, including `@I149@ BIRT` in Фёдоровка; never infer death place from burial.
- [ ] **Step 5: Run focused audit tests** and review the complete GED diff for factual changes.

### Task 4: CONT/CONC parsing and physical normalization

**Files:**
- Modify: `src/gedcom/parse.ts`
- Modify: `src/gedcom/normalize.ts`
- Modify: `scripts/normalize-gedcom.ts`
- Modify: `tests/model.test.ts`
- Modify: `tests/gedcomAudit.test.ts`
- Modify: `public/fedorovka_family.ged`

**Interfaces:**
- Produces: `parseGedcomLines(text: string): GedcomLine[]`, where child `CONC` appends directly and `CONT` appends `\n` to the preceding parent value.

- [ ] **Step 1: Add parser tests** for `NOTE + CONC`, `NOTE + CONT`, and `PAGE + CONC`; verify expected failures.
- [ ] **Step 2: Refactor parsing to consume logical lines** and pass the new tests without changing existing parse behavior.
- [ ] **Step 3: Add real-file assertions** for no blank physical lines, no line over 255 code points, normalized `NAME` when a child `SURN` exists, and no `TYPE maiden/adopted` under `NAME`; verify they fail.
- [ ] **Step 4: Extend the normalizer** to remove blanks, rewrite names from `GIVN/SURN`, replace name `TYPE` with `_TYPE`, and wrap long values using `CONC`.
- [ ] **Step 5: Run the normalizer twice** and verify the second run produces no diff.
- [ ] **Step 6: Run parser and audit tests** and compare person/family/source counts before and after normalization.

### Task 5: Full verification and publication

**Files:**
- Modify if needed: `docs/indexing-log.md` only when the migration changes source identifiers referenced there.

**Interfaces:**
- Consumes all prior tasks; produces a verified Git commit.

- [ ] **Step 1: Run `npm run validate:gedcom`** and require zero errors.
- [ ] **Step 2: Run `npm test`**, require all tests passing.
- [ ] **Step 3: Run `npm run check`**, require zero errors.
- [ ] **Step 4: Run `npm run build`**, require exit code 0; report any warnings separately.
- [ ] **Step 5: Run `git diff --check` and review `git diff --stat`**.
- [ ] **Step 6: Stage only the files in this plan, commit tersely, and push `codex/standardize-source-cards`**.
