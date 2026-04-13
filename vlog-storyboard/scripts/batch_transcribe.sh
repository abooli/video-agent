#!/bin/bash
#
# Batch transcribe A-roll clips via Deepgram.
# Deterministic: given the same inputs, always produces the same file structure.
#
# Usage: ./batch_transcribe.sh <vlogs-dir> <output-dir> <clip1> [clip2] ...
#
# Example:
#   ./batch_transcribe.sh ~/Videos/012/Media/Vlogs "Claude output/storyboard/transcripts" D1-02 D1-05 D3-01
#
# Output per clip:
#   <output-dir>/<clip>_audio.mp3
#   <output-dir>/<clip>_transcript.json   (raw Deepgram JSON)
#
# Requires: ffmpeg, python3, DEEPGRAM_API_KEY in .env

set -euo pipefail

VLOGS_DIR="$1"
OUTPUT_DIR="$2"
shift 2
CLIPS=("$@")

if [ ${#CLIPS[@]} -eq 0 ]; then
  echo "❌ Usage: ./batch_transcribe.sh <vlogs-dir> <output-dir> <clip1> [clip2] ..."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TRANSCRIBE_PY="$SCRIPT_DIR/../../podcast-rough-cut/scripts/deepgram_transcribe.py"

if [ ! -f "$TRANSCRIBE_PY" ]; then
  echo "❌ Cannot find deepgram_transcribe.py at $TRANSCRIBE_PY"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "🎬 Batch transcribe: ${#CLIPS[@]} clips"
echo "   Source: $VLOGS_DIR"
echo "   Output: $OUTPUT_DIR"
echo ""

for CLIP in "${CLIPS[@]}"; do
  DAY=$(echo "$CLIP" | grep -oE '^D[0-9]+')
  AUDIO_OUT="$OUTPUT_DIR/${CLIP}_audio.mp3"
  TRANSCRIPT_OUT="$OUTPUT_DIR/${CLIP}_transcript.json"

  # Skip if transcript already exists
  if [ -f "$TRANSCRIPT_OUT" ]; then
    echo "⏭️  $CLIP — transcript exists, skipping"
    continue
  fi

  # Find source video
  FILE=$(find "$VLOGS_DIR/$DAY" -iname "$CLIP.*" 2>/dev/null | head -1)
  if [ -z "$FILE" ]; then
    echo "❌ $CLIP — not found in $VLOGS_DIR/$DAY/"
    exit 1
  fi

  # Extract audio
  echo "🔊 $CLIP — extracting audio..."
  ffmpeg -i "file:$FILE" -vn -acodec libmp3lame -q:a 4 -y "$AUDIO_OUT" 2>/dev/null

  # Transcribe
  echo "🎤 $CLIP — transcribing..."
  (cd "$OUTPUT_DIR" && python3 "$TRANSCRIBE_PY" "${CLIP}_audio.mp3" en)

  # Rename output (deepgram_transcribe.py writes deepgram_transcription.json)
  mv "$OUTPUT_DIR/deepgram_transcription.json" "$TRANSCRIPT_OUT"

  echo "✅ $CLIP — done"
  echo ""
done

echo "🎉 All ${#CLIPS[@]} clips transcribed → $OUTPUT_DIR"
