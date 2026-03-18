# Core Principles

## Delete Earlier, Keep Later

The later take is usually more complete, so:
- Delete the earlier part (stumble / incomplete sentence)
- Keep the later part (complete sentence)

## Longest Consecutive Run (tie-breaker when both takes are complete)

When two or more complete takes of the same content exist and the content-coverage check does not clearly favor one, keep the take that produces the **longest uninterrupted kept segment** when merged with the surrounding kept content on both sides.

- Scan the window: [last kept word before this cluster] … [first kept word after this cluster]
- For each candidate take, compute: (gap to prev kept end) + (take duration) + (gap to next kept start)
- Keep the candidate with the smallest total gap (maximum continuity); delete the others

This avoids choppy edits where the shorter take would leave isolated fragments on either side.

## Exceptions

If the user explicitly says "the later one sounds better" → delete earlier, keep later.
If the user explicitly says "the earlier one sounds better" → delete later, keep earlier.

## Content Coverage Check

Before deleting an earlier complete take, ask: **does the kept later sentence say everything the earlier one said?**

- If **yes** → safe to delete the earlier one.
- If **no** → keep both. A mild duplicate is better than lost content.

Example: speaker says "my rent is $1,500, so I saved $1,000/month", then restates "so I saved $1,000/month." The restatement does NOT cover "my rent is $1,500" — keep the earlier take.

## Final Sanity Check (run after marking all deletions)

Before finishing, review the delete list and confirm:

1. **Every key fact is still audible** — each specific number, claim, or example the speaker makes has at least one non-deleted instance.
2. **Every section has an intro** — no section opens mid-thought because its setup was deleted.
3. **Transitions are intact** — sentences that bridge topics (e.g. "Now let's talk about...") are not deleted.
4. **No content island** — a kept sentence that references something only said in deleted sentences (e.g. "as I just mentioned") should trigger a review of whether the referenced content needs to be kept too.
