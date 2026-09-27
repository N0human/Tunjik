/**
 * Phase 2 of the plan: merge the two source lexicons, the derived numerals and
 * the available recordings into one registry.
 *
 * The script never writes into a source project. It is re-runnable: the output
 * is a function of the sources, and the report says what moved.
 *
 *   npm run import:lexicon                    # read Arahet's working tree
 *   npm run import:lexicon -- --arahet=head   # read Arahet at its last commit
 *
 * The second form exists because Arahet's working tree is often dirty, and a
 * lexicon built from a half-finished edit is not reproducible. When the working
 * tree cannot be loaded at all, the script says so and names the failure
 * instead of silently falling back.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  ALL_NUMBER_IDS,
  NUMBER_MAX,
  NUMBER_MIN,
  numberToArmenian,
  numberValue,
} from '../src/content/numbers';
import type {
  AudioManifest,
  AudioManifestEntry,
  LexiconEntry,
  LexiconKind,
  LexiconLevel,
  LexiconPos,
  LexiconProvenance,
  LexiconSource,
  Localized,
  Voice,
} from '../src/content/types';
import { VOICES } from '../src/content/types';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const arahetDir = resolve(root, '..', 'Arahet');
const aybuchDir = resolve(root, '..', '..', 'aybuch', 'aybuch');
const audioOut = join(root, 'public', 'audio');
const manifestPath = join(root, 'src', 'content', 'audio-manifest.json');
const lexiconPath = join(root, 'src', 'content', 'lexicon.json');
const provenancePath = join(root, 'src', 'content', 'provenance.json');
const themesPath = join(root, 'src', 'content', 'themes.json');

type ArahetItem = {
  id: string;
  kind: LexiconKind;
  text: string;
  meaning: Localized;
  ipa?: string;
  transliteration?: string;
  reading?: Localized;
  audioId?: string;
  sortOrder: number;
};
type ArahetManifestEntry = {
  file: string;
  text: string;
  reviewed: boolean;
  source?: string;
  voices: Record<string, string>;
};
type AybuchTheme = {
  id: string;
  title: { ru: string; en?: string };
  icon: string;
};
type AybuchWord = {
  id: string;
  hy: string;
  translit: string;
  ipa?: string;
  themeId: string;
  pos: LexiconPos;
  level: LexiconLevel;
  translations: { ru: string[]; en?: string[] };
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/** Collapse spacing and drop sentence-final punctuation so that two records
 *  differing only in punctuation count as the same Armenian text. */
function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').replace(/[։՝՜]+$/, '').trim();
}

function git(dir: string, args: string[]): string {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();
}

function assertSources(): void {
  for (const [label, path] of [
    ['Arahet', arahetDir],
    ['aybuch', aybuchDir],
  ] as const) {
    if (!existsSync(path)) throw new Error(`источник ${label} не найден: ${path}`);
  }
}

/** Arahet numbers are `number-900`, `number-30000`; ours are `num-090`. */
function arahetNumberValue(id: string): number | undefined {
  const match = /^number-(\d+)$/.exec(id);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isInteger(value) ? value : undefined;
}

