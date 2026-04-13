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
   - Notion page URL for this video (e.g. https://notion.so/...)
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
5. Upload to Notion (populates STEP 4: Paper Cut of their video page)
   - Parses storyboard_analysis.md
   - Appends Story toggles + hot takes + identities into STEP 4
       ↓
6. User reviews + refines storyboard in Notion, then runs rough-cut agent per chapter
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
7. Notion page URL for this video (e.g. https://notion.so/Your-Title-2aafac24...)
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
- Notion page URL: https://notion.so/...
```

## Step 2: Batch Transcribe

Transcribe ONLY the clips the user listed using the batch script:

```bash
SKILL_DIR="<path-to-repo>/vlog-storyboard"
VLOGS_DIR="path/to/Vlogs"
OUTPUT_DIR="Claude output/storyboard/transcripts"

bash "$SKILL_DIR/scripts/batch_transcribe.sh" "$VLOGS_DIR" "$OUTPUT_DIR" D1-08 D3-03 D2-01
# Output per clip: <clip>_audio.mp3 + <clip>_transcript.json (raw Deepgram JSON)
# Skips clips that already have transcripts
```

⚠️ **Audio is extracted as MP3** (`-acodec libmp3lame`), not M4A. M4A/AAC has seeking issues in Chrome's Web Audio API.

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

## Step 4: Upload to Notion

After storyboard analysis is complete, upload to the user's Notion video page:

```bash
# Extract page ID from the Notion URL (the UUID at the end)
# e.g. https://notion.so/Your-Title-2aafac24288780d3b101d2722375e0df
#                                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ this part

NOTION_PAGE_ID="<extracted UUID>"
STORYBOARD_FILE="Claude output/storyboard/storyboard_analysis.md"

python vlog-storyboard/scripts/notion_upload.py "$NOTION_PAGE_ID" "$STORYBOARD_FILE"
```

The script will:
1. Find the **STEP 4: Paper Cut** toggle block in the Notion page
2. Append inside it:
   - 📝 Overall summary callout (blue)
   - Story toggles (one per chapter) — each with ⭐ callout + A Roll transcript + to-do focus items
   - 🔥 Relevant Hot Takes toggle
   - 🎭 Relevant Identities toggle

**Prerequisites:**
- `NOTION_API_KEY` set in `.env`
- The Notion integration must be connected to the page:
  Open the page in Notion → `...` menu → **Connect to** → select your integration

## Output Structure

```
Claude output/storyboard/
├── per_video_context.md
├── transcripts/
│   ├── D1-08_audio.mp3           ← extracted audio (MP3 only — M4A breaks Chrome playback)
│   ├── D1-08_transcript.json
│   ├── D3-03_audio.mp3
│   ├── D3-03_transcript.json
│   └── ...
├── combined_transcript.txt
└── storyboard_analysis.md   ← also uploaded to Notion STEP 4
```

## After Storyboarding

1. User reviews the storyboard in Notion — refine chapters, conflict/resolution, focus notes
2. Once happy with the structure, run the rough-cut agent per chapter
3. Each chapter typically spans 1-2 A-roll clips
