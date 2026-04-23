#!/usr/bin/env node
/**
 * Review server for footage classification.
 *
 * Serves the classification review UI with video preview.
 * Reads classify_result.json, lets user override A-Roll/B-Roll tags,
 * and exports the final classification.
 *
 * Usage:
 *   node classify_review_server.js <classify_result.json> [port]
 *
 * Example:
 *   node classify_review_server.js "/Volumes/SSD/012/Media/Vlogs/classify_result.json"
 *   node classify_review_server.js "/Volumes/SSD/012/Media/Vlogs/classify_result.json" 8877
 *
 * Routes:
 *   GET  /                → review UI (generated from template + data)
 *   GET  /video/:file     → serve video file for preview
 *   GET  /api/overrides   → get saved overrides
 *   POST /api/save        → save classification overrides
 *   POST /api/export      → export final A-Roll / B-Roll file lists
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// ── Args ──
const RESULT_FILE = process.argv[2];
const PORT = parseInt(process.argv[3]) || 8877;

if (!RESULT_FILE) {
  console.error('Usage: node classify_review_server.js <classify_result.json> [port]');
  console.error('');
  console.error('Example:');
  console.error('  node classify_review_server.js /Volumes/SSD/Vlogs/classify_result.json');
  process.exit(1);
}

const resultPath = path.resolve(RESULT_FILE);
if (!fs.existsSync(resultPath)) {
  console.error(`❌ File not found: ${resultPath}`);
  process.exit(1);
}

// ── Load data ──
const classifyData = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
const vlogs_dir = classifyData.folder; // the folder containing the clips

// Strip the full word-level data from what we send to the browser
// (the UI only needs file, duration, speech_density, classification, snippet, word_count)
const browserClips = classifyData.clips.map(c => ({
  file: c.file,
  duration: c.duration || 0,
  speech_density: c.speech_density || 0,
  classification: c.classification || 'review',
  snippet: c.snippet || '',
  word_count: c.word_count || 0,
}));

const browserData = {
  folder: classifyData.folder,
  language: classifyData.language,
  thresholds: classifyData.thresholds,
  clips: browserClips,
};

// ── Build the review HTML ──
const templatePath = path.join(__dirname, '..', 'templates', 'classify-review-template.html');
if (!fs.existsSync(templatePath)) {
  console.error(`❌ Template not found: ${templatePath}`);
  console.error('   Expected at: vlog-asset-manager/templates/classify-review-template.html');
  process.exit(1);
}

const template = fs.readFileSync(templatePath, 'utf-8');
const dataScript = `var CLASSIFY_DATA = ${JSON.stringify(browserData)};`;
const reviewHtml = template.replace('/*__CLASSIFY_DATA__*/', dataScript);

// ── Overrides file (persists user corrections) ──
const overridesPath = path.join(path.dirname(resultPath), 'classify_overrides.json');

// ── MIME types ──
const MIME_TYPES = {
  '.html': 'text/html',
  '.json': 'application/json',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.m4v': 'video/x-m4v',
};

// ── Helpers ──
function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
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
 * Resolve a clip file path to an absolute path.
 * Clips can be:
 *   - "D1/D1-01.mov"  (relative to vlogs_dir)
 *   - "D1-01.mov"     (flat in vlogs_dir)
 */
function resolveClipPath(file) {
  // Try as-is relative to vlogs_dir
  const direct = path.join(vlogs_dir, file);
  if (fs.existsSync(direct)) return direct;

  // Try just the filename in vlogs_dir root
  const basename = path.basename(file);
  const flat = path.join(vlogs_dir, basename);
  if (fs.existsSync(flat)) return flat;

  // Try in day subfolder
  const dayMatch = basename.match(/^D(\d+)/i);
  if (dayMatch) {
    const dayDir = path.join(vlogs_dir, 'D' + dayMatch[1]);
    const inDay = path.join(dayDir, basename);
    if (fs.existsSync(inDay)) return inDay;
  }

  // Try alternate extensions
  const exts = ['.mov', '.mp4', '.MOV', '.MP4', '.avi', '.mkv', '.m4v'];
  const base = direct.replace(/\.[^.]+$/, '');
  for (const ext of exts) {
    const alt = base + ext;
    if (fs.existsSync(alt)) return alt;
  }

  return null;
}

