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

> Batch rough-cut orchestrator — reuses storyboard transcripts, runs AI sentence analysis, serves a tabbed review UI per chapter.

## Prerequisites

- `vlog-storyboard` must have been run first (transcripts + audio already in `Claude output/storyboard/transcripts/`)
- Node.js 18+, FFmpeg, Python 3.8+
- Detection rules in `vlog-rough-cut/detection-rules/` (separate from podcast-rough-cut)

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
        │   ├── 2_sentences.txt              ← sentence-segmented (primary AI input)
        │   ├── 3_auto_selected.json         ← silence + best-take selection indices
        │   └── 4_analysis.md                ← AI reasoning log
        ├── D3-03/
        │   └── ...
        ├── dashboard.html                   ← tabbed review UI for this batch
        └── cut_output/                      ← FFmpeg output after review
            ├── D1-08_cut.mp4
            └── D3-03_cut.mp4
```

## Quick Start (Batch Runner)

The fastest way to run everything — one command, walk away:

```bash
python vlog-rough-cut/scripts/batch_rough_cut.py "Chapter 1" D1-08 D3-03 D4-02
```

This handles all phases automatically:
1. Converts transcripts + seeds silences (Node scripts, no AI)
2. Runs AI analysis per clip (separate Claude Code CLI session each, fresh context)
3. Generates the review dashboard

See below for the manual step-by-step flow if you need more control.

## Flow (Manual)

```
1. Scan Claude output/storyboard/transcripts/ for available clips
       ↓
2. Prompt user: "Which clips to rough-cut?" (numbered list)
       ↓
3. Prompt user: "Name this batch?" → e.g. "Chapter 1"
       ↓
4. Per clip (ONE AT A TIME): generate files → AI analysis → next clip
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

⚠️ **CRITICAL: Process ONE clip fully (steps 3.1 → 3.4) before starting the next clip.** Do NOT generate files for all clips first and then analyze. This prevents context overflow. (Or use the batch runner which handles this automatically.)

For each selected clip, run these sub-steps. No Deepgram calls — everything derives from the existing transcript.

#### 3.1: Generate word-level subtitles + sentence list

Convert the storyboard transcript into analysis-ready files. This script handles both Deepgram and WhisperX transcript formats:

```bash
CLIP="D1-08"
CLIP_DIR="$BATCH_DIR/$CLIP"

node vlog-rough-cut/scripts/convert_transcript.js \
  "$TRANSCRIPTS_DIR/${CLIP}_transcript.json" \
  "$CLIP_DIR"
# Output: 1_subtitles_words.json + 2_sentences.txt
```

#### 3.2: Seed silence indices

Pre-populate `3_auto_selected.json` with gaps ≥ 1s before AI analysis:

```bash
node vlog-rough-cut/scripts/seed_silences.js "$CLIP_DIR"
# Output: 3_auto_selected.json (silence indices only)
```

#### 3.3: AI sentence analysis — pick best takes (3_auto_selected.json)

Run AI sentence-level analysis using `vlog-rough-cut/detection-rules/`:

```
1. Read detection rules ONCE (4 files: Rule 0, 1, 2, 3)
2. Read 2_sentences.txt in full (clips are ≤10 min, fits in one pass)
3. Produce topic outline (Rule 0) → write to 4_analysis.md
4. Map every sentence to a topic, aside, or noise (Rule 1) → append to 4_analysis.md
5. Per topic: pick best take — simple, composite, or sequential (Rule 2)
   a. Mark non-selected sentences' word ranges for deletion in 3_auto_selected.json
   b. Rescue usable clauses from otherwise-deleted sentences
   c. Append topic decisions to 4_analysis.md
6. Delete filler words (um/uh/uhh) and apply silence thresholds (Rule 3)
7. Run coherence check on kept sentences in order (Rule 3)
8. Orphan cleanup (Rule 3) → append final summary to 4_analysis.md
```

The unit of work is a SENTENCE, not a word. The agent reads `2_sentences.txt` as the primary input. `1_subtitles_words.json` is only referenced to look up word indices when writing to `3_auto_selected.json`.

⚠️ **Context budget rules:**
- Read detection rules ONCE. Do NOT re-read between steps.
- Vlog clips are ≤10 min (~1500 words), so the full sentence list fits in context. No chunking needed.
- Keep the analysis log terse: topic ID, sentence IDs, which was kept, one-line reason.

#### 3.4: Analysis log (4_analysis.md)

