/**
 * Content validation. Runs inside `npm run build`, so a bad dataset must fail
 * the build rather than reach the bundle.
 *
 * Phase 1 covers what already exists: the RU/EN interface dictionaries. The
 * lexicon checks (unique ids, dedup, themes, translations, audio files, mode
 * eligibility) arrive in phase 3 together with the imported lexicon; until then
 * this script does not pretend to cover them.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const locales = join(root, 'src', 'i18n', 'locales');

type Node = { [key: string]: string | Node };

function readLocale(name: string): Node {
  const raw = readFileSync(join(locales, `${name}.json`), 'utf8');
  return JSON.parse(raw) as Node;
}

function flatten(node: Node, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else for (const [nested, text] of flatten(value, path)) out.set(nested, text);
  }
  return out;
}

/**
 * Keys whose ru and en values are identical by design: the brand name in
 * Armenian and the brand name in Russian are proper nouns, not untranslated
 * copy. Every entry needs a reason, because an empty list is what makes this
 * check trustworthy.
 */
const IDENTICAL_BY_DESIGN = new Set<string>([
  'home.eyebrow', // Թունջիկներ — the name itself
  'about.title', // Пружинки — the name itself
]);

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]!).sort();
}

const ru = flatten(readLocale('ru'));
const en = flatten(readLocale('en'));
const problems: string[] = [];

for (const [key] of ru) {
  if (!en.has(key)) problems.push(`нет перевода en: ${key}`);
}
for (const key of en.keys()) {
  if (!ru.has(key)) problems.push(`нет перевода ru: ${key}`);
}
for (const [key, ruValue] of ru) {
  const enValue = en.get(key);
  if (enValue === undefined) continue;
  if (!ruValue.trim()) problems.push(`пустая строка ru: ${key}`);
  if (!enValue.trim()) problems.push(`пустая строка en: ${key}`);
  if (ruValue === enValue && !IDENTICAL_BY_DESIGN.has(key)) problems.push(`ru совпадает с en: ${key}`);
  const ruSlots = placeholders(ruValue).join(',');
  const enSlots = placeholders(enValue).join(',');
  if (ruSlots !== enSlots) problems.push(`плейсхолдеры разошлись: ${key} (ru: ${ruSlots || '—'}, en: ${enSlots || '—'})`);
}

console.log(`ключей интерфейса: ${ru.size} ru / ${en.size} en`);
if (problems.length > 0) {
  for (const problem of problems) console.error(`  ошибка: ${problem}`);
  console.error(`validate:content — провалено проверок: ${problems.length}`);
  process.exit(1);
}
console.log('validate:content — проверки словаря появится вместе с импортом лексикона (фаза 3)');
console.log('validate:content — интерфейс ru/en в порядке');
