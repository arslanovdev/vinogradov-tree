export type GedcomAuditSeverity = 'error' | 'warning';

export type GedcomAuditCode =
  | 'SYNTAX'
  | 'BLANK_LINE'
  | 'LONG_LINE'
  | 'LEVEL_JUMP'
  | 'DUPLICATE_XREF'
  | 'DANGLING_PERSON'
  | 'DANGLING_FAMILY'
  | 'DANGLING_SOURCE'
  | 'ASYMMETRIC_FAMC'
  | 'ASYMMETRIC_FAMS'
  | 'ASYMMETRIC_CHILD'
  | 'ASYMMETRIC_SPOUSE'
  | 'INCOMPLETE_MAP'
  | 'MISSING_MEDIA'
  | 'LITERAL_SOURCE'
  | 'MISSING_CONF'
  | 'INVALID_CONF'
  | 'NONCANONICAL_NAME'
  | 'NONSTANDARD_NAME_TYPE'
  | 'SOURCE_WITHOUT_TITLE'
  | 'ANCESTRY_CYCLE';

export interface GedcomAuditIssue {
  severity: GedcomAuditSeverity;
  code: GedcomAuditCode;
  line: number;
  message: string;
}

export interface GedcomAuditOptions {
  mediaFiles?: ReadonlySet<string>;
  maxLineLength?: number;
}

export interface GedcomAuditResult {
  issues: GedcomAuditIssue[];
  counts: {
    lines: number;
    individuals: number;
    families: number;
    sources: number;
  };
}

interface AuditLine {
  line: number;
  level: number;
  xref: string | null;
  tag: string;
  value: string;
  parent: AuditLine | null;
  children: AuditLine[];
  record: AuditLine;
}

const LINE_RE = /^(\d+) (?:(@[^@\s]+@) )?([A-Z0-9_]+)(?: (.*))?$/;

function direct(node: AuditLine, tag: string): AuditLine[] {
  return node.children.filter((child) => child.tag === tag);
}

function first(node: AuditLine | undefined, tag: string): AuditLine | undefined {
  return node ? direct(node, tag)[0] : undefined;
}

