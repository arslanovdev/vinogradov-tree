import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditGedcom } from '../src/gedcom/audit';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const publicDir = join(root, 'public');
const gedcomPath = join(publicDir, 'fedorovka_family.ged');

function collectFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(absolute));
    else if (entry.isFile()) files.push(relative(publicDir, absolute).split(sep).join('/'));
  }
  return files;
}

const text = readFileSync(gedcomPath, 'utf8');
const result = auditGedcom(text, { mediaFiles: new Set(collectFiles(publicDir)) });

for (const issue of result.issues) {
  console.error(`${issue.severity.toUpperCase()} ${issue.code} line ${issue.line}: ${issue.message}`);
}

console.log(
  `GEDCOM: ${result.counts.individuals} персон, ${result.counts.families} семей, ` +
  `${result.counts.sources} источников; проблем: ${result.issues.length}.`,
);

if (result.issues.length > 0) process.exitCode = 1;
