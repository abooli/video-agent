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
