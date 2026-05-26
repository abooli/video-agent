---
name: multicam-sync
description: "Multi-camera sync + rough cut: auto-syncs 2-3 angles via clap detection, provides side-by-side preview with word-level editing, exports all angles cut identically and in sync. Trigger words: multicam, multi-cam, sync, multi angle, two cameras"
---

# Multi-Cam Sync

> Automatically sync 2-3 camera angles via clap detection, preview them side-by-side, rough-cut on the primary audio, and export all angles cut identically — ready for angle selection in CapCut.

## Prerequisites

- Node.js 18+, FFmpeg, Python 3.8+
- Video files from all angles (must share a clap/clapboard sync point)
- Transcript for the primary angle (Deepgram JSON or segments format)

## Quick Start

```bash
python multicam-sync/scripts/multicam_pipeline.py "Session Name" angle1.mov angle2.mov
```

This handles everything: clap detection → sync → transcript conversion → review UI → server.

### Options

```
--primary 0            # Which angle provides audio (default: first)
--videos-dir ./        # Where video files are located
--transcript <path>    # Existing transcript (auto-detected if named <stem>_transcript.json)
--port 8877            # Review server port
```

## How Sync Works

1. **Extract audio** from first 60s of each video as raw PCM (16kHz mono)
2. **Detect clap** via onset detection: finds the first sharp amplitude spike in each track
3. **Calculate offsets**: primary angle's clap = time 0; other angles offset relative to it
4. **Discard pre-clap**: all content before the clap is ignored

## Review UI

- Side-by-side video panels (2 or 3 angles)
- Primary angle plays with audio; others are muted and synced
- Word-level timeline below (same interaction as vlog-rough-cut dashboard)
- Double-click words to mark for deletion; shift+drag for batch select
- Playback automatically skips deleted segments in all angles simultaneously
- "Cut All Angles" exports each angle with identical cuts applied

## Output

```
Claude output/multicam/<session-name>/
├── sync_data.json              # Clap times + offsets
├── 1_subtitles_words.json      # Word timeline (post-clap)
├── 2_sentences.txt             # Sentences for AI analysis
├── 3_auto_selected.json        # Auto-selected deletions (silences)
├── saved_selections.json       # User selections (persisted on Save)
├── review.html                 # Review UI
└── cut_output/
    ├── angle1_cut.mp4          # All angles cut identically
    └── angle2_cut.mp4
```

## Workflow

```
multicam-sync (sync + rough cut)
    → CapCut (angle selection, transitions, color)
    → subtitles (optional burn-in)
```

## Data Formats

### sync_data.json

```json
{
  "primary": "D1-02.mov",
  "angles": [
    { "file": "D1-02.mov", "clapTimeSec": 2.49, "offsetSec": 0 },
    { "file": "D1-05.mov", "clapTimeSec": 4.06, "offsetSec": 1.57 }
  ]
}
```

### Relationship to Other Skills

| Skill | Role |
|-------|------|
| `podcast-rough-cut` | Alternative for single-video rough cut |
| `vlog-rough-cut` | Alternative for batch single-video rough cut |
| `multicam-sync` | This skill — multi-angle sync + parallel rough cut |
