import { ARAHET_TEACHING_ENTRIES, ACTIVE_ENTRIES, LEVELS, RESERVOIR_THEME, THEMES } from './lexicon';
import type { DeckFilter, LexiconEntry, LexiconLevel, LexiconTheme } from './types';

/** A theme needs this many records before it becomes a deck. Below it a game
 *  cannot be assembled and the deck would open on an error. */
export const MIN_THEME_SIZE = 6;

export interface Deck {
  id: string;
  filter: DeckFilter;
  entries: LexiconEntry[];
}

function byTheme(themeId: string): LexiconEntry[] {
  return ACTIVE_ENTRIES.filter((entry) => entry.themeId === themeId);
}

function byLevel(level: LexiconLevel): LexiconEntry[] {
  return ACTIVE_ENTRIES.filter((entry) => entry.level === level);
}

const themeDecks: Deck[] = THEMES.filter(
  (theme) => theme.id !== RESERVOIR_THEME && theme.count >= MIN_THEME_SIZE,
).map((theme) => ({
  id: `theme-${theme.id}`,
  filter: { kind: 'theme', themeId: theme.id },
  entries: byTheme(theme.id),
}));

const levelDecks: Deck[] = LEVELS.map((level) => ({
  id: `level-${level.toLowerCase()}`,
  filter: { kind: 'level', level },
  entries: byLevel(level),
}));

export const DECKS: readonly Deck[] = [
  ...themeDecks,
  ...levelDecks,
  { id: 'teaching', filter: { kind: 'arahet-teaching' }, entries: [...ARAHET_TEACHING_ENTRIES] },
  { id: 'all', filter: { kind: 'all' }, entries: [...ACTIVE_ENTRIES] },
];

export const DECK_BY_ID: ReadonlyMap<string, Deck> = new Map(DECKS.map((deck) => [deck.id, deck]));

/** Themes deliberately not turned into decks, with the reason kept next to the
 *  list rather than inferred from a missing entry. */
export function excludedThemes(): LexiconTheme[] {
  return THEMES.filter((theme) => theme.id === RESERVOIR_THEME || theme.count < MIN_THEME_SIZE);
}
