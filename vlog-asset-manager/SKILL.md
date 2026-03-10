---
name: vlog-asset-manager
description: "Scans video project folders, renames clips by creation timestamp and sorts them into day folders. Reversible via reset script. Trigger words: organize clips, sort videos, rename clips"
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
│   └── Thumbnails/   # Temporary thumbnail assets
```

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/rename-video-assets.py` | Renames clips to `D{day}-{seq}` format based on creation time |
| `scripts/sort-video-into-folders.py` | Moves renamed clips into `D1/`, `D2/`, etc. folders |
| `scripts/reset.py` | Randomizes filenames to undo renaming (reversibility) |

Supported extensions: `.mp4`, `.mov`, `.avi`, `.mkv`, `.m4v`, `.mts`

## Flow

```
1. User provides folder path (typically the Vlogs/ folder)
       ↓
2. rename-video-assets.py
   - Reads creation timestamp from each video file
   - Sorts all files chronologically
   - Two-pass rename (temp names first, then final D1-01 names)
   - Avoids collisions by clearing the namespace first
       ↓
3. sort-video-into-folders.py
   - Moves D1-* files into D1/ folder, D2-* into D2/, etc.
       ↓
4. (If needed) reset.py
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

Output: `D1-01.mp4`, `D1-02.mov`, `D2-01.mp4`, etc.

### Step 2: Sort into day folders

```bash
python "$SKILL_DIR/scripts/sort-video-into-folders.py"
# Enter the same folder path when prompted
```

Output: files moved into `D1/`, `D2/`, etc. subfolders.

### Step 3: Undo (if needed)

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
