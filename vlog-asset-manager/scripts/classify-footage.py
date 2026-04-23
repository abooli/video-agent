#!/usr/bin/env python3
"""
Classify video clips as A-Roll, B-Roll, or Review-Needed.

Uses Deepgram transcription to detect speech density per clip,
then buckets clips into three categories:
  - A-Roll (confident): >50% speech density
  - B-Roll (confident): <5% speech density
  - Review needed: everything in between

Usage:
  python classify-footage.py <folder> [--language en] [--output classify_result.json]

The folder should contain renamed clips (D1-01.mov, D2-03.mp4, etc.)
or be organized into day subfolders (D1/, D2/).

Output: JSON manifest + per-clip transcript snippets for review.

Requires: DEEPGRAM_API_KEY in ../../.env
          pip install requests
          ffmpeg on PATH (for audio extraction)
"""

import sys
import os
import json
import subprocess
import tempfile
import argparse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# ── Config ──────────────────────────────────────────────────────────────────

VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".m4v", ".mts"}

# Classification thresholds (fraction of clip duration that contains speech)
A_ROLL_THRESHOLD = 0.50   # >50% speech → confident A-Roll
B_ROLL_THRESHOLD = 0.05   # <5% speech  → confident B-Roll
# Between 5% and 50% → review needed

DEEPGRAM_URL = "https://api.deepgram.com/v1/listen"


def load_env():
    """Load .env from repo root (three levels up from this script)."""
    env_file = Path(__file__).resolve().parent.parent.parent / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())


def get_api_key():
    load_env()
    key = os.environ.get("DEEPGRAM_API_KEY", "")
    if not key or key == "your_deepgram_api_key_here":
        print("❌ Set DEEPGRAM_API_KEY in .env (repo root)")
        sys.exit(1)
    return key


def get_clip_duration(clip_path):
    """Get clip duration in seconds using ffprobe."""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "csv=p=0",
                str(clip_path),
            ],
            capture_output=True, text=True, timeout=30,
        )
        return float(result.stdout.strip())
    except Exception as e:
        print(f"  ⚠️  Could not get duration for {clip_path.name}: {e}")
        return None


def extract_audio(clip_path, tmp_dir):
    """Extract audio to a temporary mp3 file. Returns path or None."""
    audio_path = Path(tmp_dir) / (clip_path.stem + ".mp3")
    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", str(clip_path),
                "-vn", "-acodec", "libmp3lame", "-q:a", "6",
                "-ar", "16000", "-ac", "1",
                str(audio_path),
            ],
            capture_output=True, timeout=120,
        )
        if audio_path.exists() and audio_path.stat().st_size > 0:
            return audio_path
    except Exception as e:
        print(f"  ⚠️  Audio extraction failed for {clip_path.name}: {e}")
    return None


def transcribe_audio(audio_path, api_key, language="en"):
    """Send audio to Deepgram, return word-level results."""
    import requests

    mime = "audio/mpeg"
    with open(audio_path, "rb") as f:
        resp = requests.post(
            DEEPGRAM_URL,
            headers={
                "Authorization": f"Token {api_key}",
                "Content-Type": mime,
            },
            params={
                "model": "nova-2",
                "language": language,
                "punctuate": "true",
                "utterances": "true",
                "utt_split": "0.8",
            },
            data=f,
            timeout=300,
        )

    if resp.status_code != 200:
        return None, f"API error {resp.status_code}: {resp.text[:200]}"

    data = resp.json()
    words = data.get("results", {}).get("channels", [{}])[0] \
                .get("alternatives", [{}])[0].get("words", [])
    return words, None


def compute_speech_density(words, clip_duration):
    """Compute fraction of clip duration that contains speech."""
    if not words or not clip_duration or clip_duration <= 0:
        return 0.0

    speech_duration = sum(w["end"] - w["start"] for w in words)
    return speech_duration / clip_duration


def classify_clip(speech_density):
    """Return classification based on speech density."""
    if speech_density >= A_ROLL_THRESHOLD:
        return "a-roll"
    elif speech_density < B_ROLL_THRESHOLD:
        return "b-roll"
    else:
        return "review"


