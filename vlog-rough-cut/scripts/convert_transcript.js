#!/usr/bin/env node
/**
 * Convert a WhisperX-format transcript JSON into the 3 analysis-ready files:
 *   1_subtitles_words.json  — word-level timeline with gap entries
 *   2_readable.txt          — idx|content|time for AI reading
 *   3_sentences.txt         — sentence-segmented for comparison
 *
 * Usage:
 *   node convert_transcript.js <transcript.json> <output-dir>
 *
 * Example:
 *   node convert_transcript.js \
 *     "Claude output/storyboard/transcripts/D1-08_transcript.json" \
 *     "Claude output/rough-cut/Chapter 1/D1-08"
 */

const fs = require('fs');
const path = require('path');

const SILENCE_THRESHOLD = 0.5;

function main() {
  const [transcriptPath, outputDir] = process.argv.slice(2);

  if (!transcriptPath || !outputDir) {
    console.error('Usage: node convert_transcript.js <transcript.json> <output-dir>');
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf-8'));
  const segments = transcript.segments || [];

  // --- 1. Build subtitles_words (word-level with gaps) ---
  const subtitleWords = [];

  for (const seg of segments) {
    const words = seg.words || [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const prevEnd = subtitleWords.length > 0
        ? subtitleWords[subtitleWords.length - 1].end
        : (seg.start || 0);

      if (w.start - prevEnd > 0.01) {
        subtitleWords.push({ text: '', start: prevEnd, end: w.start, isGap: true });
      }
      subtitleWords.push({ text: w.word, start: w.start, end: w.end, isGap: false });
    }
  }

  fs.writeFileSync(
    path.join(outputDir, '1_subtitles_words.json'),
    JSON.stringify(subtitleWords, null, 2)
  );

  const wordCount = subtitleWords.filter(w => !w.isGap).length;
  const gapCount = subtitleWords.filter(w => w.isGap).length;
  console.log(`1_subtitles_words.json — ${wordCount} words, ${gapCount} gaps`);

  // --- 2. Build readable.txt ---
  const readableLines = [];
  subtitleWords.forEach((w, i) => {
    if (w.isGap) {
      const dur = (w.end - w.start).toFixed(2);
      if (parseFloat(dur) >= SILENCE_THRESHOLD) {
        readableLines.push(`${i}|[silence ${dur}s]|${w.start.toFixed(2)}-${w.end.toFixed(2)}`);
      }
    } else {
      readableLines.push(`${i}|${w.text}|${w.start.toFixed(2)}-${w.end.toFixed(2)}`);
    }
  });

  fs.writeFileSync(path.join(outputDir, '2_readable.txt'), readableLines.join('\n'));
  console.log(`2_readable.txt — ${readableLines.length} lines`);

  // --- 3. Build sentences.txt ---
  const sentences = [];
  let curr = { text: '', startIdx: -1, endIdx: -1 };

  subtitleWords.forEach((w, i) => {
    const isLongGap = w.isGap && (w.end - w.start) >= SILENCE_THRESHOLD;
    if (isLongGap) {
      if (curr.text.length > 0) sentences.push({ ...curr });
      curr = { text: '', startIdx: -1, endIdx: -1 };
    } else if (!w.isGap) {
      if (curr.startIdx === -1) curr.startIdx = i;
      curr.text += w.text + ' ';
      curr.endIdx = i;
    }
  });
  if (curr.text.length > 0) sentences.push(curr);

  const sentenceLines = sentences.map((s, i) =>
    `${i}|${s.startIdx}-${s.endIdx}|${s.text.trim()}`
  );

  fs.writeFileSync(path.join(outputDir, '3_sentences.txt'), sentenceLines.join('\n'));
  console.log(`3_sentences.txt — ${sentences.length} sentences`);
}

main();
