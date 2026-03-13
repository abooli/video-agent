#!/usr/bin/env node
/**
 * Review server for vlog rough-cut dashboard.
 *
 * Serves the dashboard.html and handles cut requests via FFmpeg.
 *
 * Usage:
 *   node review_server.js <port> <batch-dir> <audio-dir> [vlogs-dir]
 *
 * Example:
 *   node review_server.js 8899 "Claude output/rough-cut/Chapter 1" \
 *     "Claude output/storyboard/transcripts" "~/Videos/012/Media/Vlogs"
 *
 * Routes:
 *   GET  /                        → dashboard.html
 *   GET  /data/:clip/:file        → clip data files (json, txt, md)
 *   GET  /audio/:filename         → audio files from storyboard transcripts
 *   POST /cut/:clip               → execute FFmpeg cut for one clip
 *   POST /cut-all                 → execute FFmpeg cut for all clips
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const url = require('url');

const [PORT, BATCH_DIR, AUDIO_DIR, VLOGS_DIR] = process.argv.slice(2);

if (!PORT || !BATCH_DIR || !AUDIO_DIR) {
  console.error('Usage: node review_server.js <port> <batch-dir> <audio-dir> [vlogs-dir]');
  process.exit(1);
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.md': 'text/plain',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.js': 'application/javascript',
  '.css': 'text/css',
};

function sendFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found: ' + filePath }));
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  const stat = fs.statSync(filePath);

  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(filePath).pipe(res);
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

/**
 * Build keep ranges from words + selected indices.
 * Returns array of {start, end} time ranges to KEEP.
 */
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

/**
 * Build FFmpeg trim+concat filtergraph for VFR footage.
 * Uses trim/atrim per segment then concat — works correctly with variable frame rate .mov files.
 */
function buildTrimConcatFilter(keepRanges) {
  if (keepRanges.length === 0) return null;

  const vParts = keepRanges.map((r, i) =>
    `[0:v]trim=start=${r.start.toFixed(3)}:end=${r.end.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`
  );
  const aParts = keepRanges.map((r, i) =>
    `[0:a]atrim=start=${r.start.toFixed(3)}:end=${r.end.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`
  );
  const vInputs = keepRanges.map((_, i) => `[v${i}]`).join('');
  const aInputs = keepRanges.map((_, i) => `[a${i}]`).join('');
  const n = keepRanges.length;

  return [
    ...vParts,
    ...aParts,
    `${vInputs}concat=n=${n}:v=1:a=0[outv]`,
    `${aInputs}concat=n=${n}:v=0:a=1[outa]`,
  ].join(';');
}

/**
 * Find the original video file for a clip.
 * Looks in VLOGS_DIR/<day>/<clip>.{mp4,mov,MP4,MOV}
 */
