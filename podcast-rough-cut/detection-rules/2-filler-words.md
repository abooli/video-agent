# Filler Word Detection

## Filler Word List

<!-- TODO: Replace/extend with your actual filler words -->

```javascript
// Chinese fillers (from original)
const fillerWords_zh = ['嗯', '啊', '哎', '诶', '呃', '额', '唉', '哦', '噢', '呀', '欸'];

// English fillers
const fillerWords_en = ['um', 'uh', 'ah', 'er', 'hmm', 'oh', 'well'];
```

## Deletion Boundary

```
WRONG: delete the filler word's own timestamp range (filler.start – filler.end)
       → may clip the tail of the previous word

RIGHT: delete from previous word's end to next word's start
       → (prevWord.end – nextWord.start)
```

## User Preference

Keep some "um"s as natural transitions — don't delete all of them.
