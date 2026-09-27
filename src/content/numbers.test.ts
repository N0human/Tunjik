import { describe, expect, it } from 'vitest';
import {
  ALL_NUMBER_IDS,
  NUMBER_MAX,
  NUMBER_MIN,
  numberId,
  numberToArmenian,
  numberValue,
} from './numbers';

describe('numberToArmenian', () => {
  it('names the units in the indefinite form', () => {
    expect(numberToArmenian(0)).toBe('զրո');
    expect(numberToArmenian(1)).toBe('մեկ');
    expect(numberToArmenian(2)).toBe('երկու');
    expect(numberToArmenian(9)).toBe('ին');
  });

  it('names 10 and the teens without the definite suffix', () => {
    expect(numberToArmenian(10)).toBe('տաս');
    expect(numberToArmenian(11)).toBe('տասնմեկ');
    expect(numberToArmenian(19)).toBe('տասնին');
  });

  it('fuses a tens digit with its unit and keeps a bare tens word', () => {
    expect(numberToArmenian(20)).toBe('քսան');
    expect(numberToArmenian(25)).toBe('քսանհինգ');
    expect(numberToArmenian(90)).toBe('իննսուն');
    expect(numberToArmenian(99)).toBe('իննսունին');
  });

  it('writes two hundred as երկու հարյուր with a space', () => {
    expect(numberToArmenian(100)).toBe('հարյուր');
    expect(numberToArmenian(200)).toBe('երկու հարյուր');
    expect(numberToArmenian(999)).toBe('ին հարյուր իննսունին');
  });

  it('rejects values outside the range and non-integers', () => {
    expect(() => numberToArmenian(-1)).toThrow(RangeError);
    expect(() => numberToArmenian(NUMBER_MAX + 1)).toThrow(RangeError);
    expect(() => numberToArmenian(1.5)).toThrow(RangeError);
  });

  it('produces a different word for every value in the range', () => {
    // The game asks "what is this number" with four options, so two values
    // sharing a word would make a question unanswerable.
    const words = new Set<string>();
    for (let value = NUMBER_MIN; value <= NUMBER_MAX; value += 1) words.add(numberToArmenian(value));
    expect(words.size).toBe(NUMBER_MAX - NUMBER_MIN + 1);
  });
});

describe('number ids', () => {
  it('pads to three digits so lexical order equals numeric order', () => {
    expect(numberId(0)).toBe('num-000');
    expect(numberId(42)).toBe('num-042');
    expect(numberId(NUMBER_MAX)).toBe('num-999');
  });

  it('round-trips through numberValue', () => {
    for (const id of ALL_NUMBER_IDS) expect(numberValue(id)).toBeGreaterThanOrEqual(NUMBER_MIN);
    expect(numberValue('word-arev')).toBeUndefined();
  });

  it('covers the whole range with unique ids', () => {
    expect(ALL_NUMBER_IDS).toHaveLength(1000);
    expect(new Set(ALL_NUMBER_IDS).size).toBe(1000);
  });
});
