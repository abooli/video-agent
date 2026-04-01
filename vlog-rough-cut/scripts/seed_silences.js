#!/usr/bin/env node
/**
 * Seed 3_auto_selected.json with silence indices (gaps ≥ 1s).
 * This runs BEFORE the AI analysis pass, which appends its own indices.
 *
 * Usage:
 *   node seed_silences.js <clip-dir>
 *
 * Example:
 *   node seed_silences.js "Claude output/rough-cut/Chapter 1/D1-08"
 */

const fs = require('fs');
const path = require('path');

function main() {
  const clipDir = process.argv[2];

  if (!clipDir) {
    console.error('Usage: node seed_silences.js <clip-dir>');
    process.exit(1);
  }

  const wordsPath = path.join(clipDir, '1_subtitles_words.json');
  const words = JSON.parse(fs.readFileSync(wordsPath, 'utf-8'));

  const selected = [];
  words.forEach((w, i) => {
    if (w.isGap && (w.end - w.start) >= 1.0) {
      selected.push(i);
    }
  });

  const outPath = path.join(clipDir, '3_auto_selected.json');
  fs.writeFileSync(outPath, JSON.stringify(selected, null, 2));
  console.log(`3_auto_selected.json — ${selected.length} silences ≥1s`);
}

main();
