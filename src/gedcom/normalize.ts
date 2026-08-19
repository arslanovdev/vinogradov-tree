function sourceAbbreviation(title: string): string {
  const withoutUrl = title.replace(/\s*https?:\/\/\S.*$/u, '').trim();
  const identity = withoutUrl.split(/\s+[—–]\s+/u, 1)[0].trim();
  return [...(identity || withoutUrl || title)].slice(0, 120).join('');
}

const MAX_PHYSICAL_LINE_LENGTH = 255;

function foldConcLines(lines: string[]): string[] {
  const result: string[] = [];
  const lastIndexByLevel: Array<number | undefined> = [];

  for (const line of lines) {
    const match = line.match(/^(\d+) (?:(@[^@\s]+@) )?([A-Z0-9_]+)(?: (.*))?$/);
    if (!match) {
      result.push(line);
      continue;
    }

    const level = Number(match[1]);
    if (match[3] === 'CONC' && level > 0) {
      const parentIndex = lastIndexByLevel[level - 1];
      if (parentIndex !== undefined) {
        const separator = /^(\d+) (?:(@[^@\s]+@) )?([A-Z0-9_]+) /.test(result[parentIndex]) ? '' : ' ';
        result[parentIndex] += separator + (match[4] ?? '');
        lastIndexByLevel[level] = parentIndex;
        lastIndexByLevel.length = level + 1;
        continue;
      }
    }

    result.push(line);
    lastIndexByLevel[level] = result.length - 1;
    lastIndexByLevel.length = level + 1;
  }

  return result;
}

function normalizeNameBlocks(lines: string[]): void {
  for (let index = 0; index < lines.length; index++) {
    if (!/^1 NAME(?: |$)/.test(lines[index])) continue;

    let surname: string | undefined;
    let given: string | undefined;
    let end = index + 1;
    for (; end < lines.length; end++) {
      const level = Number(lines[end].match(/^(\d+) /)?.[1] ?? 0);
      if (level <= 1) break;
      if (level !== 2) continue;

      const surnameMatch = lines[end].match(/^2 SURN (.*)$/);
      const givenMatch = lines[end].match(/^2 GIVN (.*)$/);
      if (surnameMatch) surname = surnameMatch[1];
      if (givenMatch) given = givenMatch[1];
      if (/^2 TYPE (maiden|adopted)$/i.test(lines[end])) {
        lines[end] = lines[end].replace(/^2 TYPE /, '2 _TYPE ');
      }
    }

    if (surname && given && !lines[index].includes(`/${surname}/`)) {
      lines[index] = `1 NAME ${given} /${surname}/`;
    }
    index = end - 1;
  }
}

function wrapLongLine(line: string, maxLength = MAX_PHYSICAL_LINE_LENGTH): string[] {
  if ([...line].length <= maxLength) return [line];

  const match = line.match(/^(\d+) (?:(@[^@\s]+@) )?([A-Z0-9_]+) (.*)$/);
  if (!match) return [line];

  const level = Number(match[1]);
  const prefix = `${level} ${match[2] ? `${match[2]} ` : ''}${match[3]} `;
  const continuationPrefix = `${level + 1} CONC `;
  const value = [...match[4]];
  const firstCapacity = maxLength - [...prefix].length;
  const continuationCapacity = maxLength - [...continuationPrefix].length;
  if (firstCapacity <= 0 || continuationCapacity <= 0) return [line];

  const takeChunk = (capacity: number): string => {
    const chunk = value.splice(0, capacity);
    if (value.length > 0) {
      let boundary = chunk.length;
      while (boundary > 0 && /\s/u.test(chunk[boundary - 1])) boundary--;
      if (boundary > 0 && boundary < chunk.length) {
        value.unshift(...chunk.splice(boundary));
      }
    }
    return chunk.join('');
  };

  const result = [`${prefix}${takeChunk(firstCapacity)}`];
  while (value.length > 0) {
    result.push(`${continuationPrefix}${takeChunk(continuationCapacity)}`);
  }
  return result;
}

/** Идемпотентные механические преобразования, не создающие новых генеалогических фактов. */
export function normalizeGedcom(text: string): string {
  const hadFinalNewline = /\r?\n$/.test(text);
  const lines = foldConcLines(text.split(/\r?\n/).filter((line) => line !== ''));

  let maxSourceId = 0;
  for (const line of lines) {
    const match = line.match(/^0 @S(\d+)@ SOUR$/);
    if (match) maxSourceId = Math.max(maxSourceId, Number(match[1]));
  }

  const newSources = new Map<string, string>();
  let recordType = '';
  const normalized = lines.map((line) => {
    const record = line.match(/^0 (?:@[^@\s]+@ )?([A-Z0-9_]+)(?: .*)?$/);
    if (record) recordType = record[1];
    const literal = line.match(/^1 SOUR (?!@)(.+)$/);
    if (!literal || !['INDI', 'FAM'].includes(recordType)) return line;

    const title = literal[1];
    let id = newSources.get(title);
    if (!id) {
      id = `@S${++maxSourceId}@`;
      newSources.set(title, id);
    }
    return `1 SOUR ${id}`;
  });

  if (newSources.size > 0) {
    const trailerIndex = normalized.findIndex((line) => line === '0 TRLR');
    const insertion = [...newSources].flatMap(([title, id]) => [
      `0 ${id} SOUR`,
      `1 TITL ${title}`,
      `1 ABBR ${sourceAbbreviation(title)}`,
    ]);
    normalized.splice(trailerIndex >= 0 ? trailerIndex : normalized.length, 0, ...insertion);
  }

  normalizeNameBlocks(normalized);
  const wrapped = normalized.flatMap((line) => wrapLongLine(line));

  return wrapped.join('\n') + (hadFinalNewline ? '\n' : '');
}
