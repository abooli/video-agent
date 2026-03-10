import os
import random
from pathlib import Path

# --- CONFIG ---
VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".m4v", ".mts"}  # accepted file types
# ---------------

def main():
    files = [f for f in FOLDER.iterdir() if f.suffix.lower() in VIDEO_EXTS]
    if not files:
        print("No video files found.")
        return

    used_hashes = set()
    for file in files:
        # generate a unique random 4-digit number
        while True:
            rand_num = random.randint(0, 9999)
            hash_str = f"{rand_num:04d}"
            if hash_str not in used_hashes:
                used_hashes.add(hash_str)
                break

        new_name = f"{hash_str}{file.suffix.lower()}"
        new_path = file.with_name(new_name)
        print(f"Renaming: {file.name} -> {new_name}")
        os.rename(file, new_path)

if __name__ == "__main__":
    main()
