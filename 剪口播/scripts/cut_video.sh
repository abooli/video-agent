#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
#
# 根据删除列表剪辑视频（filter_complex 精确剪辑）
#
# 用法: ./cut_video.sh <input.mp4> <delete_segments.json> [output.mp4]
#

INPUT="$1"
DELETE_JSON="$2"
OUTPUT="${3:-output_cut.mp4}"

if [ -z "$INPUT" ] || [ -z "$DELETE_JSON" ]; then
  echo "❌ 用法: ./cut_video.sh <input.mp4> <delete_segments.json> [output.mp4]"
  exit 1
fi

if [ ! -f "$INPUT" ]; then
  echo "❌ 找不到输入文件: $INPUT"
  exit 1
fi

if [ ! -f "$DELETE_JSON" ]; then
  echo "❌ 找不到删除列表: $DELETE_JSON"
  exit 1
fi

# 获取视频时长（file: 前缀处理文件名含冒号的情况）
DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "file:$INPUT")
echo "📹 视频时长: ${DURATION}s"

# 配置参数
BUFFER_MS=50      # 删除范围前后各扩展 50ms（吃掉气口）
CROSSFADE_MS=30   # 音频淡入淡出 30ms

echo "⚙️ 优化参数: 扩展范围=${BUFFER_MS}ms, 音频crossfade=${CROSSFADE_MS}ms"

# 用 node 生成 filter_complex 命令
FILTER_CMD=$(node -e "
const fs = require('fs');
const deleteSegs = JSON.parse(fs.readFileSync('$DELETE_JSON', 'utf8'));
const duration = $DURATION;
const bufferSec = $BUFFER_MS / 1000;
const crossfadeSec = $CROSSFADE_MS / 1000;

// 按开始时间排序
deleteSegs.sort((a, b) => a.start - b.start);

// 扩展删除范围（前后各加 buffer）
const expandedSegs = deleteSegs.map(seg => ({
  start: Math.max(0, seg.start - bufferSec),
  end: Math.min(duration, seg.end + bufferSec)
}));

// 合并重叠的删除段
const mergedSegs = [];
for (const seg of expandedSegs) {
  if (mergedSegs.length === 0 || seg.start > mergedSegs[mergedSegs.length - 1].end) {
    mergedSegs.push({ ...seg });
  } else {
    mergedSegs[mergedSegs.length - 1].end = Math.max(mergedSegs[mergedSegs.length - 1].end, seg.end);
  }
}

// 计算保留片段
const keepSegs = [];
let cursor = 0;

for (const del of mergedSegs) {
  if (del.start > cursor) {
    keepSegs.push({ start: cursor, end: del.start });
  }
  cursor = del.end;
}

if (cursor < duration) {
  keepSegs.push({ start: cursor, end: duration });
}

console.error('保留片段数:', keepSegs.length);
console.error('删除片段数:', mergedSegs.length);

let deletedTime = 0;
for (const seg of mergedSegs) {
  deletedTime += seg.end - seg.start;
}
console.error('删除总时长:', deletedTime.toFixed(2) + 's');

// 生成 filter_complex（视频 xfade + 音频 acrossfade，时长一致保持音画同步）
let filters = [];

for (let i = 0; i < keepSegs.length; i++) {
  const seg = keepSegs[i];
  filters.push('[0:v]trim=start=' + seg.start.toFixed(3) + ':end=' + seg.end.toFixed(3) + ',setpts=PTS-STARTPTS[v' + i + ']');
  filters.push('[0:a]atrim=start=' + seg.start.toFixed(3) + ':end=' + seg.end.toFixed(3) + ',asetpts=PTS-STARTPTS[a' + i + ']');
}

if (keepSegs.length === 1) {
  filters.push('[v0]null[outv]');
  filters.push('[a0]anull[outa]');
} else {
  // 视频：xfade（与 acrossfade 时长一致，两者每个接缝均减少相同时间，保持同步）
  let currentVLabel = 'v0';
  let vOffset = 0;
  for (let i = 1; i < keepSegs.length; i++) {
    vOffset += (keepSegs[i-1].end - keepSegs[i-1].start) - crossfadeSec;
    const outLabel = (i === keepSegs.length - 1) ? 'outv' : 'vx' + i;
    filters.push('[' + currentVLabel + '][v' + i + ']xfade=transition=fade:duration=' + crossfadeSec.toFixed(3) + ':offset=' + vOffset.toFixed(3) + '[' + outLabel + ']');
    currentVLabel = outLabel;
  }

  // 音频：acrossfade
  let currentALabel = 'a0';
  for (let i = 1; i < keepSegs.length; i++) {
    const outLabel = (i === keepSegs.length - 1) ? 'outa' : 'amid' + i;
    filters.push('[' + currentALabel + '][a' + i + ']acrossfade=d=' + crossfadeSec.toFixed(3) + ':c1=tri:c2=tri[' + outLabel + ']');
    currentALabel = outLabel;
  }
}

console.log(filters.join(';'));
")

if [ -z "$FILTER_CMD" ]; then
  echo "❌ 生成滤镜命令失败"
  exit 1
fi

echo ""
echo "✂️ 执行 FFmpeg 精确剪辑..."

ffmpeg -y -i "file:$INPUT" \
  -filter_complex "$FILTER_CMD" \
  -map "[outv]" -map "[outa]" \
  -c:v libx264 -preset fast -crf 18 \
  -c:a aac -b:a 192k \
  "file:$OUTPUT"

if [ $? -eq 0 ]; then
  echo "✅ 已保存: $OUTPUT"

  NEW_DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "file:$OUTPUT")
  echo "📹 新时长: ${NEW_DURATION}s"
else
  echo "❌ 剪辑失败"
  exit 1
fi
