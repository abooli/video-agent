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
SKILL_DIR="<path-to-repo>/剪口播"
python "$SKILL_DIR/scripts/deepgram_transcribe.py" audio.mp3 en
# Output: whisperx_result.json
```
