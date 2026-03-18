# Orphaned Segment Cleanup

> Sanity check — run this AFTER all other detection rules have been applied.

## Rule A — Orphaned Silence

If a silence gap between two deleted segments is < 2 seconds, delete it too.

```
[deleted segment A] + [silence < 2s] + [deleted segment B]
                           ↓
                     also delete this
```

**Threshold**: < 2s → delete; ≥ 2s → leave (likely intentional pause or scene break).

## Rule B — Orphaned Speech Island

If a **speech segment** is surrounded on both sides by deleted segments (or by a deleted segment + the start/end of the file), AND the speech segment is ≤ 8 words, delete it too.

```
[deleted zone] + [speech ≤ 8 words] + [deleted zone]
                         ↓
               also delete the speech island
```

Why: short speech fragments surrounded by deletions are usually cut-off connector words or sentence starters that lost their surrounding context ("and", "so", "But since then,", "And because of that"). Leaving them produces choppy awkward micro-clips.

**Threshold**: ≤ 8 words → delete as orphan; > 8 words → leave for human review (may be intentional).

## Combined Example

```
idx 40-55:  "So I was trying to—"       → deleted (incomplete sentence)
idx 56-58:  [silence 1.2s]              → NOW deleted (orphaned silence, Rule A)
idx 59-66:  "and"                       → NOW deleted (orphaned speech, Rule B, 1 word)
idx 67-72:  "So I was trying to set up" → deleted (repeated sentence)
```

## Why

Cleaning orphaned segments produces smoother edits without awkward micro-clips or brief silences that shouldn't be there.
