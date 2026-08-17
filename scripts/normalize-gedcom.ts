import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeGedcom } from '../src/gedcom/normalize';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const path = resolve(root, process.argv[2] ?? 'public/fedorovka_family.ged');
const before = readFileSync(path, 'utf8');
const after = normalizeGedcom(before);

if (before === after) {
  console.log(`GEDCOM уже нормализован: ${path}`);
} else {
  writeFileSync(path, after, 'utf8');
  console.log(`GEDCOM нормализован: ${path}`);
}
