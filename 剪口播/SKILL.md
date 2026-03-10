---
name: rough-cut
description: A rough cut Agent that uses Deepgram as a transcription service to identify pauses, blanks, and wrong takes in a raw video file. Trigger words: rough cut.
---

<!--
input: 视频文件 (*.mp4)
output: subtitles_words.json、auto_selected.json、review.html
pos: 转录+识别，到用户网页审核为止

架构守护者：一旦我被修改，请同步更新：
1. ../README.md 的 Skill 清单
2. /CLAUDE.md 路由表
-->

# 剪口播 (Deepgram)

> Deepgram nova-2 云端转录 + AI 口误识别 + 网页审核

## 前提

```bash
export DEEPGRAM_API_KEY=your_key_here
pip install requests
```

## 输出目录结构

```
output/
└── YYYY-MM-DD_视频名/
    ├── 剪口播/
    │   ├── 1_转录/
    │   │   ├── audio.mp3
    │   │   ├── deepgram_result.json
    │   │   └── subtitles_words.json
    │   ├── 2_分析/
    │   │   ├── readable.txt
    │   │   ├── auto_selected.json
    │   │   └── 口误分析.md
    │   └── 3_审核/
    │       └── review.html
    └── 字幕/
        └── ...
```

**规则**：已有文件夹则复用，否则新建。

## 流程

```
0. 创建输出目录
    ↓
1. 提取音频 (ffmpeg)
    ↓
2. Deepgram API 转录（~15-30秒，含上传）
    ↓
3. 生成字级别字幕 (subtitles_words.json)
    ↓
4. AI 分析口误/静音，生成预选列表 (auto_selected.json)
    ↓
5. 生成审核网页 (review.html)
    ↓
6. 启动审核服务器，用户网页确认
    ↓
【等待用户确认】→ 网页点击「执行剪辑」或手动 /剪辑
```

## 执行步骤

### 步骤 0: 创建输出目录

```bash
VIDEO_PATH="/path/to/视频.mp4"
VIDEO_NAME=$(basename "$VIDEO_PATH" .mp4)
DATE=$(date +%Y-%m-%d)
BASE_DIR="output/${DATE}_${VIDEO_NAME}/剪口播"
mkdir -p "$BASE_DIR/1_转录" "$BASE_DIR/2_分析" "$BASE_DIR/3_审核"
```

### 步骤 1-2: 提取音频 + Deepgram 转录

```bash
cd "$BASE_DIR/1_转录"

# 1. 提取音频
ffmpeg -i "file:$VIDEO_PATH" -vn -acodec libmp3lame -y audio.mp3

# 2. Deepgram 转录（输出与 WhisperX 格式兼容）
SKILL_DIR="$HOME/.claude/skills/剪口播-deepgram"
python "$SKILL_DIR/scripts/deepgram_transcribe.py" audio.mp3 en
# 输出: whisperx_result.json
```

### 步骤 3-5: 分析 + 审核

**完全与「剪口播」skill 相同** — 从步骤 4 开始照搬执行：

- 步骤 3: 生成 readable.txt + sentences.txt，读取用户习惯，AI 分析口误
- 步骤 4: `generate_review.js` 生成 review.html
- 步骤 5: `review_server.js` 启动审核服务器

用户习惯规则路径: `$HOME/.claude/skills/剪口播/用户习惯/`
其余脚本路径: `$HOME/.claude/skills/剪口播/scripts/`
