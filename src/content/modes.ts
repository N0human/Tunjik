import { normalizeAnswer, normalizeText, hasRecording } from './lexicon';
import type { LexiconEntry } from './types';

/**
 * Availability is computed from the deck, never declared by hand. A hand-written
 * table would be a second source of truth and would start lying the moment a
 * deck changed size.
 */
export const MODE_IDS = [
  'pairs',
  'bingo',
  'srs',
  'quiz',
  'reverse',
  'listen',
  'catch-letter',
  'typing',
  'dictation',
  'constructor',
  'translit',
  'fill-letter',
  'odd-one',
] as const;

export type ModeId = (typeof MODE_IDS)[number];

/** The numerals game builds its own questions from a range, so it is launched
 *  from the hub and depends on nothing in a deck. */
export const HUB_MODE_IDS = ['number-marathon'] as const;
export type HubModeId = (typeof HUB_MODE_IDS)[number];
export type AnyModeId = ModeId | HubModeId;

export type ModeFamily = 'screen' | 'round';
export type ModeReason = 'tooFew' | 'duplicateMeanings' | 'duplicateLetters' | 'noThemeCluster';

export interface ModeAvailability {
  ok: boolean;
  /** Records the mode can actually use, before sampling a round. */
  candidates: number;
  reason?: ModeReason;
}

interface ModeRule {
  family: ModeFamily;
  /** Smallest usable set. Below it the mode is not offered. */
  minimum: number;
  accept: (entry: LexiconEntry) => boolean;
  /** A second requirement on top of the count. */
  distinctness?: (entries: readonly LexiconEntry[], minimum: number) => ModeReason | undefined;
}

const isWord = (entry: LexiconEntry) => entry.kind === 'word';
const hasMeaning = (entry: LexiconEntry) => entry.meaning.ru.length > 0 && entry.meaning.en.length > 0;
const hasAudio = (entry: LexiconEntry) => hasRecording(entry);
const hasDistinctMeanings = (entries: readonly LexiconEntry[], minimum: number) => {
  const keys = new Set(entries.map((entry) => normalizeAnswer(entry.meaning.ru[0] ?? '')));
  return keys.size >= minimum ? undefined : 'duplicateMeanings';
};
const hasDistinctLetters = (entries: readonly LexiconEntry[], minimum: number) => {
  const keys = new Set(entries.map((entry) => normalizeText(entry.text).charAt(0).toLowerCase()));
  return keys.size >= minimum ? undefined : 'duplicateLetters';
};

const MODE_RULES: Record<ModeId, ModeRule> = {
  pairs: {
    family: 'screen',
    minimum: 8,
    accept: (entry) => hasMeaning(entry),
    distinctness: hasDistinctMeanings,
  },
  bingo: {
    family: 'screen',
    // Six lets the board shrink to 2×3; below that the game is not a game.
    minimum: 6,
    accept: (entry) => hasMeaning(entry) && hasAudio(entry),
    distinctness: hasDistinctMeanings,
  },
  srs: {
    family: 'screen',
    minimum: 1,
    accept: () => true,
  },
  quiz: { family: 'round', minimum: 4, accept: hasMeaning },
  reverse: { family: 'round', minimum: 4, accept: hasMeaning },
  listen: { family: 'round', minimum: 4, accept: (entry) => hasMeaning(entry) && hasAudio(entry) },
  'catch-letter': {
    family: 'round',
    minimum: 4,
    // A phrase has no single first letter worth asking about, and a two-letter
    // word makes the answer obvious.
    accept: (entry) => isWord(entry) && normalizeText(entry.text).length >= 3,
    distinctness: hasDistinctLetters,
  },
  typing: { family: 'round', minimum: 4, accept: hasMeaning },
  dictation: { family: 'round', minimum: 4, accept: (entry) => hasMeaning(entry) && hasAudio(entry) },
  constructor: {
    family: 'round',
    // The board itself supplies the letters, so one usable word is enough to
    // play a round; the round is what has to hold several.
    minimum: 1,
    accept: (entry) => {
      const text = normalizeText(entry.text);
      return isWord(entry) && text.length >= 3 && text.length <= 9;
    },
  },
  translit: { family: 'round', minimum: 4, accept: (entry) => isWord(entry) && hasMeaning(entry) },
  'fill-letter': {
    family: 'round',
    minimum: 4,
    accept: (entry) => {
      const text = normalizeText(entry.text);
      if (!isWord(entry) || text.length < 3) return false;
      // A letter that occurs twice leaves two correct positions, so the
      // question would have more than one answer.
      return new Set(text).size === text.length;
    },
  },
  'odd-one': {
    family: 'round',
    minimum: 4,
    accept: (entry) => isWord(entry) && Boolean(entry.themeId),
    distinctness: (entries) => {
      const byTheme = new Map<string, number>();
      for (const entry of entries) byTheme.set(entry.themeId!, (byTheme.get(entry.themeId!) ?? 0) + 1);
      return [...byTheme.values()].some((count) => count >= 3) ? undefined : 'noThemeCluster';
    },
  },
};

export function modeFamily(id: AnyModeId): ModeFamily {
  return id === 'number-marathon' ? 'round' : MODE_RULES[id].family;
}

export function modeAvailability(id: ModeId, entries: readonly LexiconEntry[]): ModeAvailability {
  const rule = MODE_RULES[id];
  const candidates = entries.filter((entry) => rule.accept(entry));
  if (candidates.length < rule.minimum) return { ok: false, candidates: candidates.length, reason: 'tooFew' };
  const reason = rule.distinctness?.(candidates, rule.minimum);
  if (reason) return { ok: false, candidates: candidates.length, reason };
  return { ok: true, candidates: candidates.length };
}

/** Modes a deck can actually start, in the order the hub should list them. */
export function availableModes(entries: readonly LexiconEntry[]): ModeId[] {
  return MODE_IDS.filter((id) => modeAvailability(id, entries).ok);
}

/** Why a mode is not offered, for the label under its card. */
export function unavailableReason(id: ModeId, entries: readonly LexiconEntry[]): ModeReason | undefined {
  return modeAvailability(id, entries).reason;
}
