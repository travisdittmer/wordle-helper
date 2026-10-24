import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NON_CANONICAL_ANSWERS, POSSIBLE_WORDS } from './wordlists';
import { ANSWERS_BY_DATE } from './wordle/answersByDate';

const curated = fs
  .readFileSync(path.join(process.cwd(), 'src', 'data', 'possible_words.txt'), 'utf8')
  .split(/\r?\n/)
  .filter(Boolean);

test('NON_CANONICAL_ANSWERS flags every answer outside the curated list, including auto-appended ones', () => {
  // GUANO (2023) and TRILL (2026-10-23) reached POSSIBLE_WORDS via answers_by_date, not answer_overrides.txt.
  for (const w of ['guano', 'cubit', 'trill', 'mooch', 'carom']) {
    assert.ok(NON_CANONICAL_ANSWERS.has(w), `${w} should be a rare pick`);
  }
  assert.ok(!NON_CANONICAL_ANSWERS.has('cigar'), 'curated answers are not rare picks');
});

test('NON_CANONICAL_ANSWERS is exactly the answers missing from the frozen curated list', () => {
  const curatedSet = new Set(curated);
  const expected = new Set(ANSWERS_BY_DATE.filter((w) => !curatedSet.has(w)));
  for (const w of expected) assert.ok(NON_CANONICAL_ANSWERS.has(w), `${w} missing from NON_CANONICAL_ANSWERS`);
  for (const w of NON_CANONICAL_ANSWERS) assert.ok(!curatedSet.has(w), `${w} is in the curated list`);
});

test('POSSIBLE_WORDS is the curated list followed by every rare pick', () => {
  assert.deepEqual(POSSIBLE_WORDS.slice(0, curated.length), curated);
  assert.equal(POSSIBLE_WORDS.length, curated.length + NON_CANONICAL_ANSWERS.size);
  const possible = new Set(POSSIBLE_WORDS);
  for (const w of ANSWERS_BY_DATE) assert.ok(possible.has(w), `${w} answer missing from POSSIBLE_WORDS`);
});
