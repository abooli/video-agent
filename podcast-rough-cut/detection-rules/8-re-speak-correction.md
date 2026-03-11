# Re-speak Correction

## Pattern

Speaker misspoke and immediately corrected themselves — delete the earlier wrong part.

### 1. Partial Repeat

Overlapping words but not identical:

| Original | Delete |
|----------|--------|
| "you can just you close it" | "you can just" |
| "I was going to I went ahead and" | "I was going to" |

### 2. Negation Correction

Speaker negates what they just said:

| Original | Delete |
|----------|--------|
| "it is— it's not" | "it is—" |
| "you can— well you can't actually" | "you can—" |

### 3. Interrupted Word

Word cut off mid-syllable + silence + re-spoken in full:

| Original | Delete |
|----------|--------|
| "the dep— [silence] the dependency" | "dep— [silence]" |
| "config— [silence] configuration file" | "config— [silence]" |

## Detection Logic

```javascript
// Find common prefix between nearby words
if (word[i].text.startsWith(prefix) && word[i+n].text.startsWith(prefix)) {
  // and the later one is more complete → delete the earlier one
}
```
