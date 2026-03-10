import assert from 'node:assert/strict';
import test from 'node:test';
import { feedbackPattern } from './feedback';
import { filterCandidatesByFeedback } from './solver';

// Verify feedback patterns for the SHOAL bug scenario
test('feedbackPattern: ALLOY vs SHOAL gives YYBYB', () => {
  assert.equal(feedbackPattern('alloy', 'shoal'), 'YYBYB');
});

test('feedbackPattern: SHOLA vs SHOAL gives GGGYY', () => {
  assert.equal(feedbackPattern('shola', 'shoal'), 'GGGYY');
});

test('feedbackPattern: ROATE vs SHOAL gives BYYBB', () => {
  assert.equal(feedbackPattern('roate', 'shoal'), 'BYYBB');
});

// Verify SHOAL survives filtering with correct feedback
test('SHOAL survives filtering with correct ROATE then ALLOY feedback', () => {
  const words = ['shoal', 'shola', 'chola', 'gaols', 'skoal', 'alloy', 'roate'];

  // After ROATE with BYYBB
  const afterRoate = filterCandidatesByFeedback({
    candidates: words,
    guess: 'roate',
    pattern: 'BYYBB',
  });
  assert.ok(afterRoate.includes('shoal'), 'SHOAL should survive ROATE filtering');

  // After ALLOY with correct feedback YYBYB
  const afterAlloy = filterCandidatesByFeedback({
    candidates: afterRoate,
    guess: 'alloy',
    pattern: 'YYBYB',
  });
  assert.ok(afterAlloy.includes('shoal'), 'SHOAL should survive ALLOY filtering with correct feedback');

  // After SHOLA with GGGYY
  const afterShola = filterCandidatesByFeedback({
    candidates: afterAlloy,
    guess: 'shola',
    pattern: 'GGGYY',
  });
  assert.ok(afterShola.includes('shoal'), 'SHOAL should survive SHOLA filtering');
  assert.equal(afterShola.length, 1, 'SHOAL should be the only remaining candidate');
});

// Verify SHOAL is eliminated by wrong ALLOY feedback (the user's actual scenario)
test('SHOAL eliminated by incorrect ALLOY feedback BYBGY', () => {
  const words = ['shoal', 'shola', 'chola', 'gaols', 'skoal'];

  const afterRoate = filterCandidatesByFeedback({
    candidates: words,
    guess: 'roate',
    pattern: 'BYYBB',
  });
  assert.ok(afterRoate.includes('shoal'));

  // Wrong feedback BYBGY instead of correct YYBYB
  const afterAlloy = filterCandidatesByFeedback({
    candidates: afterRoate,
    guess: 'alloy',
    pattern: 'BYBGY',
  });
  assert.ok(!afterAlloy.includes('shoal'), 'SHOAL should be eliminated by wrong ALLOY feedback');
});
