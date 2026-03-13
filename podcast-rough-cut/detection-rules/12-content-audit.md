# End-of-Analysis Content Audit

## Purpose

A final verification pass run **after** all deletion rules have been applied. Its job is to catch cases where every take of a topic or claim was deleted — something no pattern rule reliably prevents, because multiple independent rules can each delete part of the same content.

## When to Run

After completing the stumble analysis (after all rules 1–11 have been applied and `auto_selected.json` is populated), before generating `review.html`.

## Steps

### Step 1: Extract topic summary from original

Read `sentences.txt` and produce a flat list of the distinct **claims or topics** the speaker covers. Each item should be one sentence or less — the core point, not the wording.

Example output:
```
[1] Rent is now $1,500 (saved $1,000/month vs before)
[2] This video will show tips to reduce overhead
[3] Seasonality affects rent prices like any other market
[4] Summer = high demand = high prices
[5] College grads move to cities in summer
[6] Lease incentives exist: free months, look-and-lease bonus, referral bonus
[7] Ask for discounts; get any deal documented in writing
[8] Phantom costs: parking, utilities, Wi-Fi, amenities
...
```

### Step 2: Check coverage against remaining (non-deleted) sentences

For each topic in the list, find at least one sentence in `sentences.txt` whose word range has at least one index NOT in `auto_selected.json`.

If a topic has **zero** non-deleted sentences → it is a **content gap**.

### Step 3: Fix content gaps

For each content gap:
1. Find all sentences in `sentences.txt` that cover that topic
2. Pick the **last complete take** (longest, most complete wording, fewest false starts)
3. Remove that sentence's word range from `auto_selected.json`
4. Log it in `stumble_analysis.md` under a `## Content Audit` section

### Step 4: Log audit results

Append to `stumble_analysis.md`:

```markdown
## Content Audit

| Topic | Status | Action |
|-------|--------|--------|
| Lease incentives intro ("Let's talk about the incentive first") | ❌ All takes deleted | Restored S107 (2549-2560) |
| "they could give you free months on certain units" | ❌ All takes deleted | Restored S111 (2715-2746) |
| Seasonality affects prices | ✅ S25, S40 kept | — |
```

## Example of What This Catches

From video 034:
```
S107 (2549-2622): "Let's talk about the incentive first. For for for a lot of the
  apartments, especially the ones in the cities, they try to compete..."
S108-S113: all false starts of the same content
```

Rules 4 and 11 correctly identified S107-S113 as false starts of each other. But because they deleted ALL of them, the entire "lease incentives" section had no introduction. The audit catches this because topic [6] maps to zero non-deleted sentences.

## Why a Separate Rule (not just more pattern rules)

Pattern rules are **syntactic** — they detect repeated words, short gaps, identical starts. They can't know that two independently-triggered deletions together removed all coverage of a topic.

The audit is **semantic** — it works at the level of "what did the speaker say" vs "what remains." It catches:
- Cases where multiple rules each delete part of the same topic
- Cases where the "last complete take" was itself messy enough to trigger a rule
- Cases where sub-sentence restarts deleted all attempts including the clean final one

The audit is the safety net. Pattern rules are prevention; the audit is verification.
