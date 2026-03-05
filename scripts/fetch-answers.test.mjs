import assert from 'node:assert/strict';
import { test } from 'node:test';

// Inline the pure functions we want to test.
function formatDate(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

test('formatDate produces YYYY-MM-DD', () => {
  assert.equal(formatDate(new Date('2021-06-19T00:00:00Z')), '2021-06-19');
  assert.equal(formatDate(new Date('2026-03-05T12:00:00Z')), '2026-03-05');
});

test('origin date is Wordle #1', () => {
  // Wordle #1 = cigar = 2021-06-19
  assert.equal(formatDate(new Date('2021-06-19')), '2021-06-19');
});

test('date range covers expected number of days', () => {
  const origin = new Date('2021-06-19');
  const end = new Date('2026-03-04'); // yesterday as of plan date
  const days = Math.floor((end - origin) / (1000 * 60 * 60 * 24));
  // Should be 1719 days, meaning 1720 entries (inclusive of origin)
  assert.equal(days + 1, 1720);
});