def get_transcript_snippet(words, max_words=30):
    """Get first N words as a preview snippet."""
    if not words:
        return ""
    texts = [w.get("punctuated_word", w.get("word", "")) for w in words[:max_words]]
    snippet = " ".join(texts)
    if len(words) > max_words:
        snippet += " ..."
    return snippet


def collect_clips(folder):
    """Recursively collect video clips from folder and day subfolders."""
    clips = []

    # Direct files in folder
    for f in sorted(folder.iterdir()):
        if f.is_file() and f.suffix.lower() in VIDEO_EXTS:
            clips.append(f)

    # Files in D1/, D2/, etc. subfolders
    import re
    for d in sorted(folder.iterdir()):
        if d.is_dir() and re.match(r"^D\d+$", d.name):
            for f in sorted(d.iterdir()):
                if f.is_file() and f.suffix.lower() in VIDEO_EXTS:
                    clips.append(f)

    return clips


def process_clip(clip_path, api_key, language, tmp_dir):
    """Process a single clip: extract audio, transcribe, classify."""
    name = clip_path.name
    rel = str(clip_path.parent.name + "/" + name) if clip_path.parent.name.startswith("D") else name

    duration = get_clip_duration(clip_path)
    if duration is None:
        return {
            "file": rel,
            "path": str(clip_path),
            "error": "Could not read duration",
            "classification": "review",
            "speech_density": 0,
            "snippet": "",
            "word_count": 0,
        }

    audio = extract_audio(clip_path, tmp_dir)
    if audio is None:
        return {
            "file": rel,
            "path": str(clip_path),
            "error": "Audio extraction failed",
            "classification": "review",
            "duration": round(duration, 2),
            "speech_density": 0,
            "snippet": "",
            "word_count": 0,
        }

    words, err = transcribe_audio(audio, api_key, language)
    if err:
        return {
            "file": rel,
            "path": str(clip_path),
            "error": err,
            "classification": "review",
            "duration": round(duration, 2),
            "speech_density": 0,
            "snippet": "",
            "word_count": 0,
        }

    # Clean up temp audio
    try:
        audio.unlink()
    except OSError:
        pass

    density = compute_speech_density(words, duration)
    classification = classify_clip(density)
    snippet = get_transcript_snippet(words)

    return {
        "file": rel,
        "path": str(clip_path),
        "duration": round(duration, 2),
        "speech_density": round(density, 4),
        "classification": classification,
        "snippet": snippet,
        "word_count": len(words),
        "words": words,  # full word data for review UI
    }


def print_summary(results):
    """Print a human-readable summary."""
    a_rolls = [r for r in results if r["classification"] == "a-roll"]
    b_rolls = [r for r in results if r["classification"] == "b-roll"]
    reviews = [r for r in results if r["classification"] == "review"]
    errors = [r for r in results if "error" in r]

    total_dur = sum(r.get("duration", 0) for r in results)
    a_dur = sum(r.get("duration", 0) for r in a_rolls)
    b_dur = sum(r.get("duration", 0) for r in b_rolls)
    r_dur = sum(r.get("duration", 0) for r in reviews)

    print(f"\n{'='*60}")
    print(f"  Classification Summary")
    print(f"{'='*60}")
    print(f"  Total clips:    {len(results)}")
    print(f"  Total duration: {total_dur/60:.1f} min")
    print(f"")
    print(f"  ✅ A-Roll:       {len(a_rolls):3d} clips  ({a_dur/60:.1f} min)")
    print(f"  🎬 B-Roll:       {len(b_rolls):3d} clips  ({b_dur/60:.1f} min)")
    print(f"  🔍 Review:       {len(reviews):3d} clips  ({r_dur/60:.1f} min)")
    if errors:
        print(f"  ⚠️  Errors:       {len(errors):3d} clips")
    print(f"{'='*60}")

    if reviews:
        print(f"\n  Clips needing review:")
        for r in reviews:
            density_pct = r["speech_density"] * 100
            snip = r["snippet"][:80] + "..." if len(r["snippet"]) > 80 else r["snippet"]
            print(f"    {r['file']:20s}  {density_pct:5.1f}% speech  \"{snip}\"")

    print()


