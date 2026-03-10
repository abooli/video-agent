import os
import re
import random
from pathlib import Path

# --- CONFIG ---
VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".m4v", ".mts"}
DAY_FOLDER_PATTERN = re.compile(r"^D\d+$")
# ---------------

def unfolder(folder: Path):
    """Move all video files from D1/, D2/, etc. subfolders back to the root folder."""
    moved = 0
    for subfolder in sorted(folder.iterdir()):
        if not subfolder.is_dir() or not DAY_FOLDER_PATTERN.match(subfolder.name):
            continue
        for file in subfolder.iterdir():
            if file.suffix.lower() not in VIDEO_EXTS:
                continue
            dest = folder / file.name
            if dest.exists():
                print(f"SKIP: {file.name} already exists in root, not overwriting")
                continue
            print(f"Moving: {subfolder.name}/{file.name} -> {file.name}")
            file.rename(dest)
            moved += 1
        # Remove subfolder if empty
        if not any(subfolder.iterdir()):
            subfolder.rmdir()
            print(f"Removed empty folder: {subfolder.name}/")
    print(f"\nUnfoldered {moved} files.")

def randomize(folder: Path):
    """Rename all video files to random 4-digit numbers."""
    files = [f for f in folder.iterdir() if f.is_file() and f.suffix.lower() in VIDEO_EXTS]
    if not files:
        print("No video files found.")
        return

    used_hashes = set()
    for file in files:
        while True:
            rand_num = random.randint(0, 9999)
            hash_str = f"{rand_num:04d}"
            if hash_str not in used_hashes:
                used_hashes.add(hash_str)
                break

        new_name = f"{hash_str}{file.suffix.lower()}"
        new_path = file.with_name(new_name)
        print(f"Renaming: {file.name} -> {new_name}")
        file.rename(new_path)

if __name__ == "__main__":
    target = input("Enter folder path: ").strip()
    folder_path = Path(target).expanduser().resolve()

    if not folder_path.is_dir():
        print("Invalid path.")
        exit(1)

    print("\nWhat would you like to do?")
    print("  1. Unfolder + randomize (move files out of D1/, D2/... then randomize names)")
    print("  2. Randomize only (files already in root)")
    choice = input("\nChoice [1/2]: ").strip()

    if choice == "1":
        unfolder(folder_path)
        randomize(folder_path)
    elif choice == "2":
        randomize(folder_path)
    else:
        print("Invalid choice.")
