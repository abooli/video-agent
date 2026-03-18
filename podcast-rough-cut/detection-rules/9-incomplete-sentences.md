# Incomplete Sentence Detection

## Definition

Speaker stops mid-thought, followed by silence or a fresh start.

## Core Principle

**Delete entire sentence**: once identified as incomplete, delete from sentence start to sentence end — not just the trailing words.

## Correct Analysis Method

```
✓ Correct: segment first → judge completeness → delete entire sentence
✗ Wrong: scan word-by-word → find awkward ending → only delete ending
```

### Steps

1. **Split by silence** (silence ≥0.5s as delimiter)
2. **Judge each sentence for completeness** (does it make semantic/grammatical sense?)
3. **Mark incomplete sentences for full deletion** (startIdx to endIdx)

## Pattern

```
incomplete sentence (entire) + [silence] + complete sentence
         ↓
    delete all of it
```

## Examples

<!-- TODO: Replace with English examples from your own footage -->

| Incomplete sentence | What follows | Delete range |
|--------------------|--------------|-------------|
| "So the reason I—" | [silence] + "The reason I did this was..." | entire fragment |
| "And then you can just" | [silence 3s] + "So what you do is..." | entire fragment + silence |
| "Let me show you how to—" | "First you open the..." | entire fragment |

## How to Judge

1. **Sentence is grammatically incomplete**: missing object, verb, or trails off unnaturally
2. **Followed by silence**: incomplete sentences usually have an obvious pause after
3. **Followed by a re-take**: speaker starts a similar thought from scratch

## Difference from Repeated Sentences

- **Repeated sentence**: both sentences are complete, just start the same → delete shorter
- **Incomplete sentence**: the earlier one is clearly unfinished, cut off → delete the incomplete one

## Common Traits of Incomplete Sentences

- Ends with a conjunction or preposition ("and then", "so that", "because")
- Ends with an article or determiner ("the", "a", "this")
- Sentence just stops — semantically incomplete
- Speaker restarts with a different phrasing

## Boundary Expansion Check (run after marking the incomplete sentence)

After marking an incomplete sentence for deletion, check the **immediately adjacent speech fragments** on both sides:

- If the adjacent fragment is ≤ 5 words AND does not form a complete thought on its own AND its other neighbor is also being deleted → expand deletion to include it
- This prevents leaving single-word or short-phrase orphans like "and", "so", "but", "And because of that" stranded between two deleted zones

```
[deleted zone] → [short fragment ≤5 words] → [deleted zone]
                          ↓
               expand deletion to include it
```

## Common Mistake

```
❌ Only delete the trailing word ("I—")
✓ Delete "So the reason I—" (the entire incomplete sentence)

❌ Delete the incomplete sentence but leave a 3-word orphan fragment between two deletions
✓ Expand the deletion to include that orphan fragment
```

**Remember**: the problem isn't just the ending — the whole sentence was abandoned, so delete the whole thing. Then check neighbors.
