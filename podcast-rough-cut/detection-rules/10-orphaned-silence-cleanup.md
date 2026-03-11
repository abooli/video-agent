# Orphaned Silence Cleanup

> Sanity check — run this AFTER all other detection rules have been applied.

## Rule

If two or more adjacent segments are already marked for deletion, and there's a silence gap between them that is < 2 seconds, delete that silence too.

## Why

When the AI marks a stumble + the next stumble but leaves a short silence in between, the final cut ends up with an awkward tiny pause that shouldn't be there. Cleaning these up produces smoother edits.

## Logic

```
[deleted segment A] + [silence < 2s] + [deleted segment B]
                           ↓
                     also delete this
```

## Example

```
idx 40-55:  "So I was trying to—"       → marked delete (incomplete sentence)
idx 56-58:  [silence 1.2s]              → NOT yet marked
idx 59-72:  "So I was trying to set up" → marked delete (repeated sentence)

After this rule:
idx 56-58:  [silence 1.2s]              → NOW marked delete (orphaned between two deletions)
```

## Threshold

- < 2s silence between two deleted segments → delete the silence
- ≥ 2s silence → leave it alone (likely an intentional pause or scene break)