def main():
    parser = argparse.ArgumentParser(
        description="Classify video clips as A-Roll / B-Roll / Review-Needed"
    )
    parser.add_argument("folder", help="Folder containing video clips (or day subfolders)")
    parser.add_argument("--language", default="en", help="Language code for Deepgram (default: en)")
    parser.add_argument("--output", default=None, help="Output JSON path (default: <folder>/classify_result.json)")
    parser.add_argument("--workers", type=int, default=3, help="Parallel transcription workers (default: 3)")
    parser.add_argument(
        "--a-roll-threshold", type=float, default=A_ROLL_THRESHOLD,
        help=f"Speech density threshold for A-Roll (default: {A_ROLL_THRESHOLD})"
    )
    parser.add_argument(
        "--b-roll-threshold", type=float, default=B_ROLL_THRESHOLD,
        help=f"Speech density threshold for B-Roll (default: {B_ROLL_THRESHOLD})"
    )
    args = parser.parse_args()

    # Allow threshold override
    global A_ROLL_THRESHOLD, B_ROLL_THRESHOLD
    A_ROLL_THRESHOLD = args.a_roll_threshold
    B_ROLL_THRESHOLD = args.b_roll_threshold

    folder = Path(args.folder).expanduser().resolve()
    if not folder.is_dir():
        print(f"❌ Not a directory: {folder}")
        sys.exit(1)

    output_path = Path(args.output) if args.output else folder / "classify_result.json"
    api_key = get_api_key()

    clips = collect_clips(folder)
    if not clips:
        print(f"❌ No video files found in {folder}")
        sys.exit(1)

    total_dur = 0
    for c in clips:
        d = get_clip_duration(c)
        if d:
            total_dur += d

    est_cost = (total_dur / 60) * 0.0043
    print(f"📁 Found {len(clips)} clips ({total_dur/60:.1f} min)")
    print(f"💰 Estimated Deepgram cost: ${est_cost:.2f}")
    print(f"🔄 Processing with {args.workers} workers...\n")

    results = []
    with tempfile.TemporaryDirectory() as tmp_dir:
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = {
                pool.submit(process_clip, clip, api_key, args.language, tmp_dir): clip
                for clip in clips
            }
            for i, future in enumerate(as_completed(futures), 1):
                clip = futures[future]
                try:
                    result = future.result()
                    tag = {"a-roll": "✅", "b-roll": "🎬", "review": "🔍"}.get(result["classification"], "❓")
                    density_pct = result["speech_density"] * 100
                    print(f"  [{i}/{len(clips)}] {tag} {result['file']:20s}  {density_pct:5.1f}% speech  ({result.get('word_count', 0)} words)")
                    results.append(result)
                except Exception as e:
                    print(f"  [{i}/{len(clips)}] ❌ {clip.name}: {e}")
                    results.append({
                        "file": clip.name,
                        "path": str(clip),
                        "error": str(e),
                        "classification": "review",
                        "speech_density": 0,
                        "snippet": "",
                        "word_count": 0,
                    })

    # Sort results by filename for consistent output
    results.sort(key=lambda r: r["file"])

    # Write full results (with words for review UI)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({
            "folder": str(folder),
            "language": args.language,
            "thresholds": {
                "a_roll": A_ROLL_THRESHOLD,
                "b_roll": B_ROLL_THRESHOLD,
            },
            "clips": results,
        }, f, indent=2, ensure_ascii=False)

    print(f"\n📄 Results saved to {output_path}")
    print_summary(results)

    review_count = sum(1 for r in results if r["classification"] == "review")
    if review_count > 0:
        print(f"💡 {review_count} clips need review. Run the review server:")
        print(f"   node scripts/classify_review_server.js {output_path}")


if __name__ == "__main__":
    main()
