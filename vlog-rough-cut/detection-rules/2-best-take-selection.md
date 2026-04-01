# Rule 2: Best Take Selection

## Purpose

For each topic (from Rule 0) and its mapped sentences (from Rule 1), decide what to keep. The goal is to find the best audio that delivers the topic clearly and completely.

## Step 1: Order the Candidates

For each topic, collect all mapped sentences in their original order (by sentence index). This is your candidate pool.

## Step 2: Identify the Take Pattern

### Pattern A: Simple Retakes (most common)

Multiple sentences are full attempts at the same thought. Pick one.

Selection criteria (priority order):

1. **Completeness** — must be grammatically complete. Incomplete sentences are never the best take.
2. **Information coverage** — pick the take that says the most. If an earlier take has a specific fact (number, name, detail) that the later take drops, prefer the earlier one.
3. **Later is usually better** (tie-breaker) — when two takes are both complete and cover the same info, keep the later one. The speaker usually improves with each attempt.
4. **Fluency** (secondary tie-breaker) — fewer filler words, fewer mid-sentence pauses.

### Pattern B: Composite Build (common in vlogs)

The speaker built the thought incrementally across takes, retaking from mid-points. No single sentence covers the full thought.

How to detect:
- Take N trails off incomplete
- Take N+1 starts from a mid-point of take N (its opening words match words mid-sentence in take N, typically after a conjunction)
- OR: multiple sentences each cover a different part of the topic, and you need pieces from several to get the full thought

How to splice — clause-level awareness:

1. Identify natural cut points in the longest take: conjunctions ("because", "and", "but", "so", "since", "which"), commas separating independent clauses, or relative pronouns.
2. Split the thought into clauses at those boundaries.
3. Source each clause from the best available take:
   - **First clause**: if the earliest take is adjacent to the previous kept segment, use it (smoother audio, no jump cut). Otherwise use the longest take.
   - **Middle clauses**: use the longest take — it's usually the only one that has these.
   - **Final clause**: use the latest retake — it's the completed version.

### Pattern C: Sequential Points

The topic has multiple sub-points that the speaker delivered in sequence (not as retakes). Example: "Night skiing advantages" might have separate sentences about cost, goggles, and visual field — these aren't retakes of each other, they're a list.

Keep all complete sub-point sentences. Delete only the false starts and incomplete attempts within each sub-point.

## Step 3: Usable Clauses in Otherwise-Deleted Sentences

Before deleting a sentence, check if it contains a usable clause that no kept sentence has. Common case: a transition phrase or connector at the start of a sentence whose main content is a false start.

Example:
```
S25: "And for some reason, I will"  → main content is incomplete, BUT "And for some reason" is a usable transition
S26: "I feel like not having a season pass actually makes things cheaper because"  → kept
```

Keep S25's "And for some reason" and splice into S26. The result: "And for some reason, I feel like not having a season pass actually makes things cheaper because"

This is clause-level composite splicing — the sentence is deleted as a whole, but a clause is rescued.

## Step 4: Handle Asides

Asides (from Rule 1) are their own kept content. For each aside:
- If it's a complete reaction and still makes sense in the flow → keep
- If it's stranded between large deletion zones and adds nothing without its surrounding context → flag for user review (don't auto-delete — let the user decide)

## Step 5: Handle Noise

Noise sentences (from Rule 1) are deleted. No further analysis needed.

## Single-Sentence Topics

- Complete → keep it, nothing to decide.
- Incomplete with no retry → delete it. Flag in the analysis log for user review.

## Don't Over-Delete

Vlogs are conversational. Not every pause or filler needs to go. The goal is to remove failed takes and dead air, not to produce a polished podcast. When in doubt, keep it.

## Repeated Information Across Topics

Sometimes the speaker repeats a fact across two different topics (e.g., "tired after three hours" appears in both the cost topic and the night-ski topic). When this happens:

- Keep the version that's more integral to its surrounding argument
- In the other topic, check if removing the repeated fact still leaves the sentence coherent. If yes, trim it. If no, keep the repetition — a slight repeat is better than a broken sentence.

## Output

For each topic, write the decision in `4_analysis.md`:

```markdown
### Topic 7: Season pass economics (S25–S37)
- S25: "And for some reason, I will" — partial delete, keep "And for some reason" as transition into S26
- S26: "I feel like not having a season pass..." — **KEEP** (composite with S25 clause)
- S27: "so far, I did a rough calculation..." — delete (incomplete, S29 covers this better)
- S28: "because I did a rough calculation..." — delete (restart of S27)
- S29: "and as of now, because the snow is really bad, I've only gone..." — **KEEP from "I've only gone snowboarding four times this season"** (trim preamble, the "because" connects to S26)
- S30: "I did five times." — delete (self-correction, no longer needed)
- S37: "I've only spent about $170 total on my night skis..." — **KEEP** (delivers the cost figure)
→ Composite: S25 clause + S26 + S29 partial + S37
```
