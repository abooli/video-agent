# Fuzzy Word Matching

## Purpose

When comparing words or phrases for repetition/restart detection (Rules 5, 6, 11), treat the following variations as **the same word**. This prevents the detector from missing restarts just because the speaker changed form slightly.

## Equivalence Rules

### 1. Singular / Plural
Treat as identical:
- `student` = `students`
- `apartment` = `apartments`
- `tip` = `tips`

**Detection signal:** strip trailing `s` or `es` before comparing, or check if one word is the other + `s`/`es`/`ies`.

### 2. Verb Tense / Form
Treat as identical:
- `compare` = `comparing` = `be comparing` = `compared`
- `move` = `moving` = `moved`
- `go` = `going` = `went`

**Detection signal:** share the same root stem (drop `-ing`, `-ed`, `-s`). For irregular verbs, use a short lookup table or just flag when ≥2 other opening words match.

### 3. Conjunction / Filler Insertion
Treat as identical when one version adds a leading/trailing conjunction or filler:
- `the apartments` = `and the apartments`
- `I compare` = `so I compare`
- `you know, the apartments` = `the apartments`

Common insertions to ignore: `and`, `so`, `but`, `like`, `well`, `you know`, `I mean`.

**Detection signal:** after stripping leading/trailing conjunctions and fillers, compare the core phrase.

## Application

When any rule says "words match" or "same phrase", apply fuzzy matching:

| Rule | Where it applies |
|------|-----------------|
| Rule 5 (stutter words) | Two consecutive instances of the same word/phrase |
| Rule 6 (in-sentence repetition) | A + middle + A — A matches fuzzily |
| Rule 11 (phrase restart) | Opening words of consecutive clauses match fuzzily |

## Examples

| Surface form | Fuzzy-normalized | Match? |
|-------------|-----------------|--------|
| `"college student"` vs `"college students"` | `"college student"` vs `"college student"` | ✅ |
| `"I tend to compare"` vs `"I tend to be comparing"` | `"I tend to compare"` vs `"I tend to compare"` | ✅ |
| `"the apartments"` vs `"and the apartments"` | `"the apartments"` vs `"the apartments"` | ✅ |
| `"I went"` vs `"I go"` | stem match via irregular lookup | ✅ |
| `"task 1"` vs `"task 2"` | `"task 1"` vs `"task 2"` | ❌ (intentional enumeration) |

## Threshold

Fuzzy matching applies only when **≥2 words** overlap after normalization. A single fuzzy-matched word is not enough to trigger a restart rule — require at least 2 matching words to avoid false positives.
