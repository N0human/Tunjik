import { describe, expect, it } from 'vitest';
import { DECKS, DECK_BY_ID, excludedThemes, MIN_THEME_SIZE } from './decks';
import { availableModes, modeAvailability, MODE_IDS, type ModeId } from './modes';
import { ACTIVE_ENTRIES, normalizeAnswer, normalizeText, RESERVOIR_THEME } from './lexicon';
import type { LexiconEntry } from './types';

function entry(partial: Partial<LexiconEntry> & { id: string; text: string }): LexiconEntry {
  return {
    kind: 'word',
    meaning: { ru: ['x'], en: ['x'] },
    source: 'aybuch',
    ...partial,
  };
}

describe('колоды', () => {
  it('is twenty decks: fourteen themes, four levels, teaching and all', () => {
    const themes = DECKS.filter((deck) => deck.filter.kind === 'theme');
    const levels = DECKS.filter((deck) => deck.filter.kind === 'level');
    expect(themes).toHaveLength(14);
    expect(levels).toHaveLength(4);
    expect(DECKS.filter((deck) => deck.filter.kind === 'arahet-teaching')).toHaveLength(1);
    expect(DECKS.filter((deck) => deck.filter.kind === 'all')).toHaveLength(1);
    expect(DECKS).toHaveLength(20);
  });

  it('keeps the reservoir theme out of the themed decks', () => {
    // basics holds 1172 records of every late top-up batch. Presenting it as a
    // subject would be a dumping ground with a name.
    expect(excludedThemes().map((theme) => theme.id)).toEqual([RESERVOIR_THEME]);
    for (const deck of DECKS) {
      if (deck.filter.kind !== 'theme') continue;
      expect(deck.filter.themeId, deck.id).not.toBe(RESERVOIR_THEME);
    }
  });

  it('gives every themed deck at least the minimum size', () => {
    for (const deck of DECKS) {
      if (deck.filter.kind !== 'theme') continue;
      expect(deck.entries.length, deck.id).toBeGreaterThanOrEqual(MIN_THEME_SIZE);
    }
  });

  it('never counts one record twice inside a deck', () => {
    for (const deck of DECKS) {
      expect(new Set(deck.entries.map((item) => item.id)).size, deck.id).toBe(deck.entries.length);
    }
  });

  it('never offers a merged record', () => {
    for (const deck of DECKS) {
      for (const item of deck.entries) expect(item.mergedInto, item.id).toBeUndefined();
    }
  });

  it('places every active record in at least one deck', () => {
    const placed = new Set(DECKS.flatMap((deck) => deck.entries.map((entry) => entry.id)));
    const orphans = ACTIVE_ENTRIES.filter((entry) => !placed.has(entry.id)).map((entry) => entry.id);
    expect(orphans).toEqual([]);
  });

  it('covers the full pool in the all deck', () => {
    expect(DECK_BY_ID.get('all')!.entries).toHaveLength(ACTIVE_ENTRIES.length);
  });

  it('keeps Arahet teaching vocabulary out of the numerals', () => {
    const teaching = DECK_BY_ID.get('teaching')!.entries;
    expect(teaching.every((entry) => entry.kind !== 'number')).toBe(true);
    expect(teaching.every((entry) => entry.source === 'arahet')).toBe(true);
  });
});

