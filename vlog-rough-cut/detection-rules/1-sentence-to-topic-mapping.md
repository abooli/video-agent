# Rule 1: Sentence-to-Topic Mapping

## Purpose

Map every sentence from `2_sentences.txt` to a topic from the outline (Rule 0). This replaces the old adjacency-based grouping — sentences are grouped by what they're about, not just by what's next to them.

## How to Map

For each sentence, assign one of:

- **Topic N** — this sentence is an attempt at delivering topic N from the outline
- **Aside** — a short in-the-moment reaction that's its own keepable content (matches an `[aside]` bullet, or is a new one you missed in the outline)
- **Noise** — a fragment, false start, or orphan that doesn't contribute to any topic and isn't a meaningful aside

## Mapping Rules

1. **Use meaning, not position.** A sentence about snowboarding cost belongs to the cost topic even if it's sandwiched between sentences about something else. The speaker may circle back to a topic after a digression.

2. **Multiple sentences per topic is normal.** A topic like "season pass economics" might have 10+ sentences mapped to it — false starts, restarts, partial attempts, and one or two good takes. That's fine. Rule 2 will pick the best audio.

3. **One sentence can only map to one topic.** If a sentence spans two topics (rare), map it to the topic it primarily serves. Note the overlap for Rule 2.

4. **Asides are short and reactive.** Typically ≤ 8 words, reacting to something happening on camera. "Oh no", "it's just gonna leave", "wait", "it's fine." These are NOT noise — they're keepable content. Give each aside its own entry.

5. **Noise is genuinely empty.** Lone conjunctions ("So", "And"), sub-3-word fragments that trail off ("I was", "The"), and filler-only utterances. Be conservative — if a fragment has any usable clause (like "And for some reason" before a trail-off), it's not noise, it's a partial attempt at a topic.

## Handling Digressions

When the speaker interrupts their own argument with an aside and then returns:

```
S29: "...I've only gone snowboarding four times this season, and I spent a total of maybe"  [Topic 7]
S30: "I did five times."  [Topic 7 — self-correction]
S31: "It's just gonna leave."  [aside — reacting to something on camera]
S32: "So"  [noise]
S33: "oh, yeah."  [aside — getting back on track]
S34: "I only gone snowboarding four times this season, but what I realized is that,"  [Topic 7]
```

S31 and S33 are asides. S32 is noise. S29, S30, and S34 all map to Topic 7 even though they're not adjacent. This is the key advantage over adjacency-based grouping.

## Handling Sentences That Span Topics

Occasionally a sentence bridges two topics in the outline:

```
"I feel like not having a season pass actually makes things cheaper because I've only gone snowboarding four times this season"
```

This touches both "season pass economics" and "snowboarding frequency." Map it to whichever topic it primarily serves (probably the economics one since that's the argument being made). Rule 2 will handle whether to keep or splice it.

## Output

Write the mapping in `4_analysis.md` after the topic outline:

```markdown
## Sentence Mapping

| Sentence | Text (truncated) | Mapping |
|----------|-------------------|---------|
| S0 | "Hello, guys." | Topic 1 |
| S1 | "It's happy Friday." | Topic 1 |
| S2 | "I happy Friday." | Topic 1 |
| ... | ... | ... |
| S31 | "It's just gonna leave." | Aside |
| S32 | "So" | Noise |
```

This table is the input for Rule 2.
