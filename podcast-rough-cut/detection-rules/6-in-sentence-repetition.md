# In-Sentence Repetition Detection

## Definition

Within a single sentence, a phrase A appears twice with 1–3 words wedged in between.

## Pattern

```
A + filler words + A
```

## Examples

| Original | Pattern | Delete |
|----------|---------|--------|
| "so I was so I" | so I + was + so I | "so I was" |
| "the thing is the thing is" | the thing is × 2 | first instance |

## Not a Stumble

| Original | Reason |
|----------|--------|
| "task 1, task 2, task 3" | enumeration |
| "one by one" | emphasis |
| "again and again" | intentional repetition |
