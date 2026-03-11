# Silence Handling

## Threshold Rules

| Silence Duration | Action |
|-----------------|--------|
| ≤ 0.5s | **Ignore** — natural pause |
| 0.5–1s | **Optional delete** — inter-sentence pause |
| > 1s | **Suggest delete** — obvious hesitation or dead air |

## Output Format

**Mark entire gap as one entry, don't split**

Example: 3.2s silence → output 1 entry
```
| 64-66 | 12.86-15.80 | silence 3.2s | | delete |
```

User can un-check items they want to keep in the review UI.

## Special Cases

### Long Silence
Continuous 5s+ silence — mark entire span, pre-select for deletion:
```
| 323-371 | 71.38-131.38 | silence 60s | | delete |
```

### Leading Silence
Silence at the very start of the video — always delete:
```
| 0 | 0.00-1.00 | silence 1s | leading silence | delete |
```