export function auditGedcom(text: string, options: GedcomAuditOptions = {}): GedcomAuditResult {
  const maxLineLength = options.maxLineLength ?? 255;
  const issues: GedcomAuditIssue[] = [];
  const physical = text.split(/\r?\n/);
  const nodes: AuditLine[] = [];
  const records: AuditLine[] = [];
  const stack: AuditLine[] = [];
  const byId = new Map<string, AuditLine>();

  const report = (severity: GedcomAuditSeverity, code: GedcomAuditCode, line: number, message: string) => {
    issues.push({ severity, code, line, message });
  };

  for (let index = 0; index < physical.length; index++) {
    const raw = physical[index];
    const line = index + 1;
    if (raw === '' && index === physical.length - 1) continue;
    if (raw === '') {
      report('warning', 'BLANK_LINE', line, 'Пустая физическая строка не входит в структуру GEDCOM.');
      continue;
    }
    if ([...raw].length > maxLineLength) {
      report('warning', 'LONG_LINE', line, `Строка длиннее ${maxLineLength} символов.`);
    }
    const match = raw.match(LINE_RE);
    if (!match) {
      report('error', 'SYNTAX', line, 'Строка не соответствует формату level/xref/tag/value.');
      continue;
    }

    const level = Number(match[1]);
    const xref = match[2] ?? null;
    const tag = match[3];
    const value = match[4] ?? '';
    const previous = nodes[nodes.length - 1];
    if (previous && level > previous.level + 1) {
      report('error', 'LEVEL_JUMP', line, `Переход уровня ${previous.level} → ${level}.`);
    }

    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    const parent = stack[stack.length - 1] ?? null;
    const node = {
      line,
      level,
      xref,
      tag,
      value,
      parent,
      children: [],
      record: undefined as unknown as AuditLine,
    };
    if (parent) parent.children.push(node);
    if (level === 0) {
      node.record = node;
      records.push(node);
      if (xref) {
        if (byId.has(xref)) report('error', 'DUPLICATE_XREF', line, `Повторный идентификатор ${xref}.`);
        else byId.set(xref, node);
      }
    } else if (parent) {
      node.record = parent.record;
    } else {
      node.record = node;
      report('error', 'SYNTAX', line, 'Строка ненулевого уровня находится вне записи.');
    }
    nodes.push(node);
    stack.push(node);
  }

  const individuals = records.filter((record) => record.tag === 'INDI');
  const families = records.filter((record) => record.tag === 'FAM');
  const sources = records.filter((record) => record.tag === 'SOUR');
  const peopleById = new Map(individuals.filter((record) => record.xref).map((record) => [record.xref!, record]));
  const familiesById = new Map(families.filter((record) => record.xref).map((record) => [record.xref!, record]));

  for (const node of nodes) {
    if (node.tag === 'SOUR' && /^@[^@\s]+@$/.test(node.value)) {
      const target = byId.get(node.value);
      if (!target || target.tag !== 'SOUR') {
        report('error', 'DANGLING_SOURCE', node.line, `Источник ${node.value} не найден.`);
      }
    }
    if (['HUSB', 'WIFE', 'CHIL'].includes(node.tag)) {
      const target = byId.get(node.value);
      if (!target || target.tag !== 'INDI') {
        report('error', 'DANGLING_PERSON', node.line, `Персона ${node.value} не найдена.`);
      }
    }
    if (node.tag === 'FAMC' || node.tag === 'FAMS') {
      const target = byId.get(node.value);
      if (!target || target.tag !== 'FAM') {
        report('error', 'DANGLING_FAMILY', node.line, `Семья ${node.value} не найдена.`);
      }
    }
    if (node.tag === 'MAP') {
      const latitudes = direct(node, 'LATI');
      const longitudes = direct(node, 'LONG');
      if (latitudes.length !== 1 || longitudes.length !== 1) {
        report('error', 'INCOMPLETE_MAP', node.line, 'MAP должен содержать ровно один LATI и один LONG.');
      }
    }
    if (node.tag === 'FILE' && options.mediaFiles && !options.mediaFiles.has(node.value)) {
      report('error', 'MISSING_MEDIA', node.line, `Файл ${node.value} отсутствует.`);
    }
    if (node.tag === 'SOUR' && node.level === 1 && ['INDI', 'FAM'].includes(node.record.tag) && !node.value.startsWith('@')) {
      report('warning', 'LITERAL_SOURCE', node.line, 'Источник записи должен ссылаться на структурный @Sxx@ SOUR.');
    }
    if (node.tag === 'TYPE' && node.parent?.tag === 'NAME' && /^(maiden|adopted)$/i.test(node.value)) {
      report('warning', 'NONSTANDARD_NAME_TYPE', node.line, 'Для пользовательского типа имени нужен тег _TYPE.');
    }
  }

  for (const source of sources) {
    if (direct(source, 'TITL').length !== 1) {
      report('error', 'SOURCE_WITHOUT_TITLE', source.line, `${source.xref ?? 'SOUR'} должен иметь один TITL.`);
    }
  }

  for (const person of individuals) {
    const confidence = direct(person, '_CONF');
    if (confidence.length === 0) {
      report('warning', 'MISSING_CONF', person.line, `${person.xref ?? 'INDI'} не имеет _CONF.`);
    } else if (confidence.length !== 1 || !/^[ABC]$/.test(confidence[0].value)) {
      report('error', 'INVALID_CONF', confidence[0].line, `${person.xref ?? 'INDI'} должен иметь ровно один _CONF A|B|C.`);
    }

    for (const name of direct(person, 'NAME')) {
      const surname = first(name, 'SURN')?.value;
      if (surname && !name.value.includes(`/${surname}/`)) {
        report('warning', 'NONCANONICAL_NAME', name.line, `Фамилия ${surname} не выделена косыми чертами в NAME.`);
      }
    }

    for (const famc of direct(person, 'FAMC')) {
      const family = familiesById.get(famc.value);
      if (family && !direct(family, 'CHIL').some((child) => child.value === person.xref)) {
        report('error', 'ASYMMETRIC_FAMC', famc.line, `${person.xref} ссылается на ${famc.value}, но не записан как CHIL.`);
      }
    }
    for (const fams of direct(person, 'FAMS')) {
      const family = familiesById.get(fams.value);
      if (family && ![...direct(family, 'HUSB'), ...direct(family, 'WIFE')].some((spouse) => spouse.value === person.xref)) {
        report('error', 'ASYMMETRIC_FAMS', fams.line, `${person.xref} ссылается на ${fams.value}, но не записан как супруг.`);
      }
    }
  }

  for (const family of families) {
    for (const child of direct(family, 'CHIL')) {
      const person = peopleById.get(child.value);
      if (person && !direct(person, 'FAMC').some((famc) => famc.value === family.xref)) {
        report('error', 'ASYMMETRIC_CHILD', child.line, `${family.xref} содержит ${child.value}, но у персоны нет обратного FAMC.`);
      }
    }
    for (const spouse of [...direct(family, 'HUSB'), ...direct(family, 'WIFE')]) {
      const person = peopleById.get(spouse.value);
      if (person && !direct(person, 'FAMS').some((fams) => fams.value === family.xref)) {
        report('error', 'ASYMMETRIC_SPOUSE', spouse.line, `${family.xref} содержит ${spouse.value}, но у персоны нет обратного FAMS.`);
      }
    }
  }

  const parents = new Map<string, string[]>();
  for (const person of individuals) {
    const values: string[] = [];
    for (const famc of direct(person, 'FAMC')) {
      const family = familiesById.get(famc.value);
      if (family) values.push(...[...direct(family, 'HUSB'), ...direct(family, 'WIFE')].map((node) => node.value));
    }
    if (person.xref) parents.set(person.xref, values);
  }
  for (const person of individuals) {
    if (!person.xref) continue;
    const path = new Set<string>();
    const hasCycle = (id: string): boolean => {
      if (path.has(id)) return id === person.xref;
      path.add(id);
      const found = (parents.get(id) ?? []).some(hasCycle);
      path.delete(id);
      return found;
    };
    if (hasCycle(person.xref)) {
      report('error', 'ANCESTRY_CYCLE', person.line, `Цикл предков возвращается к ${person.xref}.`);
    }
  }

  issues.sort((a, b) => a.line - b.line || a.code.localeCompare(b.code));
  return {
    issues,
    counts: {
      lines: physical.length,
      individuals: individuals.length,
      families: families.length,
      sources: sources.length,
    },
  };
}