Written during step 3.3. Format:

```markdown
# Sentence Analysis: D1-08

## Topic Outline

1. Greeting — happy Friday, disclaimer that it's her Friday not yours
2. Lunch break — chicken rice from two days ago, still good
3. [aside] Fork instead of spoon
...

## Sentence Mapping

| Sentence | Text (truncated) | Mapping |
|----------|-------------------|---------|
| S0 | "Hello, guys." | Topic 1 |
| S1 | "It's happy Friday." | Topic 1 |
| ... | ... | ... |

## Best Take Selection

### Topic 1: Greeting (S0–S7)
- S0: "Hello, guys." — **KEEP** (greeting)
- S1: "It's happy Friday." — **KEEP** (best complete take)
- S2–S4: retakes → delete
- S5: **KEEP** — Friday disclaimer
- S6: **KEEP** — "So I don't know" (transition)
- S7: **KEEP** — punchline

### Topic 2: Lunch break (S8–S14)
- S8: incomplete → delete
- S9: **KEEP** — complete take
...

## Final Cut Summary

- Sentences kept: 28 / 55
- Topics fully covered: 11/11
```

**Complete steps 3.1–3.4 for this clip, then move to the next clip.**


### Step 4: Generate Dashboard

After ALL clips are processed, generate a single `dashboard.html` for the batch.

```bash
SKILL_DIR="<path-to-repo>/vlog-rough-cut"
STORYBOARD_TRANSCRIPTS="Claude output/storyboard/transcripts"

node "$SKILL_DIR/scripts/generate_dashboard.js" \
  --batch-dir "$BATCH_DIR" \
  --audio-dir "$STORYBOARD_TRANSCRIPTS" \
  --clips "D1-08,D3-03"
# Output: $BATCH_DIR/dashboard.html
```

The dashboard reads each clip's `1_subtitles_words.json` and `3_auto_selected.json`.

### Step 5: Start Review Server + Open Browser

```bash
node "$SKILL_DIR/scripts/review_server.js" 8899 "$BATCH_DIR" "$STORYBOARD_TRANSCRIPTS" "$VLOGS_DIR"
open http://localhost:8899
```

`VLOGS_DIR` is the path to the sorted Vlogs folder (e.g. `~/Videos/012 CookingVlog/Media/Vlogs`). The server needs this to find source video files for FFmpeg cutting. If omitted, the server saves the selection JSON so you can run FFmpeg manually.

### Step 6: Execute Cut

When the user clicks "Execute Cut", the server calls FFmpeg to remove the selected segments:

```bash
mkdir -p "$BATCH_DIR/cut_output"

ffmpeg -i "$VLOGS_DIR/$DAY/$CLIP.mp4" \
  -vf "select='...filter expression...', setpts=N/FRAME_RATE/TB" \
  -af "aselect='...filter expression...', asetpts=N/SR/TB" \
  -y "$BATCH_DIR/cut_output/${CLIP}_cut.mp4"
```

---

## Detection Rules

This skill uses its own detection rules in `vlog-rough-cut/detection-rules/`. These are summary-driven and additive (understand the content first, then pick best audio for each point), unlike `podcast-rough-cut/detection-rules/` which are word-level and subtractive (mark problems for deletion).

See `vlog-rough-cut/detection-rules/README.md` for the rule index and analysis flow.

---

## Data Formats

### 1_subtitles_words.json

```json
[
  {"text": "the", "start": 0.12, "end": 0.2, "isGap": false},
  {"text": "", "start": 6.78, "end": 7.48, "isGap": true}
]
```

### 3_auto_selected.json

```json
[72, 85, 120]  // indices into subtitles_words — silences + AI-selected deletions
```

### Storyboard transcript (input, read-only)

Deepgram nova-2 JSON format — `results.channels[0].alternatives[0].words[]` contains word-level timing.

---

## Relationship to Other Skills

| Skill | Role |
|-------|------|
| `vlog-storyboard` | Upstream — produces transcripts + audio that this skill consumes |
| `podcast-rough-cut` | Sibling — single-video rough cut for sit-down recordings. Uses its own word-level detection rules. |
| `vlog-rough-cut` | This skill — batch orchestrator for vlog chapters. Uses sentence-level additive rules (pick best take). |

---

## Configuration

No additional API keys needed — this skill reuses existing transcripts and doesn't call Deepgram.

Review server port: `8899` (same as podcast-rough-cut; don't run both simultaneously).
