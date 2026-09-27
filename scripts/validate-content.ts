/**
 * Content validation. Runs inside `npm run build`, so a bad dataset must fail
 * the build rather than reach the bundle.
 *
 * The rules below repeat what `src/content/*.test.ts` asserts. The duplication
 * is deliberate: the tests and this gate are separate code paths, so a mistake
 * in one does not hide a defect in the other. What each is for:
 *
 * - the tests say what the registry should be and where the logic is wrong;
 * - this gate says whether the repository may be built at all.
 *
 * Phase 3 covers the registry, the decks, the audio and the interface. Anything
 * that needs the progress store or a game engine cannot be checked here yet, and
 * the script says so instead of pretending to.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_NUMBER_IDS, numberToArmenian, numberValue } from '../src/content/numbers';
import { ACTIVE_ENTRIES, ALL_ENTRIES, AUDIO, normalizeText, THEMES } from '../src/content/lexicon';
import { DECKS, excludedThemes } from '../src/content/decks';
import { availableModes, HUB_MODE_IDS, MODE_IDS } from '../src/content/modes';
import { VOICES, type LexiconLevel, type LexiconPos } from '../src/content/types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const locales = join(root, 'src', 'i18n', 'locales');
const audioDir = join(root, 'public', 'audio');

const KINDS = ['letter', 'word', 'phrase', 'number', 'culture-note'];
const POSITIONS: readonly LexiconPos[] = ['noun', 'verb', 'adj', 'adv', 'pron', 'phrase'];
const LEVELS: readonly LexiconLevel[] = ['A1', 'A2', 'B1', 'B2'];

type Node = { [key: string]: string | Node };

function readLocale(name: string): Node {
  return JSON.parse(readFileSync(join(locales, `${name}.json`), 'utf8')) as Node;
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

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]!).sort();
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

const problems: string[] = [];
const fail = (message: string) => problems.push(message);

const ru = flatten(readLocale('ru'));
const en = flatten(readLocale('en'));

// ---- interface dictionaries ------------------------------------------------
for (const key of ru.keys()) if (!en.has(key)) fail(`нет перевода en: ${key}`);
for (const key of en.keys()) if (!ru.has(key)) fail(`нет перевода ru: ${key}`);
for (const [key, ruValue] of ru) {
  const enValue = en.get(key);
  if (enValue === undefined) continue;
  if (!ruValue.trim()) fail(`пустая строка ru: ${key}`);
  if (!enValue.trim()) fail(`пустая строка en: ${key}`);
  if (ruValue === enValue && !IDENTICAL_BY_DESIGN.has(key)) fail(`ru совпадает с en: ${key}`);
  if (placeholders(ruValue).join(',') !== placeholders(enValue).join(',')) fail(`плейсхолдеры разошлись: ${key}`);
}

// Every mode and every non-themed deck must be named in both languages, so a
// new mode cannot reach the hub without a translation.
for (const id of [...MODE_IDS, ...HUB_MODE_IDS]) {
  if (!ru.has(`modes.${id}`)) fail(`нет названия режима ru: modes.${id}`);
  if (!en.has(`modes.${id}`)) fail(`нет названия режима en: modes.${id}`);
}
for (const reason of ['TooFew', 'DuplicateMeanings', 'DuplicateLetters', 'NoThemeCluster']) {
  for (const [language, table] of [['ru', ru], ['en', en]] as const) {
    if (!table.has(`modes.reason${reason}`)) fail(`нет причины недоступности ${language}: modes.reason${reason}`);
  }
}
for (const deck of DECKS) {
  // Themed decks are named by the data, which carries both languages.
  if (deck.filter.kind === 'theme') {
    const themeId = deck.filter.themeId;
    const theme = THEMES.find((item) => item.id === themeId);
    if (!theme) fail(`колода ссылается на неизвестную тему: ${deck.id} → ${themeId}`);
    else if (!theme.title.ru.trim() || !theme.title.en.trim()) fail(`тема без названия: ${theme.id}`);
    continue;
  }
  for (const [language, table] of [['ru', ru], ['en', en]] as const) {
    if (!table.has(`decks.${deck.id}`)) fail(`нет названия колоды ${language}: decks.${deck.id}`);
  }
}

// ---- registry -------------------------------------------------------------
const active = ACTIVE_ENTRIES;
const merged = ALL_ENTRIES.filter((entry) => entry.mergedInto);
const ids = new Set<string>();
for (const entry of ALL_ENTRIES) {
  if (ids.has(entry.id)) fail(`повтор id: ${entry.id}`);
  ids.add(entry.id);
}
const texts = new Set<string>();
for (const entry of active) {
  const key = normalizeText(entry.text);
  if (texts.has(key)) fail(`повтор текста среди активных: ${entry.text} → ${entry.id}`);
  texts.add(key);
  if (!KINDS.includes(entry.kind)) fail(`неизвестный вид: ${entry.id} → ${entry.kind}`);
  if (!/[\u0530-\u058F]/.test(entry.text)) fail(`нет армянского кодпоинта: ${entry.id}`);
  if (entry.meaning.ru.length === 0) fail(`нет перевода ru: ${entry.id}`);
  if (entry.meaning.en.length === 0) fail(`нет перевода en: ${entry.id}`);
  if (entry.meaning.ru.length > 3) fail(`больше трёх переводов: ${entry.id}`);
  if (entry.pos !== undefined && !POSITIONS.includes(entry.pos)) fail(`неизвестная часть речи: ${entry.id}`);
  if (entry.level !== undefined && !LEVELS.includes(entry.level)) fail(`неизвестный уровень: ${entry.id}`);
  if (entry.themeId !== undefined && !THEMES.some((theme) => theme.id === entry.themeId)) {
    fail(`неизвестная тема: ${entry.id} → ${entry.themeId}`);
  }
  if (entry.audioId !== undefined && !AUDIO[entry.audioId]) fail(`audioId без записи: ${entry.id} → ${entry.audioId}`);
}
for (const entry of merged) {
  if (!ids.has(entry.mergedInto!)) fail(`mergedInto не найден: ${entry.id} → ${entry.mergedInto}`);
  if (entry.audioId !== undefined) fail(`поглощённая запись сохранила audioId: ${entry.id}`);
}

// ---- numerals -------------------------------------------------------------
const numerals = active.filter((entry) => entry.kind === 'number' && entry.source === 'derived');
if (numerals.length !== 1000) fail(`числительных ${numerals.length}, ожидалось 1000`);
if (numerals.map((entry) => entry.id).join(',') !== ALL_NUMBER_IDS.join(',')) fail('числительные не покрывают 0–999 подряд');
for (const entry of numerals) {
  const value = numberValue(entry.id);
  if (value === undefined) {
    fail(`идентификатор числительного не разбирается: ${entry.id}`);
    continue;
  }
  if (entry.text !== numberToArmenian(value)) fail(`текст числительного разошёлся с генератором: ${entry.id}`);
  if (entry.meaning.ru[0] !== String(value)) fail(`перевод числительного разошёлся: ${entry.id}`);
}

// ---- audio ----------------------------------------------------------------
for (const [id, record] of Object.entries(AUDIO)) {
  if (record.reviewed !== false) fail(`запись помечена как проверенная без речевой проверки: ${id}`);
  if (record.file !== record.voices.nune) fail(`file не совпадает с голосом nune: ${id}`);
  for (const voice of VOICES) {
    const file = record.voices[voice];
    if (!file) {
      fail(`нет голоса ${voice}: ${id}`);
      continue;
    }
    if (!file.endsWith(`-${voice}.m4a`)) fail(`имя файла без голоса: ${id} → ${file}`);
    if (!/^[\w.-]+\.m4a$/.test(file)) fail(`небезопасное имя файла: ${id} → ${file}`);
    const path = join(audioDir, file);
    if (!existsSync(path) || statSync(path).size === 0) fail(`нет файла озвучки: ${file}`);
  }
  if (!record.text.trim()) fail(`запись без текста: ${id}`);
}
// The clip must say what the game shows. Letters are the exception: a letter's
// clip says its name, while the record shows the glyph pair.
for (const entry of active) {
  if (!entry.audioId) continue;
  const record = AUDIO[entry.audioId];
  if (!record) continue;
  if (entry.kind === 'letter') continue;
  if (normalizeText(record.text) !== normalizeText(entry.text)) {
    fail(`текст записи разошёлся с текстом записи реестра: ${entry.id} → ${entry.audioId}`);
  }
}

// ---- decks and modes ------------------------------------------------------
if (DECKS.length !== 20) fail(`колод ${DECKS.length}, ожидалось 20`);
const placed = new Set(DECKS.flatMap((deck) => deck.entries.map((entry) => entry.id)));
const orphans = active.filter((entry) => !placed.has(entry.id));
if (orphans.length > 0) fail(`записей вне колод: ${orphans.length} (${orphans.slice(0, 5).map((e) => e.id).join(', ')})`);

const availability = new Map<string, string[]>();
for (const deck of DECKS) {
  const ids = availableModes(deck.entries);
  availability.set(deck.id, [...ids]);
  if (ids.length === 0) fail(`в колоде нет доступных режимов: ${deck.id}`);
  for (const entry of deck.entries) {
    if (entry.mergedInto) fail(`поглощённая запись попала в колоду: ${deck.id} → ${entry.id}`);
  }
  if (new Set(deck.entries.map((entry) => entry.id)).size !== deck.entries.length) {
    fail(`повтор записи внутри колоды: ${deck.id}`);
  }
}
const neverAvailable = [...MODE_IDS].filter((id) => ![...availability.values()].some((list) => list.includes(id)));
if (neverAvailable.length > 0) fail(`режим недоступен ни в одной колоде: ${neverAvailable.join(', ')}`);

// ---- report ---------------------------------------------------------------
const silent = active.filter((entry) => !entry.audioId).length;
const average = Math.round(
  ([...availability.values()].reduce((sum, list) => sum + list.length, 0) / availability.size) * 10,
) / 10;

console.log(`ключей интерфейса: ${ru.size} ru / ${en.size} en`);
console.log(`реестр: ${ALL_ENTRIES.length} записей, активных ${active.length}, поглощённых ${merged.length}`);
console.log(`озвучка: ${Object.keys(AUDIO).length} материалов, ${Object.keys(AUDIO).length * VOICES.length} файлов`);
console.log(
  `${ru.get('audit.decks')}: ${DECKS.length}, тем исключено: ${excludedThemes().map((theme) => theme.id).join(', ') || '—'}`,
);
console.log(`${ru.get('audit.modes')}: ${MODE_IDS.length} в колоде, ${HUB_MODE_IDS.length} из хаба`);
console.log(`${ru.get('audit.activeOn')}: ${average} из ${MODE_IDS.length}`);
console.log(`${ru.get('audit.orphans')}: ${orphans.length}; ${ru.get('audit.silent')}: ${silent}`);
if (neverAvailable.length > 0) console.log(`${ru.get('audit.unavailable')}: ${neverAvailable.join(', ')}`);
for (const deck of DECKS) {
  const ids = availability.get(deck.id)!;
  const absent = MODE_IDS.filter((id) => !ids.includes(id));
  const line = `${deck.id.padEnd(17)} ${String(deck.entries.length).padStart(5)}  ${String(ids.length).padStart(2)}/${MODE_IDS.length}`;
  console.log(`  ${line}${absent.length > 0 ? `   нет: ${absent.join(', ')}` : ''}`);
}

if (problems.length > 0) {
  for (const problem of problems.slice(0, 40)) console.error(`  ошибка: ${problem}`);
  console.error(`validate:content — провалено проверок: ${problems.length}`);
  process.exit(1);
}
console.log(`validate:content — ${ru.get('audit.ok')}`);
console.log('validate:content — проверки прогресса и движков игр появятся вместе с ними (фазы 4 и 8)');
