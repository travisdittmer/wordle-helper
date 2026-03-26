#!/usr/bin/env node
/**
 * Fetches the complete valid-guess word list from the NYT Wordle JS bundle.
 *
 * NYT's Wordle page loads a webpack chunk containing a single large array of
 * 5-letter words. The array is split into two sections:
 *   1. Guess-only words (alphabetically sorted)
 *   2. Answer-pool words (in original puzzle order, starting with "cigar")
 *
 * This script:
 *   1. Fetches the Wordle HTML page
 *   2. Finds all JS chunk URLs
 *   3. Downloads each chunk and locates the one with the word array
 *   4. Extracts all words and writes them (sorted) to allowed_words.txt
 *
 * Run: npm run fetch:allowed
 * Then: npm run sync:wordlists
 */
import fs from 'node:fs';
import path from 'node:path';

const WORDLE_URL = 'https://www.nytimes.com/games/wordle/index.html';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const root = process.cwd();
const allowedPath = path.join(root, 'src', 'data', 'allowed_words.txt');

async function fetchWithRetry(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Referer: WORDLE_URL,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = 1000 * attempt;
      console.warn(`  Retry ${attempt}/${retries}: ${err.message} (waiting ${delay}ms)`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

/**
 * Extract all 5-letter lowercase word arrays from a JS bundle.
 * Returns arrays with > 1000 words (to filter out small incidental matches).
 */
function extractWordArrays(jsContent) {
  // Match array literals containing quoted 5-letter words.
  // The word array is inside a [...] with thousands of "xxxxx" entries.
  const arrays = [];
  const arrayRegex = /\[([^\]]*"[a-z]{5}"[^\]]*)\]/g;
  let match;
  while ((match = arrayRegex.exec(jsContent)) !== null) {
    const inner = match[1];
    const words = inner.match(/"([a-z]{5})"/g);
    if (words && words.length > 1000) {
      arrays.push(words.map((w) => w.replace(/"/g, '')));
    }
  }
  return arrays;
}

async function main() {
  console.log('Fetching Wordle page...');
  const html = await fetchWithRetry(WORDLE_URL);

  // Extract all JS chunk URLs from script tags
  const jsUrls = [];
  const scriptRegex = /src="(https:\/\/www\.nytimes\.com\/games-assets\/v2\/[^"]+\.js)"/g;
  let m;
  while ((m = scriptRegex.exec(html)) !== null) {
    jsUrls.push(m[1]);
  }

  if (jsUrls.length === 0) {
    throw new Error(
      'No JS bundle URLs found on Wordle page. NYT may have changed the page structure.'
    );
  }
  console.log(`Found ${jsUrls.length} JS chunks. Scanning for word data...`);

  let allWords = null;

  for (const url of jsUrls) {
    const chunkName = path.basename(url);
    let content;
    try {
      content = await fetchWithRetry(url);
    } catch (err) {
      console.warn(`  Skipping ${chunkName}: ${err.message}`);
      continue;
    }

    const arrays = extractWordArrays(content);
    if (arrays.length > 0) {
      // Take the largest array found
      const largest = arrays.reduce((a, b) => (a.length > b.length ? a : b));
      console.log(`  Found word array in ${chunkName}: ${largest.length} words`);
      allWords = largest;
      break;
    }
  }

  if (!allWords) {
    throw new Error(
      'Could not find word array in any JS chunk. NYT may have changed their bundle format.\n' +
        'Try running with DEBUG=1 for more details, or check the Wordle page manually.'
    );
  }

  // Deduplicate and sort
  const wordSet = new Set(allWords);
  const sorted = [...wordSet].sort();

  // Read existing allowed_words for comparison
  let existingCount = 0;
  try {
    const existing = fs
      .readFileSync(allowedPath, 'utf8')
      .split(/\r?\n/)
      .map((w) => w.trim().toLowerCase())
      .filter((w) => /^[a-z]{5}$/.test(w));
    existingCount = existing.length;

    const existingSet = new Set(existing);
    const added = sorted.filter((w) => !existingSet.has(w));
    const removed = existing.filter((w) => !wordSet.has(w));

    if (added.length > 0) {
      console.log(`  +${added.length} new words (sample: ${added.slice(0, 10).join(', ')})`);
    }
    if (removed.length > 0) {
      console.log(
        `  -${removed.length} removed words (sample: ${removed.slice(0, 10).join(', ')})`
      );
    }
    if (added.length === 0 && removed.length === 0) {
      console.log('  No changes — word list is already up to date.');
      return;
    }
  } catch {
    /* first run — no existing file */
  }

  // Write sorted word list
  fs.writeFileSync(allowedPath, sorted.join('\n') + '\n', 'utf8');

  console.log(
    `\nWrote ${sorted.length} words to ${path.relative(root, allowedPath)}` +
      (existingCount > 0 ? ` (was ${existingCount})` : '')
  );
  console.log('Run `npm run sync:wordlists` to regenerate wordlists.ts');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
