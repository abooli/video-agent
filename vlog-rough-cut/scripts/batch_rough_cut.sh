#!/bin/bash
#
# Batch rough-cut runner for vlog clips.
# Runs mechanical prep (convert + seed) for all clips first,
# then invokes Claude Code CLI per clip for AI analysis (fresh context each time).
#
# Usage:
#   bash batch_rough_cut.sh <batch-name> <clip1> <clip2> ...
#
# Example:
#   bash batch_rough_cut.sh "Chapter 1" D1-08 D3-03 D4-02
#
# Prerequisites:
#   - Transcripts in "Claude output/storyboard/transcripts/"
#   - Claude Code CLI installed (`claude` command available)
#   - Node.js installed

set -euo pipefail

# --- Parse args ---
if [ $# -lt 2 ]; then
  echo "Usage: bash batch_rough_cut.sh <batch-name> <clip1> <clip2> ..."
  echo "Example: bash batch_rough_cut.sh \"Chapter 1\" D1-08 D3-03 D4-02"
  exit 1
fi

BATCH_NAME="$1"
shift
CLIPS=("$@")

# --- Paths ---
TRANSCRIPTS_DIR="Claude output/storyboard/transcripts"
BATCH_DIR="Claude output/rough-cut/$BATCH_NAME"
SKILL_DIR="$(dirname "$0")/.."
SCRIPTS_DIR="$(dirname "$0")"

echo "=== Vlog Rough Cut: $BATCH_NAME ==="
echo "Clips: ${CLIPS[*]}"
echo "Batch dir: $BATCH_DIR"
echo ""

# --- Phase 1: Mechanical prep (no AI needed) ---
echo "--- Phase 1: Convert transcripts + seed silences ---"
for clip in "${CLIPS[@]}"; do
  CLIP_DIR="$BATCH_DIR/$clip"
  TRANSCRIPT="$TRANSCRIPTS_DIR/${clip}_transcript.json"

  if [ ! -f "$TRANSCRIPT" ]; then
    echo "ERROR: Transcript not found: $TRANSCRIPT"
    exit 1
  fi

  echo ""
  echo "[$clip] Converting transcript..."
  node "$SCRIPTS_DIR/convert_transcript.js" "$TRANSCRIPT" "$CLIP_DIR"

  echo "[$clip] Seeding silences..."
  node "$SCRIPTS_DIR/seed_silences.js" "$CLIP_DIR"
done

echo ""
echo "--- Phase 1 complete. All clips prepped. ---"
echo ""

# --- Phase 2: AI analysis (one Claude invocation per clip, fresh context) ---
echo "--- Phase 2: AI sentence analysis (one clip per Claude session) ---"
for clip in "${CLIPS[@]}"; do
  CLIP_DIR="$BATCH_DIR/$clip"

  echo ""
  echo "[$clip] Starting AI analysis..."

  claude -p "You are running vlog rough-cut AI analysis for clip $clip.

INSTRUCTIONS:
1. Read the 4 detection rule files in vlog-rough-cut/detection-rules/ (0-topic-outline.md, 1-sentence-to-topic-mapping.md, 2-best-take-selection.md, 3-silence-and-cleanup.md)
2. Read the sentence file: $CLIP_DIR/2_sentences.txt
3. Read the word-level file: $CLIP_DIR/1_subtitles_words.json
4. Read the current auto-selected indices: $CLIP_DIR/3_auto_selected.json

Then follow the detection rules in order:
- Rule 0: Produce a topic outline
- Rule 1: Map every sentence to a topic, aside, or noise
- Rule 2: Pick best take per topic (simple, composite, or sequential)
- Rule 3: Filler cleanup, silence thresholds, coherence check, orphan cleanup

OUTPUT:
- Write the analysis log to: $CLIP_DIR/4_analysis.md
- Update $CLIP_DIR/3_auto_selected.json with all deletion indices (merge with existing silence indices, keep sorted, no duplicates)

Be terse in the analysis log. One line per sentence decision." \
    --allowedTools "Read,Write,Edit,Bash"

  echo "[$clip] AI analysis complete."
done

echo ""
echo "--- Phase 2 complete. All clips analyzed. ---"
echo ""

# --- Phase 3: Generate dashboard ---
echo "--- Phase 3: Generate dashboard ---"
CLIP_LIST=$(IFS=,; echo "${CLIPS[*]}")

node "$SCRIPTS_DIR/generate_dashboard.js" \
  --batch-dir "$BATCH_DIR" \
  --audio-dir "$TRANSCRIPTS_DIR" \
  --clips "$CLIP_LIST"

echo ""
echo "=== Done! ==="
echo "Dashboard: $BATCH_DIR/dashboard.html"
echo ""
echo "To review, run:"
echo "  node $SCRIPTS_DIR/review_server.js 8899 \"$BATCH_DIR\" \"$TRANSCRIPTS_DIR\""
echo "  open http://localhost:8899"
