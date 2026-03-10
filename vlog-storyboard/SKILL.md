---
name: vlog-storyboard
description: "Batch transcribe A-rolls, then analyze transcript for story beats, character arc, and chapter structure. Trigger words: storyboard, analyze vlog, story beats, chapters"
---

<!--
input: list of A-roll clip names (e.g. D1-08, D3-03) located in the Vlogs/ sorted folder
output: transcript + storyboard analysis

To Claude Agents: If this file gets updated, please update:
1. The Skills list in ../README.md
-->

# Vlog Storyboard

Batch transcribes user-specified A-roll clips, then runs storyboard analysis to identify chapters, character arc elements, and relevant themes.

## Flow

```
1. Ask user for:
   - Video topic / title
   - Central conflict of this vlog
   - How they want to show the resolution
   - Emotional goals
   - List of A-roll clips (e.g. D1-08, D3-03, D2-01)
   - Path to the Vlogs/ sorted folder
       ↓
2. Save answers into per-video context file
       ↓
3. Batch transcribe listed clips only (Deepgram)
   - One transcript per clip + one merged transcript
       ↓
4. AI storyboard analysis
   - Reads: merged transcript + per-video context + hot-takes.md + identities.md
   - Uses prompt-template.md structure
   - Outputs: storyboard_analysis.md
       ↓
5. User uses analysis to plan edit in NLE
```

## Step 1: Gather Context (BEFORE transcription)

Ask the user these questions interactively and save the answers. Do NOT start transcription until this is complete.

```
1. What's the video topic / working title?
2. What is the central conflict of this vlog?
3. How do you want to show the resolution? (e.g. finding balance, letting go, small win)
4. Emotional goals? (e.g. relate, be inspired, laugh)
5. List your A-roll clips (e.g. D1-08, D3-03, D2-01)
6. Path to the Vlogs/ sorted folder (e.g. ~/Videos/012 CookingVlog/Media/Vlogs)
```

Save to `per_video_context.md`:

```markdown
# Per-Video Context

- Topic: <user answer>
- Central conflict: <user answer>
- Resolution: <user answer>
- Emotional goals: <user answer>
- A-roll clips: D1-08, D3-03, D2-01
- Source folder: ~/Videos/012 CookingVlog/Media/Vlogs
```

## Step 2: Batch Transcribe

Transcribe ONLY the clips the user listed, found in their day subfolders:

```bash
# Example: D1-08 lives at Vlogs/D1/D1-08.mp4 (or .mov)
# For each clip in the list:
VLOGS_DIR="path/to/Vlogs"
CLIP="D1-08"
DAY=$(echo "$CLIP" | grep -oE '^D[0-9]+')

# Find the file (mp4 or mov)
FILE=$(find "$VLOGS_DIR/$DAY" -iname "$CLIP.*" | head -1)

# Extract audio + transcribe
ffmpeg -i "file:$FILE" -vn -acodec libmp3lame -y "${CLIP}_audio.mp3"
python deepgram_transcribe.py "${CLIP}_audio.mp3" en
```

Then merge all transcripts into one combined file, ordered by the user's clip list:

```
combined_transcript.txt
---
[D1-08] 00:00 - 02:15
Hey guys, so today we're going to...

[D3-03] 00:00 - 01:45
...and then I realized that...
```

## Step 3: Storyboard Analysis

Build the prompt by combining:
1. `per_video_context.md` (from step 1)
2. The combined transcript (from step 2)
3. `prompt-template.md` (the analysis framework)
4. `hot-takes.md` (static, evolves over time)
5. `identities.md` (static, evolves over time)

The AI should produce:

1. A 100-200 word summary identifying the major conflict/dramatic/relatable moments
2. Chapter breakdown with which clips belong to each chapter
3. North star character analysis: which elements are naturally present vs. need emphasis in editing
4. Top 5 hot takes relevant to this vlog
5. Top 5 identities/personality traits with room for development

## Output Structure

```
output/YYYY-MM-DD_<vlog-name>/storyboard/
├── per_video_context.md
├── transcripts/
│   ├── D1-08_transcript.json
│   ├── D3-03_transcript.json
│   └── ...
├── combined_transcript.txt
└── storyboard_analysis.md
```

## After Storyboarding

Once chapters are defined, the user can run the existing rough-cut skill per chapter. Each chapter typically spans 1-2 A-roll clips.