function findSourceVideo(clip) {
  if (!VLOGS_DIR) return null;

  const dayMatch = clip.match(/^D(\d+)/i);
  if (!dayMatch) return null;

  const day = 'D' + dayMatch[1];
  const dayDir = path.join(VLOGS_DIR, day);
  if (!fs.existsSync(dayDir)) return null;

  const exts = ['.mp4', '.mov', '.MP4', '.MOV'];
  for (const ext of exts) {
    const candidate = path.join(dayDir, clip + ext);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

async function executeCut(clip, selectedIndices) {
  const wordsPath = path.join(BATCH_DIR, clip, '1_subtitles_words.json');
  if (!fs.existsSync(wordsPath)) {
    return { ok: false, error: `No data for clip ${clip}` };
  }

  const words = JSON.parse(fs.readFileSync(wordsPath, 'utf-8'));
  const keepRanges = buildKeepRanges(words, selectedIndices);
  if (keepRanges.length === 0) {
    return { ok: false, error: 'Nothing to keep — all segments selected for deletion' };
  }
  const filterGraph = buildTrimConcatFilter(keepRanges);

  const sourceVideo = findSourceVideo(clip);
  if (!sourceVideo) {
    const cutDir = path.join(BATCH_DIR, 'cut_output');
    fs.mkdirSync(cutDir, { recursive: true });
    const selectionPath = path.join(cutDir, `${clip}_selection.json`);
    fs.writeFileSync(selectionPath, JSON.stringify({
      clip,
      selected: selectedIndices,
      keepRanges,
      note: 'Source video not found. Run FFmpeg manually with this filter.',
    }, null, 2));
    return {
      ok: false,
      error: `Source video not found for ${clip}. Selection saved to ${selectionPath}`,
    };
  }

  const cutDir = path.join(BATCH_DIR, 'cut_output');
  fs.mkdirSync(cutDir, { recursive: true });
  const outputPath = path.join(cutDir, `${clip}_cut.mp4`);

  const ffmpegArgs = [
    '-i', sourceVideo,
    '-filter_complex', filterGraph,
    '-map', '[outv]', '-map', '[outa]',
    '-c:v', 'libx264', '-crf', '18', '-preset', 'fast',
    '-c:a', 'aac', '-b:a', '192k',
    '-y', outputPath,
  ];

  console.log(`Cutting ${clip}...`);
  console.log('ffmpeg', ffmpegArgs.join(' '));

  try {
    execFileSync('ffmpeg', ffmpegArgs, { stdio: 'pipe', timeout: 600000 });
    const sizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1);
    console.log(`✅ ${clip} → ${outputPath} (${sizeMB} MB)`);
    return { ok: true, output: outputPath, size: sizeMB + ' MB' };
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString().slice(-500) : e.message;
    console.error(`❌ ${clip}: ${stderr}`);
    return { ok: false, error: stderr };
  }
}

// --- HTTP Server ---
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsed.pathname);

  // CORS headers for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // GET / → dashboard.html
    if (req.method === 'GET' && pathname === '/') {
      sendFile(res, path.join(BATCH_DIR, 'dashboard.html'));
      return;
    }

    // GET /data/:clip/:file → clip data files
    const dataMatch = pathname.match(/^\/data\/([^/]+)\/(.+)$/);
    if (req.method === 'GET' && dataMatch) {
      const [, clip, file] = dataMatch;
      sendFile(res, path.join(BATCH_DIR, clip, file));
      return;
    }

    // GET /audio/:filename → audio from storyboard transcripts
    const audioMatch = pathname.match(/^\/audio\/(.+)$/);
    if (req.method === 'GET' && audioMatch) {
      sendFile(res, path.join(AUDIO_DIR, audioMatch[1]));
      return;
    }

    // POST /cut/:clip → cut single clip
    const cutMatch = pathname.match(/^\/cut\/([^/]+)$/);
    if (req.method === 'POST' && cutMatch) {
      const clip = cutMatch[1];
      const body = await readBody(req);
      const result = await executeCut(clip, body.selected || []);
      res.writeHead(result.ok ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    // POST /cut-all → cut all clips
    if (req.method === 'POST' && pathname === '/cut-all') {
      const body = await readBody(req);
      const results = {};
      let allOk = true;
      for (const [clip, selected] of Object.entries(body)) {
        results[clip] = await executeCut(clip, selected);
        if (!results[clip].ok) allOk = false;
      }
      res.writeHead(allOk ? 200 : 207, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: allOk, results }));
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));

  } catch (e) {
    console.error('Server error:', e);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(parseInt(PORT), () => {
  console.log(`\n🎬 Rough Cut Review Server`);
  console.log(`   Batch:  ${path.resolve(BATCH_DIR)}`);
  console.log(`   Audio:  ${path.resolve(AUDIO_DIR)}`);
  if (VLOGS_DIR) console.log(`   Vlogs:  ${path.resolve(VLOGS_DIR)}`);
  else console.log(`   Vlogs:  not set (cuts will save selection only)`);
  console.log(`\n   → http://localhost:${PORT}\n`);
});
