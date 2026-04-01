---
name: rough-cut
description: "Rough cut agent: uses Deepgram to transcribe, then detects pauses, stumbles, and bad takes in raw video. Trigger words: rough cut, edit video, detect stumbles"
---

<!--
input: video file (*.mp4)
output: subtitles_words.json, auto_selected.json, review.html
pos: transcription + detection, up to web review

To Agents: If this file gets updated, please update:
1. The Skills list in ../README.md
-->

# Rough Cut

> Deepgram nova-2 cloud transcription + AI stumble detection + web review

## Prerequisites

```bash
export DEEPGRAM_API_KEY=your_key_here
pip install requests
```

## Output Directory Structure

```
Claude output/
├── rough-cut/
│   ├── 1_transcription/
│   │   ├── audio.mp3
│   │   ├── deepgram_result.json
│   │   └── subtitles_words.json
│   ├── 2_analysis/
│   │   ├── readable.txt
│   │   ├── auto_selected.json
│   │   └── stumble_analysis.md
│   └── 3_review/
│       └── review.html
└── subtitles/
    └── ...
```

Rule: reuse existing folders if present, otherwise create new ones.

## Flow

```
0. Create output directories
    ↓
1. Extract audio (ffmpeg)
    ↓
2. Deepgram API transcription (~15-30s including upload)
    ↓
3. Generate word-level subtitles (subtitles_words.json)
    ↓
4. AI analyzes stumbles/silences, generates pre-selection list (auto_selected.json)
    ↓
5. Generate review webpage (review.html)
    ↓
6. Start review server, user confirms via web UI
    ↓
[Wait for user] → user clicks "Execute Cut" or manually triggers /cut
```

## Steps

### Step 0: Create Output Directories

```bash
VIDEO_PATH="/path/to/video.mp4"
VIDEO_NAME=$(basename "$VIDEO_PATH" .mp4)
BASE_DIR="Claude output/rough-cut"
mkdir -p "$BASE_DIR/1_transcription" "$BASE_DIR/2_analysis" "$BASE_DIR/3_review"
```

### Steps 1–2: Extract Audio + Deepgram Transcription

```bash
cd "$BASE_DIR/1_transcription"

# 1. Extract audio (file: prefix needed if filename contains colons)
ffmpeg -i "file:$VIDEO_PATH" -vn -acodec libmp3lame -y audio.mp3

# 2. Deepgram transcription (output is WhisperX-compatible format)
SKILL_DIR="<path-to-repo>/podcast-rough-cut"
python "$SKILL_DIR/scripts/deepgram_transcribe.py" audio.mp3 en
# Output: deepgram_transcription.json
```

### Step 3: Generate Word-Level Subtitles

```bash
node "$SKILL_DIR/scripts/generate_subtitles.js" deepgram_transcription.json
# Output: subtitles_words.json

cd ..
```

### Step 4: Stumble Analysis (script + AI)

#### 4.1 Generate Readable Format

```bash
cd 2_analysis

node -e "
const data = require('../1_transcription/subtitles_words.json');
let output = [];
data.forEach((w, i) => {
  if (w.isGap) {
    const dur = (w.end - w.start).toFixed(2);
    if (dur >= 0.5) output.push(i + '|[silence ' + dur + 's]|' + w.start.toFixed(2) + '-' + w.end.toFixed(2));
  } else {
    output.push(i + '|' + w.text + '|' + w.start.toFixed(2) + '-' + w.end.toFixed(2));
  }
});
require('fs').writeFileSync('readable.txt', output.join('\n'));
"
```

#### 4.2 Read Detection Rules

Read all rule files from `detection-rules/` directory before analysis.

#### 4.3 Generate Sentence List (critical step)

**Must segment into sentences first, then analyze.** Split by silence into a sentence list:

```bash
node -e "
const data = require('../1_transcription/subtitles_words.json');
let sentences = [];
let curr = { text: '', startIdx: -1, endIdx: -1 };

data.forEach((w, i) => {
  const isLongGap = w.isGap && (w.end - w.start) >= 0.5;
  if (isLongGap) {
    if (curr.text.length > 0) sentences.push({...curr});
    curr = { text: '', startIdx: -1, endIdx: -1 };
  } else if (!w.isGap) {
    if (curr.startIdx === -1) curr.startIdx = i;
    curr.text += w.text;
    curr.endIdx = i;
  }
});
if (curr.text.length > 0) sentences.push(curr);

sentences.forEach((s, i) => {
  console.log(i + '|' + s.startIdx + '-' + s.endIdx + '|' + s.text);
});
" > sentences.txt
```

