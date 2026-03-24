#!/usr/bin/env node

/**
 * generate-sentences.mjs
 *
 * Generates one sentence per Wordle answer word using the claude CLI.
 * Processes in batches of 40 words to stay well within context limits.
 * Resumes from where it left off if interrupted.
 *
 * Usage:
 *   node scripts/generate-sentences.mjs              # generate all
 *   node scripts/generate-sentences.mjs --validate   # validate existing output
 *   node scripts/generate-sentences.mjs --unused-first  # prioritize never-used words
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// --- Config ---
const BATCH_SIZE = 40;
const OUTPUT_FILE = join(ROOT, 'src', 'data', 'sentences.json');
const WORDLIST_FILE = join(ROOT, 'src', 'lib', 'wordlists.ts');
const ANSWERS_FILE = join(ROOT, 'src', 'data', 'answers_by_date_wordlist.txt');

const STYLES = [
  'dry_wit',
  'deadpan_dark',
  'gallows_humor',
  'sardonic',
  'pop_reference',
  'fun_fact',
];

const STYLE_DESCRIPTIONS = {
  dry_wit:
    'Understated, clever, the joke is almost hidden. The humor comes from what is not said, or from a gap between tone and content.',
  deadpan_dark:
    'Disturbing or morbid content delivered with completely flat affect — no wink, no punchline. The reader does a double-take.',
  gallows_humor:
    "Laughing at the worst-case scenario, self-aware about the darkness. The speaker knows it's grim and leans in anyway — cathartic, not cruel.",
  sardonic:
    'Bitter, mocking, punching up or outward at a target. There is a clear object of scorn — institutions, pretension, hypocrisy.',
  pop_reference:
    'Cultural, historical, cinematic, musical — common knowledge given a twist. Informative but casual.',
  fun_fact:
    'Genuinely surprising, informative, the "huh, neat" reaction. Teaches the reader something true they probably didn\'t know.',
};

// --- Parse word list ---
function loadPossibleWords() {
  const content = readFileSync(WORDLIST_FILE, 'utf-8');
  const match = content.match(/export const POSSIBLE_WORDS[^=]*=\s*\[(.*?)\];/s);
  if (!match) throw new Error('Could not parse POSSIBLE_WORDS from wordlists.ts');
  return [...match[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
}

function loadUsedAnswers() {
  const raw = readFileSync(ANSWERS_FILE, 'utf-8').trim();
  return new Set(raw.split(',').map((w) => w.trim()).filter(Boolean));
}

// --- Load existing progress ---
function loadExisting() {
  if (!existsSync(OUTPUT_FILE)) return new Map();
  const data = JSON.parse(readFileSync(OUTPUT_FILE, 'utf-8'));
  return new Map(data.map((e) => [e.word, e]));
}

function saveOutput(entries) {
  const sorted = [...entries.values()].sort((a, b) => a.word.localeCompare(b.word));
  writeFileSync(OUTPUT_FILE, JSON.stringify(sorted, null, 2) + '\n');
}

// --- Build prompt for a batch ---
function buildPrompt(words) {
  const wordLines = words
    .map(({ word, style }) => `- ${word} (${style})`)
    .join('\n');

  return `You are writing sentences for a Wordle app. Each sentence is shown to the user after they solve the puzzle as a small reward.

STYLE GUIDE:
- dry_wit: ${STYLE_DESCRIPTIONS.dry_wit}
- deadpan_dark: ${STYLE_DESCRIPTIONS.deadpan_dark}
- gallows_humor: ${STYLE_DESCRIPTIONS.gallows_humor}
- sardonic: ${STYLE_DESCRIPTIONS.sardonic}
- pop_reference: ${STYLE_DESCRIPTIONS.pop_reference}
- fun_fact: ${STYLE_DESCRIPTIONS.fun_fact}

RULES:
1. Use the EXACT word in the sentence — no conjugations, plurals, or derived forms
2. 10–20 words per sentence, one sentence only
3. Do NOT define the word — show its meaning through context
4. Each sentence must stand completely on its own
5. Fun facts should be verifiable. Pop references should be recognizable.
6. Vary sentence structure — avoid repetitive patterns across entries

Generate one sentence per word below. Respond with ONLY a JSON array. No markdown fences, no preamble.

Format: [{"word":"example","style":"dry_wit","sentence":"The sentence here."}]

Words:
${wordLines}`;
}

// --- Call claude CLI ---
function callClaude(prompt) {
  // Write prompt to temp file to avoid shell escaping issues
  const tmpFile = '/tmp/wordle_sentence_prompt.txt';
  writeFileSync(tmpFile, prompt);

  try {
    const result = execSync(
      `claude -p "$(cat ${tmpFile})" --output-format json --max-turns 1`,
      {
        encoding: 'utf-8',
        timeout: 180_000, // 3 minutes per batch
        maxBuffer: 1024 * 1024,
      }
    );

    // Parse the claude CLI JSON output to get the text content
    let text;
    try {
      const cliOutput = JSON.parse(result);
      text = cliOutput.result || result;
    } catch {
      text = result;
    }

    // Extract JSON array from response (handles possible markdown fences)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('No JSON array found in response. Raw output:');
      console.error(text.slice(0, 500));
      return null;
    }
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error(`Claude CLI error: ${err.message}`);
    return null;
  }
}

// --- Validation ---
function validate(entry) {
  const issues = [];
  const { word, sentence } = entry;

  // Word appears verbatim (case-insensitive, whole word)
  const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
  if (!wordRegex.test(sentence)) {
    issues.push(`word "${word}" not found verbatim`);
  }

  // Check for conjugations/plurals (common suffixes)
  const conjugated = new RegExp(
    `\\b${word}(s|ed|ing|er|est|ly|tion|ment|ness)\\b`,
    'i'
  );
  const conjugatedMatch = sentence.match(conjugated);
  if (conjugatedMatch && !wordRegex.test(sentence)) {
    issues.push(`appears conjugated as "${conjugatedMatch[0]}"`);
  }

  // Word count 10-20
  const wordCount = sentence.split(/\s+/).filter(Boolean).length;
  if (wordCount < 10 || wordCount > 20) {
    issues.push(`word count ${wordCount} (need 10-20)`);
  }

  // Single sentence (rough check: shouldn't have multiple sentence-ending punctuation)
  const sentenceEnds = sentence.match(/[.!?]+/g);
  if (sentenceEnds && sentenceEnds.length > 1) {
    // Allow if the extra periods are in abbreviations or numbers
    const stripped = sentence.replace(/\b(Mr|Mrs|Ms|Dr|St|vs|etc|Jr|Sr|U\.S|a\.m|p\.m)\./gi, '');
    const cleanEnds = stripped.match(/[.!?]+/g);
    if (cleanEnds && cleanEnds.length > 1) {
      issues.push(`may contain multiple sentences`);
    }
  }

  return issues;
}

function runValidation(entries) {
  let total = 0;
  let failed = 0;
  const failures = [];

  for (const entry of entries.values()) {
    total++;
    const issues = validate(entry);
    if (issues.length > 0) {
      failed++;
      failures.push({ word: entry.word, issues });
    }
  }

  console.log(`\nValidation: ${total} entries, ${total - failed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures.slice(0, 30)) {
      console.log(`  ${f.word}: ${f.issues.join('; ')}`);
    }
    if (failures.length > 30) {
      console.log(`  ... and ${failures.length - 30} more`);
    }
  }
  return failures;
}

// --- Main ---
async function main() {
  const args = process.argv.slice(2);
  const validateOnly = args.includes('--validate');
  const unusedFirst = args.includes('--unused-first');

  const allWords = loadPossibleWords();
  const usedAnswers = loadUsedAnswers();
  const existing = loadExisting();

  console.log(`Total words: ${allWords.length}`);
  console.log(`Already generated: ${existing.size}`);

  if (validateOnly) {
    runValidation(existing);
    return;
  }

  // Assign styles based on alphabetical index (stable ordering)
  const wordsWithStyles = allWords
    .slice()
    .sort()
    .map((word, i) => ({
      word,
      style: STYLES[i % 6],
      used: usedAnswers.has(word),
    }));

  // Filter to only words we haven't generated yet
  let remaining = wordsWithStyles.filter((w) => !existing.has(w.word));
  console.log(`Remaining to generate: ${remaining.length}`);

  if (remaining.length === 0) {
    console.log('All words already have sentences. Running validation...');
    runValidation(existing);
    return;
  }

  // Optionally prioritize never-used words
  if (unusedFirst) {
    const unused = remaining.filter((w) => !w.used);
    const used = remaining.filter((w) => w.used);
    remaining = [...unused, ...used];
    console.log(`Prioritizing ${unused.length} never-used words first`);
  }

  // Process in batches
  const totalBatches = Math.ceil(remaining.length / BATCH_SIZE);
  let successCount = 0;
  let failCount = 0;

  for (let b = 0; b < totalBatches; b++) {
    const batch = remaining.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
    const batchWords = batch.map((w) => ({ word: w.word, style: w.style }));

    console.log(
      `\n[Batch ${b + 1}/${totalBatches}] Generating ${batch.length} words: ${batch[0].word}...${batch[batch.length - 1].word}`
    );

    const prompt = buildPrompt(batchWords);
    const results = callClaude(prompt);

    if (!results || !Array.isArray(results)) {
      console.error(`  FAILED — skipping batch, will retry on next run`);
      failCount += batch.length;
      continue;
    }

    // Merge results
    let batchSuccess = 0;
    for (const entry of results) {
      if (entry.word && entry.sentence) {
        existing.set(entry.word, {
          word: entry.word,
          style: entry.style || batch.find((w) => w.word === entry.word)?.style || 'unknown',
          sentence: entry.sentence,
        });
        batchSuccess++;
      }
    }

    // Check for missing words in this batch
    const returned = new Set(results.map((r) => r.word));
    const missing = batch.filter((w) => !returned.has(w.word));
    if (missing.length > 0) {
      console.warn(`  Missing ${missing.length} words: ${missing.map((m) => m.word).join(', ')}`);
    }

    successCount += batchSuccess;
    console.log(`  OK — ${batchSuccess}/${batch.length} sentences generated (total: ${existing.size}/${allWords.length})`);

    // Save after each batch for resume safety
    saveOutput(existing);
  }

  console.log(`\nDone. Generated ${successCount} new sentences, ${failCount} failed.`);
  console.log(`Total: ${existing.size}/${allWords.length}`);

  // Final validation
  runValidation(existing);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
