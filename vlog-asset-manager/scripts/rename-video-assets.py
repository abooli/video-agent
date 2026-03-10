import os
import datetime
from pathlib import Path

# --- CONFIG ---
VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".m4v", ".mts"}

def get_creation_time(path: Path):
    stat = path.stat()
    # macOS/Windows: birthtime | Linux: mtime
    ts = getattr(stat, "st_birthtime", stat.st_mtime)
    return datetime.datetime.fromtimestamp(ts)

def main(folder: Path):
    # 1. Gather all video files
    files = [f for f in folder.iterdir() if f.suffix.lower() in VIDEO_EXTS]
    if not files:
        print("No video files found.")
        return

    # 2. Sort EVERYTHING by actual creation timestamp
    # This ignores the current filename (D1-01, etc.) and looks at the file properties
    file_dates = sorted([(f, get_creation_time(f)) for f in files], key=lambda x: x[1])

    start_date = file_dates[0][1].date()
    
    # 3. STEP ONE: Rename everything to a UUID/Temp name
    # This clears the "D1-01" namespace so we don't have collisions
    temp_moves = []
    for i, (file_path, dt) in enumerate(file_dates):
        temp_name = file_path.with_name(f"temp_{i}{file_path.suffix}")
        file_path.rename(temp_name)
        temp_moves.append((temp_name, dt))
        print(f"Holding: {file_path.name} -> temporary")

    # 4. STEP TWO: Final Rename
    # Now we assign the final Dx-yy names based on the sorted order
    day_counters = {}
    for temp_path, dt in temp_moves:
        current_date = dt.date()
        day_offset = (current_date - start_date).days + 1
        
        day_counters[current_date] = day_counters.get(current_date, 0) + 1
        new_name = f"D{day_offset}-{day_counters[current_date]:02d}{temp_path.suffix.lower()}"
        
        final_path = temp_path.with_name(new_name)
        temp_path.rename(final_path)
        print(f"Finalizing: {new_name}")

if __name__ == "__main__":
    # Use your folder path here
    target = input("Enter folder path: ").strip()
    folder_path = Path(target).expanduser().resolve()
    
    if folder_path.is_dir():
        main(folder_path)
    else:
        print("Invalid path.")