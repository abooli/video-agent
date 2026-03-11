# Consecutive Fillers

## Pattern

Two filler words back-to-back:

```
English: um uh, uh um, ah um, er uh
```

## Detection

```javascript

// English fillers
const fillerWords_en = ['um', 'uh', 'ah', 'er', 'hmm', 'oh'];

if (allFillers.includes(curr) && allFillers.includes(next)) {
  markAsError(curr, next);
}
```

## Deletion Strategy

Delete all consecutive fillers.
