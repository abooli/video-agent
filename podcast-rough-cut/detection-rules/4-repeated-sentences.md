# Repeated Sentence Detection

## Definition

Adjacent sentences (separated by silence) that start the same way — usually the speaker misspoke and re-did the take.

**English**: adjacent sentences with ≥3 matching words at the start → delete the shorter one.

## Core Principle

**Segment first, then compare**: split by silence into sentences, then compare adjacent sentences.

```
✓ Correct: split by silence → compare adjacent sentence starts → delete entire sentence
✗ Wrong: scan word-by-word → find repeated fragment → only delete fragment
```

### Steps

1. **Split by silence** (silence ≥0.5s as delimiter)
2. **Compare adjacent sentences** (start matches ≥5 chars / ≥3 words → delete shorter entire sentence)
3. **Compare skip-one sentences** (if middle sentence is a fragment, also check sentences before and after it)

## Detection Logic

```javascript
// Adjacent sentence comparison
if (curr.text.slice(0, 5) === next.text.slice(0, 5)) {
  const shorter = curr.text.length <= next.text.length ? curr : next;
  markAsError(shorter);  // delete entire sentence, not just the repeated part
}

// Skip-one comparison (middle is a short fragment)
if (mid.text.length <= 5) {  // middle is a fragment
  if (curr.text.slice(0, 5) === next.text.slice(0, 5)) {
    markAsError(curr);   // delete earlier sentence
    markAsError(mid);    // delete fragment
  }
}
```

## Examples

| Earlier sentence | Later sentence | Delete |
|-----------------|----------------|--------|
| "So I was trying to" | "So I was trying to set up the whole thing" | earlier (incomplete) |

## Skip-One Repetition (fragment in between)

When there's a short fragment between two similar sentences:

```
Sentence A: "So I was trying to set up"
Fragment:   "wait"                        ← short fragment in between
Sentence B: "So I was trying to set up the deployment"

→ Delete Sentence A + Fragment
```

## Multiple Repeats

3+ consecutive attempts — delete all incomplete ones, keep the last complete one:

```
"So I was going to show you the"     → delete
"So I was going to show you how"     → delete
"So I was going to show you how to set up the whole pipeline" → KEEP
```

## Common Mistakes

```
❌ Scan word-by-word, only find local repeated fragments
✓ Segment first, compare entire sentence starts, delete entire sentence

❌ Only compare adjacent sentences
✓ Also compare skip-one (middle may be a fragment)
```
