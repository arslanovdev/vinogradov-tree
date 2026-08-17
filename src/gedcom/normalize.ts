function sourceAbbreviation(title: string): string {
  const withoutUrl = title.replace(/\s*https?:\/\/\S.*$/u, '').trim();
  const identity = withoutUrl.split(/\s+[—–]\s+/u, 1)[0].trim();
  return [...(identity || withoutUrl || title)].slice(0, 120).join('');
}

/** Идемпотентные механические преобразования, не создающие новых генеалогических фактов. */
export function normalizeGedcom(text: string): string {
  const hadFinalNewline = /\r?\n$/.test(text);
  const lines = text.split(/\r?\n/);
  if (hadFinalNewline && lines.at(-1) === '') lines.pop();

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

  return normalized.join('\n') + (hadFinalNewline ? '\n' : '');
}
