#!/usr/bin/env node
/**
 * Review server for podcast rough-cut.
 *
 * Features:
 * 1. Serves static files (review.html, audio.mp3)
 * 2. POST /api/cut — receives delete list, executes FFmpeg cut
 *
 * Usage: node review_server.js [port] [video_file]
 * Default: port=8899, video_file=auto-detect .mp4 in current dir
 *
 * Ported from upstream (Ceeon/videocut-skills) with English UI.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = process.argv[2] || 8899;
let VIDEO_FILE = process.argv[3] || findVideoFile();

function findVideoFile() {
  const files = fs.readdirSync('.').filter(f => f.endsWith('.mp4'));
  return files[0] || 'source.mp4';
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
};

// Detect available hardware encoder
function detectEncoder() {
  const platform = process.platform;
  const encoders = [];
  if (platform === 'darwin') {
    encoders.push({ name: 'h264_videotoolbox', args: '-q:v 60', label: 'VideoToolbox (macOS)' });
  } else if (platform === 'win32') {
    encoders.push({ name: 'h264_nvenc', args: '-preset p4 -cq 20', label: 'NVENC (NVIDIA)' });
    encoders.push({ name: 'h264_qsv', args: '-global_quality 20', label: 'QSV (Intel)' });
    encoders.push({ name: 'h264_amf', args: '-quality balanced', label: 'AMF (AMD)' });
  } else {
    encoders.push({ name: 'h264_nvenc', args: '-preset p4 -cq 20', label: 'NVENC (NVIDIA)' });
    encoders.push({ name: 'h264_vaapi', args: '-qp 20', label: 'VAAPI (Linux)' });
  }
  encoders.push({ name: 'libx264', args: '-preset fast -crf 18', label: 'x264 (software)' });

  for (const enc of encoders) {
    try {
      execSync(`ffmpeg -hide_banner -encoders 2>/dev/null | grep ${enc.name}`, { stdio: 'pipe' });
      console.log(`🎯 Detected encoder: ${enc.label}`);
      return enc;
    } catch (e) { /* not available */ }
  }
  return { name: 'libx264', args: '-preset fast -crf 18', label: 'x264 (software)' };
}

let cachedEncoder = null;
function getEncoder() {
  if (!cachedEncoder) cachedEncoder = detectEncoder();
  return cachedEncoder;
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/save') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const indices = JSON.parse(body);
        fs.writeFileSync('saved_selection.json', JSON.stringify(indices, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: indices.length }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/cut') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const segments = JSON.parse(body);
        const enc = getEncoder();
        const originalDuration = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${VIDEO_FILE}"`, { encoding: 'utf8' }).trim());

        // Build keep intervals (inverse of delete segments)
        const sorted = segments.slice().sort((a, b) => a.start - b.start);
        const keeps = [];
        let cursor = 0;
        for (const seg of sorted) {
          if (seg.start - cursor > 0.01) keeps.push([cursor, seg.start]);
          cursor = seg.end;
        }
        if (originalDuration - cursor > 0.01) keeps.push([cursor, originalDuration]);

        const deletedDuration = segments.reduce((s, seg) => s + (seg.end - seg.start), 0);
        const newDuration = originalDuration - deletedDuration;

        // Build trim+atrim+concat filter (sync-safe: audio & video trimmed together)
        const outputFile = VIDEO_FILE.replace(/(\.[^.]+)$/, '_cut$1');

        const filterParts = [];
        const concatInputs = [];
        keeps.forEach(([s, e], i) => {
          filterParts.push(`[0:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS[v${i}]`);
          filterParts.push(`[0:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS[a${i}]`);
          concatInputs.push(`[v${i}][a${i}]`);
        });
        // aresample=async=1000: resync audio to video after concat, compensating for
        // per-segment frame/sample boundary quantization drift (up to ~33ms per cut).
        filterParts.push(`${concatInputs.join('')}concat=n=${keeps.length}:v=1:a=1[outv][outa_pre];[outa_pre]aresample=async=1000[outa]`);
        const filterComplex = filterParts.join(';');

        execSync(
          `ffmpeg -y -i "file:${VIDEO_FILE}" ` +
          `-filter_complex "${filterComplex}" ` +
          `-map "[outv]" -map "[outa]" ` +
          `-c:v ${enc.name} ${enc.args} -c:a aac ` +
          `"${outputFile}"`,
          { stdio: 'pipe', maxBuffer: 100 * 1024 * 1024 }
        );

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          output: outputFile,
          originalDuration: originalDuration.toFixed(2),
          newDuration: newDuration.toFixed(2),
          deletedDuration: deletedDuration.toFixed(2),
          savedPercent: ((deletedDuration / originalDuration) * 100).toFixed(1)
        }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // Serve static files
  let filePath = req.url === '/' ? 'review.html' : req.url.slice(1);
  filePath = path.resolve('.', filePath);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`🎬 Review server running at http://localhost:${PORT}`);
  console.log(`📹 Video: ${VIDEO_FILE}`);
});
