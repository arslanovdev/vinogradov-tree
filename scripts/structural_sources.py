#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Конвертация текстовых SOUR-цитат GEDCOM в структурные записи @Sxx@ + PAGE.

Реестр повторяющихся документов (архивные дела, книги, базы) сопоставляется
с текстом каждой цитаты `1 SOUR <текст>`. Цитата заменяется на
`1 SOUR @Sxx@` (+ `2 PAGE <детали>`) на уровне записи, либо на
`2 SOUR @Sxx@` (+ `3 PAGE <детали>`) под событием BIRT/MARR/RESI, когда
привязка к факту однозначна. SOUR-записи добавляются перед `0 TRLR`.

Использование:
    python3 scripts/structural_sources.py            # dry-run отчёт
    python3 scripts/structural_sources.py --out P    # записать в P
    python3 scripts/structural_sources.py --write    # записать на место
"""

from __future__ import annotations

import re
import sys
from collections import Counter, defaultdict

GED_PATH = "public/fedorovka_family.ged"


def compile_entries():
    """(sid, match, title, abbr, strips) — strips: список regex, обрезающих идентификатор документа."""
    E = []

    def add(sid, match, title, abbr, *strips):
        E.append((sid, re.compile(match, re.I), title, abbr, [re.compile(s, re.I) for s in strips]))

    add("S1",
        r"РС\s*1834(?:\s+Кузьминовки)?\s*[,;]?\s*[—-]?\s*\(?(?:НА РБ[,.]?\s*)?ф?\.?\s*И-138[^\d]*оп\.\s*2[^\d]*д\.\s*532\b",
        "Ревизская сказка 1834, Фёдоровка и Кузьминовка — НА РБ, ф. И-138, оп. 2, д. 532",
        "РС 1834 (И-138-2-532)",
        r"РС\s*1834(?:\s+Кузьминовки)?\s*[,;]?\s*[—-]?\s*\(?(?:НА РБ[,.]?\s*)?ф?\.?\s*И-138[^\d]*оп\.\s*2[^\d]*д\.\s*532\s*\)?\s*[,;]?\s*")

    add("S2",
        r"РС\s*1850(?:\s+с\.\s*Фёдоровка)?\s*[,;]?\s*[—-]?\s*\(?(?:НА РБ[,.]?\s*)?ф?\.?\s*И-138[^\d]*оп\.\s*2[^\d]*д\.\s*654\b",
        "Ревизская сказка 1850, с. Фёдоровка — НА РБ, ф. И-138, оп. 2, д. 654",
        "РС 1850 (И-138-2-654)",
        r"РС\s*1850(?:\s+с\.\s*Фёдоровка)?\s*[,;]?\s*[—-]?\s*\(?(?:НА РБ[,.]?\s*)?ф?\.?\s*И-138[^\d]*оп\.\s*2[^\d]*д\.\s*654\s*\)?\s*[,;]?\s*")

    add("S3",
        r"РС\s*1795\s*[,;]?\s*[—-]?\s*\(?(?:НА РБ[,.]?\s*)?ф?\.?\s*И-138[^\d]*оп\.\s*2[^\d]*д\.\s*62\b",
        "Ревизская сказка 1795, Новая Алмантаева/Камышлыкулева — НА РБ, ф. И-138, оп. 2, д. 62",
        "РС 1795 (И-138-2-62)",
        r"РС\s*1795\s*[,;]?\s*[—-]?\s*\(?(?:НА РБ[,.]?\s*)?ф?\.?\s*И-138[^\d]*оп\.\s*2[^\d]*д\.\s*62\s*\)?\s*[,;]?\s*")

    add("S4",
        r"(?:НА РБ[,.]?\s*)?ф\.?\s*И-138[^\d]*оп\.\s*2[^\d]*д\.\s*56\b",
        "Причисление 52 душ мужского пола из д. Тумалей (Молчановки тож) — НА РБ, ф. И-138, оп. 2, д. 56",
        "И-138-2-56 (переселение 1807)",
        r"(?:НА РБ[,.]?\s*)?ф\.?\s*И-138[^\d]*оп\.\s*2[^\d]*д\.\s*56\s*[,;]?\s*")

    add("S5",
        r"(?:НА РБ[,.]?\s*)?ф\.?\s*И-138[^\d]*оп\.\s*2[^\d]*д\.\s*105\b",
        "Ревизская сказка 1811, д. Кузьминовка — НА РБ, ф. И-138, оп. 2, д. 105",
        "РС 1811 (И-138-2-105)",
        r"(?:НА РБ[,.]?\s*)?ф\.?\s*И-138[^\d]*оп\.\s*2[^\d]*д\.\s*105\s*[,;]?\s*")

    add("S6",
        r"РС\s*1816\s*/\s*1820(?:\s+и\s+РС\s*1850\s*/\s*1856)?(?:\s+Кузьминовки)?|И-138[^\d]*оп\.\s*2[^\d]*д\.\s*53\b",
        "Ревизская сказка 1816/1820, Кузьминовка — НА РБ, ф. И-138, оп. 2, д. 53 (Оренбургская казённая палата Оренбургской губ.)",
        "РС 1816/1820 (И-138-2-53)",
        r"РС\s*1816\s*/\s*1820\s*[—-]\s*(?:НА РБ[,.]?\s*)?ф\.?\s*И-138\s*[,]?\s*",
        r"РС\s*1816\s*/\s*1820(?:\s+и\s+РС\s*1850\s*/\s*1856)?\s*[,]?\s*Кузьминовк\w*\s*[,;]?\s*",
        r"(?:НА РБ[,.]?\s*)?ф\.?\s*И-138\s*[,]?\s*Оренбургская казённая палата Оренбургской губ\.(?:\s*\(1762–1867\))?\s*[—-]\s*РС\s*1816\s*/\s*1820(?:\s+и\s+РС\s*1850\s*/\s*1856)?\s*[,]?\s*Кузьминовк\w*\s*[,;]?\s*",
        r"РС\s*1816\s*/\s*1820(?:\s+Кузьминовки)?\s*[,]?\s*")

    add("S7",
        r"И-294[^\d]*оп\.\s*7[^\d]*д\.\s*1521\b",
        "Метрические книги прихода с. Фёдоровка, 1914–1915 — НА РБ, ф. И-294, оп. 7, д. 1521",
        "МК 1914–15 (И-294-7-1521)",
        r"(?:НА РБ[,.]?\s*ф\.?\s*)?И-294[^\d]*оп\.\s*7[^\d]*д\.\s*1521\s*[,;]?\s*")

    add("S8",
        r"И-294[^\d]*оп\.\s*7[^\d]*д\.\s*1522\b",
        "Метрическая книга прихода с. Фёдоровка, 1916–1919 — НА РБ, ф. И-294, оп. 7, д. 1522",
        "МК 1916–19 (И-294-7-1522)",
        r"(?:НА РБ[,.]?\s*ф\.?\s*)?И-294[^\d]*оп\.\s*7[^\d]*д\.\s*1522\s*[,;]?\s*")

    add("S9",
        r"И-294[^\d]*оп\.\s*3[^\d]*д\.\s*189\b",
        "Метрическая книга Христорождественской церкви с. Фёдоровка, 1880 — НА РБ, ф. И-294, оп. 3, д. 189",
        "МК 1880 (И-294-3-189)",
        r"(?:НА РБ[,.]?\s*ф\.?\s*)?И-294[^\d]*оп\.\s*3[^\d]*д\.\s*189\s*[,;]?\s*")

    add("S10",
        r"И-294[^\d]*оп\.\s*3[^\d]*д\.\s*201\b",
        "Метрическая книга Христорождественской церкви с. Фёдоровка, 1881 — НА РБ, ф. И-294, оп. 3, д. 201",
        "МК 1881 (И-294-3-201)",
        r"(?:НА РБ[,.]?\s*ф\.?\s*)?И-294[^\d]*оп\.\s*3[^\d]*д\.\s*201\s*[,;]?\s*")

    add("S11",
        r"И-294[^\d]*оп\.\s*1[^\d]*д\.\s*587\b",
        "Метрическая книга Христорождественской церкви с. Фёдоровка, 1857 — НА РБ, ф. И-294, оп. 1, д. 587",
        "МК 1857 (И-294-1-587)",
        r"(?:НА РБ[,.]?\s*ф\.?\s*)?И-294[^\d]*оп\.\s*1[^\d]*д\.\s*587\s*[,;]?\s*")

    add("S12",
        r"Метрики прихода с\. Фёдоровка, 1845–1849",
        "Метрики прихода с. Фёдоровка, 1845–1849 — индекс МК (НА РБ, ф. И-294)",
        "МК 1845–49 (И-294, индекс)",
        r"Метрики прихода с\. Фёдоровка, 1845–1849\s*(?:\(НА РБ[,.]?\s*ф\.?\s*И-294\))?\s*[—-]?\s*")

    add("S13",
        r"Метрическая книга прихода с\. Фёдоровка за 1878 год",
        "Метрическая книга прихода с. Фёдоровка за 1878 год",
        "МК 1878 (Фёдоровка)",
        r"Метрическая книга прихода с\. Фёдоровка за 1878 год\s*[,;]?\s*")

    add("S14",
        r"Р-472[^\d]*оп\.\s*1[^\d]*д\.\s*560\b",
        "Поселенный список переписи 1926, Фёдоровская вол. — НА РБ, ф. Р-472, оп. 1, д. 560",
        "Перепись 1926 (Р-472-1-560)",
        r"(?:НА РБ[,.]?\s*ф\.?\s*)?Р-472[^\d]*оп\.\s*1[^\d]*д\.\s*560\s*[—-]?\s*")

    add("S15",
        r"Р-473[^\d]*оп\.\s*1[^\d]*д\.\s*4496\b",
        "Подворная перепись 1917, Фёдоровка — НА РБ, ф. Р-473, оп. 1, д. 4496",
        "Перепись 1917 (Р-473-1-4496)",
        r"(?:НА РБ[,.]?\s*ф\.?\s*)?Р-473[^\d]*оп\.\s*1[^\d]*д\.\s*4496\s*[—-]?\s*")

    add("S16",
        r"Р-473[^\d]*оп\.\s*1[^\d]*д\.\s*3675\b",
        "Подворная перепись 1917, Талач-Мокшино — НА РБ, ф. Р-473, оп. 1, д. 3675",
        "Перепись 1917 (Р-473-1-3675)",
        r"(?:НА РБ[,.]?\s*ф\.?\s*)?Р-473[^\d]*оп\.\s*1[^\d]*д\.\s*3675\s*[—-]?\s*")

    add("S17",
        r"Р-473[^\d]*оп\.\s*1[^\d]*д\.\s*4488\b",
        "Подворная перепись 1917, Ивановка — НА РБ, ф. Р-473, оп. 1, д. 4488",
        "Перепись 1917 (Р-473-1-4488)",
        r"(?:НА РБ[,.]?\s*ф\.?\s*)?Р-473[^\d]*оп\.\s*1[^\d]*д\.\s*4488\s*[,]?\s*")

    add("S18",
        r"ЦГАРМ[^\d]*ф\.\s*26[^\d]*оп\.\s*1[^\d]*д\.\s*33\b",
        "Ревизская сказка 1811, с. Молчаново — ЦГАРМ, ф. 26, оп. 1, д. 33",
        "РС 1811 (ЦГАРМ-26-1-33)",
        r"РС\s*1811\s*[—-]?\s*ЦГАРМ[^\d]*ф\.\s*26[^\d]*оп\.\s*1[^\d]*д\.\s*33\s*[,;]?\s*")

    add("S19",
        r"ОГАОО[^\d]*ф\.\s*98[^\d]*оп\.\s*2[^\d]*д\.\s*5\b",
        "Книга учёта движения населения г. Оренбурга по сословиям, 1796–1801 — ОГАОО, ф. 98, оп. 2, д. 5",
        "ОГАОО-98-2-5",
        r"ОГАОО[^\d]*ф\.\s*98[^\d]*оп\.\s*2[^\d]*д\.\s*5\s*[,;]?\s*")

    add("S20",
        r"ф\.\s*103[^\d]*оп\.\s*1[^\d]*д\.\s*21\b",
        "Соглашение жителей Алмантаева/Камышлы о переселении, 10.01.1812 — НА РБ, ф. 103, оп. 1, д. 21",
        "НА РБ ф.103-1-21 (1812)",
        r"(?:НА РБ[,.]?\s*)?ф\.\s*103[^\d]*оп\.\s*1[^\d]*д\.\s*21\s*[,;]?\s*")

    add("S21",
        r"«Красная книга» жителей Фёдоровки",
        "А. М. Бекин, рукописная «Красная книга» жителей Фёдоровки",
        "Бекин, Красная книга",
        r"А\.\s*М\.\s*Бекин,\s*рукописная\s*«Красная книга» жителей Фёдоровки\s*[,;]?\s*")

    add("S22",
        r"«Они вернулись с Победой",
        "«Они вернулись с Победой. Списки военнослужащих, вернувшихся живыми с ВОВ 1941–1945 гг.», т. 11 (Уфа: Китап, 2004)",
        "Они вернулись с Победой, т. 11",
        r"«Они вернулись с Победой[^»]*»(?:,?\s*т\.\s*11(?:\s*\([^)]*\))?)?\s*[,;]?\s*")

    add("S23",
        r"«Герои тыла",
        "«Герои тыла. Списки тружеников, награждённых медалью \"За доблестный труд в ВОВ 1941–1945 гг.\"», т. 16 (Уфа: Китап, 2010)",
        "Герои тыла, т. 16",
        r"«Герои тыла[^»]*»(?:,?\s*т\.\s*16(?:\s*\([^)]*\))?)?\s*[,;]?\s*")

    add("S24",
        r"«МК Федоровки 1845-1857\.xlsx»",
        "Рабочая индексация «МК Федоровки 1845-1857.xlsx»",
        "Индексация МК 1845-1857.xlsx",
        r"Рабочая индексация\s*«МК Федоровки 1845-1857\.xlsx»\s*[,;]?\s*")

    add("S25",
        r"«МК Федоровки 1845-149\.xlsx»",
        "Рабочая индексация «МК Федоровки 1845-149.xlsx»",
        "Индексация МК 1845-149.xlsx",
        r"Рабочая индексация\s*«МК Федоровки 1845-149\.xlsx»\s*[,;]?\s*")

    add("S26",
        r"Асфандияров",
        "Асфандияров А. З. «История сёл и деревень Башкортостана и сопредельных территорий», Уфа, 2009",
        "Асфандияров, 2009",
        r"Асфандияров[^—-]*?[—-]\s*")

    add("S27",
        r"Кийков",
        "Кийков А. «К истории семьи и брака у башкир, татар, мордвы и чуваш» // Башкирский краеведческий сборник, 1927, № 2",
        "Кийков, 1927",
        r"Кийков[^—-]*?[—-]\s*")

    add("S28",
        r"Таблица путей переселения по номерам семей РС 1850",
        "Таблица путей переселения по номерам семей РС 1850",
        "Таблица путей РС 1850",
        r"Таблица путей переселения по номерам семей РС 1850\s*[,;:]?\s*")

    add("S29",
        r"«Освобождение Беларуси\. 1943–1944»",
        "«Освобождение Беларуси. 1943–1944» (Минск: Беларуская навука, 2014)",
        "Освобождение Беларуси, 2014",
        r"«Освобождение Беларуси[^»]*»[^;.]*?\s*[,;]?\s*")

    add("S30",
        r"МБСУ «Ритуал» г\. Салавата",
        "МБСУ «Ритуал» г. Салавата — карточки захоронений",
        "МБСУ Ритуал, Салават",
        r"МБСУ «Ритуал» г\. Салавата,\s*")

    add("S31",
        r"«Подвиг народа»",
        "«Подвиг народа» — электронный банк наградных документов (podvignaroda.ru)",
        "Подвиг народа",
        r"«Подвиг народа»,\s*")

    add("S32",
        r"Familio.*?familio\.org/persons/",
        "Familio — генеалогическая база, профили персон (familio.org/persons/)",
        "Familio (профили)",
        r"Familio(?:\s*\([^)]*\))?\s*[—-]?\s*")

    add("S33",
        r"rsfedorovkamordva1795",
        "Familio — каталог rsfedorovkamordva1795, ревизские сказки Фёдоровки (familio.org/catalogs/)",
        "Familio (rsfedorovkamordva1795)",
        r"Familio(?:\s*\([^)]*\))?\s*rsfedorovkamordva1795\s*[—-]?\s*",
        r"Familio,\s*")

    add("S34",
        r"«Память народа»|pamyat-naroda",
        "«Память народа» — электронный банк документов (pamyat-naroda.ru)",
        "Память народа",
        r"«Память народа»,\s*",
        r"pamyat-naroda\.ru\s*[—-]?\s*")

    add("S35",
        r"ОБД «Мемориал»|obd-memorial",
        "ОБД «Мемориал» — обобщённый банк данных (obd-memorial.ru)",
        "ОБД Мемориал",
        r"ОБД\s*«Мемориал»,\s*")

    add("S36",
        r"Указатель фамилий РС 1850",
        "Указатель фамилий РС 1850 (рабочий справочник по семьям)",
        "Указатель фамилий РС 1850",
        r"Указатель фамилий РС 1850\s*[,;:]?\s*")

    return E


REGISTRY = compile_entries()

# Порядок проверки: рабочие индексации раньше архивных дел (в тексте xlsx встречаются
# «Реквизиты: НА РБ, ф. И-294, оп. 1, д. 587»), РС-дела раньше каталога Familio.
CHECK_ORDER = [
    "S24", "S25",
    "S1", "S2", "S3", "S4", "S5", "S6",
    "S7", "S8", "S9", "S10", "S11", "S12", "S13",
    "S14", "S15", "S16", "S17",
    "S18", "S19", "S20", "S21",
    "S22", "S23", "S26", "S27", "S28", "S36", "S29",
    "S30", "S31", "S32", "S33", "S34", "S35",
]

REGISTRY_BY_ID = {entry[0]: entry for entry in REGISTRY}


def extract_page(text: str, sid: str) -> str:
    for e_sid, _match, _title, _abbr, strips in REGISTRY:
        if e_sid != sid:
            continue
        for pat in strips:
            m = pat.search(text)
            if m:
                rest = text[: m.start()] + text[m.end():]
                return re.sub(r"^\s*[;:,\s—-]+\s*", "", rest).strip()
    # Запасной вариант: убрать саму цитату целиком не выйдет, поэтому возвращаем весь текст.
    return text.strip()


def match_registry(text: str):
    for sid in CHECK_ORDER:
        match = REGISTRY_BY_ID[sid][1]
        if match.search(text):
            return sid
    return None


def parse_records(lines):
    records = []
    cur = None
    for ln in lines:
        m = re.match(r"^0 (?:@([^@]+)@ )?(\S+)(?: (.*))?$", ln)
        if m:
            if cur:
                records.append(cur)
            cur = [m.group(1), m.group(2), m.group(3) or "", []]
        cur[3].append(ln.rstrip("\n"))
    if cur:
        records.append(cur)
    return records


EVENT_TAGS = {"BIRT", "CHR", "DEAT", "BURI", "RESI", "EVEN", "MARR", "OCCU", "OBJE"}
BIRTH_MARKER = re.compile(r"рожд(?:ён|ен|ена|ённ|илас|ился|илась)?\b|рождени\w*|родилс\w*|\bр\.\s*\d", re.I)
ROLE_MARKER = re.compile(r"восприемник|воспреемник|поручител|крёстн|крестн", re.I)
MARRIED_CLAUSE = re.compile(r"браком|жених|невеста", re.I)
MARRIAGE_MARKER = re.compile(r"брак\w*|венчан\w*|жених|невеста|поручител", re.I)
SUBJECT_MARKERS = re.compile(r"(?:запись\s*№\s*\d+[^:;]{0,25}:|№\s*\d+\s*[жм]\.п\.\s*[;:,]|строка\s*\d+\s*:)", re.I)


def given_first(name: str) -> str:
    m = re.match(r"([А-ЯЁа-яё]+)", name or "")
    return (m.group(1) if m else "").lower()


def birth_matches_person(text: str, givn: str) -> bool:
    """Цитата — запись о собственном рождении персоны?"""
    first = given_first(givn)
    if not first or not BIRTH_MARKER.search(text):
        return False
    # Клауза субъекта: текст после маркера записи до первой точки с запятой.
    m = SUBJECT_MARKERS.search(text)
    clause = text[m.end():] if m else text
    clause = re.split(r";", clause, maxsplit=1)[0]
    if ROLE_MARKER.search(clause) or MARRIED_CLAUSE.search(clause):
        return False
    # Точное слово с именем персоны, либо конструкция «рождении <имя>» (родительный падеж).
    if re.search(r"(?<![А-ЯЁа-яё])" + re.escape(first) + r"(?![А-ЯЁа-яё])", text, re.I):
        return True
    stem = first[: max(4, len(first) - 1)]
    if re.search(r"рождени\w*\s+" + re.escape(stem), text, re.I):
        return True
    return False


def census_year(text: str):
    m = re.search(r"\b(1917|1926)\b", text)
    return m.group(1) if m else None


def block_date_year(block_lines):
    for ln in block_lines:
        m = re.match(r"^2 DATE .*(\b19\d\d\b)", ln)
        if m:
            return m.group(1)
    return None


def convert(records):
    stats = Counter()
    unmatched = []
    new_sour_records = []

    for rec in records:
        xref, typ, _val, lines = rec
        if typ not in ("INDI", "FAM"):
            continue

        givn = ""
        for ln in lines:
            m = re.match(r"^2 GIVN (.*)$", ln)
            if m:
                givn = m.group(1)

        # Индексы строк, открывающих событийные блоки (уровень 1) с их границами.
        block_bounds = []
        for i, ln in enumerate(lines):
            m = re.match(r"^1 ([A-Z_]+)(?: (.*))?$", ln)
            if m and m.group(1) in EVENT_TAGS:
                block_bounds.append((i, m.group(1)))
        block_end = {i: (block_bounds[j + 1][0] if j + 1 < len(block_bounds) else len(lines)) for j, (i, _) in enumerate(block_bounds)}
        tag_at = {i: tag for i, tag in block_bounds}

        birt_idx = next((i for i, t in block_bounds if t == "BIRT"), None)
        marr_idx = next((i for i, t in block_bounds if t == "MARR"), None)
        resi_idx = {y: i for i, t in block_bounds if t == "RESI" for y in [block_date_year(lines[i:block_end[i]])] if y}

        record_citations = []          # (sid, page)
        event_citations = defaultdict(list)  # block_idx -> [(sid, page)]
        note_citations = []            # (sid, page) из заметок-источников
        kept = []
        removed_note = False

        i = 0
        while i < len(lines):
            ln = lines[i]
            m = re.match(r"^1 SOUR (.*)$", ln)
            if m:
                text = m.group(1)
                sid = match_registry(text)
                if sid is None:
                    unmatched.append((xref, text))
                    kept.append(ln)
                    i += 1
                    continue
                page = extract_page(text, sid)
                stats["matched_total"] += 1
                stats["by_source:" + sid] += 1
                placed = False
                # Брачная цитата на FAM-записи с событием MARR относится к браку супружеской пары.
                if typ == "FAM" and marr_idx is not None and MARRIAGE_MARKER.search(text):
                    event_citations[marr_idx].append((sid, page))
                    stats["placed:MARR"] += 1
                    placed = True
                elif typ == "INDI" and birth_matches_person(text, givn) and birt_idx is not None:
                    event_citations[birt_idx].append((sid, page))
                    stats["placed:BIRT"] += 1
                    placed = True
                elif typ == "INDI":
                    y = census_year(text)
                    if y and y in resi_idx:
                        event_citations[resi_idx[y]].append((sid, page))
                        stats["placed:RESI"] += 1
                        placed = True
                if not placed:
                    record_citations.append((sid, page))
                    stats["placed:record"] += 1
                i += 1
                continue
            m = re.match(r"^1 NOTE (.*)$", ln)
            if m and re.match(r"^Источник по РС 1816/1820 и переезду в Кузьминовку:", m.group(1)):
                rest = m.group(1).split(":", 1)[1].strip()
                note_citations.append(("S6", rest))
                removed_note = True
                stats["note_converted"] += 1
                i += 1
                continue
            kept.append(ln)
            i += 1

        # Собираем новый список строк записи.
        out = []
        consumed_blocks = set()
        for j, ln in enumerate(kept):
            out.append(ln)
            if j in tag_at and tag_at[j] in ("BIRT", "MARR", "RESI"):
                if j in event_citations and j not in consumed_blocks:
                    consumed_blocks.add(j)
                    for sid, page in event_citations[j]:
                        out.append("2 SOUR @" + sid + "@")
                        if page:
                            out.append("3 PAGE " + page)
        for sid, page in note_citations + record_citations:
            out.append("1 SOUR @" + sid + "@")
            if page:
                out.append("2 PAGE " + page)
        for sid, page in event_citations.get("orphan", []):
            out.append("1 SOUR @" + sid + "@")
            if page:
                out.append("2 PAGE " + page)
        rec[3] = out

    # Уникальные S-номера из фактически использованных.
    used = set()
    for rec in records:
        for ln in rec[3]:
            m = re.search(r"SOUR @(S\d+)@", ln)
            if m:
                used.add(m.group(1))
    for sid, _match, title, abbr, _strips in REGISTRY:
        if sid in used:
            new_sour_records.append(["0 @" + sid + "@ SOUR", "1 TITL " + title, "1 ABBR " + abbr])

    return records, stats, unmatched, new_sour_records


def render(records, new_sour_records):
    out = []
    for rec in records:
        if rec[1] == "TRLR":
            continue  # TRLR выводится один раз в конце, после SOUR-записей
        out.extend(rec[3])
    for rec in new_sour_records:
        out.extend(rec)
    out.append("0 TRLR")
    return "\n".join(out) + "\n"


def main():
    out_path = None
    args = sys.argv[1:]
    if "--write" in args:
        out_path = GED_PATH
    elif "--out" in args:
        out_path = args[args.index("--out") + 1]

    lines = open(GED_PATH, encoding="utf-8").read().splitlines()
    records = parse_records(lines)
    records, stats, unmatched, new_sour_records = convert(records)

    print("== Конвертация текстовых SOUR в структурные записи ==")
    print("Совпало цитат (всего):", stats["matched_total"])
    print("Привязка: BIRT =", stats["placed:BIRT"], "| MARR =", stats["placed:MARR"],
          "| RESI =", stats["placed:RESI"], "| уровень записи =", stats["placed:record"])
    print("Заметок-источников заменено:", stats["note_converted"])
    print("SOUR-записей создано:", len(new_sour_records))
    print("\nПо документам:")
    for sid, _m, title, _a, _s in REGISTRY:
        c = stats["by_source:" + sid]
        if c:
            print(f"  {sid}: {c:3d}  {title}")
    print("\nНе распознано цитат (остаются текстовыми):", len(unmatched))
    for xref, text in unmatched:
        print("  ", xref, "::", text[:120])

    if out_path:
        rendered = render(records, new_sour_records)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(rendered)
        print("\nЗаписано:", out_path)


if __name__ == "__main__":
    main()
