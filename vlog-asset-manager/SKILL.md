---
name: vlog-asset-manager
description: "Scans video project folders, renames clips by creation timestamp, sorts them into day folders (flagging short clips as DEL for review), and classifies A-Roll vs B-Roll using speech detection. Two-phase workflow: organize first, then classify after user reviews DEL folder. Trigger words: organize clips, sort videos, rename clips, classify footage, a-roll, b-roll"
---

<!--
input: a folder path containing video files
output: renamed and sorted video files + day folders

To Claude Agents: If this file gets updated, please update:
1. The Skills list in ../README.md
2. /CLAUDE.md list
-->

# Vlog Asset Manager

Renames video clips by creation timestamp and sorts them into day-based folders. All operations are reversible.

## Expected Project Structure

```
0xx <videoTopic>/
├── Exports/          # Finished videos & thumbnails
├── Media/
│   ├── Assets/
│   │   ├── Music/
│   │   └── Photos/
│   ├── Videos/
│   │   ├── A Rolls/
│   │   └── B Rolls/
│   ├── Vlogs/        # Raw clips from DJI & phone go here
│   │   ├── D1/       # Day folders created by sort script
│   │   ├── D2/
│   │   └── DEL/      # Short clips flagged for manual review
│   └── Thumbnails/   # Temporary thumbnail assets
```

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/rename-video-assets.py` | Renames clips to `D{day}-{seq}` format based on creation time |
| `scripts/sort-video-into-folders.py` | Moves renamed clips into `D1/`, `D2/`, etc. folders |
| `scripts/reset.py` | Randomizes filenames to undo renaming (reversibility) |
| `scripts/classify-footage.py` | Classifies clips as A-Roll / B-Roll / Review using Deepgram speech detection |
| `scripts/classify_review_server.js` | Serves review UI with video preview for overriding classifications |

Supported extensions: `.mp4`, `.mov`, `.avi`, `.mkv`, `.m4v`, `.mts`

## Flow

```
Phase 1 — Organize (run together)
──────────────────────────────────
1. User provides folder path (typically the Vlogs/ folder)
       ↓
2. rename-video-assets.py
   - Reads creation timestamp from each video file
   - Sorts all files chronologically
   - Two-pass rename (temp names first, then final D1-01 names)
   - Avoids collisions by clearing the namespace first
   - Clips ≤1 second are flagged with _DEL suffix
       ↓
3. sort-video-into-folders.py
   - Moves D1-* files into D1/ folder, D2-* into D2/, etc.
   - _DEL clips are routed to a DEL/ folder for manual review

⏸ STOP — Wait for user before continuing.
   The user should review the DEL/ folder and delete or rescue clips.
   Do NOT proceed to Phase 2 until the user explicitly asks.

Phase 2 — Classify (run together, on user request)
───────────────────────────────────────────────────
4. classify-footage.py (optional but recommended)
   - Extracts audio from each clip, sends to Deepgram
   - Computes speech density per clip
   - Classifies: >50% speech = A-Roll, <5% = B-Roll, between = Review
   - Outputs classify_result.json
       ↓
5. classify_review_server.js
   - Serves review UI with video preview
   - User overrides ambiguous clips (in-action A-Rolls, etc.)
   - Exports final A-Roll / B-Roll file lists

Utility
───────
6. (If needed) reset.py
   - Renames all files to random 4-digit numbers
   - Use this to undo and start over
```

## Usage

### Step 1: Rename by timestamp

```bash
SKILL_DIR="path/to/vlog-asset-manager"
python "$SKILL_DIR/scripts/rename-video-assets.py"
# Enter folder path when prompted
```

Output: `D1-01.mp4`, `D1-02.mov`, `D2-01.mp4`, etc. Clips ≤1 second get a `_DEL` suffix (e.g. `D1-03_DEL.mov`).

### Step 2: Sort into day folders

```bash
python "$SKILL_DIR/scripts/sort-video-into-folders.py"
# Enter the same folder path when prompted
```

Output: files moved into `D1/`, `D2/`, etc. subfolders. `_DEL` clips go into a `DEL/` folder.

**⏸ Stop here.** Review the `DEL/` folder and delete or rescue clips before proceeding to classification.

### Step 3: Classify A-Roll vs B-Roll

```bash
python "$SKILL_DIR/scripts/classify-footage.py" /path/to/Vlogs
```

This transcribes all clips via Deepgram (~$1.80 for 7 hours of footage) and classifies them by speech density:
- **A-Roll** (>50% speech): sit-down talking clips
- **B-Roll** (<5% speech): scenic/action footage
- **Review** (5–50%): ambiguous clips (in-action A-Rolls, short reactions)

Output: `classify_result.json` in the target folder.

Options:
- `--language zh` — for non-English footage
- `--workers 5` — increase parallel transcription (default: 3)
- `--a-roll-threshold 0.40` — lower the A-Roll cutoff
- `--b-roll-threshold 0.10` — raise the B-Roll cutoff

### Step 4: Review ambiguous clips

```bash
node "$SKILL_DIR/scripts/classify_review_server.js" /path/to/Vlogs/classify_result.json
# Open http://localhost:8877
```

The review UI shows:
- Video preview in the sidebar (click any clip card to load it)
- Transcript snippets for quick context
- A-Roll / B-Roll toggle buttons to override the AI classification
- Save persists overrides to `classify_overrides.json`
- Export writes final `classify_export.json` with A-Roll and B-Roll file lists

### Step 5: Undo (if needed)

```bash
python "$SKILL_DIR/scripts/reset.py"
# Enter folder path when prompted
```

This randomizes all filenames, clearing the D-naming so you can re-run step 1 cleanly.

## Safety Rules

- NEVER delete any files. These scripts only rename and move.
- The rename script uses a two-pass approach (temp names → final names) to prevent collisions when re-running.
- `reset.py` is the undo mechanism — it randomizes names so you can start fresh.
- If a file already exists at the destination during sort, `Path.rename()` will overwrite on some systems. Always reset before re-running if you've added new files.

## Collision Prevention

A past bug caused data loss when new files were added and the rename was re-run — a new file got the same `D1-01` name as an existing file.

The current `rename-video-assets.py` fixes this with a two-pass strategy:
1. First pass: rename ALL files to temporary names (`temp_0`, `temp_1`, ...)
2. Second pass: assign final `D{day}-{seq}` names from the cleared namespace

If you need to add files and re-run, either:
- Reset first (`reset.py`), then re-run rename on the full set
- Or manually verify no collisions exist before running

## FAQ

### Q: I added new clips and want to re-sort. What do I do?

Run `reset.py` first to clear all D-names, then re-run `rename-video-assets.py` on the full folder. This ensures the new files get properly sequenced.

### Q: Can I rename only new files without touching existing ones?

Not with the current scripts — they operate on the entire folder. Reset + re-run is the safe approach.

### Q: The creation time is wrong on some files.

The script uses `st_birthtime` on macOS (true creation time). If files were copied in a way that reset the timestamp, the modification time (`st_mtime`) is used as fallback. Check with `stat` or `mdls` on macOS.