async function loadArahetRegistry(mode: 'worktree' | 'head'): Promise<{
  items: ArahetItem[];
  commit: string;
  dirty: boolean;
}> {
  const commit = git(arahetDir, ['rev-parse', '--short', 'HEAD']);
  const dirty = git(arahetDir, ['status', '--porcelain']).length > 0;

  if (mode === 'head') {
    const scratch = mkdtempSync(join(tmpdir(), 'tunjik-arahet-head-'));
    try {
      const archive = execFileSync('git', ['-C', arahetDir, 'archive', 'HEAD', 'src'], {
        maxBuffer: 256 * 1024 * 1024,
      });
      execFileSync('tar', ['-x', '-C', scratch], { input: archive });
      const entry = join(scratch, 'src', 'content', 'registry.ts');
      const module = (await import(pathToFileURL(entry).href)) as { LEARNING_ITEMS: ArahetItem[] };
      return { items: module.LEARNING_ITEMS, commit, dirty };
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }

  const entry = join(arahetDir, 'src', 'content', 'registry.ts');
  try {
    const module = (await import(pathToFileURL(entry).href)) as { LEARNING_ITEMS: ArahetItem[] };
    return { items: module.LEARNING_ITEMS, commit, dirty };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        `не удалось загрузить реестр Arahet: ${message}`,
        'Рабочее дерево Arahet сейчас не импортируется — это правка на стороне соседнего проекта,',
        `проверьте её так: cd ${arahetDir} && npx tsx -e "import('./src/content/registry.ts').then(() => console.log('ок'))"`,
        'либо соберите лексикон от последнего коммита: npm run import:lexicon -- --arahet=head',
      ].join('\n'),
    );
  }
}

function fromArahet(item: ArahetItem, manifest: Record<string, ArahetManifestEntry>): LexiconEntry {
  const entry: LexiconEntry = {
    id: item.id,
    kind: item.kind,
    text: item.text,
    meaning: { ru: [item.meaning.ru], en: [item.meaning.en] },
    source: 'arahet',
  };
  if (item.transliteration) entry.transliteration = item.transliteration;
  if (item.ipa) entry.ipa = item.ipa;
  if (item.reading) entry.reading = item.reading;
  if (item.audioId && manifest[item.audioId]) entry.audioId = item.audioId;
  return entry;
}

function fromAybuch(word: AybuchWord): LexiconEntry {
  return {
    id: word.id,
    kind: word.pos === 'phrase' ? 'phrase' : 'word',
    text: word.hy,
    meaning: { ru: word.translations.ru, en: word.translations.en ?? [] },
    transliteration: word.translit,
    themeId: word.themeId,
    pos: word.pos,
    level: word.level,
    audioId: word.id,
    source: 'aybuch',
  };
}

/** Audio origins for the derived numerals, keyed by Armenian text. Only an
 *  exact text match counts, so a recording of տասը is never used for տաս. */
function numberAudioReuse(
  arahetItems: readonly ArahetItem[],
  arahetManifest: Record<string, ArahetManifestEntry>,
  staticAudio: Readonly<Record<string, string>>,
  aybuchClip: (id: string, voice: Voice) => boolean,
): Map<string, { origin: string; text: string }> {
  const reuse = new Map<string, { origin: string; text: string }>();
  for (const item of arahetItems) {
    const value = item.kind === 'number' ? arahetNumberValue(item.id) : undefined;
    if (value === undefined || value < NUMBER_MIN || value > NUMBER_MAX || !item.audioId) continue;
    const text = numberToArmenian(value);
    if (normalizeText(item.text) !== text) continue;
    if (!arahetManifest[item.audioId]) continue;
    if (!reuse.has(text)) reuse.set(text, { origin: `arahet:${item.audioId}`, text });
  }
  for (const [id, rawText] of Object.entries(staticAudio)) {
    if (!id.startsWith('num')) continue;
    const text = numberToArmenian(Number(id.replace(/^num/, '')));
    if (normalizeText(rawText) !== text || reuse.has(text)) continue;
    if (!aybuchClip(id, 'nune') || !aybuchClip(id, 'tigran')) continue;
    reuse.set(text, { origin: `aybuch:${id}`, text });
  }
  return reuse;
}

