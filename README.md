# Генеалогическое древо семьи Виноградовых

Интерактивное древо: Фёдоровский район, Башкортостан. Точка отсчёта — Виноградова Надежда Дмитриевна.

**Сайт:** https://arslanovdev.github.io/vinogradov-tree/

## Стек
- **Vite + Svelte 5 + TypeScript** — приложение.
- **MapLibre GL** — карта рода (грузится лениво, только при открытии).
- **GitHub Actions** — сборка и публикация на Pages при каждом push в `main`.
- **Vitest** — тесты на парсер/раскладку/достоверность.

## Данные — источник правды
`public/fedorovka_family.ged` (GEDCOM 5.5.1). Всё древо и карта строятся из него.
Фото и сканы — в `public/photos/`.

## Как обновить древо
1. Отредактируй `public/fedorovka_family.ged` (можно прямо в веб-интерфейсе GitHub).
2. Коммит + push в `main`.
3. GitHub Actions сам соберёт и опубликует (~1–2 мин). Код трогать не нужно.

```bash
git add public/fedorovka_family.ged && git commit -m "обновление данных" && git push
```

## Разработка
```bash
npm install
npm run dev      # дев-сервер (HMR)
npm run build    # сборка в dist/ (tsc + vite)
npm test         # vitest
```

## Структура
```
src/
  gedcom/   types.ts, parse.ts        — типы + парсер GEDCOM + валидация
  model/    derive.ts, layout.ts,     — родство, достоверность, форматирование;
            detail.ts, places.ts        раскладка дерева; досье; узлы карты
  lib/      App.svelte, Tree.svelte,  — оркестрация, дерево (pan/zoom),
            Detail.svelte, MapView.svelte  карточка-досье, карта
tests/      model.test.ts
```

## Конвенции GEDCOM (понимает приложение)
- Достоверность: `_CONF A|B|C` → `QUAY 0–3` → `[ТОЧНОСТЬ A]` в заметке.
- `_TODO …` или заметка `[ИСКАТЬ] …` → секция «Что искать дальше».
- `RELI …` → факт «Вероисповедание».
- `[ФАМИЛИЯ РЕТРО]` в заметке → дофамильный предок (имя+отчество, фамилия скрыта).
- `OBJE / FILE photos/x.jpg` → фото/скан на карточке.
- Источники со слагами `person-hero…`/`…nagrazhdenie…`/`…donesenie…` → кликабельные ссылки на «Память народа».
