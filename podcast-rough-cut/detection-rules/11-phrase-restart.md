# Phrase Restart (Mid-Sentence)

## Definition

Within a sentence (gap < 0.5s), the speaker starts a multi-word phrase, pauses briefly, then repeats the **same phrase** as the beginning of the complete version. The first incomplete occurrence should be deleted.

```
"in the summer" [0.3s gap] "in the summer leasing loop forever"
          ↑ delete this + gap         ↑ keep this
```

## Pattern

```
PHRASE + short_gap(<0.5s) + PHRASE + CONTINUATION
```

- First PHRASE: incomplete — cuts off before the full thought
- Second PHRASE: starts the same way, but continues to completion
- Delete: first PHRASE + the connecting gap
- Keep: second PHRASE + CONTINUATION

## Difference from Other Rules

| Rule | Pattern | Gap threshold |
|------|---------|---------------|
| Rule 4 (repeated sentences) | full sentence repeated | ≥ 0.5s (sentence boundary) |
| Rule 5 (stutter words) | single word repeated | any |
| Rule 6 (in-sentence repetition) | A + filler_word + A | no gap, same breath |
| **Rule 11 (phrase restart)** | **multi-word phrase + short gap + same phrase + more** | **< 0.5s** |

## Examples

| Before | After |
|--------|-------|
| "now I'm stuck in the summer ⏸0.3s in the summer leasing loop forever" | "now I'm stuck in the summer leasing loop forever" |
| "I tend to compare the ⏸0.2s I tend to compare the apartments by base rent" | "I tend to compare the apartments by base rent" |
| "we moved all of our ⏸0.1s we moved all of our stuff to the storage unit" | "we moved all of our stuff to the storage unit" |

## Detection in readable.txt

Look for cases where:
1. A gap entry appears with duration < 0.5s
2. The words immediately before the gap match the words immediately after the gap
3. The post-gap version continues further than the pre-gap version

```
readable.txt signal:
  ...in|the|summer|[silence 0.3s]|in|the|summer|leasing|loop|forever...
                   ↑ short gap — check if words before match words after
```

## Action

Delete: the earlier phrase tokens + the short gap between them.
Keep: the second (complete) phrase.

---

## Extension: Incremental Build-Up

The speaker builds toward a phrase one word at a time, cutting off after each attempt before finally completing it. Each attempt is a **prefix of the next**, not a restart.

### Pattern

```
PREFIX_1 + short_gap + PREFIX_2 + short_gap + ... + COMPLETE_PHRASE
```

Where each PREFIX is strictly shorter than the next and all share the same opening words.

### Example

```
"most of the college"           [0.2s]  ← prefix, cut off
"most of the college student"   [0.2s]  ← prefix + 1 word
"most of the college students"  [0.2s]  ← prefix + correction
"most of the college students graduated in May" ← COMPLETE → KEEP
```

### Detection signal

In readable.txt: consecutive word groups (separated by gaps < 0.5s) where each group's words are a leading subset of the next group's words.

### Rule

Delete all prefix attempts. Keep only the final complete phrase.

### Difference from restart

| Sub-case | Shape | Example |
|----------|-------|---------|
| Restart | A [gap] A + more | "in the summer [gap] in the summer leasing loop" |
| Near-identical | A [gap] A' [gap] A'' + more | "I tend to compare [gap] I tend to be comparing [gap] I tend to compare the apartments" |
| **Build-up** | A [gap] AB [gap] ABC [gap] ABCD... | "most of the college [gap] most of the college student [gap] most of the college students [gap] most of the college students graduated in May" |

---

## Extension: Near-Identical Sub-Sentence Restarts

Rule 4 (repeated sentences) catches repeats at sentence level (gaps ≥0.5s). This extension catches the same pattern **within** a sentence block (all gaps < 0.5s), even when the wording is slightly different.

**Phrase comparison uses fuzzy matching (Rule 0):** singular/plural, verb tense/form, and leading conjunctions are treated as identical. So `"I tend to compare"` and `"I tend to be comparing"` share ≥2 fuzzy-matched opening words and trigger this rule.

### Pattern

```
CLAUSE_A + short_gap + CLAUSE_B + short_gap + CLAUSE_C_COMPLETE
```

Where CLAUSE_A, CLAUSE_B, CLAUSE_C all share ≥2 opening words but may vary in exact wording — the speaker is re-attempting the same thought with slightly different phrasing.

### Example

```
"I tend to compare the"        [0.2s gap]   ← incomplete, cut off
"I tend to be comparing the"   [0.2s gap]   ← incomplete, different form
"I tend to compare the apartments by their base rent."  ← KEEP
```

- "I tend to compare" vs "I tend to be comparing" → share "I tend to" (same intent, different grammar)
- Both are incomplete and immediately restarted
- Only the final complete version should be kept

### Detection signal

In readable.txt, look for 2+ consecutive clauses (separated by gaps < 0.5s) that:
1. Share ≥2 opening words
2. Are both shorter/incomplete compared to a following clause that includes them
3. All occur within a single sentence block (no gap ≥0.5s separating them)

### Rule

Delete all earlier incomplete restart attempts. Keep only the last complete clause.

This applies even when wording differs slightly (e.g. verb form changes: "compare" / "be comparing" / "compare").