async function main(): Promise<void> {
  assertSources();
  const mode = process.argv.includes('--arahet=head') ? 'head' : 'worktree';

  const arahet = await loadArahetRegistry(mode);
  const arahetManifest = readJson<Record<string, ArahetManifestEntry>>(
    join(arahetDir, 'src', 'content', 'audio-manifest.json'),
  );
  const aybuchSeed = readJson<{ words: AybuchWord[]; themes: AybuchTheme[] }>(
    join(aybuchDir, 'assets', 'content', 'words.seed.json'),
  );
  const aybuchStatic = Object.fromEntries(
    readJson<{ id: string; text: string }[]>(join(aybuchDir, 'assets', 'content', 'static_audio.json')).map((entry) => [
      entry.id,
      entry.text,
    ]),
  );
  const aybuchCommit = git(aybuchDir, ['rev-parse', '--short', 'HEAD']);
  const aybuchClip = (id: string, voice: Voice) => existsSync(join(aybuchDir, 'assets', 'audio', voice, `${id}_${voice}.m4a`));

  console.log(`Arahet  ${arahet.commit}${arahet.dirty ? ', рабочее дерево изменено' : ''} (${mode}) — ${arahet.items.length} записей`);
  console.log(`aybuch  ${aybuchCommit} — ${aybuchSeed.words.length} слов, ${Object.keys(aybuchStatic).length} статических записей`);

  // Numerals claim the text of Arahet's number records. This is the single
  // place where the derived set wins a collision, and the reason is recorded in
  // the technical plan: the derived set covers 1000 values in the indefinite
  // form, while Arahet carries 35 of them with two forms mixed in.
  //
  // Arahet's IPA and reading hint are carried over only where the recorded text
  // matches exactly. The transcription of տասը describes տասը, so moving it
  // onto տաս would put a reviewed-looking but wrong hint into the registry.
  const transferred = new Map<number, ArahetItem>();
  for (const item of arahet.items) {
    const value = item.kind === 'number' ? arahetNumberValue(item.id) : undefined;
    if (value === undefined || value < NUMBER_MIN || value > NUMBER_MAX) continue;
    if (normalizeText(item.text) === numberToArmenian(value)) transferred.set(value, item);
  }
  const reuse = numberAudioReuse(arahet.items, arahetManifest, aybuchStatic, aybuchClip);
  const numberEntries: LexiconEntry[] = ALL_NUMBER_IDS.map((id) => {
    const value = numberValue(id)!;
    const text = numberToArmenian(value);
    const entry: LexiconEntry = {
      id,
      kind: 'number',
      text,
      meaning: { ru: [String(value)], en: [String(value)] },
      source: 'derived',
    };
    const donor = transferred.get(value);
    if (donor) {
      if (donor.ipa) entry.ipa = donor.ipa;
      if (donor.transliteration) entry.transliteration = donor.transliteration;
      if (donor.reading) entry.reading = donor.reading;
    }
    const borrowed = reuse.get(text);
    if (borrowed) entry.audioId = borrowed.origin;
    return entry;
  });

  const numberTargetByValue = new Map<number, string>();
  for (const entry of numberEntries) numberTargetByValue.set(numberValue(entry.id)!, entry.id);

  const arahetEntries = arahet.items.map((item) => {
    const entry = fromArahet(item, arahetManifest);
    const value = item.kind === 'number' ? arahetNumberValue(item.id) : undefined;
    if (value !== undefined && value >= NUMBER_MIN && value <= NUMBER_MAX) {
      entry.mergedInto = numberTargetByValue.get(value);
      // The derived record owns the recording now; a merged record must not
      // keep a reference the manifest does not hold.
      delete entry.audioId;
    }
    return entry;
  });

  // Arahet wins every remaining text collision: it has IPA, a reading hint and
  // a completed editorial pass, which aybuch does not have.
  const claimed = new Map<string, string>();
  for (const entry of [...numberEntries, ...arahetEntries]) {
    if (entry.mergedInto) continue;
    const key = normalizeText(entry.text);
    if (!claimed.has(key)) claimed.set(key, entry.id);
  }
  const aybuchEntries = aybuchSeed.words.map((word) => {
    const entry = fromAybuch(word);
    const winner = claimed.get(normalizeText(entry.text));
    if (winner && winner !== entry.id) {
      entry.mergedInto = winner;
      delete entry.audioId;
    } else {
      claimed.set(normalizeText(entry.text), entry.id);
    }
    return entry;
  });

  const all = [...numberEntries, ...arahetEntries, ...aybuchEntries];
  const active = all.filter((entry) => !entry.mergedInto);
  const merged = all.filter((entry) => entry.mergedInto);

  // Invariants, asserted here so a broken merge never reaches the repository.
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const entry of all) {
    if (ids.has(entry.id)) problems.push(`повтор id: ${entry.id}`);
    ids.add(entry.id);
  }
  const texts = new Set<string>();
  for (const entry of active) {
    const key = normalizeText(entry.text);
    if (texts.has(key)) problems.push(`повтор текста среди активных: ${entry.text} → ${entry.id}`);
    texts.add(key);
    if (!/[\u0530-\u058F]/.test(entry.text)) problems.push(`нет армянского кодпоинта: ${entry.id}`);
    if (entry.meaning.ru.length === 0) problems.push(`нет перевода ru: ${entry.id}`);
    if (entry.meaning.en.length === 0) problems.push(`нет перевода en: ${entry.id}`);
    if (entry.meaning.ru.length > 3) problems.push(`больше трёх переводов ru: ${entry.id}`);
  }
  for (const entry of merged) {
    if (!ids.has(entry.mergedInto!)) problems.push(`mergedInto не найден: ${entry.id} → ${entry.mergedInto}`);
  }
  if (problems.length > 0) {
    for (const problem of problems.slice(0, 30)) console.error(`  ошибка: ${problem}`);
    throw new Error(`инварианты нарушены: ${problems.length}`);
  }

  // Audio: only clips referenced by an active record are copied, so the quest
  // and verse clips of both source projects stay where they are.
  mkdirSync(audioOut, { recursive: true });
  const manifest: AudioManifest = {};
  const missing: string[] = [];
  let copied = 0;
  let bytes = 0;

  const store = (entry: LexiconEntry, origin: string, text: string, sourceFor: (voice: Voice) => string | undefined) => {
    const voices = {} as Record<Voice, string>;
    for (const voice of VOICES) {
      const from = sourceFor(voice);
      if (!from) return;
      const name = `${entry.id}-${voice}.m4a`;
      const to = join(audioOut, name);
      if (!existsSync(to) || statSync(to).size !== statSync(from).size) copyFileSync(from, to);
      copied += 1;
      bytes += statSync(to).size;
      voices[voice] = name;
    }
    const record: AudioManifestEntry = { file: voices.nune, text, reviewed: false, voices, source: origin };
    manifest[entry.audioId!] = record;
  };

  for (const entry of active) {
    if (!entry.audioId) {
      missing.push(entry.id);
      continue;
    }
    if (entry.source === 'arahet') {
      const record = arahetManifest[entry.audioId];
      if (!record) {
        missing.push(entry.id);
        continue;
      }
      store(entry, record.source ?? `Arahet:${entry.audioId}`, record.text, (voice) => {
        const file = record.voices[voice];
        return file ? join(arahetDir, 'public', 'audio', file) : undefined;
      });
    } else if (entry.source === 'aybuch') {
      if (!aybuchClip(entry.audioId, 'nune') || !aybuchClip(entry.audioId, 'tigran')) {
        missing.push(entry.id);
        continue;
      }
      store(entry, `aybuch:${entry.audioId}`, entry.text, (voice) =>
        join(aybuchDir, 'assets', 'audio', voice, `${entry.audioId}_${voice}.m4a`),
      );
    } else {
      const separator = entry.audioId.indexOf(':');
      const origin = entry.audioId.slice(0, separator);
      const id = entry.audioId.slice(separator + 1);
      if (origin === 'arahet') {
        const record = arahetManifest[id];
        if (!record) {
          missing.push(entry.id);
          continue;
        }
        store(entry, `Arahet:${id}`, record.text, (voice) => {
          const file = record.voices[voice];
          return file ? join(arahetDir, 'public', 'audio', file) : undefined;
        });
      } else {
        store(entry, `aybuch:${id}`, entry.text, (voice) =>
          join(aybuchDir, 'assets', 'audio', voice, `${id}_${voice}.m4a`),
        );
      }
    }
  }

  const withAudio = active.filter((entry) => manifest[entry.audioId ?? '']).length;
  const numbersWithoutAudio = numberEntries.filter((entry) => !entry.audioId).length;
  const numbersWithHints = numberEntries.filter((entry) => entry.ipa || entry.transliteration || entry.reading);
  const numbersWithIpa = numberEntries.filter((entry) => entry.ipa).length;
  const bySource: Record<LexiconSource, number> = { arahet: 0, aybuch: 0, derived: 0 };
  for (const entry of all) bySource[entry.source] += 1;
  const order: Record<LexiconSource, number> = { derived: 0, arahet: 1, aybuch: 2 };

  const provenance: LexiconProvenance = {
    arahet: arahet.commit,
    arahetDirty: arahet.dirty,
    aybuch: aybuchCommit,
    generatedAt: Date.now(),
    counts: {
      imported: all.length,
      active: active.length,
      merged: merged.length,
      bySource,
      withAudio,
      withoutAudio: active.length - withAudio,
    },
  };

  // Themes are copied from the source, ru and en both, so the deck names in
  // the interface are not re-translated here.
  const themeCounts = new Map<string, number>();
  for (const entry of active) {
    if (!entry.themeId) continue;
    themeCounts.set(entry.themeId, (themeCounts.get(entry.themeId) ?? 0) + 1);
  }
  const themes = aybuchSeed.themes
    .map((theme) => ({
      id: theme.id,
      title: { ru: theme.title.ru, en: theme.title.en ?? '' },
      icon: theme.icon,
      count: themeCounts.get(theme.id) ?? 0,
    }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  const missingThemeTitles = themes.filter((theme) => !theme.title.en);
  if (missingThemeTitles.length > 0) {
    throw new Error(`у тем нет английского названия: ${missingThemeTitles.map((t) => t.id).join(', ')}`);
  }
  const unthemed = active.filter((entry) => !entry.themeId).length;

  const sorted = [...all].sort((a, b) => {
    if (order[a.source] !== order[b.source]) return order[a.source] - order[b.source];
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return a.id.localeCompare(b.id);
  });
  writeFileSync(lexiconPath, `${JSON.stringify(sorted)}\n`);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
  writeFileSync(themesPath, `${JSON.stringify(themes)}\n`);

  console.log('');
  console.log(`импортировано ${all.length}: arahet ${bySource.arahet}, aybuch ${bySource.aybuch}, числа ${bySource.derived}`);
  console.log(`активных ${active.length}, поглощённых ${merged.length}`);
  console.log(`озвучка: ${withAudio} материалов с двумя голосами, ${copied} файлов, ${(bytes / 1048576).toFixed(1)} МБ`);
  console.log(`без озвучки: ${active.length - withAudio} активных записей, из них чисел ${numbersWithoutAudio} (фаза 10)`);
  console.log(
    `чисел с перенесёнными данными Arahet: ${numbersWithHints.length} из 1000` +
      ` (IPA ${numbersWithIpa}, остальные — транслитерация и подсказка чтения)`,
  );
  if (numbersWithHints.length > 0) {
    const values = numbersWithHints
      .map((entry) => numberValue(entry.id)!)
      .sort((a, b) => a - b);
    console.log(`  значения: ${values.join(', ')}`);
  }
  if (missing.length > 0) console.log(`нет audioId: ${missing.length} — ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ', …' : ''}`);
  console.log('');
  console.log(`тем: ${themes.length}, из них пригодных для колод ${themes.filter((t) => t.id !== 'basics' && t.count >= 6).length}`);
  console.log(`активных записей без темы: ${unthemed}`);
  console.log('записано: src/content/lexicon.json, src/content/themes.json, src/content/audio-manifest.json, src/content/provenance.json, public/audio/');
}

await main();
