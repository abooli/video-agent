# Detection Rules

User preferences for AI stumble analysis. The agent reads these rules during the analysis step.

## File Index

| File | Type | Summary |
|------|------|---------|
| 1-core-principles.md | Principle | Delete earlier, keep later |
| 2-filler-words.md | Preference | um, uh, ah + deletion boundaries |
| 3-silence-handling.md | Threshold | ≤0.5s ignore, 0.5–1s optional, >1s suggest delete |
| 4-repeated-sentences.md | Preference | Adjacent sentences with same start ≥5 chars → delete shorter |
| 5-stutter-words.md | Preference | Repeated filler phrases (那个那个, like like) |
| 6-in-sentence-repetition.md | Preference | A + filler + A pattern |
| 7-consecutive-fillers.md | Preference | Two fillers back-to-back |
| 8-re-speak-correction.md | Preference | Partial repeat, negation correction, interrupted word |
| 9-incomplete-sentences.md | Preference | Sentence cut off mid-thought |
| 10-orphaned-silence-cleanup.md | Sanity check | Delete short silences stranded between two deleted segments |

## AI Analysis Priority Order

1. **Silence >1s** → suggest delete (split by 1s grid)
2. **Incomplete sentence** → delete (cut off mid-thought + silence)
3. **Repeated sentence** → delete shorter one (start matches ≥5 chars)
4. **In-sentence repetition** → delete A + middle (A + middle + A pattern)
5. **Stutter words** → delete earlier part
6. **Re-speak correction** → delete earlier part (partial repeat, negation, interrupted word)
7. **Filler words** → flag for manual review

## Core Principle

**Delete earlier, keep later**: the later take is usually more complete — delete the earlier attempt, keep the later one.
