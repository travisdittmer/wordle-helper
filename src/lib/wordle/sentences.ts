import sentenceData from '@/data/sentences.json';

interface SentenceEntry {
  word: string;
  style: string;
  sentence: string;
}

const lookup = new Map<string, SentenceEntry>(
  (sentenceData as SentenceEntry[]).map((e) => [e.word, e])
);

/** Get the sentence for a solved word, or null if not found. */
export function getSentence(word: string): string | null {
  return lookup.get(word.toLowerCase())?.sentence ?? null;
}
