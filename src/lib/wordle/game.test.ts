import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pattern } from './feedback';
import { buildShareText, gameStatus, MAX_GUESSES, turnsLeft } from './game';

const row = (guess: string, pattern: string) => ({ guess, pattern: pattern as Pattern });
const misses = (n: number) => Array.from({ length: n }, () => row('night', 'BGGGG'));

test('game is in progress until all-green feedback or six guesses', () => {
  assert.equal(gameStatus([]), 'playing');
  assert.equal(gameStatus(misses(5)), 'playing');
});

test('all-green feedback wins, including on the sixth guess', () => {
  assert.equal(gameStatus([row('raise', 'BBGBB'), row('fight', 'GGGGG')]), 'won');
  assert.equal(gameStatus([...misses(5), row('fight', 'GGGGG')]), 'won');
});

test('six guesses without all-green feedback is a loss', () => {
  assert.equal(MAX_GUESSES, 6);
  assert.equal(gameStatus(misses(6)), 'lost');
});

test('narrowing to one candidate is not a win', () => {
  // The old UI showed "Solved!" here; only all-green feedback counts.
  assert.equal(gameStatus([row('raise', 'BBGBB'), row('clout', 'BGBBY')]), 'playing');
});

test('turnsLeft counts down from six and stops at zero', () => {
  assert.equal(turnsLeft([]), 6);
  assert.equal(turnsLeft(misses(5)), 1);
  assert.equal(turnsLeft(misses(6)), 0);
});

test('share text has one row per guess actually played', () => {
  const text = buildShareText([row('raise', 'BBGBB'), row('clout', 'BGBBY'), row('blitz', 'GGGGG')]);
  assert.equal(text, 'Wordle Helper → Solved in 3\n\n⬛⬛\u{1F7E9}⬛⬛\n⬛\u{1F7E9}⬛⬛\u{1F7E8}\n\u{1F7E9}\u{1F7E9}\u{1F7E9}\u{1F7E9}\u{1F7E9}\n\nwordle.arco42.com');
});

test('there is no share text for a game that was not won', () => {
  // Previously a deduced answer appended an unplayed green row ("Share result (7 guesses)").
  assert.equal(buildShareText(misses(6)), null);
  assert.equal(buildShareText([row('raise', 'BBGBB')]), null);
});
