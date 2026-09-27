/**
 * Eastern Armenian numerals, 0–999, in the indefinite form.
 *
 * Ported from the aybuch project with one deliberate change: that generator
 * and the Arahet numbers lesson both produce the definite form for 9, 10 and
 * the teens — ինը, տասը, տասնինը — where a bare number takes ին, տաս,
 * տասնին. The recordings inherited the same defect: 11 of aybuch's `num00`–
 * `num99` clips are the definite form, and Arahet's `number-10` text is
 * տասը. Arahet's own product plan marks the number forms as awaiting
 * editorial review, so this divergence is recorded rather than hidden: the
 * game must ask for տաս, and the audio for it is generated in phase 10.
 *
 * Arahet keeps տաս հազար for ten thousand, which agrees with this form, so
 * the two projects were already inconsistent with each other.
 */
const UNITS: Readonly<Record<number, string>> = {
  0: 'զրո',
  1: 'մեկ',
  2: 'երկու',
  3: 'երեք',
  4: 'չորս',
  5: 'հինգ',
  6: 'վեց',
  7: 'յոթ',
  8: 'ութ',
  9: 'ին',
};

const TENS: Readonly<Record<number, string>> = {
  10: 'տաս',
  20: 'քսան',
  30: 'երեսուն',
  40: 'քառասուն',
  50: 'հիսուն',
  60: 'վաթսուն',
  70: 'յոթանասուն',
  80: 'ութսուն',
  90: 'իննսուն',
};

const TEEN_PREFIX = 'տասն';
const HUNDRED = 'հարյուր';

export const NUMBER_MIN = 0;
export const NUMBER_MAX = 999;

/** Cardinal number 0–999 to Eastern Armenian words. */
export function numberToArmenian(value: number): string {
  if (!Number.isInteger(value) || value < NUMBER_MIN || value > NUMBER_MAX) {
    throw new RangeError(`${NUMBER_MIN}..${NUMBER_MAX} expected, got ${value}`);
  }
  if (value < 10) return UNITS[value]!;
  if (value === 10) return TENS[10]!;
  // 11..19 — տասն + unit, and the unit must be the bare one (տասնին).
  if (value < 20) return TEEN_PREFIX + UNITS[value - 10]!;
  if (value < 100) {
    const tens = Math.floor(value / 10) * 10;
    const unit = value % 10;
    // Tens and units fuse in writing: քսանհինգ, not քսան հինգ.
    return unit === 0 ? TENS[tens]! : TENS[tens]! + UNITS[unit]!;
  }
  // Two hundred is երկու հարյուր with a space, and the rest follows it. The
  // aybuch generator fuses the unit onto հարյուր instead, which contradicts
  // Arahet's numbers data and the two-hundred rule verified there against
  // Jasmine Dum-Tragut, Modern Eastern Armenian.
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  const head = hundreds === 1 ? HUNDRED : `${UNITS[hundreds]!} ${HUNDRED}`;
  return rest === 0 ? head : `${head} ${numberToArmenian(rest)}`;
}

/** Stable id: zero padding keeps lexicographic order equal to numeric order. */
export function numberId(value: number): string {
  if (!Number.isInteger(value) || value < NUMBER_MIN || value > NUMBER_MAX) {
    throw new RangeError(`${NUMBER_MIN}..${NUMBER_MAX} expected, got ${value}`);
  }
  return `num-${String(value).padStart(3, '0')}`;
}

export function numberValue(id: string): number | undefined {
  const match = /^num-(\d{3})$/.exec(id);
  return match ? Number(match[1]) : undefined;
}

export const ALL_NUMBER_IDS: readonly string[] = Array.from(
  { length: NUMBER_MAX - NUMBER_MIN + 1 },
  (_unused, index) => numberId(NUMBER_MIN + index),
);
