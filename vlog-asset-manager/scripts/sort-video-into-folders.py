import os
import re
from pathlib import Path

def organize_by_day(folder_path: Path):
    # This regex looks for 'D' followed by digits at the start of the filename
    day_pattern = re.compile(r"^(D\d+)-")

    # Get all files in the directory
    files = [f for f in folder_path.iterdir() if f.is_file()]
    
    moved_count = 0
    
    for file_path in files:
        # Check if the filename matches our pattern (e.g., D1-01.mp4)
        match = day_pattern.match(file_path.name)
        
        if match:
            # Extract the folder name (e.g., "D1")
            day_folder_name = match.group(1)
            day_folder_path = folder_path / day_folder_name
            
            # Create the folder if it doesn't exist
            day_folder_path.mkdir(exist_ok=True)
            
            # Define the new location
            destination = day_folder_path / file_path.name
            
            # Move the file
            print(f"Moving: {file_path.name} -> {day_folder_name}/")
            file_path.rename(destination)
            moved_count += 1

    print(f"\nFinished! Organized {moved_count} files into their respective folders.")

if __name__ == "__main__":
    # Change this to your actual folder path
    target_dir = input("Enter the full path to the folder: ").strip()
    path = Path(target_dir).expanduser().resolve()

    if path.exists() and path.is_dir():
        organize_by_day(path)
    else:
        print("Invalid directory path.")