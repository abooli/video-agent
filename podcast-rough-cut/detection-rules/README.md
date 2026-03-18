# Detection Rules

User preferences for AI stumble analysis. The agent reads these rules during the analysis step.

## File Index

| File | Type | Summary |
|------|------|---------|
| 0-fuzzy-match.md | Reference | Word equivalence: singular/plural, tense variants, conjunctions — used by rules 5, 6, 11 |
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
| 11-phrase-restart.md | Preference | Phrase + short gap (<0.5s) + same/near-identical phrase + completion → delete earlier attempts. Also covers near-identical restarts (same ≥2 opening words, different wording) within a sentence block. |
| 12-content-audit.md | **Final audit** | After all rules applied: extract topic summary, verify each topic has ≥1 non-deleted sentence, restore last complete take for any topic with zero coverage. |

## AI Analysis Priority Order

1. **Silence >1s** → suggest delete (split by 1s grid)
2. **Incomplete sentence** → delete (cut off mid-thought + silence)
3. **Repeated sentence** → delete shorter one (start matches ≥5 chars)
4. **In-sentence repetition** → delete A + middle (A + middle + A pattern)
5. **Stutter words** → delete earlier part
6. **Re-speak correction** → delete earlier part (partial repeat, negation, interrupted word)
7. **Filler words** → flag for manual review
8. **Phrase restart** → within a sentence, phrase + short gap (<0.5s) + same/near-identical phrase + continuation → delete first phrase + gap
9. **Content audit** → after all rules: extract topic list from original, verify each topic has ≥1 non-deleted sentence, restore last complete take for gaps

## Core Principles

**Delete earlier, keep later**: the later take is usually more complete — delete the earlier attempt, keep the later one.

**Longest consecutive run (tie-breaker)**: when two or more complete takes exist and content coverage is equal, keep the take that maximizes uninterrupted kept-segment length when combined with its neighbors. See rule 1 for details.

**Content coverage check**: before deleting an earlier complete take, verify the later kept sentence covers *all* the same information. If not, keep both — prefer duplicates over content loss.

**Orphan cleanup (Rule 10)**: after all rules are applied, delete any silence or short speech (≤8 words) that is stranded between deletion zones.

**Calibration target**: aim to delete ~60–70% of segments in a typical talking-head vlog. If deletions are well under 50%, the rules are likely under-detecting.

**Final sanity check**: after marking all deletions, confirm every key fact, section intro, and transition is still audible in at least one non-deleted sentence.
