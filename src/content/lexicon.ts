import audioManifest from './audio-manifest.json';
import lexiconData from './lexicon.json';
import themeData from './themes.json';
import type { AudioManifest, Language, LexiconEntry, LexiconLevel, LexiconTheme } from './types';

/** Every record the import produced, including the merged ones. */
export const ALL_ENTRIES: readonly LexiconEntry[] = lexiconData as LexiconEntry[];

/** Records that survived the merge. Merged records exist for provenance and
 *  must never reach a deck, a question pool or an answer option. */
export const ACTIVE_ENTRIES: readonly LexiconEntry[] = ALL_ENTRIES.filter((entry) => !entry.mergedInto);

export const ENTRY_BY_ID: ReadonlyMap<string, LexiconEntry> = new Map(
  ACTIVE_ENTRIES.map((entry) => [entry.id, entry]),
);

export const AUDIO: AudioManifest = audioManifest as unknown as AudioManifest;

export const THEMES: readonly LexiconTheme[] = themeData as LexiconTheme[];

export const LEVELS: readonly LexiconLevel[] = ['A1', 'A2', 'B1', 'B2'];

/**
 * `basics` is not a theme. It holds every late top-up batch, 1172 records, so
 * using it as a themed deck would present a dumping ground as a subject.
 */
export const RESERVOIR_THEME = 'basics';

/** Collapse spacing and sentence-final punctuation, the same way the import
 *  does, so that a drift between the two is visible rather than silent. */
export function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').replace(/[։՝՜]+$/, '').trim();
}

/**
 * Normalisation for anything the learner types or clicks: case, spacing and
 * punctuation, including the Armenian emphasis marks ՛ ՞ ։ ՜ that end almost
 * every Armenian question.
 */
export function normalizeAnswer(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[՛՞։՜,.!?'’()\-«»"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** First translation in the interface language, or the first available one. */
export function meaningOf(entry: LexiconEntry, language: Language): string {
  return entry.meaning[language][0] ?? entry.meaning.ru[0] ?? entry.text;
}

export function hasRecording(entry: LexiconEntry): boolean {
  return Boolean(entry.audioId && AUDIO[entry.audioId]);
}

/** A recording exists and the settings allow showing unreviewed clips. */
export function hasPlayableRecording(entry: LexiconEntry, allowUnreviewed: boolean): boolean {
  if (!entry.audioId) return false;
  const record = AUDIO[entry.audioId];
  if (!record) return false;
  return allowUnreviewed || record.reviewed === true;
}

export function entriesWithTheme(themeId: string): LexiconEntry[] {
  return ACTIVE_ENTRIES.filter((entry) => entry.themeId === themeId);
}

export function numeralsInRange(from: number, to: number): LexiconEntry[] {
  return ACTIVE_ENTRIES.filter((entry) => {
    if (entry.kind !== 'number' || !entry.id.startsWith('num-')) return false;
    const value = Number(entry.id.slice(4));
    return value >= from && value <= to;
  });
}

/** Arahet's teaching vocabulary and grammar, without its numbers: the numbers
 *  live in the derived set so that one value has one word. */
export const ARAHET_TEACHING_ENTRIES: readonly LexiconEntry[] = ACTIVE_ENTRIES.filter(
  (entry) => entry.source === 'arahet' && entry.kind !== 'number',
);
