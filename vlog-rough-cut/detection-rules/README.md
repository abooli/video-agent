# Vlog Detection Rules

Summary-driven, additive analysis for vlog rough cuts. The agent first understands what the speaker is saying (topic outline), then finds the best audio for each point.

This is intentionally fuzzier than `podcast-rough-cut/detection-rules/`, which operates at word-level. Vlogs have multiple takes, scene changes, and messier speech — precision word-cutting doesn't make sense here.

## Philosophy: Summary-First (Top-Down)

Instead of grouping sentences bottom-up and hoping the result flows, the vlog workflow:

1. Reads all sentences and produces a topic outline (what the speaker is trying to say)
2. Maps sentences to topics (which audio covers which point)
3. Picks the best audio for each topic (simple take or composite splice)
4. Everything not mapped = delete candidate

This prevents the main failure mode of bottom-up grouping: treating each local restart as its own group, losing sight of the larger argument the speaker is building across many false starts.

## Rule Files

| File | Purpose |
|------|---------|
| 0-topic-outline.md | Summarize the clip into a bullet-point topic outline |
| 1-sentence-to-topic-mapping.md | Map each sentence to a topic (or mark as aside/noise) |
| 2-best-take-selection.md | Pick the best audio for each topic — simple or composite |
| 3-silence-and-cleanup.md | Filler words, silence thresholds, coherence check, orphan cleanup |

## Analysis Flow

```
Read 2_sentences.txt (entire file, one pass — clips are ≤10 min)
       ↓
Produce topic outline (Rule 0)
       ↓
Map sentences to topics + identify asides (Rule 1)
       ↓
Pick best take per topic — simple or composite (Rule 2)
       ↓
Delete fillers + mark silences + coherence check + orphan cleanup (Rule 3)
       ↓
Write 3_auto_selected.json + 4_analysis.md
```

The agent processes `2_sentences.txt` in one pass. The unit of work is a sentence, never a word. Clause-level awareness is used within composite splicing (Rule 2) but not for primary grouping.
