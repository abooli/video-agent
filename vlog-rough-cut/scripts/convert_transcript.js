#!/usr/bin/env node
/**
 * Convert a Deepgram transcript JSON into analysis-ready files:
 *   1_subtitles_words.json  — word-level timeline with gap entries
 *   2_sentences.txt         — sentence-segmented for AI analysis
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

  // --- Extract words from Deepgram native format ---
  if (!transcript.results || !transcript.results.channels) {
    console.error('Unknown transcript format. Expected Deepgram native JSON (results.channels[0].alternatives[0].words[]).');
    process.exit(1);
  }
  const rawWords = transcript.results.channels[0].alternatives[0].words;

  // --- 1. Build subtitles_words (word-level with gaps) ---
  const subtitleWords = [];

  for (let i = 0; i < rawWords.length; i++) {
    const w = rawWords[i];
    const prevEnd = i > 0 ? rawWords[i - 1].end : 0;

    if (w.start - prevEnd > 0.01) {
      subtitleWords.push({ text: '', start: prevEnd, end: w.start, isGap: true });
    }
    // Deepgram uses punctuated_word
    const text = w.punctuated_word || w.word;
    subtitleWords.push({ text, start: w.start, end: w.end, isGap: false });
  }

  fs.writeFileSync(
    path.join(outputDir, '1_subtitles_words.json'),
    JSON.stringify(subtitleWords, null, 2)
  );

  const wordCount = subtitleWords.filter(w => !w.isGap).length;
  const gapCount = subtitleWords.filter(w => w.isGap).length;
  console.log(`1_subtitles_words.json — ${wordCount} words, ${gapCount} gaps`);

  // --- 2. Build sentences.txt ---
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

  fs.writeFileSync(path.join(outputDir, '2_sentences.txt'), sentenceLines.join('\n'));
  console.log(`2_sentences.txt — ${sentences.length} sentences`);
}

main();
