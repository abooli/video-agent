#!/usr/bin/env node
/**
 * Generate a multicam review HTML from template + session data.
 *
 * Usage:
 *   node generate_review.js --session-dir <path> --session-name <name>
 *
 * Expects in session-dir:
 *   - sync_data.json
 *   - 1_subtitles_words.json
 *   - 3_auto_selected.json (optional)
 *
 * Output: <session-dir>/review.html
 */

const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--session-dir') args.sessionDir = argv[++i];
    else if (argv[i] === '--session-name') args.sessionName = argv[++i];
  }
  if (!args.sessionDir) {
    console.error('Usage: node generate_review.js --session-dir <path> [--session-name <name>]');
    process.exit(1);
  }
  if (!args.sessionName) args.sessionName = path.basename(args.sessionDir);
  return args;
}

function main() {
  const args = parseArgs();

  const syncDataPath = path.join(args.sessionDir, 'sync_data.json');
  const wordsPath = path.join(args.sessionDir, '1_subtitles_words.json');
  const autoSelectedPath = path.join(args.sessionDir, '3_auto_selected.json');

  if (!fs.existsSync(syncDataPath)) {
    console.error('Missing: ' + syncDataPath);
    process.exit(1);
  }
  if (!fs.existsSync(wordsPath)) {
    console.error('Missing: ' + wordsPath);
    process.exit(1);
  }

  const syncData = JSON.parse(fs.readFileSync(syncDataPath, 'utf-8'));
  const words = JSON.parse(fs.readFileSync(wordsPath, 'utf-8'));
  const autoSelected = fs.existsSync(autoSelectedPath)
    ? JSON.parse(fs.readFileSync(autoSelectedPath, 'utf-8'))
    : [];

  const templatePath = path.join(__dirname, '..', 'templates', 'multicam-review-template.html');
  let html = fs.readFileSync(templatePath, 'utf8');

  const dataBlock = `var SYNC_DATA = ${JSON.stringify(syncData)};
    var WORDS = ${JSON.stringify(words)};
    var AUTO_SELECTED = ${JSON.stringify(autoSelected)};`;

  html = html.replaceAll('__SESSION_NAME__', args.sessionName);
  html = html.replace('/*__MULTICAM_DATA__*/', dataBlock);

  const outPath = path.join(args.sessionDir, 'review.html');
  fs.writeFileSync(outPath, html);
  console.log('Review generated: ' + outPath);
  console.log('  Angles: ' + syncData.angles.map(a => a.file).join(', '));
  console.log('  Words: ' + words.filter(w => !w.isGap).length);
}

main();