describe('доступность режимов', () => {
  it('offers every mode on the full pool', () => {
    const all = DECK_BY_ID.get('all')!.entries;
    expect(availableModes(all)).toEqual([...MODE_IDS]);
  });

  it('needs a theme for the odd-one-out game', () => {
    const untagged = [
      entry({ id: 'a', text: 'առաջին' }),
      entry({ id: 'b', text: 'երկրորդ' }),
      entry({ id: 'c', text: 'երրորդ' }),
      entry({ id: 'd', text: 'չորրդ' }),
    ];
    expect(modeAvailability('odd-one', untagged)).toEqual({ ok: false, candidates: 0, reason: 'tooFew' });
  });

  it('offers the odd-one-out game on level decks and hides it on the teaching deck', () => {
    // aybuch words carry a theme, so a level deck has clusters to work with.
    // Arahet's teaching vocabulary carries none, which is the one deck where
    // the game cannot be built — and it must be absent, not broken.
    expect(availableModes(DECK_BY_ID.get('level-a1')!.entries)).toContain('odd-one');
    expect(availableModes(DECK_BY_ID.get('teaching')!.entries)).not.toContain('odd-one');
  });

  it('needs a cluster of three inside one theme for the odd-one-out game', () => {
    const scattered = ['a', 'b', 'c', 'd'].map((id, index) =>
      entry({ id, text: `բառ${index}`, themeId: `theme-${index}` }),
    );
    expect(modeAvailability('odd-one', scattered).reason).toBe('noThemeCluster');
    const clustered = [
      entry({ id: 'a', text: 'մեկ', themeId: 'food' }),
      entry({ id: 'b', text: 'երկու', themeId: 'food' }),
      entry({ id: 'c', text: 'երեք', themeId: 'food' }),
      entry({ id: 'd', text: 'տանիք', themeId: 'home' }),
    ];
    expect(modeAvailability('odd-one', clustered).ok).toBe(true);
  });

  it('refuses catch-letter when the first letters repeat', () => {
    const sameLetter = ['արի', 'արբ', 'արգ', 'արդ'].map((text, index) =>
      entry({ id: `x${index}`, text }),
    );
    expect(modeAvailability('catch-letter', sameLetter).reason).toBe('duplicateLetters');
    const varied = ['արի', 'բրբ', 'գրգ', 'դրդ'].map((text, index) => entry({ id: `y${index}`, text }));
    expect(modeAvailability('catch-letter', varied).ok).toBe(true);
  });

  it('refuses pairs when the meanings repeat', () => {
    // Two records with the same Russian gloss make a false pair.
    const duplicated = Array.from({ length: 8 }, (_unused, index) =>
      entry({ id: `x${index}`, text: `բառ${index}`, meaning: { ru: ['одно и то же'], en: ['same'] } }),
    );
    expect(modeAvailability('pairs', duplicated).reason).toBe('duplicateMeanings');
  });

  it('asks for a playable number of candidates, not just a non-empty deck', () => {
    const two = [entry({ id: 'a', text: 'առաջին' }), entry({ id: 'b', text: 'երկրորդ' })];
    for (const id of ['pairs', 'bingo', 'quiz', 'reverse', 'typing'] as ModeId[]) {
      expect(modeAvailability(id, two).ok, id).toBe(false);
    }
    expect(modeAvailability('srs', two).ok).toBe(true);
  });

  it('hides the audio modes on a deck whose records have no recording', () => {
    const silent = Array.from({ length: 12 }, (_unused, index) =>
      entry({ id: `s${index}`, text: `բառ${index}` }),
    );
    const modes = availableModes(silent);
    expect(modes).not.toContain('listen');
    expect(modes).not.toContain('dictation');
    expect(modes).not.toContain('bingo');
    expect(modes).toContain('quiz');
  });

  it('excludes letters, phrases and long words from the anagram game', () => {
    const withPhrase = [
      entry({ id: 'a', text: 'տան' }),
      entry({ id: 'b', text: 'գիրք' }),
      entry({ id: 'c', text: 'երկարաբառովհոդի' }),
      entry({ id: 'p', kind: 'phrase', text: 'բարև քեզ' }),
    ];
    expect(modeAvailability('constructor', withPhrase).candidates).toBe(2);
  });

  it('needs a letter that occurs once for the missing-letter game', () => {
    // մմմ has no unique letter: every position is ambiguous.
    const repeated = [entry({ id: 'a', text: 'մմմ' }), entry({ id: 'b', text: 'տտտ' })];
    expect(modeAvailability('fill-letter', repeated).candidates).toBe(0);
    const distinct = Array.from({ length: 4 }, (_unused, index) =>
      entry({ id: `w${index}`, text: `աբգ${index}` }),
    );
    expect(modeAvailability('fill-letter', distinct).ok).toBe(true);
  });

  it('lists no deck with zero available modes', () => {
    for (const deck of DECKS) {
      expect(availableModes(deck.entries).length, deck.id).toBeGreaterThan(0);
    }
  });
});

describe('нормализация', () => {
  it('collapses spacing and sentence punctuation', () => {
    expect(normalizeText('  Ես   եմ։ ')).toBe('Ես եմ');
  });

  it('drops case and the Armenian question marks', () => {
    expect(normalizeAnswer('ԵՍ ԵՄ։')).toBe('ես եմ');
    expect(normalizeAnswer('Ո՞վ ես')).toBe('ով ես');
  });
});