function sendFile(res, filePath, req) {
  if (!filePath || !fs.existsSync(filePath)) {
    sendJson(res, 404, { error: 'File not found' });
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;

  // Range requests for video seeking
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

// ── Server ──
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsed.pathname);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // GET / → review UI
    if (req.method === 'GET' && pathname === '/') {
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Content-Length': Buffer.byteLength(reviewHtml),
      });
      res.end(reviewHtml);
      return;
    }

    // GET /video/:file → serve video for preview
    const videoMatch = pathname.match(/^\/video\/(.+)$/);
    if (req.method === 'GET' && videoMatch) {
      const file = videoMatch[1];
      const resolved = resolveClipPath(file);
      sendFile(res, resolved, req);
      return;
    }

    // GET /api/overrides → return saved overrides
    if (req.method === 'GET' && pathname === '/api/overrides') {
      if (fs.existsSync(overridesPath)) {
        const data = JSON.parse(fs.readFileSync(overridesPath, 'utf-8'));
        sendJson(res, 200, data);
      } else {
        sendJson(res, 200, { overrides: [] });
      }
      return;
    }

    // POST /api/save → save overrides
    if (req.method === 'POST' && pathname === '/api/save') {
      const body = await readBody(req);
      fs.writeFileSync(overridesPath, JSON.stringify(body, null, 2));
      const count = body.overrides ? body.overrides.length : 0;
      console.log(`💾 Saved ${count} classifications to ${overridesPath}`);
      sendJson(res, 200, { ok: true, count });
      return;
    }

    // POST /api/export → write final classification lists
    if (req.method === 'POST' && pathname === '/api/export') {
      // Merge AI classifications with any saved overrides
      let overrides = {};
      if (fs.existsSync(overridesPath)) {
        const saved = JSON.parse(fs.readFileSync(overridesPath, 'utf-8'));
        if (saved.overrides) {
          saved.overrides.forEach(o => { overrides[o.file] = o; });
        }
      }

      const aRolls = [];
      const bRolls = [];
      const unresolved = [];

      classifyData.clips.forEach(clip => {
        const override = overrides[clip.file];
        const finalClass = (override && override.final_classification) || clip.classification;

        const entry = {
          file: clip.file,
          path: clip.path,
          duration: clip.duration,
          speech_density: clip.speech_density,
          ai_classification: clip.classification,
          final_classification: finalClass,
        };

        if (finalClass === 'a-roll') aRolls.push(entry);
        else if (finalClass === 'b-roll') bRolls.push(entry);
        else unresolved.push(entry);
      });

      const exportData = {
        folder: classifyData.folder,
        exported_at: new Date().toISOString(),
        a_rolls: aRolls,
        b_rolls: bRolls,
        unresolved: unresolved,
        summary: {
          total: classifyData.clips.length,
          a_roll_count: aRolls.length,
          b_roll_count: bRolls.length,
          unresolved_count: unresolved.length,
          a_roll_duration: aRolls.reduce((s, c) => s + (c.duration || 0), 0),
          b_roll_duration: bRolls.reduce((s, c) => s + (c.duration || 0), 0),
        },
      };

      const exportPath = path.join(path.dirname(resultPath), 'classify_export.json');
      fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));

      console.log(`📤 Exported: ${aRolls.length} A-Roll, ${bRolls.length} B-Roll, ${unresolved.length} unresolved`);
      console.log(`   → ${exportPath}`);

      sendJson(res, 200, {
        ok: true,
        output: exportPath,
        a_roll_count: aRolls.length,
        b_roll_count: bRolls.length,
        unresolved_count: unresolved.length,
      });
      return;
    }

    // 404
    sendJson(res, 404, { error: 'Not found' });

  } catch (e) {
    console.error('Server error:', e);
    sendJson(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => {
  const clipCount = classifyData.clips.length;
  const reviewCount = classifyData.clips.filter(c => c.classification === 'review').length;

  console.log('');
  console.log('🎬 Classification Review Server');
  console.log(`   Data:   ${resultPath}`);
  console.log(`   Vlogs:  ${vlogs_dir}`);
  console.log(`   Clips:  ${clipCount} total, ${reviewCount} need review`);
  console.log('');
  console.log(`   → http://localhost:${PORT}`);
  console.log('');
});
