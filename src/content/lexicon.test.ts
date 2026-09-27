import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from './audio-manifest.json';
import lexicon from './lexicon.json';
import provenance from './provenance.json';
import type { AudioManifest, LexiconEntry, LexiconProvenance } from './types';
import { VOICES } from './types';
import { ALL_NUMBER_IDS, numberToArmenian, numberValue } from './numbers';

const entries = lexicon as LexiconEntry[];
const audio = manifest as unknown as AudioManifest;
const source = provenance as LexiconProvenance;
const audioDir = join(__dirname, '..', '..', 'public', 'audio');

const active = entries.filter((entry) => !entry.mergedInto);
const merged = entries.filter((entry) => entry.mergedInto);

/** Same normalisation the import uses, so a drift is caught here too. */
function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').replace(/[։՝՜]+$/, '').trim();
}

describe('реестр', () => {
  // These counts are a contract with the two source projects. When a source
  // changes, this test is what should fail first and force a deliberate
  // update of the plan and the status tables.
  it('merges to the counts the plan records', () => {
    expect(entries).toHaveLength(3188);
    expect(active).toHaveLength(3113);
    expect(merged).toHaveLength(75);
    expect(source.counts.imported).toBe(entries.length);
    expect(source.counts.active).toBe(active.length);
    expect(source.counts.merged).toBe(merged.length);
  });

  it('keeps every id unique across all records', () => {
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
  });

  it('keeps the Armenian text unique among active records', () => {
    // The dedup rule: Arahet and the numerals win collisions, so no two active
    // records may share a text. A duplicate would put two cards with the same
    // word into a pair game.
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const entry of active) {
      const key = normalizeText(entry.text);
      const previous = seen.get(key);
      if (previous) duplicates.push(`${entry.text}: ${previous} / ${entry.id}`);
      else seen.set(key, entry.id);
    }
    expect(duplicates).toEqual([]);
  });

  it('points every merged record at a record that exists', () => {
    const ids = new Set(entries.map((entry) => entry.id));
    for (const entry of merged) expect(ids.has(entry.mergedInto!)).toBe(true);
  });

  it('excludes merged records from audio and from the pool', () => {
    for (const entry of merged) expect(entry.audioId).toBeUndefined();
    const activeIds = new Set(active.map((entry) => entry.id));
    for (const entry of merged) expect(activeIds.has(entry.mergedInto!)).toBe(true);
  });

  it('carries a full translation on every active record', () => {
    for (const entry of active) {
      expect(entry.meaning.ru.length, entry.id).toBeGreaterThan(0);
      expect(entry.meaning.en.length, entry.id).toBeGreaterThan(0);
      expect(entry.meaning.ru.length, entry.id).toBeLessThanOrEqual(3);
    }
  });

  it('carries Armenian script on every record', () => {
    for (const entry of entries) expect(entry.text, entry.id).toMatch(/[\u0530-\u058F]/);
  });

  it('records where each source was read from', () => {
    expect(source.arahet).toMatch(/^[0-9a-f]{7,}$/);
    expect(source.aybuch).toMatch(/^[0-9a-f]{7,}$/);
  });
});

const numerals = active.filter((entry) => entry.kind === 'number' && entry.source === 'derived');

describe('числительные', () => {
  it('covers 0–999 exactly once', () => {
    expect(numerals).toHaveLength(1000);
    expect(numerals.map((entry) => entry.id)).toEqual([...ALL_NUMBER_IDS]);
  });

  it('names every number in the indefinite form', () => {
    for (const entry of numerals) {
      const value = numberValue(entry.id)!;
      expect(entry.text, entry.id).toBe(numberToArmenian(value));
      expect(entry.meaning.ru).toEqual([String(value)]);
    }
  });

  it('keeps the eight Arahet numbers above 999 as separate words', () => {
    // Arahet covers thousand, ten thousand, million and the rest with real
    // reviewed copy and recordings. They fall outside the game range, so they
    // stay active beside the derived set instead of being folded into it.
    const large = active.filter((entry) => entry.kind === 'number' && entry.source === 'arahet');
    // Compared as a set: the order would only depend on collation.
    expect(new Set(large.map((entry) => entry.meaning.ru[0]))).toEqual(new Set([
      'тысяча', 'десять тысяч', 'двадцать тысяч', 'тридцать тысяч', 'пятьдесят тысяч',
      'сто тысяч', 'миллион', 'миллиард',
    ]));
    for (const entry of large) expect(entry.audioId).toBeDefined();
  });

  it('does not claim a recording whose text differs', () => {
    // 9, 10 and the teens exist in the sources only in the definite form
    // (ինը, տասը), so they must stay without audio until phase 10.
    for (const id of ['num-009', 'num-010', 'num-019']) {
      expect(active.find((entry) => entry.id === id)?.audioId).toBeUndefined();
    }
    expect(active.find((entry) => entry.id === 'num-001')?.audioId).toBe('arahet:number-1');
  });

  it('carries the reviewed data only where the text matches', () => {
    const withIpa = active.filter((entry) => entry.kind === 'number' && entry.ipa);
    expect(withIpa.map((entry) => entry.id)).toEqual([
      'num-001', 'num-002', 'num-003', 'num-004', 'num-005', 'num-006', 'num-007', 'num-008',
    ]);
    expect(active.find((entry) => entry.id === 'num-100')?.transliteration).toBe('haryur');
  });
});

describe('манифест озвучки', () => {
  it('resolves every audioId of an active record', () => {
    for (const entry of active) {
      if (!entry.audioId) continue;
      expect(Object.keys(audio), entry.id).toContain(entry.audioId);
    }
  });

  it('publishes both voices for every material', () => {
    for (const [id, record] of Object.entries(audio)) {
      for (const voice of VOICES) expect(record.voices[voice], id).toBeDefined();
      expect(record.file, id).toBe(record.voices.nune);
    }
  });

  it('names files after the record and the voice', () => {
    for (const record of Object.values(audio)) {
      for (const voice of VOICES) expect(record.voices[voice]).toMatch(new RegExp(`-${voice}\\.m4a$`));
    }
  });

  it('has the file on disk for every published voice', () => {
    const missing: string[] = [];
    for (const record of Object.values(audio)) {
      for (const voice of VOICES) {
        const path = join(audioDir, record.voices[voice]);
        if (!existsSync(path) || statSync(path).size === 0) missing.push(record.voices[voice]);
      }
    }
    expect(missing).toEqual([]);
  });

  it('marks nothing as reviewed, because nothing has been listened to', () => {
    expect(Object.values(audio).every((record) => record.reviewed === false)).toBe(true);
  });

  it('speaks the same text the game shows', () => {
    for (const entry of active) {
      if (!entry.audioId) continue;
      const record = audio[entry.audioId];
      if (!record) continue;
      // A numeral may only borrow a clip recorded for the same word, and the
      // import refuses a text mismatch, so this holds for every active record
      // except letters: a letter's clip says its name (այբ), while the record
      // shows the glyph pair (Ա ա). That difference is deliberate.
      if (entry.kind === 'letter') {
        // The clip says the letter's name, the record shows the glyph pair.
        expect(entry.audioId, entry.id).toMatch(/-name$/);
        expect(record.text, entry.id).not.toBe(entry.text);
        expect(record.text, entry.id).toMatch(/^[\u0530-\u058F]+$/);
        expect(entry.meaning.ru[0], entry.id).not.toBe(entry.text);
        continue;
      }
      expect(normalizeText(record.text), entry.id).toBe(normalizeText(entry.text));
    }
  });
});
