#!/usr/bin/env node
/**
 * Generate review webpage (wavesurfer.js version)
 *
 * Usage: node generate_review.js <subtitles_words.json> [auto_selected.json] [audio_file]
 * Output: review.html, audio.mp3 (copied to current directory)
 *
 * Reads templates/review-template.html and injects word data + auto-selected indices.
 */

const fs = require('fs');
const path = require('path');

const subtitlesFile = process.argv[2] || 'subtitles_words.json';
const autoSelectedFile = process.argv[3] || 'auto_selected.json';
const audioFile = process.argv[4] || 'audio.mp3';

// Copy audio to current directory (avoids relative path issues)
const audioBaseName = 'audio.mp3';
if (audioFile !== audioBaseName && fs.existsSync(audioFile)) {
  fs.copyFileSync(audioFile, audioBaseName);
  console.log('📁 Copied audio to current directory:', audioBaseName);
}

if (!fs.existsSync(subtitlesFile)) {
  console.error('❌ Subtitles file not found:', subtitlesFile);
  process.exit(1);
}

const words = JSON.parse(fs.readFileSync(subtitlesFile, 'utf8'));
let autoSelected = [];

if (fs.existsSync(autoSelectedFile)) {
  autoSelected = JSON.parse(fs.readFileSync(autoSelectedFile, 'utf8'));
  console.log('AI pre-selected:', autoSelected.length, 'elements');
}

// Read template and inject data
const templatePath = path.join(__dirname, '..', 'templates', 'review-template.html');
if (!fs.existsSync(templatePath)) {
  console.error('❌ Template not found:', templatePath);
  process.exit(1);
}

let html = fs.readFileSync(templatePath, 'utf8');
html = html.replace('/*__WORDS_DATA__*/[]', JSON.stringify(words));
html = html.replace('/*__AUTO_SELECTED_DATA__*/[]', JSON.stringify(autoSelected));
html = html.replace('__AUDIO_FILE__', audioBaseName);

fs.writeFileSync('review.html', html);
console.log('✅ Generated review.html');
console.log('📌 Start server: node review_server.js 8899');
console.log('📌 Open: http://localhost:8899');
