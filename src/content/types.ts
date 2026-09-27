export type Language = 'ru' | 'en';
export type Localized = Record<Language, string>;

export type LexiconKind = 'letter' | 'word' | 'phrase' | 'number' | 'culture-note';
export type LexiconPos = 'noun' | 'verb' | 'adj' | 'adv' | 'pron' | 'phrase';
export type LexiconLevel = 'A1' | 'A2' | 'B1' | 'B2';

/** Where a record came from. The three sources have different authority. */
export type LexiconSource = 'arahet' | 'aybuch' | 'derived';

export interface LexiconEntry {
  id: string;
  kind: LexiconKind;
  /** Armenian text, the single target-language field. */
  text: string;
  meaning: { ru: string[]; en: string[] };
  transliteration?: string;
  ipa?: string;
  /** Approximate reading hint. Arahet only. */
  reading?: Localized;
  themeId?: string;
  pos?: LexiconPos;
  level?: LexiconLevel;
  /**
   * Key into the audio manifest. Absent means no recording exists, and the
   * listen button must be hidden rather than rendered and left mute.
   */
  audioId?: string;
  source: LexiconSource;
  /**
   * Set when this record lost a `text` collision to another record. Merged
   * records stay in the file for provenance and are excluded from every deck,
   * question pool and answer option.
   */
  mergedInto?: string;
}

export interface AudioManifestEntry {
  file: string;
  text: string;
  /** Nothing in this repository has been checked by a native speaker yet. */
  reviewed: boolean;
  voices: { nune: string; tigran: string };
  /** Where the clip was taken from before it was copied. */
  source?: string;
}

export type AudioManifest = Record<string, AudioManifestEntry>;

export type Voice = 'nune' | 'tigran';
export const VOICES: readonly Voice[] = ['nune', 'tigran'];

export interface LexiconProvenance {
  /** Commit of Arahet the registry was read from, or 'worktree'. */
  arahet: string;
  arahetDirty: boolean;
  aybuch: string;
  generatedAt: number;
  counts: {
    imported: number;
    active: number;
    merged: number;
    bySource: Record<LexiconSource, number>;
    withAudio: number;
    withoutAudio: number;
  };
}

/** A deck is a filter over the active registry, never a stored list. */
export type DeckFilter =
  | { kind: 'all' }
  | { kind: 'theme'; themeId: string }
  | { kind: 'level'; level: LexiconLevel }
  | { kind: 'arahet-grammar' };

export interface DeckDefinition {
  id: string;
  filter: DeckFilter;
  /** Set when the deck is built but not yet reachable from the shell. */
  visible: boolean;
}
