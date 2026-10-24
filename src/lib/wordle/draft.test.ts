import assert from 'node:assert/strict';
import test from 'node:test';
import { draftReducer, initialDraft } from './draft';

test('a solver suggestion fills an untouched draft', () => {
  const draft = draftReducer(initialDraft, { type: 'suggest', guess: 'raise' });
  assert.equal(draft.guess, 'raise');
  assert.deepEqual(draft.tiles, ['B', 'B', 'B', 'B', 'B']);
});

test('a solver suggestion does not overwrite a word the user typed', () => {
  let draft = draftReducer(initialDraft, { type: 'suggest', guess: 'raise' });
  draft = draftReducer(draft, { type: 'edit-guess', guess: 'crane' });
  draft = draftReducer(draft, { type: 'suggest', guess: 'slate' });
  assert.equal(draft.guess, 'crane');
});

test('a solver suggestion does not clear tiles the user tapped', () => {
  let draft = draftReducer(initialDraft, { type: 'suggest', guess: 'raise' });
  draft = draftReducer(draft, { type: 'edit-tiles', tiles: ['G', 'B', 'Y', 'B', 'B'] });
  draft = draftReducer(draft, { type: 'suggest', guess: 'raise' });
  assert.equal(draft.guess, 'raise');
  assert.deepEqual(draft.tiles, ['G', 'B', 'Y', 'B', 'B']);
});

test('applying, undoing or resetting clears the previous guess and its tile colors', () => {
  let draft = draftReducer(initialDraft, { type: 'edit-guess', guess: 'night' });
  draft = draftReducer(draft, { type: 'edit-tiles', tiles: ['B', 'G', 'G', 'G', 'G'] });
  draft = draftReducer(draft, { type: 'board-changed' });
  assert.equal(draft.guess, '');
  assert.deepEqual(draft.tiles, ['B', 'B', 'B', 'B', 'B']);
});

test('after the board changes, the next suggestion fills the draft again', () => {
  let draft = draftReducer(initialDraft, { type: 'edit-guess', guess: 'crane' });
  draft = draftReducer(draft, { type: 'board-changed' });
  draft = draftReducer(draft, { type: 'suggest', guess: 'tough' });
  assert.equal(draft.guess, 'tough');
  assert.deepEqual(draft.tiles, ['B', 'B', 'B', 'B', 'B']);
});
