#!/usr/bin/env node
/**
 * Multi-cam review server.
 * Serves synced multi-angle video preview and handles parallel FFmpeg cuts.
 *
 * Usage:
 *   node review_server.js <port> <session-dir> <videos-dir>
 *
 * Routes:
 *   GET  /                  → review.html
 *   GET  /video/:filename   → video files with range request support
 *   GET  /data/:file        → session data files (json, txt)
 *   POST /save              → save selection state
 *   POST /cut               → execute FFmpeg cuts on all angles
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');

const [PORT, SESSION_DIR, VIDEOS_DIR] = process.argv.slice(2);

if (!PORT || !SESSION_DIR || !VIDEOS_DIR) {
  console.error('Usage: node review_server.js <port> <session-dir> <videos-dir>');
  process.exit(1);
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
};

function sendFile(res, filePath, req) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found: ' + filePath }));
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;

  const range = req && req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': mime,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': fileSize,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(filePath).pipe(res);
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function buildKeepRanges(words, selectedIndices) {
  const deleteSet = new Set(selectedIndices);
  const keepRanges = [];
  let keepStart = null;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (deleteSet.has(i)) {
      if (keepStart !== null) {
        keepRanges.push({ start: keepStart, end: w.start });
        keepStart = null;
      }
    } else {
      if (keepStart === null) keepStart = w.start;
    }
  }
  if (keepStart !== null && words.length > 0) {
    keepRanges.push({ start: keepStart, end: words[words.length - 1].end });
  }
  return keepRanges;
}

function buildTrimConcatFilter(keepRanges, clapOffset) {
  if (keepRanges.length === 0) return null;

  // Shift keep ranges by the clap offset to get actual file timestamps
  const shifted = keepRanges.map(r => ({
    start: r.start + clapOffset,
    end: r.end + clapOffset,
  }));

  const vParts = shifted.map((r, i) =>
    `[0:v]trim=start=${r.start.toFixed(3)}:end=${r.end.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`
  );
  const aParts = shifted.map((r, i) =>
    `[0:a]atrim=start=${r.start.toFixed(3)}:end=${r.end.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`
  );
  const n = shifted.length;
  const vInputs = shifted.map((_, i) => `[v${i}]`).join('');
  const aInputs = shifted.map((_, i) => `[a${i}]`).join('');

  return [
    ...vParts,
    ...aParts,
    `${vInputs}concat=n=${n}:v=1:a=0[outv]`,
    `${aInputs}concat=n=${n}:v=0:a=1[outa]`,
  ].join(';');
}

function detectEncoder() {
  const platform = process.platform;
  if (platform === 'darwin') {
    try {
      const out = execSync('ffmpeg -hide_banner -encoders 2>/dev/null', { encoding: 'utf-8' });
      if (out.includes('h264_videotoolbox')) {
        return { codec: 'h264_videotoolbox', args: ['-q:v', '60'] };
      }
    } catch (e) {}
  }
  return { codec: 'libx264', args: ['-preset', 'fast', '-crf', '18'] };
}

async function executeCut(selectedIndices) {
  const wordsPath = path.join(SESSION_DIR, '1_subtitles_words.json');
  const syncPath = path.join(SESSION_DIR, 'sync_data.json');

  if (!fs.existsSync(wordsPath) || !fs.existsSync(syncPath)) {
    return { ok: false, error: 'Missing session data files' };
  }

  const words = JSON.parse(fs.readFileSync(wordsPath, 'utf-8'));
  const syncData = JSON.parse(fs.readFileSync(syncPath, 'utf-8'));
  const keepRanges = buildKeepRanges(words, selectedIndices);

  if (keepRanges.length === 0) {
    return { ok: false, error: 'Nothing to keep' };
  }

  const cutDir = path.join(SESSION_DIR, 'cut_output');
  fs.mkdirSync(cutDir, { recursive: true });

  const encoder = detectEncoder();
  const results = [];

  for (const angle of syncData.angles) {
    const videoPath = path.join(VIDEOS_DIR, angle.file);
    if (!fs.existsSync(videoPath)) {
      results.push({ file: angle.file, ok: false, error: 'Source not found' });
      continue;
    }

    const filterGraph = buildTrimConcatFilter(keepRanges, angle.clapTimeSec);
    if (!filterGraph) {
      results.push({ file: angle.file, ok: false, error: 'Empty filter' });
      continue;
    }

    const outName = path.basename(angle.file, path.extname(angle.file)) + '_cut.mp4';
    const outPath = path.join(cutDir, outName);

    const ffmpegArgs = [
      '-i', videoPath,
      '-filter_complex', filterGraph,
      '-map', '[outv]', '-map', '[outa]',
      '-c:v', encoder.codec, ...encoder.args,
      '-c:a', 'aac', '-b:a', '192k',
      '-y', outPath,
    ];

    try {
      console.log(`Cutting ${angle.file}...`);
      execFileSync('ffmpeg', ffmpegArgs, { stdio: 'pipe', timeout: 600000 });
      results.push({ file: angle.file, ok: true, output: outPath });
      console.log(`  ✓ ${outName}`);
    } catch (e) {
      const stderr = e.stderr ? e.stderr.toString().slice(-500) : e.message;
      results.push({ file: angle.file, ok: false, error: stderr });
      console.error(`  ✗ ${angle.file}: ${stderr.slice(0, 200)}`);
    }
  }

  return { ok: results.every(r => r.ok), results };
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsed = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(parsed.pathname);

  // GET / → serve review.html
  if (req.method === 'GET' && pathname === '/') {
    const htmlPath = path.join(SESSION_DIR, 'review.html');
    sendFile(res, htmlPath, req);
    return;
  }

  // GET /video/:filename → serve video with range requests
  if (req.method === 'GET' && pathname.startsWith('/video/')) {
    const filename = pathname.slice('/video/'.length);
    const filePath = path.join(VIDEOS_DIR, filename);
    sendFile(res, filePath, req);
    return;
  }

  // GET /data/:file → serve session data
  if (req.method === 'GET' && pathname.startsWith('/data/')) {
    const filename = pathname.slice('/data/'.length);
    const filePath = path.join(SESSION_DIR, filename);
    sendFile(res, filePath, req);
    return;
  }

  // POST /save → save selection state
  if (req.method === 'POST' && pathname === '/save') {
    try {
      const body = await readBody(req);
      const savePath = path.join(SESSION_DIR, 'saved_selections.json');
      fs.writeFileSync(savePath, JSON.stringify(body, null, 2));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST /cut → execute cuts on all angles
  if (req.method === 'POST' && pathname === '/cut') {
    try {
      const body = await readBody(req);
      const result = await executeCut(body.selected || []);
      res.writeHead(result.ok ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`Multi-cam review server running at http://localhost:${PORT}`);
  console.log(`  Session: ${SESSION_DIR}`);
  console.log(`  Videos:  ${VIDEOS_DIR}`);
});
