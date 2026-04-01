# Rule 0: Topic Outline

## Purpose

Before touching any sentences, understand what the speaker is actually saying. Produce a short bullet-point outline of the clip's content. This outline drives all downstream decisions.

## How to Produce the Outline

Read all of `2_sentences.txt` in one pass. Then write a topic outline with these properties:

1. **Each bullet = one point the speaker is making** — not one sentence, not one paragraph. A "point" is the smallest unit of meaning the speaker is trying to land. Examples:
   - "Greeting + it's Friday"
   - "About to take lunch, heated up chicken rice from two days ago"
   - "Sleep deprived from snowboarding yesterday"
   - "Season pass economics: no pass this year, only gone 4 times, spent $170 total on night skis"
   - "Night skiing advantages: cheaper, no goggles needed, wider visual field"

2. **Preserve the speaker's order** — don't reorganize. The outline should match the clip's narrative flow.

3. **Note asides and reactions** — short in-the-moment reactions ("oh no, got a fork", "it's just gonna leave") get their own bullet marked as `[aside]`. These are real content, not noise.

4. **Note transitions** — if the speaker explicitly transitions ("so yeah, that's my take for today", "bye"), mark those as `[transition]` or `[closing]`.

5. **Be specific about facts** — if the speaker mentions a number, name, or specific detail, include it in the bullet. "Snowboarding cost" is too vague. "Boots $150, board+bindings $75 from Facebook Marketplace, total ~$200" captures what the speaker actually said.

## Outline Length

For a typical 5–10 minute vlog clip: 8–15 bullets. If you're writing 20+, you're being too granular — merge related sub-points. If you're writing fewer than 5, you're probably collapsing distinct topics.

## What the Outline is NOT

- It's not a transcript summary for viewers. It's a structural map for the editing pass.
- It doesn't need to be well-written. Shorthand is fine.
- It doesn't judge quality ("speaker stumbles here") — that's Rule 2's job.

## Output

Write the outline at the top of `4_analysis.md`:

```markdown
# Sentence Analysis: <clip-name>

## Topic Outline

1. Greeting — happy Friday, disclaimer that it's her Friday not yours
2. [aside] Happy Friday to myself
3. Lunch break — chicken rice from two days ago, still good
4. [aside] Fork instead of spoon reaction
5. Sleep deprived — regrets going snowboarding yesterday
6. Snowboarding frequency — twice in this vlog, no season pass this year
7. Season pass economics — no pass is cheaper, only 4 times this season, $170 total on night skis
8. Night skiing advantages — tired after 3 hours anyway, cheaper than day, Seattle proximity (1 hour), no goggles needed, wider visual field
9. Cost of starting snowboarding — gear is expensive upfront but board+boots ~$200 via deals
10. Advice — be patient, do research, Facebook Marketplace
11. [closing] Spent 5 minutes of lunch chatting, scooped rice but never ate, bye
```

This outline is the source of truth for Rule 1 (mapping) and Rule 3 (coherence check).