#### 4.4 Auto-Mark Silences (must run first)

```bash
node -e "
const words = require('../1_transcription/subtitles_words.json');
const selected = [];
words.forEach((w, i) => {
  if (w.isGap && (w.end - w.start) >= 0.5) selected.push(i);
});
require('fs').writeFileSync('auto_selected.json', JSON.stringify(selected, null, 2));
console.log('Silences ≥0.5s:', selected.length);
"
```

→ Output: `auto_selected.json` (silence indices only)

#### 4.5 AI Stumble Analysis (appends to auto_selected.json)

**Detection rules (by priority)** — see `detection-rules/` for full details:

| # | Type | Method | Delete Range |
|---|------|--------|-------------|
| 1 | Repeated sentence | Adjacent sentences start with same ≥3 words | Shorter **entire sentence** |
| 2 | Skip-one repeat | Fragment between two similar sentences | Earlier sentence + fragment |
| 3 | Incomplete sentence | Cut off mid-thought + silence | **Entire incomplete sentence** |
| 4 | In-sentence repeat | A + filler + A pattern | Earlier part |
| 5 | Stutter words | "like like", "so so" | Earlier part |
| 6 | Re-speak correction | Partial repeat / negation correction | Earlier part |
| 7 | Filler words | um, uh, like | Flag but don't auto-delete |
| 8 | Orphaned silence | < 2s silence between two deleted segments | Delete the silence |

**Core principles:**
- **Segment first, then compare**: use sentences.txt to compare adjacent sentences
- **Delete entire sentence**: incomplete/repeated sentences get deleted whole, not just the bad words

**Chunked analysis (loop):**

```
1. Read readable.txt offset=N limit=300
2. Cross-reference with sentences.txt to analyze these 300 lines
3. Append stumble indices to auto_selected.json
4. Log to stumble_analysis.md
5. N += 300, go back to step 1
```

⚠️ **Context budget rules (prevent context overflow on long clips):**
- Read detection rules ONCE at the start. Do NOT re-read rule files between chunks.
- Each chunk's stumble_analysis output should be APPENDED to the .md file via tool, then forgotten — do NOT accumulate past chunk analyses in working memory.
- Keep the analysis table rows terse: idx range, type keyword, and action only. Skip quoting the full spoken content unless it's needed to explain an ambiguous call.
- If a clip has >2000 word entries, increase chunk size to 500 to reduce the number of iterations.
- Do NOT re-read sentences.txt or readable.txt sections you've already processed. Move forward only.

🚨 **Critical warning: line number ≠ idx**

```
readable.txt format: idx|content|time
                     ↑ use THIS value

Line 1500 → "1568|[silence 1.02s]|..."  ← idx is 1568, NOT 1500!
```

**stumble_analysis.md format:**

```markdown
## Chunk N (line range)

| idx | Time | Type | Content | Action |
|-----|------|------|---------|--------|
| 65-75 | 15.80-17.66 | repeated sentence | "So I was trying to set up" | delete |
```

### Steps 5–6: Review

```bash
cd ../3_review

# 5. Generate review webpage
node "$SKILL_DIR/scripts/generate_review.js" ../1_transcription/subtitles_words.json ../2_analysis/auto_selected.json ../1_transcription/audio.mp3
# Output: review.html

# 6. Start review server
node "$SKILL_DIR/scripts/review_server.js" 8899 "$VIDEO_PATH"
# Open http://localhost:8899
```

User actions in the web UI:
- Play video segments to confirm
- Check/uncheck items for deletion
- Click "Execute Cut"

---

## Data Formats

### subtitles_words.json

```json
[
  {"text": "the", "start": 0.12, "end": 0.2, "isGap": false},
  {"text": "", "start": 6.78, "end": 7.48, "isGap": true}
]
```

### auto_selected.json

```json
[72, 85, 120]  // AI-generated pre-selection indices
```

---

## Configuration

Deepgram requires an API key set via `DEEPGRAM_API_KEY` environment variable (or in `.env` at repo root).

Language parameter:
- `en` — English (default)
- `zh` — Chinese
- `auto` — auto-detect (slower, skips language-specific optimizations)
