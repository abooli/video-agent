---
name: videocut:字幕
description: 字幕生成与烧录。WhisperX本地转录→词典纠错→审核→烧录。触发词：加字幕、生成字幕、字幕
---

<!--
input: 视频文件
output: 带字幕视频
pos: 后置 skill，剪辑完成后调用
-->

# 字幕

> 转录 → Agent校对 → 人工审核 → 烧录

## 核心流程（总计约 10-20 分钟，含人工审核）

```
1. 提取音频                       ⏱ ~30s
    ↓
2. WhisperX 本地转录（带词典）     ⏱ ~3-8min（CPU），~1-2min（GPU）
    ↓
3. Agent 自动校对                  ⏱ ~3-5min
    ↓
4. 人工审核确认                    ⏱ 取决于用户
    ↓
5. 烧录字幕                        ⏱ ~1-2min
```

---

## Step 1: 提取音频

```bash
# 提取音频（WhisperX 直接读本地文件，无需上传）
ffmpeg -i "video.mp4" -vn -acodec libmp3lame -y audio.mp3
```

---

## Step 2: WhisperX 本地转录（带词典提示）

转录脚本会**自动读取词典**作为 initial_prompt，提高专业词汇识别率：

```bash
# 词典位置: ~/.claude/skills/videocut/字幕/词典.txt
SKILL_DIR="~/.claude/skills/videocut"
DICT_FILE="$SKILL_DIR/字幕/词典.txt"

python "$SKILL_DIR/剪口播/scripts/whisperx_transcribe.py" audio.mp3 auto "$DICT_FILE"
# 输出: whisperx_result.json
# language 参数: "en" 英语 | "zh" 中文 | "auto" 自动检测
```

**词典格式**（每行一个词）：
```
Claude Code
MCP
API
skills
```

---

## Step 3: Agent 自动校对

### 3.1 生成带时间戳的字幕

```javascript
// WhisperX 格式: segments[].text/start/end，时间单位已是秒
const result = JSON.parse(fs.readFileSync('whisperx_result.json'));
const subtitles = result.segments.map((s, i) => ({
  id: i + 1,
  text: s.text.trim(),
  start: s.start,
  end: s.end
}));
fs.writeFileSync('subtitles_with_time.json', JSON.stringify(subtitles, null, 2));
```

### 3.2 Agent 手动校对（不用脚本）

**转录后，Agent 必须逐条阅读全部字幕，手动校对以下问题：**

#### 常见误识别规则表

| 误识别 | 正确 | 类型 |
|--------|------|------|
| 成风 | 成峰 | 同音字 |
| 正特/整特 | Agent | 误识别 |
| IT就 | Agent就 | 发音相似 |
| edge的叉100 | Agentx100 | 误识别 |
| cloud code | Claude Code | 发音相似 |
| Schill/skill | skills | 发音相似 |
| 剪口拨/剪口波 | 剪口播 | 同音字 |
| 自净化/资金化 | 自进化 | 同音字 |
| 减口播 | 剪口播 | 同音字 |
| 录剪 | 漏剪 | 同音字 |
| 作为这个 | 做这个 | 同音字 |
| 斜杠V1/斜杠v | /v | 口语描述 |
| 斜杠v点口拨 | /v.口播 | 口语+同音 |
| a p i t/APIK | API Key | 误识别 |
| excuse | skills | 误识别 |
| 移完了 | 剪完了 | 同音字 |

#### 常见漏字问题

| 原文 | 修正 | 说明 |
|------|------|------|
| 步呢是配置 | 第二步呢是配置 | 漏"第二" |
| 4步就是 | 第4步就是 | 漏"第" |
| 别省时间 | 特别省时间 | 漏"特" |
| 这个我们的 | 这个是我们的 | 漏"是" |
| 在里面看到 | 可以在里面看到 | 漏"可以" |
| 跟大家处理完 | 跟大家讲完 | 用词不当 |
| 剪辑了逻辑 | 剪辑的逻辑 | 语法错误 |

### 3.3 对照原稿校对（如有原稿）

如果有原稿/脚本，可以辅助校对，但**不要用脚本自动匹配**（文字差异会导致时间戳累积错误）。

Agent 应：
1. 读取原稿作为参考
2. 手动逐条对比，发现差异时修正
3. 不确定的地方标记，留给人工审核

---

## Step 4: 启动审核服务器

```bash
cd 字幕目录/
node /path/to/skills/字幕/scripts/subtitle_server.js 8898 "video.mp4"
```

访问 http://localhost:8898

**功能：**
- 左侧视频播放，右侧字幕列表
- 播放时自动高亮当前字幕
- 双击字幕文字编辑（时间戳不变）
- 倍速播放（1x/1.5x/2x/3x）
- 保存字幕 / 导出 SRT / 烧录字幕
- 底部显示词典快捷插入

---

## Step 5: 烧录字幕

**默认样式：22号金黄粗体、黑色描边2px、底部居中**

```bash
ffmpeg -i "video.mp4" \
  -vf "subtitles='video.srt':force_style='FontSize=22,FontName=PingFang SC,Bold=1,PrimaryColour=&H0000deff,OutlineColour=&H00000000,Outline=2,Alignment=2,MarginV=30'" \
  -c:a copy \
  -y "video_字幕.mp4"
```

| 参数 | 值 | 说明 |
|------|------|------|
| FontSize | 22 | 字体大小 |
| FontName | PingFang SC | 苹方字体 |
| Bold | 1 | 粗体 |
| PrimaryColour | &H0000deff | 金黄色 #ffde00 |
| OutlineColour | &H00000000 | 黑色描边 |
| Outline | 2 | 描边宽度 |
| Alignment | 2 | 底部居中 |
| MarginV | 30 | 底部边距 |

---

## 目录结构

```
output/YYYY-MM-DD_视频名/字幕/
├── 1_转录/
│   ├── audio.mp3
│   └── volcengine_result.json
├── subtitles_with_time.json    # 核心文件
└── 3_输出/
    ├── video.srt
    └── video_字幕.mp4
```

---

## 字幕规范

| 规则 | 说明 |
|------|------|
| 一屏一行 | 不换行，不堆叠 |
| 句尾无标点 | `你好` 不是 `你好。` |
| 句中保留标点 | `先点这里，再点那里` |

---

## 反馈记录

### 2026-01-31
- 火山引擎支持热词，已集成到转录脚本
- Agent 转录后需要自动校对，不能直接交给用户
- 字幕样式：金黄粗体 #ffde00，描边 2px
- IT 常被误识别为 Agent，需加入纠错规则
- **重要**：Agent 校对必须手动逐条阅读，不能用脚本自动匹配
- 新增 17 条常见误识别规则（详见 3.2 节）
- 漏字问题比误识别更难发现，需要特别注意
