#!/usr/bin/env node
/**
 * Convert a transcript JSON into analysis-ready files for multicam editing.
 * Handles both Deepgram native format and segments-based format.
 * Adjusts timestamps to start from the clap (time 0).
 *
 * Usage:
 *   node convert_transcript.js <transcript.json> <output-dir> [--clap-offset <seconds>]
 *
 * The clap-offset shifts all timestamps so that clap = 0. Words before the clap are discarded.
 */

const fs = require('fs');
const path = require('path');

const SILENCE_THRESHOLD = 0.5;

function parseArgs() {
  const argv = process.argv.slice(2);
  let transcriptPath = null;
  let outputDir = null;
  let clapOffset = 0;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--clap-offset') {
      clapOffset = parseFloat(argv[++i]);
    } else if (!transcriptPath) {
      transcriptPath = argv[i];
    } else if (!outputDir) {
      outputDir = argv[i];
    }
  }
  return { transcriptPath, outputDir, clapOffset };
}

function extractWords(transcript) {
  // Deepgram native format: results.channels[0].alternatives[0].words[]
  if (transcript.results && transcript.results.channels) {
    return transcript.results.channels[0].alternatives[0].words.map(w => ({
      text: w.punctuated_word || w.word,
      start: w.start,
      end: w.end,
    }));
  }
  // Segments-based format: segments[].words[]
  if (transcript.segments) {
    const words = [];
    for (const seg of transcript.segments) {
      for (const w of seg.words) {
        words.push({
          text: w.word,
          start: w.start,
          end: w.end,
        });
      }
    }
    return words;
  }
  throw new Error('Unknown transcript format');
}

function main() {
  const { transcriptPath, outputDir, clapOffset } = parseArgs();

  if (!transcriptPath || !outputDir) {
    console.error('Usage: node convert_transcript.js <transcript.json> <output-dir> [--clap-offset <seconds>]');
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf-8'));
  const rawWords = extractWords(transcript);

  // Filter out words before the clap and adjust timestamps
  const shiftedWords = rawWords
    .filter(w => w.end > clapOffset)
    .map(w => ({
      text: w.text,
      start: Math.max(0, w.start - clapOffset),
      end: w.end - clapOffset,
    }));

  // Build subtitles_words (word-level with gaps)
  const subtitleWords = [];
  for (let i = 0; i < shiftedWords.length; i++) {
    const w = shiftedWords[i];
    const prevEnd = i > 0 ? shiftedWords[i - 1].end : 0;

    if (w.start - prevEnd > 0.01) {
      subtitleWords.push({ text: '', start: prevEnd, end: w.start, isGap: true });
    }
    subtitleWords.push({ text: w.text, start: w.start, end: w.end, isGap: false });
  }

  fs.writeFileSync(
    path.join(outputDir, '1_subtitles_words.json'),
    JSON.stringify(subtitleWords, null, 2)
  );

  const wordCount = subtitleWords.filter(w => !w.isGap).length;
  const gapCount = subtitleWords.filter(w => w.isGap).length;
  console.log(`1_subtitles_words.json — ${wordCount} words, ${gapCount} gaps`);

  // Build sentences.txt
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
