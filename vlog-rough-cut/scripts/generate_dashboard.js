#!/usr/bin/env node
/**
 * Generate a tabbed review dashboard for a batch of clips.
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

function generateHTML(clips, batchName) {
  const tabButtons = clips.map((clip, i) =>
    `<button class="tab-btn${i === 0 ? ' active' : ''}" data-clip="${clip}">${clip}</button>`
  ).join('\n          ');

  const tabPanels = clips.map((clip, i) =>
    `<div class="tab-panel${i === 0 ? ' active' : ''}" id="panel-${clip}">
            <h2>${clip}</h2>
            <div class="audio-controls">
              <audio id="audio-${clip}" preload="auto"></audio>
              <button class="play-all-btn" data-clip="${clip}">▶ Play All</button>
              <span class="status" id="status-${clip}">Loading...</span>
            </div>
            <div class="segments" id="segments-${clip}"></div>
            <div class="actions">
              <button class="cut-btn" data-clip="${clip}">✂️ Execute Cut</button>
            </div>
          </div>`
  ).join('\n          ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rough Cut Review — ${batchName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #1a1a2e; color: #e0e0e0; }
    .container { display: flex; height: 100vh; }

    /* Sidebar */
    .sidebar { width: 200px; background: #16213e; padding: 16px; border-right: 1px solid #333; flex-shrink: 0; }
    .sidebar h1 { font-size: 14px; color: #888; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 1px; }
    .tab-btn {
      display: block; width: 100%; padding: 10px 12px; margin-bottom: 4px;
      background: transparent; border: 1px solid transparent; border-radius: 6px;
      color: #ccc; font-size: 14px; cursor: pointer; text-align: left;
    }
    .tab-btn:hover { background: #1a1a3e; }
    .tab-btn.active { background: #0f3460; border-color: #4a9eff; color: #fff; }
    .cut-all-btn {
      margin-top: 16px; width: 100%; padding: 10px; background: #e94560; color: #fff;
      border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;
    }
    .cut-all-btn:hover { background: #c73e54; }

    /* Main panel */
    .main { flex: 1; overflow-y: auto; padding: 24px; }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }
    .tab-panel h2 { font-size: 20px; margin-bottom: 16px; }

    /* Audio controls */
    .audio-controls { margin-bottom: 16px; display: flex; align-items: center; gap: 12px; }
    .play-all-btn { padding: 6px 16px; background: #0f3460; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
    .status { font-size: 13px; color: #888; }

    /* Segments */
    .segment {
      display: flex; align-items: center; padding: 8px 12px; margin-bottom: 2px;
      border-radius: 4px; font-size: 13px; font-family: 'SF Mono', 'Consolas', monospace;
    }
    .segment:hover { background: #1a1a3e; }
    .segment.selected { background: #3d1f1f; }
    .segment.silence { color: #888; }
    .segment input[type="checkbox"] { margin-right: 10px; flex-shrink: 0; }
    .segment .idx { width: 50px; color: #666; flex-shrink: 0; }
    .segment .time { width: 120px; color: #4a9eff; flex-shrink: 0; }
    .segment .content { flex: 1; }
    .segment .play-btn {
      padding: 2px 8px; background: #333; border: 1px solid #555; border-radius: 3px;
      color: #ccc; cursor: pointer; font-size: 11px; margin-left: 8px; flex-shrink: 0;
    }
    .segment .play-btn:hover { background: #444; }

    /* Actions */
    .actions { margin-top: 20px; padding-top: 16px; border-top: 1px solid #333; }
    .cut-btn {
      padding: 10px 24px; background: #e94560; color: #fff; border: none;
      border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;
    }
    .cut-btn:hover { background: #c73e54; }
    .cut-btn:disabled { background: #555; cursor: not-allowed; }

    /* Toast */
    .toast {
      position: fixed; bottom: 20px; right: 20px; padding: 12px 20px;
      background: #0f3460; color: #fff; border-radius: 6px; font-size: 14px;
      display: none; z-index: 100;
    }
    .toast.error { background: #e94560; }
    .toast.show { display: block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="sidebar">
      <h1>${batchName}</h1>
      <nav>
        ${tabButtons}
      </nav>
      <button class="cut-all-btn" id="cut-all-btn">✂️ Cut All</button>
    </div>
    <div class="main">
      ${tabPanels}
    </div>
  </div>
  <div class="toast" id="toast"></div>

  <script>
    const CLIPS = ${JSON.stringify(clips)};
    const clipData = {};

    // --- Tab switching ---
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('panel-' + btn.dataset.clip).classList.add('active');
      });
    });

    // --- Toast ---
    function showToast(msg, isError) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.className = 'toast show' + (isError ? ' error' : '');
      setTimeout(() => t.className = 'toast', 3000);
    }

    // --- Load clip data ---
    async function loadClip(clip) {
      try {
        const [wordsRes, selectedRes] = await Promise.all([
          fetch('/data/' + clip + '/1_subtitles_words.json'),
          fetch('/data/' + clip + '/4_auto_selected.json'),
        ]);
        const words = await wordsRes.json();
        const selected = new Set(await selectedRes.json());
        clipData[clip] = { words, selected };
        renderSegments(clip);
        document.getElementById('status-' + clip).textContent =
          words.length + ' segments, ' + selected.size + ' pre-selected';

        // Set audio source
        document.getElementById('audio-' + clip).src = '/audio/' + clip + '_audio.mp3';
      } catch (e) {
        document.getElementById('status-' + clip).textContent = 'Error loading: ' + e.message;
      }
    }

    // --- Render segments ---
    function renderSegments(clip) {
      const { words, selected } = clipData[clip];
      const container = document.getElementById('segments-' + clip);
      container.innerHTML = '';

      words.forEach((w, i) => {
        // Skip very short gaps (< 0.5s) that aren't in the readable format
        if (w.isGap && (w.end - w.start) < 0.5 && !selected.has(i)) return;

        const div = document.createElement('div');
        div.className = 'segment' + (selected.has(i) ? ' selected' : '') + (w.isGap ? ' silence' : '');

        const isChecked = selected.has(i) ? 'checked' : '';
        const dur = (w.end - w.start).toFixed(2);
        const content = w.isGap ? '[silence ' + dur + 's]' : w.text;
        const timeStr = w.start.toFixed(2) + '-' + w.end.toFixed(2);

        div.innerHTML =
          '<input type="checkbox" ' + isChecked + ' data-idx="' + i + '" data-clip="' + clip + '">' +
          '<span class="idx">' + i + '</span>' +
          '<span class="time">' + timeStr + '</span>' +
          '<span class="content">' + content + '</span>' +
          '<button class="play-btn" data-start="' + w.start + '" data-end="' + w.end + '" data-clip="' + clip + '">▶</button>';

        container.appendChild(div);
      });

      // Checkbox toggle
      container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => {
          const idx = parseInt(cb.dataset.idx);
          if (cb.checked) clipData[clip].selected.add(idx);
          else clipData[clip].selected.delete(idx);
          cb.closest('.segment').classList.toggle('selected', cb.checked);
        });
      });

      // Play buttons
      container.querySelectorAll('.play-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const audio = document.getElementById('audio-' + btn.dataset.clip);
          audio.currentTime = parseFloat(btn.dataset.start);
          audio.play();
          const endTime = parseFloat(btn.dataset.end);
          const checkEnd = () => {
            if (audio.currentTime >= endTime) { audio.pause(); }
            else requestAnimationFrame(checkEnd);
          };
          checkEnd();
        });
      });
    }

    // --- Play all (unselected segments) ---
    document.querySelectorAll('.play-all-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const clip = btn.dataset.clip;
        const audio = document.getElementById('audio-' + clip);
        audio.currentTime = 0;
        audio.play();
      });
    });

    // --- Execute Cut (per clip) ---
    document.querySelectorAll('.cut-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const clip = btn.dataset.clip;
        const selected = Array.from(clipData[clip].selected).sort((a, b) => a - b);
        btn.disabled = true;
        btn.textContent = '⏳ Cutting...';
        try {
          const res = await fetch('/cut/' + clip, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selected }),
          });
          const result = await res.json();
          if (result.ok) showToast('✅ ' + clip + ' cut complete!');
          else showToast('❌ ' + (result.error || 'Cut failed'), true);
        } catch (e) {
          showToast('❌ ' + e.message, true);
        }
        btn.disabled = false;
        btn.textContent = '✂️ Execute Cut';
      });
    });

    // --- Cut All ---
    document.getElementById('cut-all-btn').addEventListener('click', async () => {
      const btn = document.getElementById('cut-all-btn');
      btn.disabled = true;
      btn.textContent = '⏳ Cutting all...';
      try {
        const payload = {};
        CLIPS.forEach(clip => {
          payload[clip] = Array.from(clipData[clip].selected).sort((a, b) => a - b);
        });
        const res = await fetch('/cut-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await res.json();
        if (result.ok) showToast('✅ All clips cut!');
        else showToast('❌ ' + (result.error || 'Cut failed'), true);
      } catch (e) {
        showToast('❌ ' + e.message, true);
      }
      btn.disabled = false;
      btn.textContent = '✂️ Cut All';
    });

    // --- Init ---
    CLIPS.forEach(loadClip);
  </script>
</body>
</html>`;
}

function main() {
  const args = parseArgs();
  const batchName = path.basename(args.batchDir);

  // Verify clip data exists
  for (const clip of args.clips) {
    const wordsFile = path.join(args.batchDir, clip, '1_subtitles_words.json');
    const selectedFile = path.join(args.batchDir, clip, '4_auto_selected.json');
    if (!fs.existsSync(wordsFile)) {
      console.error(`Missing: ${wordsFile}`);
      process.exit(1);
    }
    if (!fs.existsSync(selectedFile)) {
      console.error(`Missing: ${selectedFile}`);
      process.exit(1);
    }

    const audioFile = path.join(args.audioDir, `${clip}_audio.mp3`);
    if (!fs.existsSync(audioFile)) {
      console.warn(`Warning: audio not found at ${audioFile}`);
    }
  }

  const html = generateHTML(args.clips, batchName);
  const outPath = path.join(args.batchDir, 'dashboard.html');
  fs.writeFileSync(outPath, html);
  console.log(`Dashboard generated: ${outPath}`);
  console.log(`Clips: ${args.clips.join(', ')}`);
}

main();
