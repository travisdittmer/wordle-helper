# Wordle Sentence Generation Spec

## Overview

Generate one sentence per Wordle answer word (~2,000+ words). The sentence is displayed to the user as a reward after solving the puzzle — it should feel like a small payoff, not a dictionary entry.

---

## Style Buckets (6)

Each word is assigned a style via `index % 6`. The rotation ensures even distribution across the corpus.

### 0 — Dry Wit
- **Tone:** Understated, clever, the joke is almost hidden
- **Signal:** The humor comes from what's *not* said, or from a gap between tone and content
- **Example (word: grave):** "He took the news with grave concern, which for him meant a slightly longer pause before ordering dessert."

### 1 — Deadpan Dark
- **Tone:** Disturbing or morbid content delivered with completely flat affect — no wink, no punchline
- **Signal:** The reader does a double-take; the sentence doesn't acknowledge its own darkness
- **Example (word: grave):** "The grave was already dug, which really took the suspense out of the negotiation."

### 2 — Gallows Humor
- **Tone:** Laughing *at* the worst-case scenario, self-aware about the darkness
- **Signal:** The speaker knows it's grim and leans in anyway — cathartic, not cruel
- **Example (word: grave):** "Nothing puts life in perspective like a grave with your name on it and a typo in the date."

### 3 — Sardonic
- **Tone:** Bitter, mocking, punching up or outward at a target
- **Signal:** There's a clear object of scorn — institutions, pretension, hypocrisy
- **Example (word: grave):** "They built a grave monument to honor the man who'd cut everyone's pension — how fitting."

### 4 — Pop Reference
- **Tone:** Cultural, historical, cinematic, musical — common knowledge given a twist
- **Signal:** References something the reader is likely to recognize; informative but casual
- **Example (word: grave):** "The phrase 'turning in his grave' gets attributed to so many people it's a wonder cemeteries aren't seismically active."

### 5 — Fun Fact
- **Tone:** Genuinely surprising, informative, the "huh, neat" reaction
- **Signal:** Teaches the reader something true (or plausibly true) they probably didn't know
- **Example (word: grave):** "A grave in London's Highgate Cemetery has a working telephone installed, just in case."

---

## Sentence Requirements

| Rule | Detail |
|------|--------|
| **Uses the exact word** | The Wordle answer must appear verbatim in the sentence — no conjugations, no plurals, no derived forms (e.g., if the word is `bloom`, don't use `blooming` or `bloomed`) |
| **Length** | 10–20 words. Punchy, not sprawling. One sentence only. |
| **Standalone** | Must make sense with zero context — the reader just solved a Wordle |
| **No definitions** | Don't start with "X means..." or "The word X refers to..." |
| **Meaning from context** | The sentence should make the word's meaning (or one of its meanings) clear through usage |
| **Factual accuracy (Fun Fact / Pop Reference)** | Facts should be verifiable or at minimum highly plausible. Flag any you're uncertain about. |

---

## Distinguishing the Four Humor Styles

This is the hardest part for any model. Here's the cheat sheet:

| Style | Who's in on the joke? | Emotional register | Target |
|-------|----------------------|-------------------|--------|
| Dry Wit | Only the speaker (maybe) | Cool, measured | The situation |
| Deadpan Dark | Nobody — it's stated as fact | Flat, clinical | The reader's comfort |
| Gallows Humor | Everyone — we're all doomed | Warm, defiant | Mortality / catastrophe |
| Sardonic | The speaker, against someone | Sharp, bitter | A person, institution, or norm |

**Prompt-engineering note:** When prompting a model, include both the style description AND the distinction table above. The table is the most reliable way to keep outputs from blurring across styles.

---

## Implementation Notes

### Rotation Logic
```
style_index = word_list_index % 6
styles = ["dry_wit", "deadpan_dark", "gallows_humor", "sardonic", "pop_reference", "fun_fact"]
assigned_style = styles[style_index]
```

### Prompt Template (per word)

```
You are writing a single sentence for a Wordle app. The sentence is shown to the user after they solve the puzzle.

WORD: {word}
STYLE: {style_name}
STYLE DESCRIPTION: {style_description}

Rules:
- Use the exact word "{word}" in the sentence (no conjugations, plurals, or derived forms)
- 10–20 words, one sentence only
- Do NOT define the word — show its meaning through context
- The sentence must stand completely on its own

Respond with ONLY the sentence. No quotes, no preamble, no explanation.
```

### Batch Processing Strategy

**Option A — Local model (Ollama / Qwen3:8b):**
- Process all ~2,000 words in a Python loop
- One API call per word (simple, debuggable)
- Estimated time: ~15–30 min depending on hardware
- Output to JSON as each sentence completes

**Option B — Claude API (batch):**
- Group into batches of 50–100
- Use the Anthropic batch API for cost efficiency
- Higher quality, especially on the four humor styles
- Use for QA pass on local model output

**Option C — Hybrid (recommended):**
1. Generate all sentences with local model
2. Feed output to Claude in batches for QA scoring
3. Regenerate flagged sentences with Claude

### Output Schema

Adapt to match whatever the app currently uses. Suggested minimal structure:

```json
{
  "word": "grave",
  "style": "dry_wit",
  "sentence": "He took the news with grave concern, which for him meant a slightly longer pause before ordering dessert."
}
```

---

## QA Checklist (for review pass)

- [ ] Word appears verbatim (not conjugated)
- [ ] Length is 10–20 words
- [ ] Style matches the assigned bucket (use distinction table)
- [ ] Sentence is standalone — no "he said" without an antecedent, no dangling references
- [ ] Fun facts are plausible / verifiable
- [ ] Pop references are recognizable to a general audience
- [ ] No repeated sentence structures across adjacent words
- [ ] Humor lands (subjective but important — flat jokes should be flagged)
