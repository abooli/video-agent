---
name: vlog-rough-cut
description: "Batch rough-cut for vlogs: reuses storyboard transcripts, runs AI stumble detection per clip, serves a tabbed review dashboard per chapter. Trigger words: rough cut vlog, batch cut, chapter cut"
---

<!--
input: Claude output/storyboard/transcripts/ (from vlog-storyboard)
output: per-clip analysis + dashboard.html + cut video files

To Agents: If this file gets updated, please update:
1. The Skills list in ../README.md
-->

# Vlog Rough Cut

> Batch rough-cut orchestrator — reuses storyboard transcripts, runs AI stumble detection, serves a tabbed review UI per chapter.

## Prerequisites

- `vlog-storyboard` must have been run first (transcripts + audio already in `Claude output/storyboard/transcripts/`)
- Node.js 18+, FFmpeg, Python 3.8+
- Detection rules in `podcast-rough-cut/detection-rules/`

## Output Directory Structure

```
Claude output/
├── storyboard/
│   └── transcripts/                         ← READ ONLY, from vlog-storyboard
│       ├── D1-08_audio.mp3
│       ├── D1-08_transcript.json
│       ├── D3-03_audio.mp3
│       └── D3-03_transcript.json
│
└── rough-cut/
    └── <batch-name>/                        ← user-named (e.g. "Chapter 1")
        ├── D1-08/
        │   ├── 1_subtitles_words.json       ← word-level timeline
        │   ├── 2_readable.txt               ← idx|content|time for AI
        │   ├── 3_sentences.txt              ← sentence-segmented
        │   ├── 4_auto_selected.json         ← silence + stumble indices
        │   └── 5_stumble_analysis.md        ← AI reasoning log
        ├── D3-03/
        │   └── ...
        ├── dashboard.html                   ← tabbed review UI for this batch
        └── cut_output/                      ← FFmpeg output after review
            ├── D1-08_cut.mp4
            └── D3-03_cut.mp4
```

## Flow

```
1. Scan Claude output/storyboard/transcripts/ for available clips
       ↓
2. Prompt user: "Which clips to rough-cut?" (numbered list)
       ↓
3. Prompt user: "Name this batch?" → e.g. "Chapter 1"
       ↓
4. Per clip: convert transcript → generate files 1_ through 5_
       ↓
5. Generate dashboard.html (tabbed UI, one tab per clip)
       ↓
6. Start review server + auto-open browser
       ↓
7. User reviews → "Execute Cut" → FFmpeg → cut_output/
```

## Steps

### Step 1: Discover Available Clips

Scan the storyboard transcripts folder for clip names:

```bash
TRANSCRIPTS_DIR="Claude output/storyboard/transcripts"

# List available clips (extract names from *_transcript.json files)
ls "$TRANSCRIPTS_DIR"/*_transcript.json 2>/dev/null | \
  sed 's|.*/||; s|_transcript\.json||' | \
  sort
```

Present to user as a numbered list:

```
Available clips from storyboard:
  1) D1-08
  2) D2-01
  3) D3-03
  4) D3-07
  5) D4-02

Which clips to include in this batch? (e.g. 1,3,4 or "all")
>
```

### Step 2: Name the Batch

```
Name this batch? (e.g. "Chapter 1", "Intro", "Cooking Montage")
> Chapter 1
```

Create the batch directory:

```bash
BATCH_NAME="Chapter 1"
BATCH_DIR="Claude output/rough-cut/$BATCH_NAME"
mkdir -p "$BATCH_DIR"
```

### Step 3: Per-Clip Processing

For each selected clip, run these sub-steps. No Deepgram calls — everything derives from the existing transcript.

#### 3.1: Generate word-level subtitles (1_subtitles_words.json)

Convert the storyboard transcript into the word-level format used by the analysis pipeline:

