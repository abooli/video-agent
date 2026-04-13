#!/usr/bin/env node
/**
 * Generate a review dashboard for a batch of clips.
 * Uses <video> element with rAF+skipLock+gainNode playback.
 *
 * Usage:
 *   node generate_dashboard.js --batch-dir <path> --audio-dir <path> --clips "D1-08,D3-03"
 *
 * Output: <batch-dir>/dashboard.html
 */
const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--batch-dir') args.batchDir = argv[++i];
    else if (argv[i] === '--audio-dir') args.audioDir = argv[++i];
    else if (argv[i] === '--clips') args.clips = argv[++i].split(',').map(s => s.trim());
  }
  if (!args.batchDir || !args.audioDir || !args.clips) {
    console.error('Usage: node generate_dashboard.js --batch-dir <path> --audio-dir <path> --clips "D1-08,D3-03"');
    process.exit(1);
  }
  return args;
}

function main() {
  const args = parseArgs();
  const batchName = path.basename(args.batchDir);
  const clipData = {};
  for (const clip of args.clips) {
    const wordsFile = path.join(args.batchDir, clip, '1_subtitles_words.json');
    const selectedFile = path.join(args.batchDir, clip, '3_auto_selected.json');
    if (!fs.existsSync(wordsFile)) { console.error('Missing: ' + wordsFile); process.exit(1); }
    clipData[clip] = {
      words: JSON.parse(fs.readFileSync(wordsFile, 'utf8')),
      autoSelected: fs.existsSync(selectedFile) ? JSON.parse(fs.readFileSync(selectedFile, 'utf8')) : []
    };
  }
  const templatePath = path.join(__dirname, '..', 'templates', 'dashboard-template.html');
  let html = fs.readFileSync(templatePath, 'utf8');

  // Build sidebar clip tabs
  const tabButtons = args.clips.map((clip, i) => {
    const count = clipData[clip].autoSelected.length;
    return `    <button class="tab-btn${i === 0 ? ' active' : ''}" data-clip="${clip}">${clip} <span class="badge">${count}</span></button>`;
  }).join('\n');

  // Inject data
  const dataBlock = `const CLIPS = ${JSON.stringify(args.clips)};
    const CLIP_WORDS = ${JSON.stringify(Object.fromEntries(args.clips.map(c => [c, clipData[c].words])))};
    const CLIP_AUTO = ${JSON.stringify(Object.fromEntries(args.clips.map(c => [c, clipData[c].autoSelected])))};`;

  html = html.replaceAll('__BATCH_NAME__', batchName);
  html = html.replace('<!--__TAB_BUTTONS__-->', tabButtons);
  html = html.replace('/*__CLIP_DATA__*/', dataBlock);

  const outPath = path.join(args.batchDir, 'dashboard.html');
  fs.writeFileSync(outPath, html);
  console.log('✅ Dashboard generated: ' + outPath);
  console.log('   Clips: ' + args.clips.join(', '));
}

main();
