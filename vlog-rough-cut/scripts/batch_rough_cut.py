#!/usr/bin/env python3
"""
Batch rough-cut runner for vlog clips.
Runs mechanical prep (convert + seed) for all clips first,
then invokes Claude Code CLI per clip for AI analysis (fresh context each time).

Usage:
    python batch_rough_cut.py "Chapter 1" D1-08 D3-03 D4-02

Prerequisites:
    - Transcripts in "Claude output/storyboard/transcripts/"
    - Claude Code CLI installed (`claude` command available)
    - Node.js installed
"""

import subprocess
import sys
from pathlib import Path


TRANSCRIPTS_DIR = Path("Claude output/storyboard/transcripts")
OUTPUT_DIR = Path("Claude output/rough-cut")
SCRIPTS_DIR = Path(__file__).parent


def run(cmd, label=""):
    """Run a command, print output, exit on failure."""
    print(f"  → {label or ' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.stdout.strip():
        print(result.stdout.strip())
    if result.returncode != 0:
        print(f"ERROR: {result.stderr.strip()}")
        sys.exit(1)


def phase1_prep(batch_dir: Path, clips: list[str]):
    """Convert transcripts + seed silences (no AI needed)."""
    print("\n--- Phase 1: Convert transcripts + seed silences ---")

    for clip in clips:
        transcript = TRANSCRIPTS_DIR / f"{clip}_transcript.json"
        clip_dir = batch_dir / clip

        if not transcript.exists():
            print(f"ERROR: Transcript not found: {transcript}")
            sys.exit(1)

        print(f"\n[{clip}] Converting transcript...")
        run(
            ["node", str(SCRIPTS_DIR / "convert_transcript.js"), str(transcript), str(clip_dir)],
            label=f"convert {clip}",
        )

        print(f"[{clip}] Seeding silences...")
        run(
            ["node", str(SCRIPTS_DIR / "seed_silences.js"), str(clip_dir)],
            label=f"seed {clip}",
        )

    print("\n--- Phase 1 complete ---")


def phase2_ai_analysis(batch_dir: Path, clips: list[str]):
    """Run AI analysis per clip (separate Claude session each)."""
    print("\n--- Phase 2: AI sentence analysis (one clip per Claude session) ---")

    for clip in clips:
        clip_dir = batch_dir / clip
        print(f"\n[{clip}] Starting AI analysis...")

        prompt = f"""You are running vlog rough-cut AI analysis for clip {clip}.

INSTRUCTIONS:
1. Read the 4 detection rule files in vlog-rough-cut/detection-rules/ (0-topic-outline.md, 1-sentence-to-topic-mapping.md, 2-best-take-selection.md, 3-silence-and-cleanup.md)
2. Read the sentence file: {clip_dir}/2_sentences.txt
3. Read the word-level file: {clip_dir}/1_subtitles_words.json
4. Read the current auto-selected indices: {clip_dir}/3_auto_selected.json

Then follow the detection rules in order:
- Rule 0: Produce a topic outline
- Rule 1: Map every sentence to a topic, aside, or noise
- Rule 2: Pick best take per topic (simple, composite, or sequential)
- Rule 3: Filler cleanup, silence thresholds, coherence check, orphan cleanup

OUTPUT:
- Write the analysis log to: {clip_dir}/4_analysis.md
- Update {clip_dir}/3_auto_selected.json with all deletion indices (merge with existing silence indices, keep sorted, no duplicates)

Be terse in the analysis log. One line per sentence decision."""

        result = subprocess.run(
            ["claude", "-p", prompt, "--allowedTools", "Read,Write,Edit,Bash"],
            capture_output=True,
            text=True,
        )

        if result.returncode != 0:
            print(f"WARNING: Claude returned non-zero for {clip}")
            if result.stderr.strip():
                print(f"  stderr: {result.stderr.strip()}")

        print(f"[{clip}] AI analysis complete.")

    print("\n--- Phase 2 complete ---")


def phase3_dashboard(batch_dir: Path, clips: list[str]):
    """Generate the review dashboard."""
    print("\n--- Phase 3: Generate dashboard ---")

    clip_list = ",".join(clips)
    run(
        [
            "node", str(SCRIPTS_DIR / "generate_dashboard.js"),
            "--batch-dir", str(batch_dir),
            "--audio-dir", str(TRANSCRIPTS_DIR),
            "--clips", clip_list,
        ],
        label="generate dashboard",
    )

    print(f"\nDashboard: {batch_dir}/dashboard.html")


def main():
    if len(sys.argv) < 3:
        print("Usage: python batch_rough_cut.py <batch-name> <clip1> <clip2> ...")
        print('Example: python batch_rough_cut.py "Chapter 1" D1-08 D3-03 D4-02')
        sys.exit(1)

    batch_name = sys.argv[1]
    clips = sys.argv[2:]
    batch_dir = OUTPUT_DIR / batch_name

    print(f"=== Vlog Rough Cut: {batch_name} ===")
    print(f"Clips: {', '.join(clips)}")
    print(f"Batch dir: {batch_dir}")

    phase1_prep(batch_dir, clips)
    phase2_ai_analysis(batch_dir, clips)
    phase3_dashboard(batch_dir, clips)

    print(f"\n=== Done! ===")
    print(f"\nTo review, run:")
    print(f'  node {SCRIPTS_DIR}/review_server.js 8899 "{batch_dir}" "{TRANSCRIPTS_DIR}"')
    print(f"  open http://localhost:8899")


if __name__ == "__main__":
    main()
