// VIPOS — pure-helper regression tests for `utils/signup-helpers.js`.
//
// These three helpers gate the signup flow:
//   - `slugify(input)`: derive a tenant subdomain candidate from the
//     user's typed business name. Output is fed into <Input value=...>
//     and downstream POST /auth/signup. A regression here means user
//     gets an invalid slug (rejected by API) or a slug different from
//     what they previewed in the input.
//   - `SLUG_REGEX`: the source of truth for "is this slug acceptable
//     to send to the API". Used in real-time validation. A regression
//     either accepts invalid slugs (API will reject) or rejects valid
//     ones (user can't proceed).
//   - `scorePassword(pw)`: the 0–4 strength meter shown next to the
//     password input. Drives both the visible label and the
//     submit-disabled gate.
//
// All three are pure (no DOM, no API, no React). Pinning behaviour
// here protects against accidental regex / scoring tweaks.

import { describe, expect, it } from 'vitest';
import { slugify, SLUG_REGEX, scorePassword } from '../utils/signup-helpers';

describe('slugify', () => {
  it('returns empty string for non-string inputs', () => {
    expect(slugify(null)).toBe('');
    expect(slugify(undefined)).toBe('');
    expect(slugify(123)).toBe('');
    expect(slugify({})).toBe('');
    expect(slugify([])).toBe('');
  });

  it('lowercases and dashes ASCII input', () => {
    expect(slugify('Toko Buku Pak Budi')).toBe('toko-buku-pak-budi');
    expect(slugify('VIPOS Demo')).toBe('vipos-demo');
  });

  it('strips accents (NFKD + combining marks)', () => {
    expect(slugify('Café Niño')).toBe('cafe-nino');
    expect(slugify('Crème Brûlée')).toBe('creme-brulee');
  });

  it('collapses non-alphanumeric runs into single dashes', () => {
    expect(slugify('foo___bar...baz!!!qux')).toBe('foo-bar-baz-qux');
    expect(slugify('a@b#c$d%e')).toBe('a-b-c-d-e');
  });

  it('strips leading and trailing dashes', () => {
    expect(slugify('---hello---')).toBe('hello');
    expect(slugify('!!!warung kopi???')).toBe('warung-kopi');
  });

  it('caps output at 40 characters', () => {
    const long = 'a'.repeat(50);
    const out = slugify(long);
    expect(out).toBe('a'.repeat(40));
    expect(out.length).toBe(40);
  });

  it('returns empty string for input that contains only non-alphanumeric', () => {
    expect(slugify('!!!')).toBe('');
    expect(slugify('   ')).toBe('');
    expect(slugify('---')).toBe('');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });
});

describe('SLUG_REGEX', () => {
  it('accepts valid slugs (3–40 chars, lowercase alnum + interior dashes)', () => {
    expect(SLUG_REGEX.test('abc')).toBe(true);
    expect(SLUG_REGEX.test('toko-buku-pak-budi')).toBe(true);
    expect(SLUG_REGEX.test('vipos-demo')).toBe(true);
    expect(SLUG_REGEX.test('a1b2c3')).toBe(true);
    expect(SLUG_REGEX.test('a' + 'b'.repeat(38) + 'c')).toBe(true); // 40 chars
  });

  it('accepts the minimum-length 1-character slug', () => {
    expect(SLUG_REGEX.test('a')).toBe(true);
    expect(SLUG_REGEX.test('1')).toBe(true);
  });

  it('rejects slugs starting or ending with a dash', () => {
    expect(SLUG_REGEX.test('-abc')).toBe(false);
    expect(SLUG_REGEX.test('abc-')).toBe(false);
    expect(SLUG_REGEX.test('-abc-')).toBe(false);
  });

  it('rejects slugs with uppercase letters', () => {
    expect(SLUG_REGEX.test('ABC')).toBe(false);
    expect(SLUG_REGEX.test('toko-Budi')).toBe(false);
  });

  it('rejects slugs with non-dash special characters', () => {
    expect(SLUG_REGEX.test('toko_budi')).toBe(false);
    expect(SLUG_REGEX.test('toko.budi')).toBe(false);
    expect(SLUG_REGEX.test('toko budi')).toBe(false);
    expect(SLUG_REGEX.test('toko@budi')).toBe(false);
  });

  it('rejects slugs longer than 40 characters', () => {
    expect(SLUG_REGEX.test('a'.repeat(41))).toBe(false);
    expect(SLUG_REGEX.test('a' + 'b'.repeat(40) + 'c')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(SLUG_REGEX.test('')).toBe(false);
  });
});

describe('scorePassword', () => {
  it('returns score=0 with empty label for empty / non-string input', () => {
    expect(scorePassword('')).toEqual({ score: 0, label: '' });
    expect(scorePassword(null)).toEqual({ score: 0, label: '' });
    expect(scorePassword(undefined)).toEqual({ score: 0, label: '' });
    expect(scorePassword(123)).toEqual({ score: 0, label: '' });
  });

  it('scores short all-lowercase password as Lemah (score=1)', () => {
    // length>=6 = +1; no other rules trigger
    expect(scorePassword('abcdef')).toEqual({ score: 1, label: 'Lemah' });
  });

  it('scores medium-length all-lowercase password as Cukup (score=2)', () => {
    // length>=6 = +1; length>=10 = +1
    expect(scorePassword('abcdefghij')).toEqual({ score: 2, label: 'Cukup' });
  });

  it('scores mixed-case medium-length password as Kuat (score=3)', () => {
    // length>=6 = +1; length>=10 = +1; mixed case = +1
    expect(scorePassword('AbCdEfGhIj')).toEqual({ score: 3, label: 'Kuat' });
  });

  it('scores mixed-case + digits as Sangat kuat (score=4)', () => {
    // length>=6 = +1; length>=10 = +1; mixed case = +1; digit = +1
    expect(scorePassword('AbCdEfGh12')).toEqual({ score: 4, label: 'Sangat kuat' });
  });

  it('caps score at 4 even when all five rules trigger', () => {
    // length>=6 + length>=10 + mixed case + digit + symbol = 5; capped to 4
    const result = scorePassword('AbCdEfGh12!');
    expect(result.score).toBe(4);
    expect(result.label).toBe('Sangat kuat');
  });

  it('counts symbols toward score even without digits', () => {
    // length>=6 + length>=10 + mixed case + symbol = 4
    expect(scorePassword('AbCdEfGh!@')).toEqual({ score: 4, label: 'Sangat kuat' });
  });

  it('scores a 1-character password as Lemah (score=0)', () => {
    // length<6, no other rule triggers
    expect(scorePassword('a')).toEqual({ score: 0, label: 'Lemah' });
  });

  it('boundary: length=5 does not get the length>=6 bonus', () => {
    expect(scorePassword('abcde')).toEqual({ score: 0, label: 'Lemah' });
  });

  it('boundary: length=6 gets +1 but length<10 stays 1', () => {
    expect(scorePassword('abcdef')).toEqual({ score: 1, label: 'Lemah' });
  });

  it('boundary: length=10 gets the length>=10 bonus', () => {
    expect(scorePassword('abcdefghij')).toEqual({ score: 2, label: 'Cukup' });
  });

  it('mixed-case alone (no length bonus) does not score', () => {
    // length<6: only mixed-case rule eligible, but it requires both upper
    // AND lower. Length is 4 (<6), so no length bonus; rule still triggers.
    expect(scorePassword('AbCd')).toEqual({ score: 1, label: 'Lemah' });
  });
});
