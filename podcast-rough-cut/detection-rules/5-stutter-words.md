# Stutter Words

## Fuzzy Matching

Before comparing, normalize words using **Rule 0 (fuzzy match)**:
- `student` = `students` (singular/plural)
- `compare` = `comparing` = `be comparing` (tense/form)
- `the thing` = `and the thing` (leading conjunction stripped)

Stutter detection applies even when the repeated word/phrase differs by these variations.

## Pattern

Same word/phrase repeated 2–3 times in a row (after fuzzy normalization):

<!-- TODO: Replace/extend with your actual stutter patterns -->

```javascript
// English stutter patterns
const stutterPatterns_en = [
  'like like',
  'so so',
  'and then and then',
  'you know you know',
  'basically basically',
  'I mean I mean'
];
```

## Deletion Strategy

Delete the earlier ones, keep the last instance.

```
Original: "like like I was thinking"
Delete:   "like"
Keep:     "like I was thinking"
```
