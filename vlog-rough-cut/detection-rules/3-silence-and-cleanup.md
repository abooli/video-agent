# Rule 3: Silence, Fillers & Cleanup

## Filler Words

Delete these specific filler words: "um", "uh", "uhh"

Other fillers ("like", "you know", "I mean", "basically") are part of the vlog's conversational tone — leave them.

## Silence Thresholds

| Duration | Action |
|----------|--------|
| ≤ 0.5s | Ignore — natural pause |
| 0.5–1s | Keep if between two kept sentences. Delete if between deleted sentences. |
| > 1s | Delete — dead air |

Leading silence (at the very start of the clip) → always delete.

## Coherence Check

After best-take selection, read the kept sentences in order and verify:

1. **Logical flow** — does each kept sentence follow naturally from the previous one? If there's a jarring jump, check if a transition clause was lost during deletion. Rescue it if possible (see Rule 2, Step 3).

2. **No dangling connectors** — a kept sentence that starts with "because", "and", "but", "so" must have something before it that it connects to. If the preceding kept sentence doesn't set it up, either:
   - Find a transition clause from a deleted sentence to bridge the gap
   - Or flag it for user review

3. **No repeated information** — if the same fact appears in two kept sentences (e.g., "tired after three hours" in both S37 and S39), decide which instance to trim (see Rule 2, "Repeated Information Across Topics").

4. **Topic completeness** — for each topic in the outline, verify at least one kept sentence delivers the point. If a topic has zero kept sentences, flag it — the speaker's point was lost entirely, and the user should decide whether to rescue a partial take or accept the cut.

## Orphan Cleanup

After coherence check, scan for orphans:

- **Orphaned silence**: a silence < 1s stranded between two deletion zones → delete it
- **Orphaned speech**: a kept sentence of ≤ 5 words surrounded by deletions on both sides AND it shares words with adjacent deleted sentences (looks like a retake fragment) → delete it
- **Stranded asides**: an aside that was kept but is now surrounded by large deletion zones on both sides. Don't auto-delete — flag for user review. Some asides are gold ("it's just gonna leave"), some are noise without context.

## Output

After cleanup, write a final summary at the bottom of `4_analysis.md`:

```markdown
## Final Cut Summary

- Sentences kept: 28 / 55
- Sentences deleted: 24
- Noise removed: 3
- Composites: 4 splices
- Asides kept: 3
- Asides flagged for review: 1
- Coherence issues: none (or list them)
- Topics fully covered: 11/11 (or note gaps)
```