```bash
CLIP="D1-08"
CLIP_DIR="$BATCH_DIR/$CLIP"
mkdir -p "$CLIP_DIR"

node -e "
const transcript = require('$TRANSCRIPTS_DIR/${CLIP}_transcript.json');

// Deepgram transcript → subtitles_words format
// Extract words array, insert gap entries between words
const words = transcript.results.channels[0].alternatives[0].words;
const output = [];

words.forEach((w, i) => {
  // Insert gap if there's space between this word and the previous
  if (i > 0) {
    const prevEnd = words[i-1].end;
    if (w.start - prevEnd > 0.01) {
      output.push({ text: '', start: prevEnd, end: w.start, isGap: true });
    }
  }
  output.push({ text: w.punctuated_word || w.word, start: w.start, end: w.end, isGap: false });
});

require('fs').writeFileSync('$CLIP_DIR/1_subtitles_words.json', JSON.stringify(output, null, 2));
console.log('Words:', output.filter(w => !w.isGap).length, '| Gaps:', output.filter(w => w.isGap).length);
"
```

#### 3.2: Generate readable format (2_readable.txt)

```bash
node -e "
const data = require('$CLIP_DIR/1_subtitles_words.json');
let output = [];
data.forEach((w, i) => {
  if (w.isGap) {
    const dur = (w.end - w.start).toFixed(2);
    if (dur >= 0.5) output.push(i + '|[silence ' + dur + 's]|' + w.start.toFixed(2) + '-' + w.end.toFixed(2));
  } else {
    output.push(i + '|' + w.text + '|' + w.start.toFixed(2) + '-' + w.end.toFixed(2));
  }
});
require('fs').writeFileSync('$CLIP_DIR/2_readable.txt', output.join('\n'));
"
```

#### 3.3: Generate sentence list (3_sentences.txt)

Split by silence into sentences for comparison:

```bash
node -e "
const data = require('$CLIP_DIR/1_subtitles_words.json');
let sentences = [];
let curr = { text: '', startIdx: -1, endIdx: -1 };

data.forEach((w, i) => {
  const isLongGap = w.isGap && (w.end - w.start) >= 0.5;
  if (isLongGap) {
    if (curr.text.length > 0) sentences.push({...curr});
    curr = { text: '', startIdx: -1, endIdx: -1 };
  } else if (!w.isGap) {
    if (curr.startIdx === -1) curr.startIdx = i;
    curr.text += w.text + ' ';
    curr.endIdx = i;
  }
});
if (curr.text.length > 0) sentences.push(curr);

const output = sentences.map((s, i) =>
  i + '|' + s.startIdx + '-' + s.endIdx + '|' + s.text.trim()
).join('\n');
require('fs').writeFileSync('$CLIP_DIR/3_sentences.txt', output);
console.log('Sentences:', sentences.length);
"
```

#### 3.4: Auto-mark silences + AI stumble analysis (4_auto_selected.json)

First, seed with silence indices:

```bash
node -e "
const words = require('$CLIP_DIR/1_subtitles_words.json');
const selected = [];
words.forEach((w, i) => {
  if (w.isGap && (w.end - w.start) >= 0.5) selected.push(i);
});
require('fs').writeFileSync('$CLIP_DIR/4_auto_selected.json', JSON.stringify(selected, null, 2));
console.log('Silences ≥0.5s:', selected.length);
"
```

Then run AI stumble analysis — read detection rules from `podcast-rough-cut/detection-rules/` and analyze in chunks:

```
1. Read 2_readable.txt offset=N limit=300
2. Cross-reference with 3_sentences.txt
3. Append stumble indices to 4_auto_selected.json
4. Log reasoning to 5_stumble_analysis.md
5. N += 300, repeat
```

🚨 **Critical warning: line number ≠ idx** (same as podcast-rough-cut)

```
2_readable.txt format: idx|content|time
                       ↑ use THIS value, not the line number
```

#### 3.5: Stumble analysis log (5_stumble_analysis.md)

Written during step 3.4. Format:

```markdown
# Stumble Analysis: D1-08

## Chunk 1 (idx 0–300)

| idx | Time | Type | Content | Action |
|-----|------|------|---------|--------|
| 65-75 | 15.80-17.66 | repeated sentence | "So I was trying to set up" | delete |

## Chunk 2 (idx 301–600)
...
```

**Repeat steps 3.1–3.5 for each clip in the batch.**


### Step 4: Generate Dashboard

