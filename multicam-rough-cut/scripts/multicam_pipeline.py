#!/usr/bin/env python3
"""
Multi-cam sync pipeline orchestrator.

Usage:
  python multicam_pipeline.py "Session Name" angle1.mov angle2.mov [angle3.mov]
    --primary 0            # which angle provides audio (default: 0)
    --videos-dir ./        # where source video files live
    --transcript <path>    # existing transcript for primary angle (skip Deepgram)

Phases:
  1. Extract PCM from each angle (first 60s for clap detection)
  2. Detect clap + calculate sync → sync_data.json
  3. Convert primary transcript → word timeline + sentences
  4. Seed silences
  5. Generate review HTML
  6. Start review server + open browser
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent


def run(cmd, **kwargs):
    print(f"  $ {' '.join(str(c) for c in cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True, **kwargs)
    if result.returncode != 0:
        print(f"  STDERR: {result.stderr[:500]}")
        sys.exit(1)
    if result.stdout.strip():
        print(f"  {result.stdout.strip()}")
    return result


def main():
    parser = argparse.ArgumentParser(description="Multi-cam sync pipeline")
    parser.add_argument("session_name", help="Name for this editing session")
    parser.add_argument("angles", nargs="+", help="Video files (2-3 angles)")
    parser.add_argument("--primary", type=int, default=0, help="Primary angle index (default: 0)")
    parser.add_argument("--videos-dir", default=".", help="Directory containing video files")
    parser.add_argument("--transcript", help="Existing transcript JSON for primary angle")
    parser.add_argument("--port", type=int, default=8877, help="Review server port")
    args = parser.parse_args()

    if len(args.angles) < 2 or len(args.angles) > 3:
        print("Error: provide 2 or 3 angle files")
        sys.exit(1)

    videos_dir = Path(args.videos_dir).resolve()
    session_dir = PROJECT_ROOT / "Claude output" / "multicam" / args.session_name
    session_dir.mkdir(parents=True, exist_ok=True)

    # Verify all video files exist
    for angle in args.angles:
        if not (videos_dir / angle).exists():
            print(f"Error: video not found: {videos_dir / angle}")
            sys.exit(1)

    print(f"\n=== Multi-Cam Sync: {args.session_name} ===")
    print(f"  Angles: {', '.join(args.angles)}")
    print(f"  Primary: {args.angles[args.primary]}")
    print(f"  Session: {session_dir}\n")

    # Phase 1: Extract PCM
    print("Phase 1: Extracting audio for clap detection...")
    pcm_files = []
    with tempfile.TemporaryDirectory() as tmp_dir:
        for angle in args.angles:
            pcm_path = os.path.join(tmp_dir, Path(angle).stem + ".pcm")
            video_path = str(videos_dir / angle)
            run([
                "ffmpeg", "-y", "-i", video_path,
                "-vn", "-t", "60", "-ar", "16000", "-ac", "1",
                "-f", "s16le", "-acodec", "pcm_s16le", pcm_path,
            ])
            pcm_files.append(pcm_path)

        # Phase 2: Detect clap + sync
        print("\nPhase 2: Detecting clap and calculating sync...")
        clap_results_path = os.path.join(tmp_dir, "clap_results.json")
        result = run([
            "node", str(SCRIPT_DIR / "detect_clap.js"), *pcm_files,
        ])
        with open(clap_results_path, "w") as f:
            f.write(result.stdout)

        sync_data_path = str(session_dir / "sync_data.json")
        run([
            "node", str(SCRIPT_DIR / "sync_calculator.js"),
            clap_results_path, sync_data_path, *args.angles,
        ])

    # Read sync data for clap offset
    with open(session_dir / "sync_data.json") as f:
        sync_data = json.load(f)
    primary_clap = sync_data["angles"][args.primary]["clapTimeSec"]

    # Phase 3: Convert transcript
    print("\nPhase 3: Converting transcript...")
    transcript_path = args.transcript
    if not transcript_path:
        # Look for existing transcript next to the video
        primary_stem = Path(args.angles[args.primary]).stem
        candidates = [
            videos_dir / f"{primary_stem}_transcript.json",
            videos_dir / f"{primary_stem}.json",
        ]
        for c in candidates:
            if c.exists():
                transcript_path = str(c)
                break

    if not transcript_path:
        print(f"Error: no transcript found for {args.angles[args.primary]}")
        print("  Provide one with --transcript or place it as <name>_transcript.json next to the video")
        sys.exit(1)

    run([
        "node", str(SCRIPT_DIR / "convert_transcript.js"),
        transcript_path, str(session_dir),
        "--clap-offset", str(primary_clap),
    ])

    # Phase 4: Seed silences
    print("\nPhase 4: Seeding silences...")
    run(["node", str(SCRIPT_DIR.parent.parent / "vlog-rough-cut" / "scripts" / "seed_silences.js"), str(session_dir)])

    # Phase 5: Generate review HTML
    print("\nPhase 5: Generating review UI...")
    run([
        "node", str(SCRIPT_DIR / "generate_review.js"),
        "--session-dir", str(session_dir),
        "--session-name", args.session_name,
    ])

    # Phase 6: Start server
    print(f"\nPhase 6: Starting review server on port {args.port}...")
    print(f"  Open: http://localhost:{args.port}")
    print("  Press Ctrl+C to stop\n")

    # Open browser
    if sys.platform == "darwin":
        subprocess.Popen(["open", f"http://localhost:{args.port}"])

    # Start server (blocking)
    os.execvp("node", [
        "node", str(SCRIPT_DIR / "review_server.js"),
        str(args.port), str(session_dir), str(videos_dir),
    ])


if __name__ == "__main__":
    main()