Generate a single `dashboard.html` for the batch. This is a tabbed single-page app — one tab per clip.

```bash
SKILL_DIR="<path-to-repo>/vlog-rough-cut"
STORYBOARD_TRANSCRIPTS="Claude output/storyboard/transcripts"

node "$SKILL_DIR/scripts/generate_dashboard.js" \
  --batch-dir "$BATCH_DIR" \
  --audio-dir "$STORYBOARD_TRANSCRIPTS" \
  --clips "D1-08,D3-03"
# Output: $BATCH_DIR/dashboard.html
```

The dashboard must:
- Show a sidebar with one tab per clip in the batch
- Each tab loads that clip's `1_subtitles_words.json` and `4_auto_selected.json`
- Audio playback from `storyboard/transcripts/<clip>_audio.mp3` (relative path)
- Checkboxes for each marked segment (pre-checked = AI-selected for deletion)
- Play button per segment to preview before confirming
- "Execute Cut" button per clip
- "Cut All" button to process every clip in the batch

### Step 5: Start Review Server + Open Browser

```bash
# Start the review server (4th arg = vlogs folder for FFmpeg source videos)
node "$SKILL_DIR/scripts/review_server.js" 8899 "$BATCH_DIR" "$STORYBOARD_TRANSCRIPTS" "$VLOGS_DIR"

# Auto-open in default browser
open http://localhost:8899
```

`VLOGS_DIR` is the path to the sorted Vlogs folder (e.g. `~/Videos/012 CookingVlog/Media/Vlogs`). The server needs this to find source video files for FFmpeg cutting. If omitted, the server saves the selection JSON so you can run FFmpeg manually.

The review server:
- Serves `dashboard.html` at the root (`GET /`)
- Serves clip data files from each clip subfolder (`GET /data/:clip/:file`)
- Serves audio files from `storyboard/transcripts/` (`GET /audio/:filename`)
- Exposes `POST /cut/:clip` endpoint for per-clip cutting
- Exposes `POST /cut-all` endpoint for batch cutting

### Step 6: Execute Cut

When the user clicks "Execute Cut" (per clip or all), the server calls FFmpeg to remove the selected segments:

```bash
mkdir -p "$BATCH_DIR/cut_output"

# Per clip — the server builds this command from the confirmed selection
# Segments NOT in auto_selected.json are kept, selected segments are cut
ffmpeg -i "$VLOGS_DIR/$DAY/$CLIP.mp4" \
  -vf "select='...filter expression...', setpts=N/FRAME_RATE/TB" \
  -af "aselect='...filter expression...', asetpts=N/SR/TB" \
  -y "$BATCH_DIR/cut_output/${CLIP}_cut.mp4"
```

The review server constructs the FFmpeg filter from the user's final selection (after they've reviewed and toggled checkboxes in the dashboard).

---

## Detection Rules

This skill reuses the detection rules from `podcast-rough-cut/detection-rules/`. The agent reads all rule files during step 3.4 before running stumble analysis.

See `podcast-rough-cut/detection-rules/README.md` for the full rule index and priority order.

---

## Data Formats

### 1_subtitles_words.json

```json
[
  {"text": "the", "start": 0.12, "end": 0.2, "isGap": false},
  {"text": "", "start": 6.78, "end": 7.48, "isGap": true}
]
```

### 4_auto_selected.json

```json
[72, 85, 120]  // indices into subtitles_words — silences + AI-detected stumbles
```

### Storyboard transcript (input, read-only)

Deepgram nova-2 JSON format — `results.channels[0].alternatives[0].words[]` contains word-level timing.

---

## Relationship to Other Skills

| Skill | Role |
|-------|------|
| `vlog-storyboard` | Upstream — produces transcripts + audio that this skill consumes |
| `podcast-rough-cut` | Sibling — single-video rough cut for sit-down recordings. Shares detection rules. |
| `vlog-rough-cut` | This skill — batch orchestrator for vlog chapters |

---

## Configuration

No additional API keys needed — this skill reuses existing transcripts and doesn't call Deepgram.

Review server port: `8899` (same as podcast-rough-cut; don't run both simultaneously).
